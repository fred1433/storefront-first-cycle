// The status of a page follows from the reading, and nothing else decides it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decideStatus } from '../pipeline/lib/status.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const batch = JSON.parse(await readFile(join(root, 'data', 'batch.json'), 'utf8'));
const config = JSON.parse(await readFile(join(root, 'pipeline', 'config.json'), 'utf8'));

test('each recorded status is the one the rules give for that stored page', async () => {
  for (const item of batch.items) {
    const page = JSON.parse(await readFile(join(root, 'data', 'snapshot', 'pages', `${item.handle}.json`), 'utf8'));
    assert.equal(decideStatus(page).status, item.status, `${item.handle} carries a status the reading does not give`);
  }
});

test('the batch is the whole selection and nothing else', () => {
  assert.equal(batch.items.length, config.batch.length);
  assert.deepEqual(
    batch.items.map((item) => item.handle).sort(),
    [...config.batch].sort(),
  );
});

test('the counts on the page are the counts of the batch', () => {
  const tally = batch.items.reduce((counts, item) => ({ ...counts, [item.status]: (counts[item.status] || 0) + 1 }), {});
  assert.equal(batch.counts.proposal, tally.proposal);
  assert.equal(batch.counts.no_change, tally.no_change);
  assert.equal(batch.counts.to_confirm, tally.to_confirm);
  assert.equal(batch.counts.pages_read, batch.items.length);
});

test('a page in the no change group carries the lines it already shows', () => {
  for (const item of batch.items.filter((entry) => entry.status === 'no_change')) {
    assert.ok(item.current_lines.length > 0, `${item.handle} is marked as already carrying the block but shows no line`);
    assert.equal((item.lines || []).length, 0, `${item.handle} both keeps its lines and proposes new ones`);
  }
});

test('a page in the to confirm group proposes nothing', () => {
  for (const item of batch.items.filter((entry) => entry.status === 'to_confirm')) {
    assert.equal((item.lines || []).length, 0, `${item.handle} needs a decision and yet carries a proposal`);
  }
});

// Synthetic pages, invented for the test.
test('synthetic: a page that was not served needs a decision', () => {
  const page = { served_product_page: false, highlights: { present: false, count: 0 }, badges: [], bundle_components: [], description: { bullets: [] }, specifics: [] };
  assert.equal(decideStatus(page).status, 'to_confirm');
});

test('synthetic: a page already carrying the block is left alone', () => {
  const page = { served_product_page: true, highlights: { present: true, count: 3 }, badges: [], bundle_components: [], description: { bullets: [] }, specifics: [] };
  assert.equal(decideStatus(page).status, 'no_change');
});

test('synthetic: a page with nothing to cite needs a decision', () => {
  const page = { served_product_page: true, highlights: { present: false, count: 0 }, badges: [], bundle_components: [], description: { bullets: [] }, specifics: [] };
  assert.equal(decideStatus(page).status, 'to_confirm');
});

test('synthetic: a page with the block absent and a fact to cite gives a proposal', () => {
  const page = {
    served_product_page: true,
    highlights: { present: false, count: 0 },
    badges: [{ text: 'Ages 5-8', kind: 'age-range' }],
    bundle_components: [],
    description: { bullets: [] },
    specifics: [],
  };
  assert.equal(decideStatus(page).status, 'proposal');
});
