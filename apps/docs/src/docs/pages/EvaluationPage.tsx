import {
  Compass,
  Download,
  FileSpreadsheet,
  FlaskConical,
  PlayCircle,
  Sparkles,
  Upload,
} from 'lucide-react';
import {
  Callout,
  Checklist,
  DefinitionList,
  DocSection,
  FeatureGrid,
} from '../components';
import { asset, pageHref } from '../metadata';

export function EvaluationPage() {
  return (
    <>
      <DocSection title="Evaluation panel">
        <p>
          The evaluation panel is the shortest feedback loop in LEVERIE. While a
          table is open, you can fill in a realistic case, hit{' '}
          <strong>Evaluate</strong>, and see the matched row, the resulting
          outputs, and the path the engine took — without leaving the editor.
        </p>
        <p>
          The panel renders inputs as form controls that match the field type:
          enums become select boxes, numbers a right-aligned number input,
          booleans a segmented control, dates a date picker. Leave a field blank
          if the engine should treat it as <em>(unset)</em>.
        </p>
        <figure className="media-card">
          <img
            src={asset('editor-evaluation-trace.png')}
            alt="The evaluation panel on the right of the editor showing inputs for a P0 Enterprise ticket and a successful trace with the matched rows and outputs."
          />
          <figcaption>
            Filling in a real case in the evaluation panel and inspecting the
            matched rows, outputs, and trace.
          </figcaption>
        </figure>
      </DocSection>

      <DocSection title="Reading the trace">
        <p>
          The trace is not log spam; it is the explanation. Each step names the
          table that was evaluated, the row that matched, and the rows that were
          skipped along with the field that disqualified them. When a row
          continues into a child table, the next step in the trace is that child
          table.
        </p>
        <FeatureGrid
          items={[
            {
              icon: PlayCircle,
              title: 'Matched row',
              body: 'Highlighted with a checkmark. Click into the row in the table to see the original conditions and outputs.',
            },
            {
              icon: Compass,
              title: 'Skipped rows',
              body: 'Each skipped row lists the field that failed. Useful for diagnosing why an expected row did not match.',
            },
            {
              icon: Sparkles,
              title: 'Result block',
              body: 'When evaluation ends, the result block shows every output column by name — the same shape Hosted API returns.',
            },
          ]}
        />
        <Callout icon={Sparkles} title="Trace is part of the API surface">
          The name-only trace shown here is the same trace Hosted API and Hosted
          MCP return. See <a href={pageHref('hosted-api')}>Hosted API</a> for
          the response shape and <a href={pageHref('hosted-mcp')}>Hosted MCP</a>{' '}
          for how agents see it.
        </Callout>
      </DocSection>

      <DocSection title="Batch testing">
        <p>
          Single-case evaluation is for the fast loop while writing rules. Batch
          test is for regression — running tens or hundreds of cases at once
          before publishing. Open it from the More actions menu (Batch test),
          upload a CSV of inputs and expected outputs, and review which rows
          pass, which fail, and what each one actually returned.
        </p>
        <figure className="media-card">
          <img
            src={asset('editor-batch-test.png')}
            alt="The Batch test dialog with a short explanation and Load CSV and Download template buttons."
          />
          <figcaption>
            The Batch test dialog. Download template gives you a CSV with the
            right columns; Load CSV runs your filled-in cases.
          </figcaption>
        </figure>
        <DefinitionList
          items={[
            [
              'CSV columns',
              'One column per field, then output_<name> columns for expected outputs. Unset values are blank cells.',
            ],
            [
              'Pass vs Fail',
              'A row passes when every expected output matches what the engine returned. Mismatches show what was expected and what was actually returned.',
            ],
            [
              'Edit jump',
              'Each failing row has an Edit shortcut. It closes the dialog, selects the offending table, and scrolls the matched row into view so you can fix it immediately.',
            ],
          ]}
        />
      </DocSection>

      <DocSection title="Sample templates">
        <p>
          You don&apos;t have to start from a blank page. An empty table shows a{' '}
          <strong>Start from a sample</strong> button that opens the Sample
          templates dialog, which ships with realistic starting points —
          customer support routing, refund eligibility, loan review, and more —
          each with fields, tables, and example rows already wired up.
        </p>
        <figure className="media-card">
          <img
            src={asset('editor-templates.png')}
            alt="The Sample templates dialog listing several business-domain templates such as customer support routing and refund eligibility."
          />
          <figcaption>
            Templates are a fast way to see what a healthy multi-table logic
            looks like. Pick one, then edit it into your own rule.
          </figcaption>
        </figure>
        <Callout
          icon={FlaskConical}
          title="Create new, or replace the current draft"
        >
          The dialog can create a new draft from a sample or replace the one you
          are editing. Replacing overwrites the current draft, so save a backup
          of anything you want to keep first.
        </Callout>
      </DocSection>

      <DocSection title="Backups: Open file and Save backup">
        <p>
          The File group in the More actions menu lets you move logic between
          machines or save a checkpoint before a risky refactor. These entries
          appear in local mode; cloud mode persists through autosave and
          publishing instead.
        </p>
        <FeatureGrid
          items={[
            {
              icon: Download,
              title: 'Save backup',
              body: 'Downloads the current logic as a JSON file. Keep these in version control if you treat logic as code.',
            },
            {
              icon: Upload,
              title: 'Open file',
              body: 'Loads a JSON file produced by Save backup. Validation runs immediately so a malformed file cannot corrupt the editor.',
            },
            {
              icon: FileSpreadsheet,
              title: 'New',
              body: 'Clears the current draft. In local mode this is destructive — save a backup first if you want to keep the work.',
            },
          ]}
        />
        <Checklist
          items={[
            'Use single evaluation while you are still drafting the rules.',
            'Use batch test before promoting a draft to production.',
            'Keep a small library of canonical test cases — at minimum one per major branch and one no-match case.',
            'Save a backup of the logic JSON after a milestone so you can restore it without relying on browser storage.',
          ]}
        />
      </DocSection>
    </>
  );
}
