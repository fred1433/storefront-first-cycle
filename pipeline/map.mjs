// Compare each page of the batch with what a page carrying the block looks like,
// and let the status follow from the reading.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decideStatus } from './lib/status.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const config = JSON.parse(await readFile(join(here, 'config.json'), 'utf8'));
const pagesDir = join(root, 'data', 'snapshot', 'pages');

const items = [];
for (const handle of config.batch) {
  const page = JSON.parse(await readFile(join(pagesDir, `${handle}.json`), 'utf8'));
  const decision = decideStatus(page);
  items.push({
    handle,
    url: page.url,
    title: page.heading || page.feed?.title || handle,
    market: config.market.code,
    read_at: page.fetched_at,
    status: decision.status,
    rule: decision.rule,
    reason: decision.reason,
    observations: {
      served_product_page: page.served_product_page,
      http_status: page.http_status,
      rechecks: page.rechecks || [],
      canonical_handle: page.canonical_handle,
      canonical_is_self: page.canonical_is_self,
      block_present: page.highlights.present,
      block_lines: page.highlights.messages,
      panels: page.panels,
      badges: page.badges,
      contents: page.bundle_components,
      description_paragraphs: page.description.paragraphs,
      description_bullets: page.description.bullets,
      specifics: page.specifics,
    },
  });
}

const counts = items.reduce((tally, item) => ({ ...tally, [item.status]: (tally[item.status] || 0) + 1 }), {});
const map = { market: config.market, read_on: config.snapshotDate, counts, items };
await writeFile(join(root, 'data', 'map.json'), `${JSON.stringify(map, null, 2)}\n`);

for (const item of items) console.log(`${item.status.padEnd(11)} ${item.handle.padEnd(52)} ${item.rule}`);
console.log('\ncounts:', counts);
