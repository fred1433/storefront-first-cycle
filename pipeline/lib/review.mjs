// A verdict belongs to one wording and to the material that was put with it, never to a
// line identifier on its own. The prompt sent to the second reader is kept word for word
// next to its answer, so the wording and the material can be sealed and compared later:
// change either one and the verdict stops applying, which is the point.
import { createHash } from 'node:crypto';

export const OUTCOMES = ['kept', 'revised', 'withdrawn'];
export const VERDICTS = ['Supported as written', 'Revise', 'Unsupported', 'Conflicting sources'];
export const ANSWERS = ['conflict', 'no conflict', 'cannot tell'];

const MATERIAL_HEADING = 'MATERIAL OBSERVED ON THAT PAGE\n\n';
const DRAFT_HEADING = '\n\nDRAFT LINES\n\n';
const AFTER_DRAFTS = '\n\nFor every draft line';

const sha = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

const list = (values) => (values.length ? values.map((value) => `  - ${value}`).join('\n') : '  (none on this page)');

/** Everything the second reader is shown about the page, and nothing else. */
export function materialBlock(page) {
  return [
    `Description text: ${page.description.text || '(none)'}`,
    `Description bullet points:\n${list(page.description.bullets)}`,
    `Badges shown under the product title:\n${list(page.badges.map((badge) => badge.text))}`,
    `Items listed on the page as included:\n${list(page.bundle_components)}`,
    `Attribute table:\n${list(page.specifics.map((row) => `${row.label}: ${row.value}`))}`,
  ].join('\n\n');
}

/** The draft lines as the reader is given them, numbered, with no argument for them. */
export function draftBlock(claims) {
  return claims.map((claim, index) => `${index + 1}. id "${claim.id}": "${claim.text}"`).join('\n');
}

export function sealOf(page, claims) {
  const material = sha(materialBlock(page));
  return {
    material,
    lines: Object.fromEntries(claims.map((claim) => [claim.id, sha(`${material}\n${claim.text}`)])),
  };
}

/** The same seal, taken from the record of what was actually sent. */
export function sealFromPrompt(prompt) {
  const start = prompt.indexOf(MATERIAL_HEADING);
  const middle = prompt.indexOf(DRAFT_HEADING);
  const end = prompt.indexOf(AFTER_DRAFTS);
  if (start === -1 || middle === -1 || end === -1 || !(start < middle && middle < end)) {
    throw new Error('the record of what was sent to the second reader cannot be read');
  }
  const material = sha(prompt.slice(start + MATERIAL_HEADING.length, middle));
  const lines = {};
  for (const line of prompt.slice(middle + DRAFT_HEADING.length, end).split('\n')) {
    const match = /^\d+\. id "([^"]+)": "(.*)"$/.exec(line);
    if (!match) throw new Error(`a draft line in the record cannot be read: ${line}`);
    lines[match[1]] = sha(`${material}\n${match[2]}`);
  }
  return { material, lines };
}

export function assertSealMatches(key, expected, actual) {
  if (expected.material !== actual.material) {
    throw new Error(
      `${key}: the material the second reader was given is not the material stored for that page, so its verdicts no longer apply`,
    );
  }
  for (const [id, seal] of Object.entries(expected.lines)) {
    if (!(id in actual.lines)) throw new Error(`${key}: ${id} was never put to the second reader`);
    if (actual.lines[id] !== seal) {
      throw new Error(`${key}: ${id} no longer reads as it did when the second reader ruled on it, so that verdict does not carry over`);
    }
  }
}

/**
 * A line the reader did not pass as written reaches the page only through a decision that
 * says what became of it and why. A revision may only adopt the wording the reader asked
 * for, word for word: any other wording is a line that was never reviewed.
 */
export function validateDecision(id, decision, verdict) {
  if (!decision || typeof decision !== 'object' || Array.isArray(decision)) {
    throw new Error(`${id}: the second reader returned "${verdict.verdict}" and no decision is recorded for it`);
  }
  if (!OUTCOMES.includes(decision.outcome)) {
    throw new Error(`${id}: a decision needs an outcome among ${OUTCOMES.join(', ')}`);
  }
  if (typeof decision.note !== 'string' || decision.note.trim() === '') {
    throw new Error(`${id}: a decision needs the reason it was settled that way`);
  }
  if (typeof decision.settled_by !== 'string' || decision.settled_by.trim() === '') {
    throw new Error(`${id}: a decision needs to say what settled it`);
  }
  if (decision.outcome === 'revised') {
    if (typeof decision.final_text !== 'string' || decision.final_text.trim() === '') {
      throw new Error(`${id}: a revision needs the wording it ends up with`);
    }
    if (!verdict.requested_change) {
      throw new Error(`${id}: the second reader asked for no wording, so a revision has nothing to adopt and needs a fresh verdict`);
    }
    if (decision.final_text !== verdict.requested_change) {
      throw new Error(
        `${id}: the wording kept is not the wording the second reader asked for, word for word; another wording needs a fresh verdict sealed to it`,
      );
    }
  }
  if (decision.outcome !== 'revised' && decision.final_text) {
    throw new Error(`${id}: a decision that is not a revision carries a new wording`);
  }
  return decision;
}

/** A question that was asked has an answer, or the batch does not go out. */
export function answerFor(key, claim, questions) {
  const answer = (questions || []).find((entry) => entry.id === claim.id);
  if (!answer) throw new Error(`${key}: the second reader was asked about ${claim.id} and the answer is missing`);
  if (!ANSWERS.includes(answer.answer)) {
    throw new Error(`${key}: the answer recorded for ${claim.id} is not one of ${ANSWERS.join(', ')}`);
  }
  if (typeof answer.reason !== 'string' || answer.reason.trim() === '') {
    throw new Error(`${key}: the answer recorded for ${claim.id} carries no reason`);
  }
  return answer;
}
