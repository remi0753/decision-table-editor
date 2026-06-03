import {
  Cloud,
  HardDrive,
  LayoutPanelLeft,
  MousePointer2,
  Smartphone,
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
        <Callout icon={Smartphone} title="Built for larger screens">
          The editor is a fixed three-column layout, so on a phone a short
          guidance page appears instead of the editor. You can still continue to
          the editor anyway: it then renders at its full width and you scroll
          horizontally to reach every pane. For real authoring a desktop or
          tablet is recommended.
        </Callout>
      </DocSection>

      <DocSection title="Workspace layout">
        <p>
          The editor is a three-part workspace. A header runs across the top —
          the current logic&apos;s name and switcher sit on the left, document
          actions on the right — a sidebar on the left holds the logic&apos;s
          field definitions, and the center is the table or flowchart you are
          editing — with the table tabs and a collapsible logic overview sitting
          above it. When you are ready to try a case, the evaluation panel
          slides in from the right.
        </p>
        <figure className="media-card">
          <img
            src={asset('editor-table.png')}
            alt="LEVERIE editor with header carrying the logic switcher, a left sidebar of field definitions, table tabs and the decision table in the center, and the evaluation panel on the right."
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
              body: 'Holds the field definitions — the typed inputs every table shares. Add one with the + button; click a field to edit it in a dialog.',
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
              'Logic name and switcher',
              'The pill next to the logo shows the current logic and its production version (or "Draft only"). Click it to rename the logic, and in cloud mode to search, switch between the workspace’s logics, and create new ones.',
            ],
            [
              'Undo and redo',
              'Reverse or re-apply the last structural edit. The shortcuts are ⌘Z and ⇧⌘Z (Ctrl on Windows or Linux).',
            ],
            [
              'Publish',
              'In cloud mode, an editor sees a Publish button here. It opens the diff review and promotes the current draft to a new production version.',
            ],
            [
              'More actions',
              'A menu grouped into This logic and Tools. This logic holds Share Runner, Use via API, and Duplicate in cloud mode, Open file and Save backup in local mode, and Delete when you are allowed to remove the logic. Tools holds Batch test.',
            ],
            [
              'Docs',
              'Opens this documentation in a new tab so you can keep the editor open beside it.',
            ],
            [
              'Language',
              'Toggles the entire editor between English and Japanese. The choice is remembered per browser.',
            ],
            [
              'Account and workspace',
              'Shows the current mode (local or cloud) and the active workspace, and links to sign in or open organization settings.',
            ],
          ]}
        />
        <figure className="media-card">
          <img
            src={asset('editor-more-actions.png')}
            alt="The More actions menu in the LEVERIE editor header with This logic and Tools sections."
          />
          <figcaption>
            The More actions menu groups logic operations (This logic: Share
            Runner, Use via API, Duplicate, and Delete in cloud mode; Open file
            and Save backup in local mode) and authoring tools (Tools: Batch
            test).
          </figcaption>
        </figure>
      </DocSection>

      <DocSection title="Left sidebar">
        <p>
          The sidebar is dedicated to <strong>Field Definitions</strong> — the
          part of the logic that stays constant as you move between tables.
        </p>
        <DefinitionList
          items={[
            [
              'Field Definitions',
              'The typed inputs the logic understands. Names entered here become the keys callers send through Hosted API and Hosted MCP.',
            ],
            [
              'Add and edit fields',
              'Use the + button in the Field Definitions header to add a field, or click an existing field to open its editor dialog — name, type, and, for enums, the list of allowed values.',
            ],
          ]}
        />
        <Callout
          icon={MousePointer2}
          title="Name, description, and tables moved"
        >
          The logic name and description are no longer in the sidebar — they
          live in the header, behind the logic switcher pill. The list of tables
          now lives as tabs across the top of the main work area, and the
          miniature table graph is the collapsible{' '}
          <strong>Logic overview</strong> above the table. On narrower screens
          the sidebar scrolls independently so a large field list does not push
          the table off-screen.
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
