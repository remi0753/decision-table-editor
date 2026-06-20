import {
  Calculator,
  Database,
  EyeOff,
  KeyRound,
  Link2,
  ListChecks,
  Lock,
  Server,
  ShieldCheck,
  Tag,
  UserRoundCheck,
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

export function FactCatalogPage() {
  return (
    <>
      <DocSection title="What a fact is">
        <p>
          A fact is a business-level input that your decision logic can use —
          &ldquo;Purchase date&rdquo;, &ldquo;Customer tier&rdquo;, &ldquo;Item
          opened&rdquo;. It is deliberately not an API path.{' '}
          <code>order.created_at</code> is a source field;{' '}
          <em>Purchase date</em> is the fact. The fact catalog is the shared
          vocabulary that lets logic authors write rules in business terms while
          the messy details of where a value comes from stay in the data layer.
        </p>
        <p>
          Defining facts once, in one place, is what makes the{' '}
          <a href={pageHref('decision-workspace')}>decision workspace</a>{' '}
          possible: a fact can declare that it is resolved from a source, so an
          operator never has to type it.
        </p>
        <Callout icon={Database} title="One catalog per workspace">
          The catalog belongs to the workspace, not to a single logic. Many
          logics can reuse the same &ldquo;Order ID&rdquo; or &ldquo;Customer
          tier&rdquo; fact, and a published logic snapshots the exact fact
          definitions it used.
        </Callout>
      </DocSection>

      <DocSection title="How to reach the fact catalog">
        <p>
          The fact catalog lives in the workspace <strong>Data area</strong> at{' '}
          <code>/settings/data</code>. From the editor:
        </p>
        <DefinitionList
          items={[
            [
              '1. Open the workspace menu',
              'In the editor header, open the cloud/account menu and choose Workspace (settings). This requires owner or admin on the organization.',
            ],
            [
              '2. Open the Fact catalog',
              'On the workspace settings page, click the "Fact catalog" link in the header. It opens the Data area on the Facts tab, scoped to the current workspace.',
            ],
            [
              '3. Move between data screens',
              'The Data area sub-navigation switches between Facts, Reference tables, Live connectors, Resolvers, and Bindings & readiness — the full path from a fact to a resolved value.',
            ],
          ]}
        />
        <CodeBlock
          title="Data area tabs"
          code={`Facts                 → /settings/data            (this page)
Reference tables      → /settings/data/tables
Live connectors       → /settings/data/connectors
Resolvers             → /settings/data/resolvers
Bindings & readiness  → /settings/data/bindings`}
        />
        <Callout icon={ShieldCheck} title="Who can edit">
          Editors can create and edit manual facts. System, internal, and
          data-source-backed facts are managed by admins/owners, because they
          touch connectors and credentials. Everyone with workspace access can
          read the catalog.
        </Callout>
      </DocSection>

      <DocSection title="Fact kinds">
        <p>
          The <em>kind</em> of a fact tells LEVERIE how the value is expected to
          arrive. It is the single most important field, because it decides
          whether an operator is asked for the value or it is resolved for them.
        </p>
        <FeatureGrid
          items={[
            {
              icon: KeyRound,
              title: 'Key',
              body: 'Identifies a case and retrieves other facts. Example: Order ID. Keys are what an operator pastes to start a case.',
            },
            {
              icon: Server,
              title: 'System fact',
              body: 'Resolved from a source via a resolver. Example: Purchase date, Customer tier. Never typed by hand when a key is available.',
            },
            {
              icon: UserRoundCheck,
              title: 'Manual fact',
              body: 'Asked from the operator because no system knows it. Example: Item opened. Requires a question.',
            },
            {
              icon: EyeOff,
              title: 'Internal fact',
              body: 'Used by logic but hidden from the operator. Example: a risk flag computed for routing.',
            },
          ]}
        />
        <Callout icon={Calculator} title="Derived facts are reserved">
          A <code>derived_fact</code> kind (a value computed from other facts,
          such as &ldquo;Days since purchase&rdquo;) is part of the model but
          not yet creatable in the catalog. Until the derived-fact engine ships,
          model such values as system facts or compute them inside the table.
        </Callout>
      </DocSection>

      <DocSection title="Creating a fact">
        <p>
          Use <strong>New fact</strong> on the Facts tab. The editor dialog
          collects everything a fact needs:
        </p>
        <DefinitionList
          items={[
            [
              'Name',
              'The business label shown to users, e.g. "Purchase date".',
            ],
            [
              'Description',
              'Business meaning and edge cases. Helps logic authors pick the right fact.',
            ],
            [
              'Type',
              'string, number, bool, enum, date, or datetime. Drives normalization and validation.',
            ],
            [
              'Enum values',
              'For enum facts, the allowed values (one per line), e.g. Gold / Silver / Bronze.',
            ],
            ['Kind', 'Key, system fact, manual fact, or internal fact.'],
            [
              'Question',
              'Required for manual facts — the operator-facing prompt, e.g. "Was the item opened?".',
            ],
            [
              'Aliases',
              'Alternate names used for key extraction and matching copied text (one per line).',
            ],
            [
              'Sensitive & logging policy',
              'Marks a fact as sensitive and chooses how its value is stored: full, masked, hash, or omit.',
            ],
            ['Status', 'draft, active, or deprecated.'],
          ]}
        />
        <CodeBlock
          title="Example: two facts for a refund logic"
          code={`Customer tier
  Type: enum   Values: Gold, Silver, Bronze
  Kind: System fact          (resolved from the orders table)

Item opened
  Type: bool
  Kind: Manual fact
  Question: "Was the item opened?"`}
        />
      </DocSection>

      <DocSection title="Aliases and key extraction">
        <p>
          Aliases are how a single fact recognizes the many names it appears
          under. When an operator pastes copied text or a URL into the{' '}
          <a href={pageHref('decision-workspace')}>decision workspace</a>,
          LEVERIE matches those aliases to pull out key candidates.
        </p>
        <CodeBlock
          title="Example: Order ID aliases"
          code={`Order ID  (kind: key)
  aliases:
    order_id
    order #
    注文番号

Pasted text "Order #A-10293 / 注文番号 A-10293" → Order ID = A-10293`}
        />
        <Checklist
          items={[
            'Add the names your source systems and support tools actually use, including localized labels.',
            'Aliases must be unique within a workspace — the catalog rejects a duplicate so two facts never claim the same name.',
            'Keep aliases specific. Over-broad aliases cause the wrong column or token to be picked up as a key.',
          ]}
        />
      </DocSection>

      <DocSection title="Sensitive facts and logging">
        <p>
          Auditability must not become surveillance. A fact marked{' '}
          <strong>sensitive</strong> is masked in the runner unless the viewer
          has permission, and its logging policy controls what is actually
          persisted on a decision session.
        </p>
        <FeatureGrid
          items={[
            {
              icon: Lock,
              title: 'full',
              body: 'Store the value as-is. Reserved for non-sensitive facts or an explicit admin choice.',
            },
            {
              icon: ShieldCheck,
              title: 'masked',
              body: 'Store only a masked form (e.g. keep the last 4 characters). The default for sensitive facts.',
            },
            {
              icon: Tag,
              title: 'hash',
              body: 'Store a keyed hash — enough to match or de-duplicate, not to read back.',
            },
            {
              icon: EyeOff,
              title: 'omit',
              body: 'Store neither the value nor a masked form; keep only state and provenance.',
            },
          ]}
        />
        <Callout icon={ShieldCheck} title="Policy travels with the fact">
          The logging policy is part of the fact definition and is captured in
          the published snapshot, so every decision session that uses the fact
          obeys the same rule — including recorded replays.
        </Callout>
      </DocSection>

      <DocSection title="Binding facts to logic">
        <p>
          The engine still evaluates a table by its field IDs. A{' '}
          <strong>binding</strong> connects a logic field to a catalog fact, so
          the workspace can resolve by fact and then project the value into the
          field the engine expects. Bindings are managed on the{' '}
          <strong>Bindings &amp; readiness</strong> tab.
        </p>
        <FeatureGrid
          items={[
            {
              icon: Link2,
              title: 'Bind a field to a fact',
              body: 'Map each table field to a fact. Types must match, and enum values must be compatible, or the binding is rejected.',
            },
            {
              icon: ListChecks,
              title: 'Readiness checks',
              body: 'The tab lists blocking issues: a system fact with no resolver, a manual fact with no question, a sensitive fact with unsafe logging, and more.',
            },
            {
              icon: Database,
              title: 'Resolver path',
              body: 'A system fact needs an active resolver and data source. Connect a reference table or live connector, then map its columns to facts.',
            },
          ]}
        />
        <Callout icon={ListChecks} title="Readiness is enforced at publish">
          The checklist is also enforced server-side. Publishing a
          data-connected logic fails if a blocking issue remains, so a runner
          can never open a workspace whose facts cannot be resolved.
        </Callout>
      </DocSection>

      <DocSection title="From fact to running decision">
        <p>
          The catalog is the first step of a short pipeline. Putting it
          together:
        </p>
        <Checklist
          items={[
            'Define a key fact (Order ID) and the system facts it should resolve (Purchase date, Customer tier).',
            'Add the manual facts only humans can answer (Item opened) with a clear question.',
            'Connect a reference table or live connector and create a resolver that maps source columns to those system facts.',
            'Bind each logic field to its fact and clear the readiness checks.',
            'Publish — the fact definitions, bindings, resolvers, and data sources are snapshotted for that version.',
            'Share the runner URL; operators now start from the key and the catalog does the rest.',
          ]}
        />
        <p>
          See <a href={pageHref('decision-workspace')}>decision workspace</a>{' '}
          for what operators experience, and{' '}
          <a href={pageHref('publishing')}>publishing</a> for how a version is
          promoted and snapshotted.
        </p>
      </DocSection>
    </>
  );
}
