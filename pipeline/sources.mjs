// Read the outside sources quoted in the research step, one request per host,
// and keep the passage that is quoted together with the digest of the page it came from.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { politeFetch, parseRobots, robotsAllows } from './lib/polite.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const wanted = JSON.parse(await readFile(join(here, 'sources.json'), 'utf8'));
const outDir = join(root, 'data', 'snapshot', 'sources');
await mkdir(outDir, { recursive: true });

function toText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&rsquo;/g, '’')
    .replace(/&#8220;|&ldquo;/g, '“')
    .replace(/&#8221;|&rdquo;/g, '”')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

for (const source of wanted) {
  const origin = new URL(source.url).origin;
  const robotsResponse = await politeFetch(`${origin}/robots.txt`);
  const robots = parseRobots(robotsResponse.body);
  const path = new URL(source.url).pathname;
  if (!robotsAllows(robots, path)) throw new Error(`robots.txt disallows ${source.url}`);
  const response = await politeFetch(source.url);
  if (response.status !== 200) throw new Error(`${source.url} returned ${response.status}`);
  const text = toText(response.body);
  // Keep the passage and enough of its surroundings to judge it, not the whole article.
  const excerpts = source.quotes.map((quote) => {
    const at = text.indexOf(quote);
    if (at === -1) throw new Error(`quote not found verbatim at ${source.url}: ${quote.slice(0, 60)}`);
    return {
      quote,
      context: text.slice(Math.max(0, at - 320), Math.min(text.length, at + quote.length + 320)),
    };
  });
  const record = {
    id: source.id,
    publisher: source.publisher,
    title: source.title,
    url: source.url,
    published: source.published || null,
    read_at: new Date().toISOString(),
    sha256: createHash('sha256').update(response.body).digest('hex'),
    quotes: source.quotes,
    excerpts,
    text: excerpts.map((entry) => entry.context).join('\n\n'),
  };
  await writeFile(join(outDir, `${source.id}.json`), `${JSON.stringify(record, null, 2)}\n`);
  console.log(`${source.id}: ${source.quotes.length} quote(s) found verbatim`);
}
