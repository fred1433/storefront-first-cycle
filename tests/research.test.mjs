// A practice quoted from outside has to be quoted word for word from the page it came from,
// and a pattern measured on the storefront has to match the stored reading.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const batch = JSON.parse(await readFile(join(root, 'data', 'batch.json'), 'utf8'));
const config = JSON.parse(await readFile(join(root, 'pipeline', 'config.json'), 'utf8'));

test('each quoted practice is verbatim in the stored reading of its source', async () => {
  for (const practice of batch.research.practices) {
    const source = JSON.parse(
      await readFile(join(root, 'data', 'snapshot', 'sources', `${practice.source}.json`), 'utf8'),
    );
    assert.ok(source.text.includes(practice.quote), `the passage quoted by "${practice.id}" is not in ${source.url}`);
  }
});

test('the measured pattern matches the comparable pages that were read', async () => {
  const pages = [];
  for (const handle of config.reference) {
    pages.push(JSON.parse(await readFile(join(root, 'data', 'snapshot', 'pages', `${handle}.json`), 'utf8')));
  }
  const served = pages.filter((entry) => entry.served_product_page);
  const withBlock = served.filter((entry) => entry.highlights.present);
  const observed = batch.research.observed;
  assert.equal(observed.pages_read, pages.length);
  assert.equal(observed.pages_serving_a_product, served.length);
  assert.equal(observed.pages_showing_the_block, withBlock.length);
  const counts = withBlock.map((entry) => entry.highlights.count);
  assert.equal(observed.lines_per_page.min, Math.min(...counts));
  assert.equal(observed.lines_per_page.max, Math.max(...counts));
});

test('a measured pattern is presented as a reading, not as a rule of the shop', async () => {
  const page = await readFile(join(root, 'app', 'page.tsx'), 'utf8');
  assert.ok(page.includes('not a rule you'), 'the page presents a measured pattern as a stated rule');
  assert.ok(batch.research.observed.note.includes('not a rule the shop has stated'));
});

test('the outside sources are named on the page with a link', async () => {
  assert.ok(batch.sources.length >= 2);
  for (const source of batch.sources) {
    assert.match(source.url, /^https:\/\//);
    assert.ok(source.publisher.length > 0 && source.title.length > 0);
  }
});
