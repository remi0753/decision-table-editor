import { Bot, ShieldCheck, Table2 } from 'lucide-react';
import { DefinitionList, DocSection, FeatureGrid } from '../components';
import { asset, pageHref } from '../metadata';

export function IntroductionPage() {
  return (
    <>
      <DocSection title="What LEVERIE solves">
        <p>
          LEVERIE is for rules that teams already understand, but that become
          fragile when they are reimplemented in application code or copied into
          prompts. A refund policy, review queue, escalation matrix, approval
          threshold, or loan triage table is usually deterministic. The hard
          part is keeping the rule readable after it becomes software.
        </p>
        <p>
          LEVERIE keeps those rules as decision tables. Authors can see the
          fields, rows, ordering, and outputs directly. Engineers and AI agents
          can call the published version through Hosted API or Hosted MCP
          without learning the editor&apos;s internal data model.
        </p>
        <FeatureGrid
          items={[
            {
              icon: Table2,
              title: 'Author in tables',
              body: 'Rules stay close to how operations teams already write them: ordered rows, conditions, and named outcomes.',
            },
            {
              icon: ShieldCheck,
              title: 'Run stable versions',
              body: 'External callers default to a production snapshot so audits, logs, and replay stay meaningful.',
            },
            {
              icon: Bot,
              title: 'Expose agent tools',
              body: 'Hosted MCP turns each accessible production logic into a schema-rich tool an agent can choose safely.',
            },
          ]}
        />
      </DocSection>

      <DocSection title="How the platform is shaped">
        <p>
          LEVERIE has two connected surfaces. The editor is the human surface:
          it helps authors create and review logic without JSON. The hosted
          integration surface is the runtime surface: it lets systems and LLM
          clients evaluate the approved logic with authentication, scopes, rate
          limits, and execution logs.
        </p>
        <p>
          This separation is intentional. Authors can continue iterating on a
          draft while production callers keep using the pinned version. When the
          draft is ready, the team publishes a new version and integrations can
          move forward deliberately.
        </p>
        <figure className="media-card">
          <img
            src={asset('editor-overview.png')}
            alt="Actual LEVERIE editor showing a customer support routing sample with the decision table, the logic overview, and the evaluation panel."
          />
          <figcaption>
            The same logic artifact is edited visually, reviewed by people, and
            executed by API or MCP callers after publishing.
          </figcaption>
        </figure>
      </DocSection>

      <DocSection title="Core concepts">
        <DefinitionList
          items={[
            [
              'Logic',
              'A complete decision model with fields, tables, rows, outputs, metadata, and versions.',
            ],
            [
              'Field',
              'A typed input such as enum, number, boolean, string, or date. Field names are accepted by external callers.',
            ],
            [
              'Decision table',
              'An ordered set of rows. The first matching row returns a conclusion or continues into another table.',
            ],
            [
              'Output column',
              'A named result value such as decision, queue, reason, SLA, or reviewer. API responses use these names.',
            ],
            [
              'Trace',
              'A name-only explanation of tables visited, matched rows, skipped rows, and failed fields.',
            ],
            [
              'Production version',
              'An immutable snapshot selected for stable integrations. Hosted MCP only advertises logics with production versions.',
            ],
          ]}
        />
      </DocSection>

      <DocSection title="Recommended first path">
        <ol className="steps">
          <li>
            Open the <a href="/edit">editor</a> — no account required. Tour the
            layout in <a href={pageHref('editor')}>Editor overview</a>, then
            load a starting point from{' '}
            <a href={pageHref('evaluation')}>Sample templates</a> or build one
            in <a href={pageHref('tables')}>Tables and flowchart</a>.
          </li>
          <li>
            Use the <a href={pageHref('evaluation')}>evaluation panel</a> to run
            representative cases, including edge cases and no-match cases.
          </li>
          <li>
            Sign in to save into a cloud workspace. See{' '}
            <a href={pageHref('workspace')}>Workspace management</a> for the
            organization, member, and role model.
          </li>
          <li>
            <a href={pageHref('publishing')}>Publish</a> the reviewed draft so
            the runtime has a stable production snapshot, and{' '}
            <a href={pageHref('sharing')}>share a runner</a> with a stakeholder
            for sign-off.
          </li>
          <li>
            Create an <a href={pageHref('api-keys')}>API key</a> with the
            narrowest workspace and logic scope that matches the caller.
          </li>
          <li>
            Start with <a href={pageHref('hosted-api')}>Hosted API</a> for
            direct service calls, or{' '}
            <a href={pageHref('hosted-mcp')}>Hosted MCP</a> for LLM agents.
          </li>
        </ol>
        <p>
          The fastest useful pilot is usually one existing spreadsheet or wiki
          rule that already has a clear owner. Importing every policy at once is
          tempting, but LEVERIE works best when the first logic is small enough
          to review end to end.
        </p>
      </DocSection>
    </>
  );
}
