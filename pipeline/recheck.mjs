// Read a second and third time, without following redirects, the pages that did not
// serve product content. One observation is an event; three make a statement.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { USER_AGENT } from './lib/polite.mjs';
import { setTimeout as sleep } from 'node:timers/promises';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const config = JSON.parse(await readFile(join(here, 'config.json'), 'utf8'));
const pagesDir = join(root, 'data', 'snapshot', 'pages');

const targets = [];
for (const handle of [...config.batch, ...config.reference]) {
  const record = JSON.parse(await readFile(join(pagesDir, `${handle}.json`), 'utf8'));
  if (!record.served_product_page) targets.push({ handle, record });
}
console.log(`pages to read again: ${targets.map((entry) => entry.handle).join(', ') || 'none'}`);

for (const { handle, record } of targets) {
  const url = `${config.market.origin}/products/${handle}`;
  const rechecks = record.rechecks || [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await sleep(4000);
    const response = await fetch(url, {
      redirect: 'manual',
      headers: { 'user-agent': USER_AGENT, accept: 'text/html' },
    });
    await response.arrayBuffer();
    rechecks.push({
      read_at: new Date().toISOString(),
      status: response.status,
      location: response.headers.get('location'),
      content_language: response.headers.get('content-language'),
    });
    console.log(`${handle}: HTTP ${response.status}${response.headers.get('location') ? ` -> ${response.headers.get('location')}` : ''}`);
  }
  record.rechecks = rechecks;
  await writeFile(join(pagesDir, `${handle}.json`), `${JSON.stringify(record, null, 2)}\n`);
}
