// Run the steps that work from the stored reading, and record how long each one took.
// Reading the pages and asking the second reader are not repeated here: their times are
// read back from what those steps wrote.
import { spawn } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

function runStep(script) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(process.execPath, [join(here, script)], { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve((Date.now() - started) / 1000) : reject(new Error(`${script} exited ${code}`)),
    );
  });
}

const display = (seconds) =>
  seconds < 1 ? 'under 1 s' : seconds < 60 ? `${Math.round(seconds)} s` : `${Math.round(seconds / 60)} min`;

const manifest = JSON.parse(await readFile(join(root, 'data', 'snapshot', 'manifest.json'), 'utf8'));
const crawlSeconds = (Date.parse(manifest.finished_at) - Date.parse(manifest.started_at)) / 1000;

const juryDir = join(root, 'data', 'jury');
const jurySeconds = (
  await Promise.all(
    (await readdir(juryDir))
      .filter((name) => name.endsWith('.json'))
      .map(async (name) => JSON.parse(await readFile(join(juryDir, name), 'utf8')).seconds || 0),
  )
).reduce((sum, seconds) => sum + seconds, 0);

const extractSeconds = await runStep('extract.mjs');
const researchSeconds = await runStep('research.mjs');
const mapSeconds = await runStep('map.mjs');
const proposeSeconds = await runStep('propose.mjs');

const timings = [
  {
    step: 'read',
    // The counts are filled in by decide.mjs, from what was actually measured.
    label: 'Reading {batch_pages} product URLs and {comparable_addresses} comparison URLs, one request at a time',
    seconds: Math.round(crawlSeconds),
    display: display(crawlSeconds),
  },
  {
    step: 'compare',
    label: 'Comparing each page with the pattern on the comparison pages',
    seconds: Math.round(extractSeconds + researchSeconds + mapSeconds),
    display: display(extractSeconds + researchSeconds + mapSeconds),
  },
  {
    step: 'check',
    label: 'Checking every line against the passage it rests on',
    seconds: Math.round(proposeSeconds),
    display: display(proposeSeconds),
  },
  {
    step: 'second-reader',
    label: 'Second reader, across the batch',
    seconds: Math.round(jurySeconds),
    display: display(jurySeconds),
  },
];

await writeFile(join(root, 'data', 'timings.json'), `${JSON.stringify(timings, null, 2)}\n`);
const decideSeconds = await runStep('decide.mjs');
console.log(`\nassembled in ${display(decideSeconds)} (not counted above: it builds the page, not the batch)`);
for (const entry of timings) console.log(`${entry.display.padStart(7)}  ${entry.label}`);
