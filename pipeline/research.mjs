// Three separate things, kept separate on purpose:
//   practices  - stated elsewhere, quoted with their source
//   observed   - measured on comparable pages of the same storefront, and nothing more
//   editorial  - choices made for this batch, named as choices
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const config = JSON.parse(await readFile(join(here, 'config.json'), 'utf8'));
const authored = JSON.parse(await readFile(join(here, 'research.source.json'), 'utf8'));
const pagesDir = join(root, 'data', 'snapshot', 'pages');

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const pages = [];
for (const handle of config.reference) {
  pages.push(JSON.parse(await readFile(join(pagesDir, `${handle}.json`), 'utf8')));
}
const served = pages.filter((page) => page.served_product_page);
const withBlock = served.filter((page) => page.highlights.present);
const counts = withBlock.map((page) => page.highlights.count);
const lines = withBlock.flatMap((page) => page.highlights.messages);
const lengths = lines.map((line) => line.length);
const words = lines.map((line) => line.split(/\s+/).length);

const research = {
  market: config.market,
  read_on: config.snapshotDate,
  practices: authored.practices,
  observed: {
    note:
      'Measured on comparable product pages of the same storefront in the observed market. A pattern read from the outside is not a rule the shop has stated.',
    pages_read: pages.length,
    pages_serving_a_product: served.length,
    pages_showing_the_block: withBlock.length,
    lines_per_page: { min: Math.min(...counts), median: median(counts), max: Math.max(...counts) },
    characters_per_line: { min: Math.min(...lengths), median: median(lengths), max: Math.max(...lengths) },
    words_per_line: { min: Math.min(...words), median: median(words), max: Math.max(...words) },
    placement: 'Between the add to cart area and the description panel, under the product title.',
    recurring_subjects: [
      'who the product is for, usually an age range',
      'what the pack contains',
      'what the child practises',
    ],
  },
  editorial: authored.editorial,
};

await writeFile(join(root, 'data', 'research.json'), `${JSON.stringify(research, null, 2)}\n`);
console.log(
  `observed: ${withBlock.length} of ${served.length} comparable pages show the block, ${research.observed.lines_per_page.min} to ${research.observed.lines_per_page.max} lines, median ${research.observed.characters_per_line.median} characters a line`,
);
