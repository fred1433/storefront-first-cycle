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
The passage is stored beside the line and shown on the published page. The build fails when a
quoted passage is no longer in the stored reading, so a line cannot outlive the page it came
from. Where two passages on one page disagree, no line is written: the disagreement is
recorded instead, with both passages.

A second reader from another model family then sees the page material and the draft lines,
with no argument for them, and rules on each line: identity and scope, strength, decomposition,
conditions and context, contradictions and unknowns. Its verdicts are kept word for word in
`data/jury/`. A line it did not pass as written cannot reach the page until a decision is
recorded for it in `pipeline/decisions.json`, with the reason. That reason is shown next to
the line.

The published page claims no human reading of the batch. The decision on the wording sits with
the owner of the storefront.

## Two separate ways to replay this

They have different requirements and they are not the same operation.

**Replay the checks against the stored reading.** No network, no model.

```bash
npm install
npm test
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
plan is five steps, in this order: the wording is approved or amended, the field is confirmed
on one product, that one product is changed, the rendered page is checked against the approved
wording, and the previous value is kept so the change can be put back.

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
  run.mjs         the steps that need no network, with their timings
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
