import {
  Cloud,
  HardDrive,
  LayoutPanelLeft,
  MousePointer2,
  Sparkles,
} from 'lucide-react';
import {
  Callout,
  DefinitionList,
  DocSection,
  FeatureGrid,
} from '../components';
import { asset, pageHref } from '../metadata';

export function EditorPage() {
  return (
    <>
      <DocSection title="Opening the editor">
        <p>
          The editor is the surface where business rules are authored, reviewed,
          and tested. You can open it without signing in: visit{' '}
          <a href="/edit">/edit</a> or click{' '}
          <strong>Open the free editor</strong> from the home page. A sample
          logic is preloaded so you have something to look at on the first
          visit.
        </p>
        <p>
          You can stay in local mode (data is saved in your browser only) or
          sign in to save into a cloud workspace and share with teammates. See
          the <a href={pageHref('workspace')}>Workspace management</a> page for
          the team setup, and <a href={pageHref('publishing')}>Publishing</a>{' '}
          for the draft to production loop.
        </p>
      </DocSection>

      <DocSection title="Workspace layout">
        <p>
          The editor is a three-part workspace. A header runs across the top, a
          sidebar on the left holds the logic&apos;s name, description, and
          field definitions, and the center is the table or flowchart you are
          editing — with the table tabs and a collapsible logic overview sitting
          above it. When you are ready to try a case, the evaluation panel
          slides in from the right.
        </p>
        <figure className="media-card">
          <img
            src={asset('editor-table.png')}
            alt="LEVERIE editor with header, left sidebar showing the logic name and field definitions, table tabs and the decision table in the center, and the evaluation panel on the right."
          />
          <figcaption>
            Header (top), sidebar (left), decision table (center), and
            evaluation panel (right). The same logic is the source of all four.
          </figcaption>
        </figure>
        <FeatureGrid
          items={[
            {
              icon: LayoutPanelLeft,
              title: 'Sidebar',
              body: 'Holds the logic name, description, and field definitions — the typed inputs every table shares.',
            },
            {
              icon: MousePointer2,
              title: 'Main work area',
              body: 'Tables are tabs across the top, with a collapsible logic overview above and a table or flowchart view below.',
            },
            {
              icon: Sparkles,
              title: 'Evaluation panel',
              body: 'A docked panel for trying a single case, reading the trace, and jumping to the matched row.',
            },
          ]}
        />
      </DocSection>

      <DocSection title="Header controls">
        <p>
          The header keeps account, history, and document-wide actions in reach.
          It is the same in local and cloud mode; only the labels change.
        </p>
        <DefinitionList
          items={[
            [
              'Language',
              'Toggles the entire editor between English and Japanese. The choice is remembered per browser.',
            ],
            [
              'Account and workspace',
              'Shows the current mode (local or cloud), the active workspace and logic, and links to sign in or open organization settings.',
            ],
            [
              'Undo and redo',
              'Reverse or re-apply the last structural edit. The shortcuts are ⌘Z and ⇧⌘Z (Ctrl on Windows or Linux).',
            ],
            [
              'More actions',
              'A menu for New, Open file, Save backup, and Batch test. New is destructive in local mode; save a backup first if you want to keep your work. Open file and Save backup appear in local mode only.',
            ],
            [
              'Docs',
              'Opens this documentation in a new tab so you can keep the editor open beside it.',
            ],
          ]}
        />
        <figure className="media-card">
          <img
            src={asset('editor-more-actions.png')}
            alt="The More actions menu in the LEVERIE editor header with File and Tools sections."
          />
          <figcaption>
            The More actions menu groups document operations (File: New, Open
            file, Save backup) and authoring tools (Tools: Batch test).
          </figcaption>
        </figure>
      </DocSection>

      <DocSection title="Left sidebar">
        <p>
          The sidebar holds the parts of the logic that stay constant as you
          move between tables.
        </p>
        <DefinitionList
          items={[
            [
              'Logic name and description',
              'Name the logic and describe what it decides. In cloud mode the same area surfaces draft, publish, and workspace controls.',
            ],
            [
              'Field Definitions',
              'The typed inputs the logic understands. Names entered here become the keys callers send through Hosted API and Hosted MCP.',
            ],
          ]}
        />
        <Callout icon={MousePointer2} title="Tables and the table graph moved">
          The list of tables now lives as tabs across the top of the main work
          area, and the miniature table graph is the collapsible{' '}
          <strong>Logic overview</strong> above the table. The Field Definitions
          header still collapses, and on narrower screens the sidebar scrolls
          independently so a large field list does not push the table
          off-screen.
        </Callout>
      </DocSection>

      <DocSection title="Main work area">
        <p>
          The center of the editor is the table you are currently working on.
          Tables are tabs across the top — the entry table carries an entry icon
          — and a collapsible Logic overview above them shows how the tables
          connect. Two buttons on the right toggle between authoring views.
        </p>
        <FeatureGrid
          items={[
            {
              icon: LayoutPanelLeft,
              title: 'Table view',
              body: 'The authoring view. Add rows, edit conditions, set output columns, reorder columns, duplicate rows.',
            },
            {
              icon: Sparkles,
              title: 'Flowchart view',
              body: 'A read-only structural view. Useful for explaining or reviewing how multiple tables chain into each other.',
            },
            {
              icon: MousePointer2,
              title: 'Table-level menu',
              body: 'The More actions button next to the view toggle holds rename, duplicate, and delete operations for the current table.',
            },
          ]}
        />
        <p>
          See <a href={pageHref('tables')}>Tables and flowchart</a> for how
          rows, conditions, output columns, and the flowchart view work in
          detail.
        </p>
      </DocSection>

      <DocSection title="Cloud and local modes">
        <p>
          The Account and workspace control in the header always shows the
          current mode. Local mode is the default for first-time visitors.
        </p>
        <figure className="media-card">
          <img
            src={asset('editor-cloud-menu.png')}
            alt="The Account and workspace menu in the editor, currently in local mode with Sign in to save online options."
          />
          <figcaption>
            The Account and workspace menu shows status, sign-in, and workspace
            switching when you are signed in.
          </figcaption>
        </figure>
        <FeatureGrid
          items={[
            {
              icon: HardDrive,
              title: 'Local mode',
              body: 'Logic is saved in browser storage only. No account is needed. Use Open file and Save backup to move between machines.',
            },
            {
              icon: Cloud,
              title: 'Cloud mode',
              body: 'Logic is autosaved to a workspace. Teammates with the right role can edit, run, or review the same logic.',
            },
          ]}
        />
        <Callout icon={Cloud} title="Moving a local draft to the cloud">
          When you sign in or sign up while a local draft is open, the editor
          keeps that draft and offers it as a new cloud logic once you reach
          your workspace — without overwriting anything already there.
        </Callout>
      </DocSection>
    </>
  );
}
