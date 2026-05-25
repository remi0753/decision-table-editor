import { Cloud, GitBranch, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  Callout,
  Checklist,
  DefinitionList,
  DocSection,
  FeatureGrid,
} from '../components';
import { pageHref } from '../metadata';

export function PublishingPage() {
  return (
    <>
      <DocSection title="Draft vs production">
        <p>
          A draft is the editable state of a logic. It may be incomplete,
          temporarily inconsistent, or halfway through a refactor. Production is
          an immutable version selected for external callers. LEVERIE keeps
          these states separate so an author can keep working without changing
          what an integration sees.
        </p>
        <p>
          <a href={pageHref('hosted-mcp')}>Hosted MCP</a> only lists logics that
          have a production version pinned.{' '}
          <a href={pageHref('hosted-api')}>Hosted API</a> defaults to
          production. This protects agents and services from seeing half-edited
          logic.
        </p>
        <DefinitionList
          items={[
            [
              'Draft',
              'Editable workspace state. Best for authoring and internal experimentation. Cannot be called by Hosted API.',
            ],
            [
              'Latest',
              'The newest saved version. Useful for controlled testing when explicitly requested.',
            ],
            [
              'Production',
              'The pinned snapshot used by default by API and MCP callers.',
            ],
            [
              'vN',
              'A specific immutable version number used for replay, regression tests, or backfills.',
            ],
          ]}
        />
      </DocSection>

      <DocSection title="Cloud autosave">
        <p>
          When you are signed in, every meaningful edit autosaves to the draft.
          The header shows save status next to the workspace name. If two people
          edit at once, the second save returns a conflict and the editor stops
          autosaving until the user reloads — there are no silent overwrites.
        </p>
        <FeatureGrid
          items={[
            {
              icon: Cloud,
              title: 'Autosave',
              body: 'Debounced saves push the current draft to the cloud as you work.',
            },
            {
              icon: RefreshCw,
              title: 'Conflict detection',
              body: 'A draft revision number guards every save. Conflicts pause autosave and surface a clear notice.',
            },
            {
              icon: ShieldCheck,
              title: 'Local fallback',
              body: 'When signed out, the editor falls back to local storage. You can move that draft to the cloud at sign-up time.',
            },
          ]}
        />
      </DocSection>

      <DocSection title="Version selection">
        <p>
          External callers choose versions with different levels of stability.
          The recommended default is production. Use latest only for controlled
          pre-production testing, and use vN when you need deterministic replay
          of an old behavior.
        </p>
        <FeatureGrid
          items={[
            {
              icon: ShieldCheck,
              title: 'production',
              body: 'Stable behavior for agents, workflows, and customer-facing systems.',
            },
            {
              icon: GitBranch,
              title: 'latest',
              body: 'Useful for test harnesses that intentionally follow the newest saved version.',
            },
            {
              icon: Cloud,
              title: 'vN',
              body: 'Use exact version numbers for audit replay, comparisons, and migration checks.',
            },
          ]}
        />
        <Callout
          icon={ShieldCheck}
          title="Stakeholder review before production"
        >
          The <a href={pageHref('sharing')}>Sharing and runners</a> page covers
          how to send a runner URL to a stakeholder for sign-off before you pin
          a new production version.
        </Callout>
      </DocSection>

      <DocSection title="Publishing habits">
        <Checklist
          items={[
            'Publish when the meaning of the decision changes, not after every cosmetic edit.',
            'Run representative success, rejection, manual-review, and no-match examples before promotion.',
            'Check warnings and document which ones are intentional.',
            'Coordinate API consumers when output names or enum values change.',
            'Keep production pinned until stakeholders have reviewed the new behavior.',
          ]}
        />
      </DocSection>
    </>
  );
}
