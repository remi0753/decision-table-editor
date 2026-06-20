import {
  CircleHelp,
  ClipboardCheck,
  Database,
  ExternalLink,
  Flag,
  KeyRound,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import {
  Callout,
  Checklist,
  CodeBlock,
  DefinitionList,
  DocSection,
  FeatureGrid,
} from '../components';
import { pageHref } from '../metadata';

export function DecisionWorkspacePage() {
  return (
    <>
      <DocSection title="What the decision workspace is">
        <p>
          The decision workspace is the operator-facing way to run a published
          logic on a real case. Instead of filling in a form field by field, an
          operator starts from the key they already have — an order number, a
          ticket URL, a customer ID — and LEVERIE prepares the rest: it resolves
          the facts it can look up, asks only the facts a system cannot know,
          evaluates the deterministic logic, and returns a decision with its
          reason and the next action.
        </p>
        <p>
          It is the same engine and the same trace as the{' '}
          <a href={pageHref('evaluation')}>evaluation panel</a>, but wrapped in
          a guided surface for daily work. The promise is simple:
        </p>
        <Callout
          icon={Workflow}
          title="Start the case, then LEVERIE prepares the inputs"
        >
          Operators should not assemble JSON, export CSV, or take screenshots.
          They paste the key they already have, confirm what was found, and
          answer only what the data could not provide.
        </Callout>
        <FeatureGrid
          items={[
            {
              icon: KeyRound,
              title: 'Key first',
              body: 'A case begins with one identifier. LEVERIE extracts candidate keys from pasted text or a URL.',
            },
            {
              icon: Database,
              title: 'Facts resolved for you',
              body: 'Reference tables and live connectors fill in known facts automatically, each tagged with its source.',
            },
            {
              icon: ClipboardCheck,
              title: 'Decide and act',
              body: 'The result carries a reason, the matched rule, a copy-ready response, and a saved, auditable session.',
            },
          ]}
        />
      </DocSection>

      <DocSection title="How to reach it">
        <p>
          The decision workspace appears automatically when a runner opens a{' '}
          <strong>published, data-connected</strong> logic. There is no separate
          URL scheme — it is the normal runner URL. A logic becomes
          data-connected once it has fact bindings and a published data snapshot
          (see the <a href={pageHref('fact-catalog')}>fact catalog</a> and{' '}
          <a href={pageHref('publishing')}>publishing</a> pages).
        </p>
        <DefinitionList
          items={[
            [
              'Build it',
              'In the editor, define facts, bind them to fields, connect a reference table or live source, and confirm the Bindings & readiness checks pass.',
            ],
            [
              'Publish it',
              'Publishing snapshots the fact catalog, bindings, resolvers, and data sources for that version. The snapshot is what the workspace runs against.',
            ],
            [
              'Share the runner URL',
              'Use the share dialog to send the production runner link, e.g. /run/<workspaceId>/<logicId>. See the sharing page for viewer vs runner-only access.',
            ],
            [
              'Open it',
              'When the opened version has a data snapshot, the runner shows the decision workspace instead of the plain input form. If it has no snapshot, the classic form runner is shown — nothing breaks.',
            ],
          ]}
        />
        <CodeBlock
          title="Runner URL shapes"
          code={`/run/<workspaceId>/<logicId>        # latest production version
/run/<workspaceId>/<logicId>@v3     # a pinned version for audits`}
        />
        <p>
          Operators with the <code>runner</code> role can open this URL and
          nothing else, which makes it safe to hand to a wide team. For how a
          URL is generated and who can see it, see{' '}
          <a href={pageHref('sharing')}>sharing and runners</a>.
        </p>
      </DocSection>

      <DocSection title="Start a case from a key">
        <p>
          The workspace opens on a single paste box rather than a form. The
          operator pastes the identifier they already have, and LEVERIE runs
          rule-based key extraction to find candidate keys — from a bare ID, a
          pasted URL, or a labelled line in copied text.
        </p>
        <CodeBlock
          title="Example: a support agent pastes copied case text"
          code={`Order #A-10293
Customer: Gold tier
"I want to return this, it never shipped opened."

→ LEVERIE extracts Order ID = A-10293 and shows it for confirmation.`}
        />
        <p>
          Extraction uses each key fact&apos;s <em>aliases</em> (for example{' '}
          <code>order_id</code> or <code>注文番号</code>) and common URL
          patterns, so the same workspace can accept an ID, a back-office URL,
          or a chunk of ticket text. The chosen key is always shown for the
          operator to confirm or correct before anything is looked up.
        </p>
        <Callout icon={ShieldCheck} title="Data minimization by default">
          Only the extracted key candidates are sent and stored — raw pasted
          text is not persisted. URLs and copied text never become part of the
          saved case unless the workspace explicitly opts in.
        </Callout>
      </DocSection>

      <DocSection title="Resolved facts">
        <p>
          Once a key is confirmed, LEVERIE runs the resolvers in the published
          snapshot and shows a <strong>case sheet</strong>: one row per fact,
          with its value, where it came from, and its state. A resolver can even
          chain — a ticket ID can resolve an order ID, which then resolves the
          order facts.
        </p>
        <CodeBlock
          title="Example case sheet after resolving Order #A-10293"
          code={`Purchase date     2026-05-28        reference table
Order amount      ¥7,200,000        reference table
Customer tier     Gold              API (live connector)
Item opened       —                 needs operator input`}
        />
        <DefinitionList
          items={[
            [
              'Source badge',
              'Shows provenance: reference table, API, manual, clipboard, derived, or internal. Auditors and operators always see where a value came from.',
            ],
            [
              'State badge',
              'resolved, needs confirmation, manual, unavailable, invalid, or hidden. A value the source could not return is marked unavailable rather than silently blank.',
            ],
            [
              'Correcting a value',
              'Visible facts can be corrected inline unless locked by policy. A corrected value is recorded as operator-supplied with provenance.',
            ],
          ]}
        />
      </DocSection>

      <DocSection title="Guided questions">
        <p>
          LEVERIE asks a manual question only when the current partial analysis
          still needs that fact to reach a decision. Facts that a system already
          provided are never re-asked, and facts that no longer change the
          outcome are skipped.
        </p>
        <FeatureGrid
          items={[
            {
              icon: CircleHelp,
              title: 'Only what systems cannot know',
              body: 'Item condition, customer intent, an exception approval — the facts no database holds. Everything else is resolved first.',
            },
            {
              icon: ClipboardCheck,
              title: 'Fast input',
              body: 'Yes/No buttons for booleans, a picker for short enums, and a text box otherwise. Answers are keyboard-friendly.',
            },
            {
              icon: Workflow,
              title: 'Explained',
              body: 'Each question shows why it matters — the outcomes it is choosing between — so the operator understands the impact.',
            },
          ]}
        />
        <CodeBlock
          title="Example: the one remaining question"
          code={`Was the item opened?     [ Yes ]   [ No ]
Why it matters: choosing between "Full refund" and "Store credit".`}
        />
      </DocSection>

      <DocSection title="Decision and next action">
        <p>
          When enough facts exist, the workspace shows the result card. The
          decision is re-evaluated on the server from the normalized facts, so
          the saved outcome cannot drift from what the operator saw. The card is
          built to drive the next step of work, not just to display an answer.
        </p>
        <DefinitionList
          items={[
            [
              'Result and reason',
              'The outcome title plus a business reason rendered from the result template — for example "Full refund approved — within 30 days, unopened, Gold tier."',
            ],
            [
              'Facts used and skipped',
              'The facts that drove the matched row, and the facts that were skipped because they no longer affected the result.',
            ],
            [
              'Responsibility and versions',
              'A "Based on company rule <logic> v<N>" line, the data definition version, and the saved decision session ID for audit.',
            ],
            [
              'Next actions',
              'One-click copy of the customer message and the internal note, and an open-external-URL action when a safe link template is configured.',
            ],
          ]}
        />
        <CodeBlock
          title="Example result card"
          code={`Full refund approved

Within 30 days, unopened, Gold tier.
Based on company rule "Refund policy" v3.

[ Copy customer message ]  [ Copy internal note ]  [ Open in back office ]

Facts used: Purchase date, Item opened, Customer tier
Data definition: 9f2c… · Decision session: ds_01J…`}
        />
        <Callout icon={ShieldCheck} title="Deterministic and auditable">
          External lookups happen before evaluation; the decision runs over a
          fixed, normalized fact set. The session stores each fact value with
          its state and provenance, honoring every fact&apos;s logging policy —
          so a recorded replay reconstructs exactly what was decided and why.
        </Callout>
      </DocSection>

      <DocSection title="No match and reporting">
        <p>
          When no rule covers the case, the workspace does not dead-end. It
          explains that current rules do not cover the situation, shows the
          known facts, and offers ready-to-send escalation text. The operator
          can keep working while the gap is flagged.
        </p>
        <FeatureGrid
          items={[
            {
              icon: Flag,
              title: 'Report a gap',
              body: 'Send a structured report — no match, wrong fact, missing source, confusing question, wrong result text, or exception required.',
            },
            {
              icon: ExternalLink,
              title: 'Escalate cleanly',
              body: 'Copy escalation text that already includes the logic version, known facts, and the decision session ID.',
            },
            {
              icon: ClipboardCheck,
              title: 'Close the loop',
              body: 'Reports attach the session and non-sensitive facts so a logic owner can reproduce the case and improve the rule.',
            },
          ]}
        />
        <Checklist
          items={[
            'Confirm the extracted key before resolving — a wrong key produces wrong facts.',
            'Treat an "unavailable" fact as a data issue, not a no-match — check the source or report a missing source.',
            'Use the report button instead of a side channel, so the logic owner gets the session ID and versions automatically.',
            'For audits, open the pinned @vN runner URL so facts resolve against the exact published snapshot.',
          ]}
        />
        <p>
          The facts shown here come from the{' '}
          <a href={pageHref('fact-catalog')}>fact catalog</a>, and the logic is
          promoted through <a href={pageHref('publishing')}>publishing</a>. The
          same normalized result is also available to systems and agents via the{' '}
          <a href={pageHref('hosted-api')}>hosted API</a>.
        </p>
      </DocSection>
    </>
  );
}
