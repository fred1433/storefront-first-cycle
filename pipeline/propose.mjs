// Assemble the proposed lines, each one checked against the stored reading of its own page.
// A line whose passage cannot be found stops the run.
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkClaim } from './lib/anchor.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const drafts = JSON.parse(await readFile(join(here, 'drafts.json'), 'utf8'));
const map = JSON.parse(await readFile(join(root, 'data', 'map.json'), 'utf8'));
const pagesDir = join(root, 'data', 'snapshot', 'pages');

const proposals = [];
for (const item of map.items) {
  if (item.status !== 'proposal') continue;
  const draft = drafts[item.handle];
  if (!draft) throw new Error(`no draft for ${item.handle}, which the map put in the proposal group`);
  const sharedWith = draft.same_as || null;
  const claims = (draft.claims || drafts[sharedWith]?.claims || []).map((claim) => ({ ...claim }));
  if (claims.length === 0) throw new Error(`no lines drafted for ${item.handle}`);
  const page = JSON.parse(await readFile(join(pagesDir, `${item.handle}.json`), 'utf8'));
  const proposed = [];
  const blocked = [];
  for (const claim of claims) {
    const located = checkClaim(page, claim);
    const entry = { id: claim.id, product: item.handle, sources: located };
    if (claim.blocked) {
      blocked.push({ ...entry, intended: claim.intended, reason: claim.reason });
    } else {
      proposed.push({ ...entry, text: claim.text });
    }
  }
  proposals.push({
    handle: item.handle,
    title: item.title,
    url: item.url,
    shared_with: sharedWith,
    canonical_handle: item.observations.canonical_handle,
    canonical_is_self: item.observations.canonical_is_self,
    claims: proposed,
    blocked,
  });
}

const totals = {
  pages: proposals.length,
  distinct_texts: new Set(proposals.map((entry) => entry.shared_with || entry.handle)).size,
  claims: proposals.reduce((sum, entry) => sum + entry.claims.length, 0),
  blocked: proposals.reduce((sum, entry) => sum + entry.blocked.length, 0),
};
await writeFile(join(root, 'data', 'proposals.json'), `${JSON.stringify({ totals, proposals }, null, 2)}\n`);
console.log(totals);
for (const entry of proposals) {
  console.log(`\n${entry.handle}${entry.shared_with ? ` (same wording as ${entry.shared_with})` : ''}`);
  for (const claim of entry.claims) console.log(`  + ${claim.text}`);
  for (const claim of entry.blocked) console.log(`  - blocked: ${claim.intended}`);
}
