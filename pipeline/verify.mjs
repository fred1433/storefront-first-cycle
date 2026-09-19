// The checks the page claims are run before it is built, run before it is built.
//
// Every passage quoted on the page is looked for again in the stored reading of the
// product it is attributed to. Nothing here reaches the storefront and nothing here
// calls a model: it reads the snapshot that is committed next to it. A passage that is
// no longer there stops the build, so the page is not published without its sources.
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { locateSource } from './lib/anchor.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const batch = JSON.parse(await readFile(join(root, 'data', 'batch.json'), 'utf8'));

let passages = 0;
for (const item of batch.items) {
  const quoting = [...(item.lines || []), ...(item.withdrawn || []), ...(item.blocked || [])];
  if (!quoting.length) continue;
  const page = JSON.parse(await readFile(join(root, 'data', 'snapshot', 'pages', `${item.handle}.json`), 'utf8'));
  for (const entry of quoting) {
    for (const source of entry.sources) {
      locateSource(page, source);
      passages += 1;
    }
  }
}

if (!passages) throw new Error('the batch quotes nothing, so there was nothing to check');
console.log(`${passages} quoted passages found again in the stored reading`);
