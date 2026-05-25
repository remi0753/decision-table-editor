import {
  ArrowRight,
  CheckCircle2,
  FileJson2,
  GitFork,
  Network,
  Plus,
  Table2,
} from 'lucide-react';
import {
  Callout,
  DefinitionList,
  DocSection,
  FeatureGrid,
} from '../components';
import { asset, pageHref } from '../metadata';

export function TablesPage() {
  return (
    <>
      <DocSection title="Decision tables">
        <p>
          A decision table is an ordered list of rows. Each row describes one
          case: the conditions a row requires, and what should happen when those
          conditions are met. The engine reads the rows top-down and stops at
          the first match. This <em>first matching row wins</em> rule is what
          makes the logic deterministic.
        </p>
        <p>
          You do not need a separate language for the rules; the table is the
          rule. If a behavior is hard to express in one row, that is usually a
          signal to split the table into two or to add an output column.
        </p>
        <figure className="media-card">
          <img
            src={asset('editor-table.png')}
            alt="The customer support ticket routing sample, showing four rows that route incoming tickets by priority and customer tier."
          />
          <figcaption>
            The Customer support ticket routing sample. Row 1 matches an
            Enterprise P0 ticket and continues into the Escalation table; the
            last row catches everything else.
          </figcaption>
        </figure>
      </DocSection>

      <DocSection title="Fields and output columns">
        <p>
          Fields are the typed inputs the logic understands. They are defined
          once in the left sidebar (Field Definitions) and reused across tables.
          The field name is the key that external callers will send through{' '}
          <a href={pageHref('hosted-api')}>Hosted API</a> and{' '}
          <a href={pageHref('hosted-mcp')}>Hosted MCP</a>.
        </p>
        <DefinitionList
          items={[
            [
              'Enum',
              'Choose from a controlled list. Best for things like priority, customer tier, region, or category.',
            ],
            [
              'Number',
              'Use for thresholds, scores, amounts, quantities, and durations.',
            ],
            [
              'Boolean',
              'Yes or no signals such as fraud flags or membership status.',
            ],
            [
              'Date and datetime',
              'For windows, deadlines, and age-of-case checks. The editor enforces a consistent format.',
            ],
            [
              'Text',
              'Free-form values. Avoid when an enum could express the same idea — enums catch typos and give nicer UI.',
            ],
          ]}
        />
        <p>
          Output columns sit on the right side of every table. Instead of a
          single opaque answer like &quot;rejected,&quot; a row can return
          several named values, for example <code>decision</code>,{' '}
          <code>queue</code>, <code>sla</code>, <code>reviewer</code>. External
          callers receive these as a structured response.
        </p>
        <Callout icon={FileJson2} title="Name fields and outputs deliberately">
          Field and output names are part of your API surface. Renaming them
          later is a breaking change for any integration already consuming the
          logic.
        </Callout>
      </DocSection>

      <DocSection title="Rows and conditions">
        <p>
          Every row is a sequence of condition cells, one per condition column.
          A cell can require a specific value, a range, an inequality, or be
          left as <em>(no condition)</em> to mean &quot;any value matches.&quot;
          The supported operators depend on the field type — enums offer{' '}
          <code>equal to</code> and <code>in</code>, numbers add{' '}
          <code>&gt;</code>, <code>&lt;</code>, and <code>between</code>, dates
          add window operators, and so on.
        </p>
        <FeatureGrid
          items={[
            {
              icon: Plus,
              title: 'Insert row below',
              body: 'Use the hover button at the start of any row to add a new row directly underneath. New rows start with no conditions.',
            },
            {
              icon: Table2,
              title: 'Duplicate row',
              body: 'Duplicate keeps all conditions and the output. Useful when one row is almost right and you only need to tweak a field.',
            },
            {
              icon: ArrowRight,
              title: 'Reorder columns',
              body: 'Drag the column header to reorder conditions. Output columns are kept on the right and managed separately.',
            },
          ]}
        />
      </DocSection>

      <DocSection title="Multi-table logic">
        <p>
          Real-world rules rarely fit in a single table. LEVERIE expects you to
          split work across tables: a high-level triage table on top, and
          focused child tables for each branch. A row&apos;s conclusion can be a
          direct output (set output columns) or a <em>continue</em> that tells
          the engine which child table to evaluate next.
        </p>
        <Callout icon={GitFork} title="When to split a table">
          When two unrelated condition shapes appear in the same table — for
          example, a priority dimension and a category dimension that don&apos;t
          actually combine — split them into separate tables. The flowchart view
          makes overgrown single tables obvious.
        </Callout>
      </DocSection>

      <DocSection title="Flowchart view">
        <p>
          The Flowchart toggle next to the table&apos;s name swaps the authoring
          grid for a read-only flowchart. The flowchart is the fastest way to
          explain a multi-table logic to someone who hasn&apos;t opened the
          editor before, and the easiest way to spot tables that have grown
          unwieldy.
        </p>
        <figure className="media-card">
          <img
            src={asset('editor-flowchart.png')}
            alt="The flowchart view of the support ticket routing logic showing the Triage table on the left and child tables Escalation and Standard routing on the right."
          />
          <figcaption>
            The flowchart view shows the Triage table branching into Escalation
            or Standard routing. Each box is a table you can click into.
          </figcaption>
        </figure>
        <p>
          The sidebar also shows a smaller version of the same graph at the top,
          so you can navigate while staying in the table view.
        </p>
      </DocSection>

      <DocSection title="Quality checks">
        <p>
          Quality checks run continuously and surface issues directly in the
          editor. Some findings are hard errors that will block evaluation;
          others are review prompts that tell the author where intent should be
          confirmed.
        </p>
        <FeatureGrid
          items={[
            {
              icon: CheckCircle2,
              title: 'Duplicate awareness',
              body: 'Finds rows that express the same condition pattern, which may indicate accidental copy-paste.',
            },
            {
              icon: Network,
              title: 'Coverage review',
              body: 'Warns about missing branches in enum-heavy logic before a no-match shows up in production.',
            },
            {
              icon: FileJson2,
              title: 'Schema alignment',
              body: 'Keeps the input and output shapes consistent with what API and MCP callers will receive.',
            },
          ]}
        />
        <Callout icon={CheckCircle2} title="Warnings are part of review">
          A warning does not always mean the logic is wrong. It means the author
          should decide whether the uncovered branch or overlap is intentional.
        </Callout>
      </DocSection>
    </>
  );
}
