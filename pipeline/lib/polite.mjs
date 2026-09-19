// Polite fetching helpers: one request at a time, a pause between requests,
// a declared user agent, and a robots.txt check before any path is read.
import { setTimeout as sleep } from 'node:timers/promises';

export const USER_AGENT =
  'TheAIPipe-Research/1.0 (+https://theaipipe.com; contact frederic@theaipipe.com)';

const MIN_PAUSE_MS = 3000;
const JITTER_MS = 1500;

let lastRequestAt = 0;

/** Parse the `User-agent: *` group of a robots.txt body. */
export function parseRobots(body) {
  const groups = [];
  let current = null;
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const match = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!match) continue;
    const field = match[1].toLowerCase();
    const value = match[2].trim();
    if (field === 'user-agent') {
      if (!current || current.started) {
        current = { agents: [], rules: [], crawlDelay: null, started: false };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if (current) {
      current.started = true;
      if (field === 'disallow' && value) current.rules.push({ allow: false, path: value });
      else if (field === 'allow' && value) current.rules.push({ allow: true, path: value });
      else if (field === 'crawl-delay') current.crawlDelay = Number(value) || null;
    }
  }
  return groups;
}

function patternToRegExp(pattern) {
  let source = '';
  for (const char of pattern) {
    if (char === '*') source += '.*';
    else if (char === '$') source += '$';
    else source += char.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp('^' + source);
}

/** True when the `User-agent: *` group permits the given path. */
export function robotsAllows(groups, path) {
  const group = groups.find((entry) => entry.agents.includes('*'));
  if (!group) return true;
  let decision = { allow: true, length: -1 };
  for (const rule of group.rules) {
    if (!patternToRegExp(rule.path).test(path)) continue;
    if (rule.path.length > decision.length) decision = { allow: rule.allow, length: rule.path.length };
  }
  return decision.allow;
}

/** One request at a time, never faster than the configured pause. */
export async function politeFetch(url, options = {}) {
  const elapsed = Date.now() - lastRequestAt;
  const wait = MIN_PAUSE_MS + Math.floor(Math.random() * JITTER_MS) - elapsed;
  if (lastRequestAt && wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
  const response = await fetch(url, {
    ...options,
    redirect: 'follow',
    headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/json', ...(options.headers || {}) },
  });
  const body = await response.text();
  return { status: response.status, finalUrl: response.url, body, headers: Object.fromEntries(response.headers) };
}
