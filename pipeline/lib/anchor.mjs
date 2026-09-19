// A line is only allowed on the page if every passage it rests on is still there,
// word for word, in the stored reading of that product's own page.

export const FIELDS = ['badge', 'contents', 'contents_count', 'description', 'bullet', 'specific'];

// A count is a value, not a passage. Looked for the way a passage is looked for, "5" is
// found inside "15", so a number is only ever matched whole.
const COUNTED_FIELDS = new Set(['contents_count']);
const isNumber = (text) => /^\d+(\.\d+)?$/.test(text);

export function fieldValues(page, field) {
  switch (field) {
    case 'badge':
      return page.badges.map((badge) => badge.text);
    case 'contents':
      return page.bundle_components;
    case 'contents_count':
      return [String(page.bundle_components.length)];
    case 'description':
      return [page.description.text];
    case 'bullet':
      return page.description.bullets;
    case 'specific':
      return page.specifics.map((row) => `${row.label}: ${row.value}`);
    default:
      throw new Error(`unknown source field: ${field}`);
  }
}

export function locateSource(page, source) {
  if (!FIELDS.includes(source.field)) throw new Error(`unknown source field: ${source.field}`);
  if (!source.quote) throw new Error('a source without a passage is not a source');
  const values = fieldValues(page, source.field);
  const whole = COUNTED_FIELDS.has(source.field) || isNumber(source.quote);
  const index = values.findIndex(
    (value) => typeof value === 'string' && (whole ? value === source.quote : value.includes(source.quote)),
  );
  if (index === -1) {
    throw new Error(`passage not found on ${page.handle} in field ${source.field}: "${source.quote}"`);
  }
  return { field: source.field, quote: source.quote, context: values[index], position: index };
}

export function checkClaim(page, claim) {
  if (!claim.sources || claim.sources.length === 0) {
    throw new Error(`claim ${claim.id} rests on nothing`);
  }
  if (claim.text && claim.text.includes('—')) {
    throw new Error(`claim ${claim.id} uses a dash this project does not use`);
  }
  for (const source of claim.sources) {
    if (source.quote.includes('—')) {
      throw new Error(`the passage quoted by ${claim.id} contains a dash this project does not use; quote a shorter span`);
    }
  }
  return claim.sources.map((source) => locateSource(page, source));
}
