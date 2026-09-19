// Put the second reader's verdicts next to the draft lines and settle every disagreement.
// A line the reader did not pass as written cannot reach the page until a decision is
// recorded for it in decisions.json, with its reason.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const config = JSON.parse(await readFile(join(here, 'config.json'), 'utf8'));
const map = JSON.parse(await readFile(join(root, 'data', 'map.json'), 'utf8'));
const proposals = JSON.parse(await readFile(join(root, 'data', 'proposals.json'), 'utf8'));
const research = JSON.parse(await readFile(join(root, 'data', 'research.json'), 'utf8'));
const decisions = JSON.parse(await readFile(join(here, 'decisions.json'), 'utf8'));

const juryFor = new Map();
const seen = new Set();
for (const entry of proposals.proposals) {
  const key = entry.shared_with || entry.handle;
  if (seen.has(key)) continue;
  seen.add(key);
  juryFor.set(key, JSON.parse(await readFile(join(root, 'data', 'jury', `${key}.json`), 'utf8')));
}

const sources = [];
for (const id of ['nng-how-users-read', 'shopify-metafield-definitions']) {
  const record = JSON.parse(await readFile(join(root, 'data', 'snapshot', 'sources', `${id}.json`), 'utf8'));
  sources.push({ id, publisher: record.publisher, title: record.title, url: record.url, read_at: record.read_at });
}

// Three pages of the batch are served with the canonical address of another page and
// carry the same material, so they carry the same lines. A line is counted once.
const verdictTally = {};
const counted = new Set();
let changesRequested = 0;
let linesOnPages = 0;
const settled = [];

const items = map.items.map((item) => {
  const proposal = proposals.proposals.find((entry) => entry.handle === item.handle);
  const base = {
    handle: item.handle,
    title: item.title,
    url: item.url,
    status: item.status,
    reason: item.reason,
    rule: item.rule,
    shared_with: proposal?.shared_with || null,
    canonical_handle: item.observations.canonical_handle,
    current_lines: item.observations.block_present ? item.observations.block_lines : [],
    rechecks: item.observations.rechecks,
  };
  if (!proposal) return { ...base, lines: [], blocked: [] };

  const key = proposal.shared_with || proposal.handle;
  const review = juryFor.get(key);
  const lines = proposal.claims.map((claim) => {
    const verdict = review.lines.find((line) => line.id === claim.id);
    if (!verdict) throw new Error(`the second reader returned nothing for ${claim.id}`);
    linesOnPages += 1;
    if (!counted.has(claim.id)) {
      counted.add(claim.id);
      verdictTally[verdict.verdict] = (verdictTally[verdict.verdict] || 0) + 1;
      if (verdict.requested_change) changesRequested += 1;
    }
    const passed = verdict.verdict === 'Supported as written' && !verdict.requested_change;
    const decision = decisions[claim.id];
    if (!passed && !decision) {
      throw new Error(
        `the second reader returned "${verdict.verdict}" for ${claim.id} and no decision is recorded in decisions.json`,
      );
    }
    if (decision?.final_text?.includes('\u2014')) {
      throw new Error(`the settled wording of ${claim.id} uses a dash this project does not use`);
    }
    if (decision && !settled.some((entry) => entry.id === claim.id)) {
      settled.push({ id: claim.id, product: base.title, ...decision, verdict: verdict.verdict });
    }
    const outcome = decision?.outcome || 'kept';
    return {
      id: claim.id,
      text: decision?.final_text || claim.text,
      drafted_text: claim.text,
      outcome,
      note: decision?.note || null,
      sources: claim.sources,
      review: {
        verdict: verdict.verdict,
        reason: verdict.reason,
        supporting_passage: verdict.supporting_passage,
        requested_change: verdict.requested_change,
      },
    };
  });

  const blocked = proposal.blocked.map((claim) => {
    const answer = review.questions.find((question) => question.id === claim.id) || null;
    return { id: claim.id, intended: claim.intended, reason: claim.reason, sources: claim.sources, second_reader: answer };
  });

  return { ...base, lines: lines.filter((line) => line.outcome !== 'withdrawn'), withdrawn: lines.filter((line) => line.outcome === 'withdrawn'), blocked };
});

const timings = JSON.parse(await readFile(join(root, 'data', 'timings.json'), 'utf8'));

const batch = {
  market: config.market,
  read_on: config.snapshotDate,
  selection: config.selection,
  counts: {
    pages_read: map.items.length,
    ...map.counts,
    distinct_texts: proposals.totals.distinct_texts,
  },
  review: {
    lines_reviewed: Object.values(verdictTally).reduce((sum, count) => sum + count, 0),
    lines_on_pages: linesOnPages,
    verdicts: verdictTally,
    changes_requested: changesRequested,
    settled,
  },
  research,
  sources,
  timings,
  items,
};

await writeFile(join(root, 'data', 'batch.json'), `${JSON.stringify(batch, null, 2)}\n`);
console.log('statuses:', map.counts);
console.log('verdicts:', verdictTally, '| changes requested:', changesRequested);
console.log('decisions recorded:', settled.length);
