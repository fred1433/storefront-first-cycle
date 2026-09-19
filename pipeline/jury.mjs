// A second reader, from another model family, sees the material and the draft lines,
// and nothing else: no argument for the lines, no mention of who wrote them or why.
//
// Prerequisite, and it is not the one the tests need: a working `codex` command
// signed in to its own subscription. No paid interface is called from here.
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { draftBlock, materialBlock } from './lib/review.mjs';

/** The prompt goes in on stdin: passed as an argument, the command does not start. */
function readReview(args, prompt) {
  return new Promise((resolve, reject) => {
    const child = spawn('codex', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let error = '';
    child.stdout.on('data', () => {});
    child.stderr.on('data', (chunk) => {
      error += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`codex exited ${code}: ${error.slice(-500)}`))));
    child.stdin.end(prompt);
  });
}

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const config = JSON.parse(await readFile(join(here, 'config.json'), 'utf8'));
const proposals = JSON.parse(await readFile(join(root, 'data', 'proposals.json'), 'utf8'));
const pagesDir = join(root, 'data', 'snapshot', 'pages');
const juryDir = join(root, 'data', 'jury');
await mkdir(juryDir, { recursive: true });

const list = (values) => (values.length ? values.map((value) => `  - ${value}`).join('\n') : '  (none on this page)');

function buildPrompt(page, entry) {
  const material = materialBlock(page);
  const lines = draftBlock(entry.claims);

  const questions = entry.blocked
    .map(
      (claim) =>
        `id "${claim.id}": do the passages below, taken from this page, agree or disagree about the age or school stage of this product?\n${list(
          claim.sources.map((source) => `${source.field}: ${source.quote}`),
        )}`,
    )
    .join('\n\n');

  return `You are reviewing draft copy for one product page. Work only from the material quoted below. Do not use outside knowledge of the product, the brand, the market or the publisher, and do not assume the draft is correct.

Product: ${page.heading}
Page read: ${page.url}
Market observed: ${config.market.label} storefront, read on ${config.snapshotDate}.

MATERIAL OBSERVED ON THAT PAGE

${material}

DRAFT LINES

${lines}

For every draft line, decide whether the material above supports it exactly as written. Check each of these:
- identity and scope: a property of one included item presented as true of the whole set
- strength: a possibility presented as a guarantee, or a claim strengthened beyond its source
- decomposition: a line making several promises where the material supports only some of them
- conditions and context: an age, a school stage, a language, a quantity or a pack content dropped, widened or altered
- contradictions and unknowns: two passages that disagree, or a detail filled in by likelihood

For each line return: its id, the exact supporting passage copied from the material (or null if none supports it), one verdict from "Supported as written", "Revise", "Unsupported", "Conflicting sources", a one sentence reason, and the wording you would require instead (or null).

${questions ? `QUESTIONS\n\n${questions}\n` : ''}
Return one JSON object with keys "lines" and "questions". Return JSON only.`;
}

const seen = new Set();
for (const entry of proposals.proposals) {
  const draftKey = entry.shared_with || entry.handle;
  if (seen.has(draftKey)) continue;
  seen.add(draftKey);
  const page = JSON.parse(await readFile(join(pagesDir, `${draftKey}.json`), 'utf8'));
  const source = proposals.proposals.find((candidate) => candidate.handle === draftKey) || entry;
  const prompt = buildPrompt(page, source);
  await writeFile(join(juryDir, `${draftKey}.prompt.txt`), prompt);
  const outputPath = join(juryDir, `${draftKey}.raw.txt`);
  process.stdout.write(`${draftKey}: reading ... `);
  const started = Date.now();
  await readReview(
    [
      'exec',
      '--sandbox',
      'read-only',
      '--skip-git-repo-check',
      '-c',
      'model_reasoning_effort="high"',
      '--output-schema',
      join(here, 'jury.schema.json'),
      '--output-last-message',
      outputPath,
      '-',
    ],
    prompt,
  );
  const raw = await readFile(outputPath, 'utf8');
  const parsed = JSON.parse(raw);
  await writeFile(
    join(juryDir, `${draftKey}.json`),
    `${JSON.stringify({ draft: draftKey, read_at: new Date().toISOString(), seconds: Math.round((Date.now() - started) / 1000), ...parsed }, null, 2)}\n`,
  );
  const tally = parsed.lines.reduce((counts, line) => ({ ...counts, [line.verdict]: (counts[line.verdict] || 0) + 1 }), {});
  console.log(`${Math.round((Date.now() - started) / 1000)}s  ${JSON.stringify(tally)}`);
}
