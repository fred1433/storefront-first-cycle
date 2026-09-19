// What stops a verdict from being reused for something the second reader never saw.
//
// The cases below were put to this repository by an outside reader, which ran them in a
// copy with invented data and found them accepted. They are written here as they were
// put, so that the fix is the thing that makes them fail to get through.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  materialBlock,
  sealOf,
  sealFromPrompt,
  assertSealMatches,
  validateDecision,
  answerFor,
} from '../pipeline/lib/review.mjs';
import { locateSource } from '../pipeline/lib/anchor.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const batch = JSON.parse(await readFile(join(root, 'data', 'batch.json'), 'utf8'));
const proposals = JSON.parse(await readFile(join(root, 'data', 'proposals.json'), 'utf8'));
const decisions = JSON.parse(await readFile(join(root, 'pipeline', 'decisions.json'), 'utf8'));
const pageOf = async (handle) =>
  JSON.parse(await readFile(join(root, 'data', 'snapshot', 'pages', `${handle}.json`), 'utf8'));
const promptOf = (key) => readFile(join(root, 'data', 'jury', `${key}.prompt.txt`), 'utf8');

const drafts = new Set(proposals.proposals.map((entry) => entry.shared_with || entry.handle));
const verdictOf = async (key, id) => {
  const review = JSON.parse(await readFile(join(root, 'data', 'jury', `${key}.json`), 'utf8'));
  return review.lines.find((line) => line.id === id);
};

// 1. A decision that says nothing
test('a decision with nothing in it is refused', async () => {
  const verdict = await verdictOf('card-game-bundle', 'cardgame-practice');
  assert.throws(() => validateDecision('cardgame-practice', {}, verdict), /outcome/);
  assert.throws(() => validateDecision('cardgame-practice', undefined, verdict), /no decision/);
  assert.throws(
    () => validateDecision('cardgame-practice', { outcome: 'revised', final_text: verdict.requested_change }, verdict),
    /reason/,
  );
  assert.throws(
    () => validateDecision('cardgame-practice', { outcome: 'settled', note: 'a note', settled_by: 'me' }, verdict),
    /outcome/,
  );
});

// 2. A wording the second reader never saw, carrying the verdict of the one it did
test('a wording the second reader never asked for cannot carry its verdict', async () => {
  const verdict = await verdictOf('card-game-bundle', 'cardgame-practice');
  assert.throws(
    () =>
      validateDecision(
        'cardgame-practice',
        {
          outcome: 'revised',
          final_text: 'Includes a bicycle.',
          note: 'Changed after review.',
          settled_by: 'the wording asked for',
        },
        verdict,
      ),
    /word for word/,
  );
  // The wording it did ask for, unchanged, is the one case that stands.
  validateDecision(
    'cardgame-practice',
    { outcome: 'revised', final_text: verdict.requested_change, note: 'Changed after review.', settled_by: 'the wording asked for' },
    verdict,
  );
});

test('a draft line changed after the reading no longer matches its verdict', async () => {
  const page = await pageOf('card-game-bundle');
  const entry = proposals.proposals.find((candidate) => candidate.handle === 'card-game-bundle');
  const prompt = await promptOf('card-game-bundle');

  // As it stands, the seal of what is on the page is the seal of what was read.
  assertSealMatches('card-game-bundle', sealOf(page, entry.claims), sealFromPrompt(prompt));

  const swapped = entry.claims.map((claim) =>
    claim.id === 'cardgame-contents' ? { ...claim, text: 'Includes a bicycle.' } : claim,
  );
  assert.throws(
    () => assertSealMatches('card-game-bundle', sealOf(page, swapped), sealFromPrompt(prompt)),
    /cardgame-contents/,
  );

  const otherMaterial = { ...page, description: { ...page.description, text: 'Something else entirely.' } };
  assert.throws(
    () => assertSealMatches('card-game-bundle', sealOf(otherMaterial, entry.claims), sealFromPrompt(prompt)),
    /material/,
  );
});

// 3. A question the second reader was asked and did not answer
test('an answer the second reader was expected to give cannot go missing', () => {
  const asked = { id: 'readiculous-school-stage' };
  assert.throws(() => answerFor('readiculous', asked, []), /missing/);
  assert.throws(
    () => answerFor('readiculous', asked, [{ id: 'readiculous-school-stage', answer: 'maybe', reason: 'a reason' }]),
    /answer/,
  );
  assert.throws(
    () => answerFor('readiculous', asked, [{ id: 'readiculous-school-stage', answer: 'conflict', reason: '' }]),
    /reason/,
  );
});

// 4. A number found inside a larger number
test('a counted value is matched whole, never inside a longer number', () => {
  const page = {
    handle: 'synthetic-product',
    badges: [],
    bundle_components: Array.from({ length: 15 }, (_, index) => `Item ${index + 1}`),
    description: { text: '', bullets: [] },
    specifics: [],
  };
  assert.throws(() => locateSource(page, { field: 'contents_count', quote: '5' }), /passage not found/);
  assert.deepEqual(locateSource(page, { field: 'contents_count', quote: '15' }).quote, '15');
});

// What the batch itself stands on: the same checks, run over the real work.
test('every decision in the batch passes its own validation', async () => {
  for (const key of drafts) {
    const review = JSON.parse(await readFile(join(root, 'data', 'jury', `${key}.json`), 'utf8'));
    for (const line of review.lines) {
      const passed = line.verdict === 'Supported as written' && !line.requested_change;
      if (passed) continue;
      validateDecision(line.id, decisions[line.id], line);
    }
  }
});

test('every verdict used by the batch is sealed to the wording and the material that were read', async () => {
  for (const key of drafts) {
    const page = await pageOf(key);
    const entry = proposals.proposals.find((candidate) => candidate.handle === key);
    assertSealMatches(key, sealOf(page, entry.claims), sealFromPrompt(await promptOf(key)));
  }
});

test('the material put to the second reader is rebuilt from the stored reading, not stored twice', async () => {
  for (const key of drafts) {
    const prompt = await promptOf(key);
    assert.ok(prompt.includes(materialBlock(await pageOf(key))), `${key}: the prompt does not carry the stored material`);
  }
});

test('the line kept for Family Game Bundle is the wording the second reader asked for', async () => {
  const verdict = await verdictOf('card-game-bundle', 'cardgame-practice');
  const line = batch.items
    .find((item) => item.handle === 'card-game-bundle')
    .lines.find((entry) => entry.id === 'cardgame-practice');
  assert.equal(line.text, verdict.requested_change);
});
