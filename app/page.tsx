import batch from '../data/batch.json';

type Source = { field: string; quote: string; context: string };
type Line = {
  id: string;
  text: string;
  drafted_text: string;
  outcome: string;
  note: string | null;
  sources: Source[];
  review: {
    verdict: string;
    reason: string;
    supporting_passage: string | null;
    requested_change: string | null;
  };
};
type Blocked = {
  id: string;
  intended: string;
  reason: string;
  sources: Source[];
  second_reader: { answer: string; reason: string } | null;
};
type Item = {
  handle: string;
  title: string;
  url: string;
  status: string;
  reason: string;
  shared_with: string | null;
  canonical_handle: string | null;
  current_lines: string[];
  rechecks: { read_at: string; status: number; location: string | null }[];
  lines?: Line[];
  withdrawn?: Line[];
  blocked?: Blocked[];
};

const items = batch.items as Item[];
const groups = [
  {
    key: 'proposal',
    label: 'Proposal',
    blurb: 'The block is absent and the page carries facts a line can cite.',
  },
  {
    key: 'no_change',
    label: 'No change recommended',
    blurb: 'The block is already on the page.',
  },
  {
    key: 'to_confirm',
    label: 'To confirm',
    blurb: 'Something on the page has to be settled before any wording is proposed.',
  },
];

const fieldLabel: Record<string, string> = {
  badge: 'badge under the title',
  contents: 'item listed as included',
  contents_count: 'number of items listed',
  description: 'description',
  bullet: 'description bullet',
  specific: 'attribute table',
};

const readOn = '19 September 2026';
const pathOf = (url: string) => new URL(url).pathname;
const firstSentence = (text: string) => `${text.split('. ')[0]}.`;

function Marker() {
  return (
    <svg
      className="marker mt-[3px] shrink-0 text-muted"
      width="11"
      height="11"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <path d="M4 2.5L8 6L4 9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function Evidence({ line }: { line: Line }) {
  return (
    <div className="border-t border-rule-soft py-5 first:border-t-0 first:pt-0">
      <p className="text-[15px] leading-[1.6] text-ink">{line.text}</p>
      {line.note ? <p className="mt-2 text-[14px] leading-[1.6] text-muted">{line.note}</p> : null}
      <ul className="mt-4 space-y-2.5">
        {line.sources.map((source) => (
          <li key={`${source.field}-${source.quote}`} className="text-[14px] leading-[1.6]">
            <span className="text-muted">{fieldLabel[source.field] || source.field}: </span>
            <span className="text-ink-soft">“{source.quote}”</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[14px] leading-[1.6] text-muted">
        <span className="text-bronze">Second reader: {line.review.verdict}.</span> {line.review.reason}
        {line.review.requested_change ? ` Wording asked for: “${line.review.requested_change}”.` : ''}
      </p>
    </div>
  );
}

function ItemCard({ item, twins, open }: { item: Item; twins: Item[]; open: boolean }) {
  const lines = item.lines || [];
  const blocked = item.blocked || [];
  const addresses = [item, ...twins];
  const showReason = item.status !== 'proposal';
  return (
    <details
      open={open}
      className="group border-b border-rule-soft last:border-b-0 open:border-b open:border-rule"
    >
      <summary className="flex items-start gap-4 py-5">
        <Marker />
        <span className="min-w-0 flex-1 text-[16px] leading-[1.5] text-ink">
          {item.title}
          {twins.length ? (
            <span className="ml-2 whitespace-nowrap rounded-full border border-rule-soft px-2 py-[3px] text-[12px] text-muted">
              {addresses.length} addresses
            </span>
          ) : null}
          {showReason ? <span className="text-[14.5px] text-muted"> {item.reason}</span> : null}
        </span>
      </summary>

      <div className="pb-6 pl-0 sm:pl-[27px]">
        {item.status === 'proposal' ? (
          <>
            <div className="rounded-xl border border-rule bg-card p-6 md:p-7">
              <p className="text-[12.5px] uppercase tracking-[0.14em] text-bronze">Proposed</p>
              <ul className="mt-4 space-y-3">
                {lines.map((line) => (
                  <li key={line.id} className="flex gap-3 text-[15.5px] leading-[1.6] text-ink">
                    <span className="mt-[9px] h-[3px] w-[3px] shrink-0 rounded-full bg-bronze" />
                    <span>{line.text}</span>
                  </li>
                ))}
              </ul>
            </div>
            {blocked.map((entry) => (
              <p key={entry.id} className="mt-4 text-[14.5px] leading-[1.6] text-ink-soft">
                <span className="text-amber">Not proposed. </span>
                {entry.intended} {firstSentence(entry.reason)}
              </p>
            ))}
            <details className="mt-4">
              <summary className="flex items-center gap-2.5 text-[14px] text-muted hover:text-ink">
                <Marker />
                {blocked.length ? 'Where each line comes from, and why one was not written' : 'Where each line comes from'}
              </summary>
              <div className="mt-5 border-l border-rule pl-5 sm:pl-6">
                {lines.map((line) => (
                  <Evidence key={line.id} line={line} />
                ))}
                {blocked.map((entry) => (
                  <div key={entry.id} className="border-t border-rule-soft py-5">
                    <p className="text-[15px] leading-[1.6] text-ink">Not proposed: {entry.intended}</p>
                    <p className="mt-2 text-[14px] leading-[1.6] text-ink-soft">{entry.reason}</p>
                    {entry.second_reader ? (
                      <p className="mt-3 text-[14px] leading-[1.6] text-muted">
                        <span className="text-bronze">Second reader, asked the same question without seeing this note: </span>
                        {entry.second_reader.answer}. {entry.second_reader.reason}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </details>
          </>
        ) : null}

        {item.status === 'no_change' ? (
          <div className="rounded-xl border border-rule-soft bg-white p-6 md:p-7">
            <p className="text-[12.5px] uppercase tracking-[0.14em] text-muted">On the page now</p>
            <ul className="mt-4 space-y-3">
              {item.current_lines.map((line) => (
                <li key={line} className="flex gap-3 text-[15px] leading-[1.6] text-ink-soft">
                  <span className="mt-[9px] h-[3px] w-[3px] shrink-0 rounded-full bg-rule" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {item.status === 'to_confirm' ? (
          <p className="rounded-xl border border-[#e6dcc2] bg-[#fdfaf2] px-6 py-4 text-[15px] leading-[1.65] text-ink-soft md:px-7">
            {item.rechecks.length
              ? `Read ${item.rechecks.length + 1} times on ${readOn}. Each request was sent to the product address and answered with a redirect to the storefront home page.`
              : 'A line here would restate the description rather than add a fact, so the page is left for you to decide what a reader should see.'}
          </p>
        ) : null}

        <p className="mt-5 text-[13.5px] leading-[1.7] text-muted">
          {twins.length ? (
            <>
              Served at {addresses.length === 2 ? 'two' : addresses.length} addresses,{' '}
              {addresses.length === 2 ? 'both' : 'all'} answered with the same canonical address, so one set of lines
              stands for {addresses.length === 2 ? 'both' : 'them'}. The page as read:{' '}
              {addresses.map((address, index) => (
                <span key={address.handle}>
                  {index > 0 ? ', ' : ''}
                  <a className="underline decoration-rule underline-offset-4 hover:text-ink" href={address.url}>
                    {pathOf(address.url)}
                  </a>
                </span>
              ))}
            </>
          ) : (
            <a className="underline decoration-rule underline-offset-4 hover:text-ink" href={item.url}>
              The page as read
            </a>
          )}
        </p>
      </div>
    </details>
  );
}

export default function Page() {
  const counts = batch.counts;
  const review = batch.review;
  const observed = batch.research.observed;
  const firstProposal = items.find((item) => item.status === 'proposal');

  return (
    <main className="mx-auto w-full max-w-[760px] px-6 sm:px-8">
      {/* 1. The work and its scope */}
      <section className="pt-14 pb-14 md:pt-16 md:pb-16">
        <p className="text-[12.5px] uppercase tracking-[0.18em] text-bronze">
          Independent sample by The AI Pipe
        </p>
        <h1 className="mt-6 text-[42px] font-semibold leading-[1.04] tracking-[-0.028em] text-ink sm:text-[56px] md:text-[68px]">
          Product highlights for review
        </h1>
        <p className="mt-8 max-w-[560px] text-[18px] leading-[1.65] text-ink-soft md:text-[19px]">
          A first proposal batch prepared from your public product pages. Nothing has been changed in your store.
        </p>
        <div className="mt-8 flex flex-col gap-y-2 text-[14.5px] text-muted sm:flex-row sm:flex-wrap sm:gap-x-6">
          <span>{batch.market.label} storefront</span>
          <span aria-hidden="true" className="hidden text-rule sm:inline">
            /
          </span>
          <span>read on {readOn}</span>
          <span aria-hidden="true" className="hidden text-rule sm:inline">
            /
          </span>
          <span>{counts.pages_read} product pages</span>
        </div>
        <p className="mt-6 max-w-[620px] text-[15px] leading-[1.7] text-muted">
          This is a sample of the recurring work I would operate within your existing setup.
        </p>
      </section>

      {/* 2. The decision */}
      <section className="border-t border-rule pt-14 pb-14 md:pt-16 md:pb-16">
        <h2 className="text-[30px] font-semibold leading-[1.15] tracking-[-0.022em] text-ink md:text-[38px]">
          The batch
        </h2>
        <p className="mt-6 max-w-[700px] text-[16px] leading-[1.7] text-ink-soft">
          Every page was opened before anything was written. {counts.proposal} came back with a proposal,{' '}
          {counts.no_change} already carry the block, {counts.to_confirm} need a decision from you. The proposals
          hold {counts.distinct_texts} sets of wording, because three addresses are served as the same product. The
          order is a review order, not a ranking.
        </p>

        <div className="mt-8">
          {groups.map((group) => {
            const inGroup = items.filter((item) => item.status === group.key);
            // A page served with the canonical address of another page of the batch carries the
            // same material, so it is folded into that page's row rather than repeated under it.
            const principals = inGroup.filter((item) => !item.shared_with);
            if (!principals.length) return null;
            return (
              <div key={group.key} className="mt-7 first:mt-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
                    {group.label}
                    <span className="ml-2 font-normal text-muted">{inGroup.length}</span>
                  </h3>
                  <p className="text-[14px] text-muted">{group.blurb}</p>
                </div>
                <div className="mt-4 border-t border-rule">
                  {principals.map((item) => (
                    <ItemCard
                      key={item.handle}
                      item={item}
                      twins={inGroup.filter((other) => other.shared_with === item.handle)}
                      open={item.handle === firstProposal?.handle}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-6 max-w-[640px] text-[14px] leading-[1.7] text-muted">
          Selection: {counts.pages_read} products carrying “{batch.selection.tag}” in the public product feed on{' '}
          {readOn}. Each page was checked before proposing an edit; the tag was not treated as a confirmed task.
        </p>
      </section>

      {/* 3. The check and what comes next */}
      <section className="border-t border-rule pt-14 pb-14 md:pt-16 md:pb-16">
        <h2 className="text-[30px] font-semibold leading-[1.15] tracking-[-0.022em] text-ink md:text-[38px]">
          How this was checked
        </h2>

        <div className="mt-8 space-y-6">
          <div>
            <h3 className="text-[15px] font-semibold text-ink">A second reader, from another model family</h3>
            <p className="mt-3 max-w-[700px] text-[16px] leading-[1.7] text-ink-soft">
              It received the page material and the draft lines, with no argument for them, and ruled on each: does
              the page support this exactly as written, in this market, without widening the claim or dropping a
              condition. {review.lines_reviewed} lines were put to it,{' '}
              {review.changes_requested === 0
                ? 'it asked for no change of wording'
                : `it asked for ${review.changes_requested} changes of wording that are recorded next to the line`}
              , and the lines it passed are still drafts: the decision on them is yours.
            </p>
          </div>

          <div>
            <h3 className="text-[15px] font-semibold text-ink">Before anything is written</h3>
            <p className="mt-3 max-w-[700px] text-[16px] leading-[1.7] text-ink-soft">
              Content prepared for review. Connector mapping not verified. Where this block is stored is a setting
              inside your shop, and a product page does not show it, so the write target has to be confirmed by
              someone with access before any value is sent.
            </p>
            <ol className="mt-5 space-y-2 text-[15.5px] leading-[1.6] text-ink-soft">
              {[
                'You approve or amend the wording.',
                'We confirm the field that feeds the block on one product.',
                'That one product is changed, and nothing else.',
                'The rendered page is checked against the approved wording.',
                'The previous value is kept so the change can be put back.',
              ].map((step, index) => (
                <li key={step} className="flex gap-4">
                  <span className="w-4 shrink-0 text-muted">{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <details>
            <summary className="flex items-center gap-2.5 text-[15px] font-semibold text-ink hover:text-bronze">
              <Marker />
              Method, timings and replay
            </summary>
            <div className="mt-6 space-y-6 border-l border-rule pl-5 sm:pl-6">
              <p className="max-w-[620px] text-[15.5px] leading-[1.7] text-ink-soft">
                Each line rests on a passage from that product’s own page, quoted above it. The build fails if a
                quoted passage is no longer in the stored reading, so a line cannot outlive the page it came from.
                Where two passages on one page disagree, no line is written and the disagreement is shown instead.
              </p>
              <p className="max-w-[620px] text-[15.5px] leading-[1.7] text-ink-soft">
                The shape of the lines follows your own pages. Of the {observed.pages_read} comparable addresses
                requested, {observed.pages_serving_a_product} served a product page, and{' '}
                {observed.pages_showing_the_block === observed.pages_serving_a_product
                  ? `all ${observed.pages_showing_the_block}`
                  : `${observed.pages_showing_the_block} of them`}{' '}
                carry the block, with {observed.lines_per_page.min} to {observed.lines_per_page.max} lines of around{' '}
                {observed.characters_per_line.median} characters. That is a pattern read from outside, not a rule you
                have stated.
              </p>
              <p className="max-w-[620px] text-[15.5px] leading-[1.7] text-ink-soft">
                Each line is written to be carried into a task board as it stands: one product, one market, the
                wording, the passages it rests on, the field still to confirm.
              </p>
              <div>
                <p className="text-[14px] text-muted">
                  Time spent by the steps that produced this batch, apart from building this page.
                </p>
                <dl className="mt-4 border-t border-rule-soft">
                  {batch.timings.map((entry) => (
                    <div
                      key={entry.step}
                      className="flex items-baseline justify-between gap-6 border-b border-rule-soft py-3"
                    >
                      <dt className="text-[15px] text-ink-soft">{entry.label}</dt>
                      <dd className="shrink-0 font-mono text-[14px] text-muted">{entry.display}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <p className="max-w-[620px] text-[15.5px] leading-[1.7] text-ink-soft">
                The code, the stored reading of each page and the second reader’s verdicts are public. Replaying the
                checks against the stored reading and asking the models again are two separate commands, with
                separate requirements.
              </p>
              <p className="max-w-[620px] text-[14px] leading-[1.7] text-muted">
                Reading practices quoted:{' '}
                {batch.sources.map((source, index) => (
                  <span key={source.id}>
                    {index > 0 ? '; ' : ''}
                    <a className="underline decoration-rule underline-offset-4 hover:text-ink" href={source.url}>
                      {source.publisher}, “{source.title}”
                    </a>
                  </span>
                ))}
                .
              </p>
            </div>
          </details>
        </div>

        <p className="mt-7">
          <a
            className="text-[16px] text-ink underline decoration-bronze decoration-1 underline-offset-[6px] hover:decoration-2"
            href="https://github.com/fred1433/storefront-first-cycle"
          >
            github.com/fred1433/storefront-first-cycle
          </a>
        </p>

        <p className="mt-8 max-w-[640px] text-[17px] leading-[1.65] text-ink-soft">
          If this is the kind of batch you want prepared every week: 15 minutes,{' '}
          <a
            className="text-ink underline decoration-bronze decoration-1 underline-offset-[6px] hover:decoration-2"
            href="https://cal.theaipipe.com"
          >
            cal.theaipipe.com
          </a>
        </p>

        <footer className="mt-8 border-t border-rule-soft pt-7 text-[13.5px] leading-[1.7] text-muted">
          <p>
            Prepared by Frederic de Lavenne de Choulot, The AI Pipe. Read from public product pages only, one request
            at a time, with robots.txt respected. Nothing in your store was changed.
          </p>
        </footer>
      </section>
    </main>
  );
}
