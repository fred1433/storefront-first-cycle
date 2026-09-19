// Read the public product pages of one storefront, one request at a time.
//
// What this reads: robots.txt, the public product feed, and product pages.
// What this never reads: an admin area, an account, a cart, a form.
//
// Output:
//   crawl/raw-<date>/           full responses, kept out of the published repository
//   data/snapshot/pages/*.json  the small record each page contributes to the batch
//   data/snapshot/manifest.json what was read, when, with which status and digest
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { politeFetch, parseRobots, robotsAllows, USER_AGENT } from './lib/polite.mjs';
import { extractPage } from './lib/extract.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const config = JSON.parse(await readText(join(here, 'config.json')));

async function readText(path) {
  const { readFile } = await import('node:fs/promises');
  return readFile(path, 'utf8');
}

const rawDir = join(root, 'crawl', `raw-${config.snapshotDate.replace(/-/g, '')}`);
const pagesDir = join(root, 'data', 'snapshot', 'pages');
await mkdir(rawDir, { recursive: true });
await mkdir(pagesDir, { recursive: true });

const origin = config.market.origin;
const digest = (value) => createHash('sha256').update(value).digest('hex');

console.log(`user agent: ${USER_AGENT}`);
const robotsResponse = await politeFetch(`${origin}/robots.txt`);
if (robotsResponse.status !== 200) throw new Error(`robots.txt returned ${robotsResponse.status}`);
await writeFile(join(rawDir, 'robots.txt'), robotsResponse.body);
const robots = parseRobots(robotsResponse.body);
console.log('robots.txt read');

const manifest = {
  storefront: origin,
  market: config.market,
  user_agent: USER_AGENT,
  started_at: new Date().toISOString(),
  requests: [
    {
      url: `${origin}/robots.txt`,
      status: robotsResponse.status,
      bytes: robotsResponse.body.length,
      sha256: digest(robotsResponse.body),
      read_at: new Date().toISOString(),
    },
  ],
};

// The feed is read to resolve the selection, then kept out of the published repository:
// it carries the whole catalogue and the merchant's own working annotations.
const feedPath = '/products.json?limit=250';
if (!robotsAllows(robots, '/products.json')) throw new Error('robots.txt disallows the product feed');
const feed = await politeFetch(`${origin}${feedPath}`);
await writeFile(join(rawDir, 'products.json'), feed.body);
manifest.requests.push({
  url: `${origin}${feedPath}`,
  status: feed.status,
  bytes: feed.body.length,
  sha256: digest(feed.body),
  read_at: new Date().toISOString(),
});
const feedProducts = JSON.parse(feed.body).products;
console.log(`product feed read: ${feedProducts.length} products`);

const selected = feedProducts.filter((product) =>
  (product.tags || []).some((tag) => tag.trim() === config.selection.tag),
);
console.log(`carrying the selection tag: ${selected.length}`);

const planned = [
  ...config.batch.map((handle) => ({ handle, role: 'batch' })),
  ...config.reference.map((handle) => ({ handle, role: 'reference' })),
];

const pages = [];
for (const { handle, role } of planned) {
  const path = `/products/${handle}`;
  if (!robotsAllows(robots, path)) {
    console.log(`skipped (robots.txt): ${path}`);
    continue;
  }
  const url = `${origin}${path}`;
  const response = await politeFetch(url);
  const fetchedAt = new Date().toISOString();
  await writeFile(join(rawDir, `${handle}.html`), response.body);
  manifest.requests.push({
    url,
    status: response.status,
    bytes: response.body.length,
    sha256: digest(response.body),
    read_at: fetchedAt,
  });
  const record = extractPage({
    handle,
    url,
    role,
    market: config.market.code,
    status: response.status,
    finalUrl: response.finalUrl,
    headers: response.headers,
    body: response.body,
    fetchedAt,
  });
  record.raw_sha256 = digest(response.body);
  const feedEntry = feedProducts.find((product) => product.handle === handle);
  record.feed = feedEntry
    ? {
        title: feedEntry.title,
        product_type: feedEntry.product_type,
        image_count: (feedEntry.images || []).length,
        variant_count: (feedEntry.variants || []).length,
        carries_selection_tag: (feedEntry.tags || []).some((tag) => tag.trim() === config.selection.tag),
      }
    : null;
  pages.push(record);
  await writeFile(join(pagesDir, `${handle}.json`), `${JSON.stringify(record, null, 2)}\n`);
  const state = record.reachable
    ? `highlights ${record.highlights.count}, description ${record.description.text.length} chars`
    : `not reachable in the ${config.market.code} market (HTTP ${record.http_status}${record.is_404 ? ', 404 page' : ''})`;
  console.log(`${role.padEnd(9)} ${handle.padEnd(52)} ${state}`);
}

manifest.finished_at = new Date().toISOString();
manifest.page_count = pages.length;
await writeFile(join(root, 'data', 'snapshot', 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`\n${pages.length} pages recorded in data/snapshot/pages`);
