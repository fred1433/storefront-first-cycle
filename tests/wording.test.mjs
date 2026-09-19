// What the page and the repository are not allowed to say, and the shape the lines keep.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const batch = JSON.parse(await readFile(join(root, 'data', 'batch.json'), 'utf8'));
const page = await readFile(join(root, 'app', 'page.tsx'), 'utf8');
const readme = await readFile(join(root, 'README.md'), 'utf8');

const refused = [
  'first cycle is done',
  'stops where yours does',
  'ready for your connector',
  'jury-checked',
  'jury checked',
  'guaranteed',
  'best-in-class',
  'world-class',
  'revenue',
  'conversion rate',
  'uplift',
];

test('the page avoids the wording this project refuses', () => {
  const text = page.toLowerCase();
  for (const phrase of refused) assert.ok(!text.includes(phrase), `the page says "${phrase}"`);
});

test('the proposed lines carry no price and no performance claim', () => {
  for (const item of batch.items) {
    for (const line of item.lines || []) {
      assert.ok(!/[$£€]\s?\d/.test(line.text), `${line.id} carries a price`);
      assert.ok(!/bestselling|best seller|award|save \d/i.test(line.text), `${line.id} carries a performance claim`);
    }
  }
});

test('nothing on the page uses the long dash', async () => {
  const built = join(root, 'out', 'index.html');
  let html = null;
  try {
    html = await readFile(built, 'utf8');
  } catch {
    html = null;
  }
  assert.ok(!page.includes('—'), 'the page source uses the long dash');
  if (html) assert.ok(!html.includes('—'), 'the built page uses the long dash');
});

test('the proposed lines stay within the shape the storefront itself shows', () => {
  const observed = batch.research.observed;
  for (const item of batch.items) {
    const lines = item.lines || [];
    if (!lines.length) continue;
    assert.ok(
      lines.length <= observed.lines_per_page.max,
      `${item.handle} proposes more lines than any comparable page shows`,
    );
    for (const line of lines) {
      assert.ok(
        line.text.length <= observed.characters_per_line.max,
        `${line.id} is longer than any line the storefront shows`,
      );
    }
  }
});

test('the repository publishes no note about people and no address check', async () => {
  const files = await readdir(root);
  assert.ok(!files.includes('fiche_identite.json'));
  const text = `${readme}\n${JSON.stringify(batch)}`.toLowerCase();
  for (const phrase of ['linkedin.com/in/', 'millionverifier', '@mrswordsmith.com', 'companies house']) {
    assert.ok(!text.includes(phrase), `the repository carries "${phrase}"`);
  }
});

test('the selection is cited once, as the source of the selection', () => {
  const occurrences = page.split(batch.selection.tag).length - 1;
  assert.equal(occurrences, 0, 'the page hard codes the tag rather than reading it from the batch');
  assert.ok(page.includes('was not treated as a confirmed task'));
});
