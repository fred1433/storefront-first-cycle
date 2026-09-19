// The second reader has to have seen every line, and a line it did not pass as
// written cannot reach the page without a settled decision recorded next to it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const batch = JSON.parse(await readFile(join(root, 'data', 'batch.json'), 'utf8'));
const verdicts = ['Supported as written', 'Revise', 'Unsupported', 'Conflicting sources'];

test('every line carries a verdict from the second reader', () => {
  for (const item of batch.items) {
    for (const line of item.lines || []) {
      assert.ok(verdicts.includes(line.review.verdict), `${line.id} carries no verdict`);
      assert.ok(line.review.reason.length > 0, `${line.id} carries a verdict with no reason`);
    }
  }
});

test('a line the reader did not pass as written was settled, and says so', () => {
  for (const item of batch.items) {
    for (const line of item.lines || []) {
      const passed = line.review.verdict === 'Supported as written' && !line.review.requested_change;
      if (passed) continue;
      assert.equal(line.outcome, 'revised', `${line.id} was questioned and yet stands as drafted`);
      assert.notEqual(line.text, line.drafted_text, `${line.id} is marked as changed and reads the same`);
      assert.ok(line.note, `${line.id} was changed without saying why`);
    }
  }
});

test('the counts shown for the review are the counts of the verdicts', () => {
  const seen = new Map();
  for (const item of batch.items) {
    for (const line of item.lines || []) if (!seen.has(line.id)) seen.set(line.id, line);
  }
  const tally = {};
  for (const line of seen.values()) tally[line.review.verdict] = (tally[line.review.verdict] || 0) + 1;
  assert.deepEqual(batch.review.verdicts, tally);
  assert.equal(batch.review.lines_reviewed, seen.size);
  assert.equal(
    batch.review.changes_requested,
    [...seen.values()].filter((line) => line.review.requested_change).length,
  );
});

test('the page claims no human reading of the batch', async () => {
  const page = await readFile(join(root, 'app', 'page.tsx'), 'utf8');
  for (const phrase of ['Human reviewed', 'human reviewed', 'reviewed by a human', 'verified product claim']) {
    assert.ok(!page.includes(phrase), `the page says "${phrase}"`);
  }
});
