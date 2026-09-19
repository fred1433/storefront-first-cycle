// Re-derive the page records from the stored responses. No network access.
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractPage } from './lib/extract.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const config = JSON.parse(await readFile(join(here, 'config.json'), 'utf8'));
const rawDir = join(root, 'crawl', `raw-${config.snapshotDate.replace(/-/g, '')}`);
const pagesDir = join(root, 'data', 'snapshot', 'pages');
const manifest = JSON.parse(await readFile(join(root, 'data', 'snapshot', 'manifest.json'), 'utf8'));
await mkdir(pagesDir, { recursive: true });

const feed = JSON.parse(await readFile(join(rawDir, 'products.json'), 'utf8')).products;
const planned = [
  ...config.batch.map((handle) => ({ handle, role: 'batch' })),
  ...config.reference.map((handle) => ({ handle, role: 'reference' })),
];

for (const { handle, role } of planned) {
  const url = `${config.market.origin}/products/${handle}`;
  const request = manifest.requests.find((entry) => entry.url === url);
  const body = await readFile(join(rawDir, `${handle}.html`), 'utf8');
  const previous = JSON.parse(await readFile(join(pagesDir, `${handle}.json`), 'utf8'));
  const record = extractPage({
    handle,
    url,
    role,
    market: config.market.code,
    status: previous.http_status,
    finalUrl: previous.final_url,
    headers: { 'content-language': previous.content_language },
    body,
    fetchedAt: request?.read_at || previous.fetched_at,
  });
  record.raw_sha256 = createHash('sha256').update(body).digest('hex');
  record.feed = previous.feed;
  if (previous.rechecks) record.rechecks = previous.rechecks;
  await writeFile(join(pagesDir, `${handle}.json`), `${JSON.stringify(record, null, 2)}\n`);
  console.log(
    `${role.padEnd(9)} ${handle.padEnd(52)} served=${String(record.served_product_page).padEnd(5)} highlights=${String(record.highlights.count).padEnd(2)} badges=${String(record.badges.length).padEnd(2)} components=${String(record.bundle_components.length).padEnd(2)} description=${record.description.text.length}`,
  );
}
