# storefront-first-cycle

A reviewed batch of proposed product highlights, prepared from public product pages of a
Shopify storefront and stopped before anything is written back.

The published page: <https://first-cycle.theaipipe.com>

Nothing in the storefront was changed. No account, cart, form or admin area was used. The
reading is of public pages only, one request at a time, with `robots.txt` honoured.

## What this does

A short block of product highlights sits above the description on this storefront's product
pages. Some pages carry it, some do not. This repository takes a selection of product pages,
reads each one, and for each page decides between three outcomes:

| Outcome | What it means |
| --- | --- |
| Proposal | The block is absent and the page carries facts a line can cite. |
| No change recommended | The block is already on the page. |
| To confirm | Something on the page has to be settled before any wording is proposed. |

No outcome is typed by hand. Each follows from the stored reading through the rules in
`pipeline/lib/status.mjs`, and a test checks that every recorded outcome is the one those
rules give for that page.

## What a proposed line is allowed to say

Every line rests on a passage from **that product's own page, in the market that was read**.
The passage is stored beside the line and shown on the published page. `npm run build` runs
`pipeline/verify.mjs` before it builds anything, so a quoted passage that is no longer in the
stored reading stops the build and nothing is published. Those checks are against the dated
snapshot, not the current storefront: the affected page would be re-read before any change.
Where sources conflict about a claim, that claim is withheld, and the other supported lines of
that page can still be proposed; the conflicting passages are recorded instead.

Counts are matched whole. A source of `5` is not found inside a count of `15`.

A second reader from another model family then sees the page material and the draft lines,
with no argument for them, and rules on each line: identity and scope, strength, decomposition,
conditions and context, contradictions and unknowns. Its verdicts are kept word for word in
`data/jury/`, next to the prompt that produced them.

A verdict belongs to one wording and to the material it was given, never to a line identifier
on its own. `pipeline/decide.mjs` seals both from that stored prompt and refuses to carry a
verdict over when either has moved since. It also refuses a decision without a valid outcome
and a reason, a revision whose wording is not the one the reader asked for word for word, and
a question the reader was asked and did not answer. `tests/guardrail.test.mjs` holds those
cases, written as they were put to this repository from outside.

The published page claims no human reading of the batch. The decision on the wording sits with
the owner of the storefront.

## Two separate ways to replay this

They have different requirements and they are not the same operation.

**Replay the checks against the stored reading.** No network, no model.

```bash
npm install
npm test           # the rules, the passages, the guard rail, the wording
npm run verify     # every quoted passage, found again in the stored reading
```

**Ask the models again.** Needs the `codex` command, signed in to its own subscription. This
reaches an outside service and its answers will not be identical to the stored ones.

```bash
npm run jury      # second reader, verdicts written to data/jury/
npm run decide    # settle the verdicts and rebuild data/batch.json
```

**Read the storefront again.** This sends requests to a live storefront. It replaces the stored
reading, so the lines are checked against pages read today rather than the pages this batch was
built from.

```bash
npm run crawl     # public pages, one request at a time, robots.txt honoured
node pipeline/recheck.mjs
node pipeline/sources.mjs
node pipeline/run.mjs
```

A green test run says the lines still match the stored reading and that the rules were applied.
It says nothing about whether a line is the right thing to publish, and nothing about the field
that would carry it.

## Before anything is written

Content prepared for review. Connector mapping not verified.

Where this block is stored is a setting inside the shop, and a product page does not show it,
so the write target has to be confirmed by someone with access before any value is sent. No
import file is offered here: an import can overwrite values that were not meant to change. The
plan is five steps, in this order: the wording is approved or amended, the field and market are
confirmed on one product, the current value is saved and only that field on that product is
changed, the rendered page is checked against the approved wording, and the previous value is
restored if that check fails. `data/batch.json` carries `target_field: { status:
"not_confirmed" }` so the package says this too, and not only the page.

## Layout

```
pipeline/     the steps, in the order they run
  crawl.mjs       read the public pages, one request at a time
  recheck.mjs     read again the pages that did not serve product content
  sources.mjs     read the outside pages quoted in research, and verify each quote
  extract.mjs     derive the page records from the stored responses
  research.mjs    practices, measured patterns and editorial choices, kept apart
  map.mjs         compare each page with the pattern, and let the outcome follow
  propose.mjs     assemble the lines and check every passage they rest on
  jury.mjs        the second reader
  decide.mjs      settle the verdicts and build what the page reads
  verify.mjs      find every quoted passage again in the stored reading, before the build
  run.mjs         the steps that need no network, with their timings
  lib/review.mjs  the shape of the prompt, and the seal that binds a verdict to it
data/
  snapshot/       the reading: one small record per page, plus the request manifest
  research.json   what the lines were shaped by
  map.json        what each page showed and the outcome it gave
  proposals.json  the lines and the passages they rest on
  jury/           the second reader, word for word, with the prompt it was given
  batch.json      what the published page reads
app/          the published page, built from data/batch.json at build time
tests/        the checks, including synthetic counter-examples
```

The repository carries the small record each page contributes to the batch, not an archive of
the storefront: the full responses stay on the machine that read them, and the product feed,
which carries the whole catalogue and the shop's own working annotations, is not published
here.

## Licence

MIT. See `LICENSE`.
