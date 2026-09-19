// Every line that reaches the page must still be traceable to a passage in the
// stored reading of its own product page. These checks run against the stored
// reading alone: no network, no model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkClaim, locateSource, fieldValues } from '../pipeline/lib/anchor.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const batch = JSON.parse(await readFile(join(root, 'data', 'batch.json'), 'utf8'));
const pageOf = async (handle) =>
  JSON.parse(await readFile(join(root, 'data', 'snapshot', 'pages', `${handle}.json`), 'utf8'));

test('every proposed line rests on at least one passage', () => {
  const lines = batch.items.flatMap((item) => item.lines || []);
  assert.ok(lines.length > 0, 'the batch has no proposed lines');
  for (const line of lines) {
    assert.ok(line.sources.length > 0, `${line.id} rests on nothing`);
  }
});

test('every quoted passage is still in the stored reading of that same page', async () => {
  for (const item of batch.items) {
    for (const line of item.lines || []) {
      const page = await pageOf(item.handle);
      for (const source of line.sources) {
        const values = fieldValues(page, source.field);
        assert.ok(
          values.some((value) => value.includes(source.quote)),
          `${line.id}: "${source.quote}" is no longer in ${source.field} of ${item.handle}`,
        );
      }
    }
  }
});

test('a blocked line names the passages that disagree', async () => {
  for (const item of batch.items) {
    for (const blocked of item.blocked || []) {
      assert.ok(blocked.sources.length >= 2, `${blocked.id} claims a disagreement with fewer than two passages`);
      const page = await pageOf(item.handle);
      for (const source of blocked.sources) locateSource(page, source);
    }
  }
});

// The checks above pass on work that is correct. These say what happens when it is not.
// They are synthetic: the products and passages are invented for the test and none of
// them belongs to the batch.
test('synthetic: a line quoting a passage that is not on the page is refused', () => {
  const page = {
    handle: 'synthetic-product',
    badges: [{ text: 'Ages 5-8', kind: 'age-range' }],
    bundle_components: [],
    description: { text: 'A short description.', bullets: [] },
    specifics: [],
  };
  assert.throws(
    () => checkClaim(page, { id: 'synthetic-absent', text: 'For ages 2 to 4.', sources: [{ field: 'badge', quote: 'Ages 2-4' }] }),
    /passage not found/,
  );
});

test('synthetic: a line resting on another product page is refused', async () => {
  const page = {
    handle: 'synthetic-product',
    badges: [],
    bundle_components: ['Widget One'],
    description: { text: 'A short description.', bullets: [] },
    specifics: [],
  };
  assert.throws(
    () =>
      checkClaim(page, {
        id: 'synthetic-borrowed',
        text: 'Includes Widget Two.',
        sources: [{ field: 'contents', quote: 'Widget Two' }],
      }),
    /passage not found/,
  );
});

test('synthetic: a line resting on nothing is refused', () => {
  const page = { handle: 'synthetic-product', badges: [], bundle_components: [], description: { text: '', bullets: [] }, specifics: [] };
  assert.throws(() => checkClaim(page, { id: 'synthetic-bare', text: 'The best set available.', sources: [] }), /rests on nothing/);
});

test('synthetic: an unknown source kind is refused', () => {
  const page = { handle: 'synthetic-product', badges: [], bundle_components: [], description: { text: '', bullets: [] }, specifics: [] };
  assert.throws(
    () => checkClaim(page, { id: 'synthetic-unknown', text: 'A line.', sources: [{ field: 'reviews', quote: 'five stars' }] }),
    /unknown source field/,
  );
});
