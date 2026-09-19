// Turn one rendered product page into the small record the batch needs.
// Nothing here reads a merchant account: the input is the public page HTML.
import { parse } from 'node-html-parser';

const collapse = (value) => (value || '').replace(/\s+/g, ' ').trim();

/** The theme renders each highlight as `span.product__usp-message`. */
export function readHighlights(root) {
  const nodes = root.querySelectorAll('.product__usp-message');
  const messages = nodes.map((node) => collapse(node.text)).filter(Boolean);
  return { present: messages.length > 0, count: messages.length, messages };
}

/** The description lives in the `Product Description` accordion of the product template. */
export function readDescription(root) {
  const panels = root.querySelectorAll('details.product__details--item');
  for (const panel of panels) {
    const title = collapse(panel.querySelector('summary')?.text).toLowerCase();
    if (!title.includes('description')) continue;
    const content = panel.querySelector('.product__details--content');
    if (!content) continue;
    const bullets = content.querySelectorAll('li').map((li) => collapse(li.text)).filter(Boolean);
    const paragraphs = [];
    for (const child of content.childNodes) {
      const tag = (child.rawTagName || '').toLowerCase();
      if (tag === 'ul' || tag === 'ol' || tag === 'meta' || tag === 'table') continue;
      const text = collapse(child.text);
      if (text) paragraphs.push(text);
    }
    const whole = collapse(content.text);
    return {
      present: true,
      html: content.innerHTML.trim(),
      text: whole,
      bullets,
      paragraphs: paragraphs.length ? dedupeNested(paragraphs) : whole ? [whole] : [],
    };
  }
  return { present: false, html: '', text: '', bullets: [], paragraphs: [] };
}

function dedupeNested(values) {
  const kept = [];
  for (const value of values) {
    if (kept.some((existing) => existing.includes(value))) continue;
    for (let index = kept.length - 1; index >= 0; index -= 1) {
      if (value.includes(kept[index])) kept.splice(index, 1);
    }
    kept.push(value);
  }
  return kept;
}

/** The `Product Specific` accordion holds a small table of attributes. */
export function readSpecifics(root) {
  const panels = root.querySelectorAll('details.product__details--item');
  for (const panel of panels) {
    const title = collapse(panel.querySelector('summary')?.text).toLowerCase();
    if (!title.includes('specific')) continue;
    const rows = panel.querySelectorAll('tr').map((row) => {
      const cells = row.querySelectorAll('td').map((cell) => collapse(cell.text));
      return cells.length >= 2 ? { label: cells[0], value: cells.slice(1).join(' ') } : null;
    });
    return rows.filter(Boolean);
  }
  return [];
}

/** Every accordion title, so a page on a different template is visible as such. */
export function readPanels(root) {
  return root
    .querySelectorAll('details.product__details--item summary')
    .map((node) => collapse(node.text))
    .filter(Boolean);
}

/** The badge row under the product title: age range, category, grade range. */
export function readBadges(root) {
  const seen = new Set();
  const badges = [];
  for (const node of root.querySelectorAll('.product__badges-row .badge')) {
    const text = collapse(node.text);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    const modifier = (node.getAttribute('class') || '')
      .split(/\s+/)
      .find((name) => name.startsWith('badge--'));
    badges.push({ text, kind: modifier ? modifier.replace('badge--', '') : 'other' });
  }
  return badges;
}

/** The list of items a bundle page shows as included. Titles only, no prices. */
export function readBundleComponents(root) {
  const seen = new Set();
  const components = [];
  for (const node of root.querySelectorAll('.bundle-breakdown .component-title')) {
    const text = collapse(node.text);
    if (!text || seen.has(text)) continue;
    seen.add(text);
    components.push(text);
  }
  return components;
}

export function extractPage({ handle, url, status, finalUrl, headers, body, fetchedAt, market, role }) {
  const record = {
    handle,
    url,
    role,
    market,
    fetched_at: fetchedAt,
    http_status: status,
    final_url: finalUrl,
    content_language: headers?.['content-language'] || null,
    reachable: status === 200,
  };
  if (status !== 200) {
    record.title = null;
    record.canonical = null;
    record.highlights = { present: false, count: 0, messages: [] };
    record.description = { present: false, html: '', text: '', bullets: [], paragraphs: [] };
    record.specifics = [];
    record.panels = [];
    record.badges = [];
    record.bundle_components = [];
    return record;
  }
  const root = parse(body, { blockTextElements: { script: false, style: false } });
  record.title = collapse(root.querySelector('title')?.text) || null;
  record.canonical = root.querySelector('link[rel="canonical"]')?.getAttribute('href') || null;
  record.meta_description = root.querySelector('meta[name="description"]')?.getAttribute('content') || null;
  record.heading = collapse(root.querySelector('h1')?.text) || null;
  record.highlights = readHighlights(root);
  record.description = readDescription(root);
  record.specifics = readSpecifics(root);
  record.panels = readPanels(root);
  record.badges = readBadges(root);
  record.bundle_components = readBundleComponents(root);
  record.is_404 = /^404/.test(record.title || '') || (record.canonical || '').endsWith('/404');
  // Did the request return a product page at all, or something else?
  record.served_product_page = Boolean(record.heading) && !record.is_404 && (record.canonical || '').includes('/products/');
  // Shopify Markets gives a market variant the canonical URL of the product the market sells.
  const canonicalMatch = (record.canonical || '').match(/\/products\/([^/?#]+)/);
  record.canonical_handle = canonicalMatch ? canonicalMatch[1] : null;
  record.canonical_is_self = record.canonical_handle === handle;
  if (!record.served_product_page) record.reachable = false;
  return record;
}
