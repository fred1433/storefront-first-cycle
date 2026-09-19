// What was read, how it was read, and what the repository is allowed to carry from it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRobots, robotsAllows } from '../pipeline/lib/polite.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(join(root, 'data', 'snapshot', 'manifest.json'), 'utf8'));
const config = JSON.parse(await readFile(join(root, 'pipeline', 'config.json'), 'utf8'));

test('every request in the record is a public read of the storefront', () => {
  for (const request of manifest.requests) {
    assert.match(request.url, /^https:\/\/mrswordsmith\.com\//);
    assert.ok(!/\/(admin|account|cart|checkout|orders)\b/.test(request.url), `${request.url} is not a public page`);
  }
});

test('the reading kept a pause between requests', () => {
  const times = manifest.requests.map((request) => Date.parse(request.read_at)).sort((a, b) => a - b);
  for (let index = 1; index < times.length; index += 1) {
    assert.ok(times[index] - times[index - 1] >= 2500, 'two requests were sent less than two and a half seconds apart');
  }
});

test('robots.txt is honoured by the rule the reading used', () => {
  const groups = parseRobots(`User-agent: *\nDisallow: /admin\nDisallow: /account\nDisallow: /search\n`);
  assert.equal(robotsAllows(groups, '/products/anything'), true);
  assert.equal(robotsAllows(groups, '/admin'), false);
  assert.equal(robotsAllows(groups, '/account'), false);
  assert.equal(robotsAllows(groups, '/search'), false);
});

test('the stored reading covers the batch and the comparable pages', async () => {
  const stored = (await readdir(join(root, 'data', 'snapshot', 'pages'))).map((name) => name.replace(/\.json$/, ''));
  for (const handle of [...config.batch, ...config.reference]) {
    assert.ok(stored.includes(handle), `${handle} was not stored`);
  }
});

test('the stored reading carries no catalogue annotation of the shop', async () => {
  const dir = join(root, 'data', 'snapshot', 'pages');
  for (const name of await readdir(dir)) {
    const record = JSON.parse(await readFile(join(dir, name), 'utf8'));
    assert.equal(record.tags, undefined, `${name} carries the shop's own tags`);
    assert.equal(record.feed?.tags, undefined, `${name} carries the shop's own tags`);
    assert.ok(!('body_html' in record), `${name} carries a copy of the feed`);
  }
});

test('the full responses are kept out of the repository', async () => {
  const ignore = await readFile(join(root, '.gitignore'), 'utf8');
  assert.ok(ignore.includes('crawl/'), 'the stored responses are not ignored');
});
