import {
  ArrowRight,
  Bot,
  CheckCircle2,
  GitBranch,
  Play,
  ShieldCheck,
  Sparkles,
  Table2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import logoUrl from '@/assets/logo.svg';

export function TopPage() {
  const startGuestEditor = () => {
    sessionStorage.setItem('leverie-editor-mode', 'guest');
  };

  return (
    <div className="min-h-screen bg-violet-50 text-gray-950">
      <header className="fixed inset-x-0 top-0 z-30 border-b border-violet-200 bg-white/90 px-4 backdrop-blur md:px-8">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4">
          <a href="/" aria-label="LEVERIE top">
            <img src={logoUrl} alt="LEVERIE" className="h-9" />
          </a>
          <nav className="hidden items-center gap-7 text-sm font-medium text-gray-600 md:flex">
            <a href="#value" className="hover:text-violet-800">
              Features
            </a>
            <a href="#flow" className="hover:text-violet-800">
              How it works
            </a>
            <a href="#fit" className="hover:text-violet-800">
              Use cases
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <a
              href="/auth"
              className="whitespace-nowrap rounded-md border border-violet-200 bg-white/80 px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-white hover:text-violet-800"
            >
              Sign in
            </a>
            <a
              href="/edit"
              onClick={startGuestEditor}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700"
            >
              <span className="sm:hidden">Try it</span>
              <span className="hidden sm:inline">Try it free</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="relative min-h-[92vh] overflow-hidden px-4 pb-14 pt-28 md:px-8 md:pt-32">
          <div
            className="absolute inset-0 opacity-[0.38]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(109,40,217,.13) 1px, transparent 1px), linear-gradient(90deg, rgba(109,40,217,.13) 1px, transparent 1px)',
              backgroundSize: '44px 44px',
            }}
          />
          <div className="absolute right-[-10vw] top-20 hidden h-[76vh] w-[60vw] rotate-[-5deg] rounded-[32px] border border-violet-200 bg-white/88 shadow-2xl shadow-violet-950/15 lg:block">
            <DecisionWorkspacePreview />
          </div>
          <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="flex min-h-[64vh] flex-col justify-center pb-4">
              <p className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-violet-200 bg-white/85 px-3 py-1 text-sm font-semibold text-violet-700">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Business rules, readable to humans &amp; AI
              </p>
              <h1 className="max-w-3xl text-5xl font-semibold leading-[1.06] tracking-normal text-gray-950 md:text-7xl">
                Grow decision rules
                <br />
                in tables, not code.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-gray-700 md:text-xl">
                LEVERIE turns "if this, then that" logic — for triage, reviews,
                approvals, and routing — into spreadsheet-style decision tables
                your team can build, verify, and share.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a
                  href="/edit"
                  onClick={startGuestEditor}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-violet-600 px-5 py-3 text-base font-semibold text-white shadow-lg shadow-violet-600/25 hover:bg-violet-700"
                >
                  Open the free editor
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </a>
                <a
                  href="/auth"
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-violet-200 bg-white/80 px-5 py-3 text-base font-semibold text-gray-800 shadow-sm hover:bg-white hover:text-violet-800"
                >
                  Use with your team
                </a>
              </div>
              <div className="mt-8 grid max-w-2xl gap-3 text-sm font-medium text-gray-600 sm:grid-cols-3">
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-violet-600" />
                  No JSON required
                </span>
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-violet-600" />
                  Conflict detection
                </span>
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-violet-600" />
                  AI-ready output
                </span>
              </div>
            </div>
            <div className="relative lg:hidden">
              <div className="overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-2xl shadow-violet-950/15">
                <DecisionWorkspacePreview />
              </div>
            </div>
          </div>
        </section>

        <section
          id="value"
          className="border-y border-violet-200 bg-white px-4 py-28 md:px-8 md:py-36"
        >
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-violet-600">
                Why LEVERIE
              </p>
              <h2 className="mt-5 text-4xl font-semibold leading-tight tracking-normal md:text-6xl">
                One place to write, inspect, and trust every rule.
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600">
                LEVERIE keeps business rules in the shape teams already
                understand: a table. The editor makes the important parts
                visible without exposing JSON or implementation details.
              </p>
            </div>
            <div className="mt-16 overflow-hidden rounded-[28px] border border-violet-200 bg-violet-50 shadow-2xl shadow-violet-950/10">
              <DecisionWorkspacePreview />
            </div>
            <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-3">
              <FeaturePoint
                icon={<Table2 />}
                title="Spreadsheet-shaped"
                body="Rows, conditions, and outcomes stay readable to operators and managers."
              />
              <FeaturePoint
                icon={<ShieldCheck />}
                title="Quality visible"
                body="Coverage warnings and duplicate checks appear beside the table."
              />
              <FeaturePoint
                icon={<Bot />}
                title="Executable by AI"
                body="The same table can become deterministic logic for agents and systems."
              />
            </div>
          </div>
        </section>

        <section id="flow" className="bg-violet-50 px-4 py-28 md:px-8 md:py-36">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-violet-700">
                From Rulebook To Running Logic
              </p>
              <h2 className="mt-5 text-4xl font-semibold leading-tight tracking-normal md:text-6xl">
                Test the rule while the reasoning is still in front of you.
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-gray-600">
                Instead of asking someone to re-create a decision in code, try
                real inputs in the editor and see the matched row, output, and
                explanation immediately.
              </p>
            </div>
            <div className="mt-16 grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-stretch">
              <div className="grid gap-4">
                <FlowStep
                  number="01"
                  title="Define the inputs"
                  body="Customer type, amount, request reason, date, status — each field gets a type once and can be reused across tables."
                />
                <FlowStep
                  number="02"
                  title="Run a real case"
                  body="Enter a sample case in the evaluation panel and let the engine pick the first matching row."
                />
                <FlowStep
                  number="03"
                  title="Show the trace"
                  body="The answer is paired with the exact rule path, so reviewers can confirm why it happened."
                />
              </div>
              <EvaluationWorkbenchPreview />
            </div>
          </div>
        </section>

        <section
          id="fit"
          className="bg-violet-950 px-4 py-28 text-white md:px-8 md:py-36"
        >
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-violet-200">
                Use Cases
              </p>
              <h2 className="mt-5 text-4xl font-semibold leading-tight tracking-normal md:text-6xl">
                Built for decisions that must stay explainable.
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/70">
                Refunds, approvals, eligibility, routing: if the same input
                should always reach the same answer, LEVERIE gives the team a
                shared surface to review it before it reaches production.
              </p>
            </div>
            <div className="mt-16 overflow-hidden rounded-[28px] border border-white/12 bg-white/[0.04] shadow-2xl shadow-black/30">
              <RunnerReviewPreview />
            </div>
            <div className="mt-10 flex justify-center">
              <a
                href="/edit"
                onClick={startGuestEditor}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-base font-semibold text-violet-950 hover:bg-violet-50"
              >
                Play with a sample
                <Play className="h-5 w-5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function FeaturePoint({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-md border border-violet-200 bg-white p-5 shadow-sm">
      <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-md bg-violet-600 text-white [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-gray-600">{body}</p>
    </div>
  );
}

function FlowStep({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-md border border-violet-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-600">
        {number}
      </p>
      <h3 className="mt-4 text-xl font-semibold text-gray-950">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-gray-600">{body}</p>
    </div>
  );
}

function EvaluationWorkbenchPreview() {
  return (
    <div className="rounded-[28px] border border-violet-200 bg-white p-4 shadow-2xl shadow-violet-950/10">
      <div className="flex items-center justify-between border-b border-violet-100 px-2 pb-4">
        <div>
          <p className="text-sm font-semibold text-gray-950">
            Evaluation panel
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Try a case without leaving the rule table
          </p>
        </div>
        <span className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white">
          Run test
        </span>
      </div>
      <div className="grid gap-4 pt-4 md:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-3">
          {[
            ['Customer', 'Individual'],
            ['Amount', '¥320,000'],
            ['KYC', 'Verified'],
            ['Request', 'New application'],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-md border border-violet-100 bg-violet-50/70 p-3"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-violet-500">
                {label}
              </p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {value}
              </p>
            </div>
          ))}
        </div>
        <div className="rounded-md border border-violet-200 bg-white">
          <div className="border-b border-violet-100 bg-violet-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">
              Trace
            </p>
          </div>
          <div className="space-y-3 p-4">
            <TraceItem
              status="checked"
              title="Intake decision"
              body="Row 2 matched: Individual + verified + under ¥500K."
            />
            <TraceItem status="checked" title="Output" body="Auto-approve" />
            <TraceItem
              status="warning"
              title="Coverage"
              body="Two edge cases still need explicit rules."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function TraceItem({
  status,
  title,
  body,
}: {
  status: 'checked' | 'warning';
  title: string;
  body: string;
}) {
  return (
    <div className="grid grid-cols-[1.75rem_1fr] gap-3">
      <div
        className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full ${
          status === 'checked'
            ? 'bg-violet-600 text-white'
            : 'bg-violet-100 text-violet-700'
        }`}
      >
        {status === 'checked' ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : (
          <ShieldCheck className="h-4 w-4" />
        )}
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-950">{title}</p>
        <p className="mt-1 text-sm leading-6 text-gray-600">{body}</p>
      </div>
    </div>
  );
}

function RunnerReviewPreview() {
  const useCases = [
    ['Inquiry routing', 'Send complex requests to the right team.'],
    ['Refunds & claims', 'Keep policy exceptions explainable.'],
    ['Loan review', 'Separate auto-approval from human review.'],
    ['Internal approvals', 'Make delegation rules visible.'],
  ];

  return (
    <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="border-b border-white/10 bg-white/[0.03] p-6 lg:border-b-0 lg:border-r">
        <div className="rounded-2xl border border-white/12 bg-white text-gray-950 shadow-2xl shadow-black/25">
          <div className="border-b border-violet-100 px-5 py-4">
            <p className="text-sm font-semibold">Shared runner</p>
            <p className="mt-1 text-xs text-gray-500">
              Review a published rule as a business user
            </p>
          </div>
          <div className="grid gap-4 p-5 md:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-3">
              <PreviewField label="Customer" value="Business" />
              <PreviewField label="Amount" value="¥7,200,000" />
              <PreviewField label="KYC" value="Verified" />
              <button
                type="button"
                className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-violet-600 text-sm font-semibold text-white"
              >
                <Play className="h-4 w-4" />
                Run decision
              </button>
            </div>
            <div className="rounded-md border border-violet-200 bg-violet-50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-600">
                Result
              </p>
              <p className="mt-3 text-2xl font-semibold text-violet-950">
                Manager review
              </p>
              <div className="mt-5 rounded-md bg-white p-3 text-sm leading-6 text-gray-600">
                Matched Intake decision row 1 because customer is Business and
                amount is at least ¥5M.
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="grid content-center gap-3 p-6">
        {useCases.map(([title, body]) => (
          <div
            key={title}
            className="grid grid-cols-[2.5rem_1fr] gap-4 rounded-md border border-white/10 bg-white/[0.06] p-4"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white/10 text-violet-200">
              <GitBranch className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-white">{title}</p>
              <p className="mt-1 text-sm leading-6 text-white/60">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-semibold text-gray-500">{label}</span>
      <span className="mt-1 block rounded-md border border-violet-200 bg-white px-3 py-2 text-sm font-semibold text-gray-900">
        {value}
      </span>
    </div>
  );
}

function DecisionWorkspacePreview() {
  const previewColumns = [
    { key: 'id', label: '#' },
    { key: 'customer', label: 'Customer' },
    { key: 'amount', label: 'Amount' },
    { key: 'verification', label: 'KYC' },
    { key: 'result', label: 'Outcome' },
  ] as const;
  const previewRows = [
    {
      id: '1',
      customer: 'Business',
      amount: '>= ¥5M',
      verification: 'Verified',
      result: 'Manager review',
    },
    {
      id: '2',
      customer: 'Individual',
      amount: '< ¥500K',
      verification: 'Verified',
      result: 'Auto-approve',
    },
    {
      id: '3',
      customer: 'Any',
      amount: '>= ¥500K',
      verification: 'Pending',
      result: 'Send to follow-up',
    },
    {
      id: '4',
      customer: 'Any',
      amount: 'Any',
      verification: 'Any',
      result: 'Manual review',
    },
  ];

  return (
    <div className="bg-violet-50 p-4 text-left">
      <div className="mb-4 flex items-center justify-between border-b border-violet-200 pb-3">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-violet-300" />
          <span className="h-3 w-3 rounded-full bg-violet-500" />
          <span className="h-3 w-3 rounded-full bg-violet-700" />
        </div>
        <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
          Review Rules v3
        </span>
      </div>
      <div className="grid gap-4 lg:grid-cols-[11rem_1fr]">
        <div className="hidden rounded-md border border-violet-200 bg-white p-3 lg:block">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-gray-400">
            Tables
          </p>
          {['Intake', 'Identity', 'Follow-up'].map((item, index) => (
            <div
              key={item}
              className={`mb-2 rounded-md px-3 py-2 text-sm font-semibold ${
                index === 0
                  ? 'bg-violet-600 text-white'
                  : 'bg-violet-50 text-gray-600'
              }`}
            >
              {item}
            </div>
          ))}
          <div className="mt-5 rounded-md bg-violet-100 p-3 text-xs leading-5 text-violet-800">
            2 uncovered patterns detected
          </div>
        </div>
        <div className="overflow-hidden rounded-md border border-violet-200 bg-white">
          <div className="flex items-center justify-between border-b border-violet-200 bg-violet-50 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-gray-950">Intake decision</p>
              <p className="text-xs text-gray-500">First matching row wins</p>
            </div>
            <span className="rounded-md bg-violet-600 px-2.5 py-1 text-xs font-semibold text-white">
              Tests passing
            </span>
          </div>
          <div className="min-w-[560px]">
            <div className="grid grid-cols-[3rem_1.1fr_1fr_1fr_1.2fr] bg-violet-100 text-xs font-bold text-violet-800">
              {previewColumns.map((column) => (
                <div
                  key={column.key}
                  className="border-r border-violet-200 px-3 py-3"
                >
                  {column.label}
                </div>
              ))}
            </div>
            {previewRows.map((row, rowIndex) => (
              <div
                key={row.id}
                className={`grid grid-cols-[3rem_1.1fr_1fr_1fr_1.2fr] text-sm ${
                  rowIndex === 1 ? 'bg-violet-50' : 'bg-white'
                }`}
              >
                {previewColumns.map((column) => (
                  <div
                    key={column.key}
                    className="border-r border-t border-violet-100 px-3 py-3 text-gray-700"
                  >
                    {row[column.key]}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="grid gap-3 border-t border-violet-200 bg-violet-50 p-4 md:grid-cols-3">
            <PreviewMetric label="Matched row" value="Row 2" />
            <PreviewMetric label="Output" value="Auto-approve" />
            <PreviewMetric label="Reasoning" value="View conditions" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-violet-200 bg-white px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-violet-950">{value}</p>
    </div>
  );
}
