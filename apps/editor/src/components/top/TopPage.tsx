import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  ClipboardPaste,
  Copy,
  Database,
  FileText,
  GitBranch,
  Github,
  GripHorizontal,
  GripVertical,
  KeyRound,
  MoreHorizontal,
  Play,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  Table2,
  Trash2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import logoUrl from '@/assets/logo.svg';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

const GITHUB_URL = 'https://github.com/remi0753/leverie';

export function TopPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-brand-subtle text-fg">
      <header className="fixed inset-x-0 top-0 z-30 border-b border-brand-border bg-surface/90 px-4 backdrop-blur md:px-8">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4">
          <a href="/" aria-label="LEVERIE top">
            <img src={logoUrl} alt="LEVERIE" className="h-9" />
          </a>
          <nav className="hidden items-center gap-7 text-sm font-medium text-fg-muted md:flex">
            <a href="#value" className="hover:text-brand-fg-strong">
              Features
            </a>
            <a href="#flow" className="hover:text-brand-fg-strong">
              How it works
            </a>
            <a href="#workspace" className="hover:text-brand-fg-strong">
              In operation
            </a>
            <a href="#integrations" className="hover:text-brand-fg-strong">
              Integrations
            </a>
            <a href="#fit" className="hover:text-brand-fg-strong">
              Use cases
            </a>
            <a href="/docs/introduction" className="hover:text-brand-fg-strong">
              Docs
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle className="h-10 w-10 justify-center rounded-md border-brand-border bg-surface/80 text-fg-secondary shadow-sm hover:bg-surface hover:border-brand-border hover:text-brand-fg-strong" />
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Open LEVERIE on GitHub"
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-brand-border bg-surface/80 text-fg-secondary shadow-sm hover:bg-surface hover:text-brand-fg-strong"
            >
              <Github className="h-5 w-5" aria-hidden="true" />
            </a>
            <a
              href="/auth"
              className="whitespace-nowrap rounded-md border border-brand-border bg-surface/80 px-3 py-2 text-sm font-semibold text-fg-secondary shadow-sm hover:bg-surface hover:text-brand-fg-strong"
            >
              Sign in
            </a>
            <a
              href="/local"
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white shadow-sm shadow-violet-600/20 hover:bg-brand-strong"
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
          <div className="absolute right-[-10vw] top-20 hidden h-[76vh] w-[60vw] rotate-[-5deg] rounded-[32px] border border-brand-border bg-surface/88 shadow-2xl shadow-violet-950/15 lg:block">
            <DecisionWorkspacePreview />
          </div>
          <div className="relative mx-auto grid min-w-0 max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="flex min-h-[64vh] min-w-0 flex-col justify-center pb-4">
              <p className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-brand-border bg-surface/85 px-3 py-1 text-sm font-semibold text-brand-fg">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Business-owned rules, runnable by apps &amp; AI
              </p>
              <h1 className="max-w-3xl text-5xl font-semibold leading-[1.06] tracking-normal text-fg md:text-7xl">
                Turn policy tables
                <br />
                into running decisions.
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-fg-secondary md:text-xl">
                LEVERIE gives operations teams one table-shaped source of truth
                for approvals, routing, refunds, and reviews. Build the rules
                without JSON, verify why each row wins, then publish the same
                logic as a guided workspace, HTTP API, or MCP tool.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a
                  href="/local"
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-brand px-5 py-3 text-base font-semibold text-white shadow-lg shadow-violet-600/25 hover:bg-brand-strong"
                >
                  Open the free editor
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </a>
                <a
                  href="/auth"
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-brand-border bg-surface/80 px-5 py-3 text-base font-semibold text-fg-secondary shadow-sm hover:bg-surface hover:text-brand-fg-strong"
                >
                  Use with your team
                </a>
              </div>
              <div className="mt-8 grid max-w-2xl gap-3 text-sm font-medium text-fg-muted sm:grid-cols-3">
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand-fg" />
                  No JSON required
                </span>
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand-fg" />
                  Traceable results
                </span>
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand-fg" />
                  API &amp; MCP ready
                </span>
              </div>
            </div>
            <div className="relative min-w-0 lg:hidden">
              <div className="overflow-hidden rounded-2xl border border-brand-border bg-surface shadow-2xl shadow-violet-950/15">
                <DecisionWorkspacePreview />
              </div>
            </div>
          </div>
        </section>

        <section
          id="value"
          className="border-y border-brand-border bg-surface px-4 py-28 md:px-8 md:py-36"
        >
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand-fg">
                Why LEVERIE
              </p>
              <h2 className="mt-5 text-4xl font-semibold leading-tight tracking-normal md:text-6xl">
                One source of truth for rules that used to drift.
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-fg-muted">
                When policies live across spreadsheets, docs, code, and agent
                prompts, teams lose ownership of the decision. LEVERIE keeps the
                rule readable to business users and executable by the systems
                that need it.
              </p>
            </div>
            <div className="mt-16 min-w-0 overflow-hidden rounded-[28px] border border-brand-border bg-brand-subtle shadow-2xl shadow-violet-950/10">
              <DecisionWorkspacePreview />
            </div>
            <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-3">
              <FeaturePoint
                icon={<Table2 />}
                title="Business-readable"
                body="Rows, conditions, and outcomes stay in the table format operations teams already understand."
              />
              <FeaturePoint
                icon={<ShieldCheck />}
                title="Problems surface early"
                body="Duplicate, unreachable, contradictory, and missing rule patterns are shown before the logic is published."
              />
              <FeaturePoint
                icon={<Bot />}
                title="Executable everywhere"
                body="The same approved table can run in the workspace, through an API, or as a deterministic MCP tool."
              />
            </div>
          </div>
        </section>

        <section
          id="flow"
          className="bg-brand-subtle px-4 py-28 md:px-8 md:py-36"
        >
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand-fg">
                From Rulebook To Running Logic
              </p>
              <h2 className="mt-5 text-4xl font-semibold leading-tight tracking-normal md:text-6xl">
                Change rules without guessing what broke.
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-fg-muted">
                Instead of handing a rulebook to engineering and waiting for a
                rebuild, authors can inspect the table, run a case, and review
                exactly which rows changed before production moves.
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
                  title="Verify the reasoning"
                  body="Run a case in the editor and see the matched row, skipped rows, output, and explanation immediately."
                />
                <FlowStep
                  number="03"
                  title="Publish a stable snapshot"
                  body="Review changed rows before publishing, while existing API and MCP callers keep using the current production version."
                />
              </div>
              <EvaluationWorkbenchPreview />
            </div>
          </div>
        </section>

        <section
          id="workspace"
          className="border-y border-brand-border bg-surface px-4 py-28 md:px-8 md:py-36"
        >
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand-fg">
                In Operation
              </p>
              <h2 className="mt-5 text-4xl font-semibold leading-tight tracking-normal md:text-6xl">
                From a single key to a decided case.
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-fg-muted">
                A rule is only useful when it runs. In the LEVERIE workspace,
                operators start from the key they already have — an order
                number, ticket, or customer ID. LEVERIE collects the known facts
                from your data, asks only what software can't know, and returns
                the decision with its reason and next action.
              </p>
            </div>
            <div className="mt-16 grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-stretch">
              <div className="grid gap-4">
                <ApiPoint
                  icon={<KeyRound />}
                  title="Start from a key"
                  body="No JSON payloads. Paste an order number or ticket and LEVERIE extracts the case."
                />
                <ApiPoint
                  icon={<Database />}
                  title="Facts resolved for you"
                  body="Connect reference tables or live data sources. Known facts arrive automatically, each tagged with its source."
                />
                <ApiPoint
                  icon={<ClipboardCheck />}
                  title="Decision, reason, next action"
                  body="Every result keeps the matched rule and fact provenance, with a copy-ready response for the operator."
                />
              </div>
              <ConnectedRunPreview />
            </div>
          </div>
        </section>

        <section
          id="integrations"
          className="bg-brand-subtle px-4 py-28 md:px-8 md:py-36"
        >
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand-fg">
                Integrations
              </p>
              <h2 className="mt-5 text-4xl font-semibold leading-tight tracking-normal md:text-6xl">
                Run approved logic from products, workflows, and agents.
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-fg-muted">
                Publish a decision table once, then call it over HTTP or expose
                it as an MCP tool. LEVERIE returns the matched result and trace,
                so apps and AI agents can act without hiding the reasoning.
              </p>
            </div>
            <div className="mt-16 grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-stretch">
              <div className="grid gap-4">
                <ApiPoint
                  icon={<KeyRound />}
                  title="Scoped keys"
                  body="Issue keys for specific workspaces and production logics."
                />
                <ApiPoint
                  icon={<Server />}
                  title="Stable versions"
                  body="Call the published snapshot while authors keep editing drafts."
                />
                <ApiPoint
                  icon={<Bot />}
                  title="MCP-ready tools"
                  body="Let agents discover and call production logic with scoped access."
                />
              </div>
              <ApiExecutionPreview />
            </div>
          </div>
        </section>

        <section
          id="fit"
          className="bg-brand-deep px-4 py-28 text-white md:px-8 md:py-36"
        >
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand-fg-light">
                Use Cases
              </p>
              <h2 className="mt-5 text-4xl font-semibold leading-tight tracking-normal md:text-6xl">
                Built for decisions that must stay explainable.
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/70">
                Refunds, approvals, eligibility, routing: if the same input
                should always reach the same answer, LEVERIE gives the team a
                shared way to run it consistently after the rule reaches
                production.
              </p>
            </div>
            <div className="mt-16 overflow-hidden rounded-[28px] border border-white/12 bg-surface/[0.04] shadow-2xl shadow-black/30">
              <RunnerReviewPreview />
            </div>
            <div className="mt-10 flex justify-center">
              <a
                href="/local"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-surface px-5 py-3 text-base font-semibold text-brand-fg-strong hover:bg-brand-subtle"
              >
                Play with a sample
                <Play className="h-5 w-5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-brand-deep px-4 pb-10 pt-16 text-white md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 md:grid-cols-[1.6fr_1fr_1fr] md:gap-12">
            <div>
              <a
                href="/"
                aria-label="LEVERIE top"
                className="text-xl font-bold tracking-[0.18em] text-white"
              >
                LEVERIE
              </a>
              <p className="mt-4 max-w-sm text-sm leading-6 text-white/60">
                Business rules in the shape teams already understand — a table
                your team can build, verify, publish, and run from the tools
                that need the decision.
              </p>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/50">
                Product
              </p>
              <ul className="mt-4 space-y-2 text-sm text-white/80">
                <li>
                  <a href="#value" className="hover:text-white">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#flow" className="hover:text-white">
                    How it works
                  </a>
                </li>
                <li>
                  <a href="#workspace" className="hover:text-white">
                    In operation
                  </a>
                </li>
                <li>
                  <a href="#integrations" className="hover:text-white">
                    Integrations
                  </a>
                </li>
                <li>
                  <a href="#fit" className="hover:text-white">
                    Use cases
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/50">
                Get started
              </p>
              <ul className="mt-4 space-y-2 text-sm text-white/80">
                <li>
                  <a href="/local" className="hover:text-white">
                    Open the editor
                  </a>
                </li>
                <li>
                  <a href="/auth" className="hover:text-white">
                    Sign in
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 flex items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-white/50">
            <span>© {new Date().getFullYear()} LEVERIE</span>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Open LEVERIE on GitHub"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 text-white/70 hover:border-white/25 hover:bg-surface/10 hover:text-white"
            >
              <Github className="h-5 w-5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </footer>
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
    <div className="rounded-md border border-brand-border bg-surface p-5 shadow-sm">
      <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-md bg-brand text-white [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-fg-muted">{body}</p>
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
    <div className="rounded-md border border-brand-border bg-surface p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-fg">
        {number}
      </p>
      <h3 className="mt-4 text-xl font-semibold text-fg">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-fg-muted">{body}</p>
    </div>
  );
}

function ApiPoint({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="grid grid-cols-[2.5rem_1fr] gap-4 rounded-md border border-brand-border bg-brand-subtle/70 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand text-white [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </div>
      <div>
        <h3 className="text-base font-semibold text-fg">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-fg-muted">{body}</p>
      </div>
    </div>
  );
}

function ApiExecutionPreview() {
  return (
    <div className="flex h-full min-w-0 flex-col rounded-md border border-line bg-surface shadow-xl">
      <div className="flex items-center justify-between border-b border-line-subtle px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-fg">
            Use this logic via API
          </p>
          <p className="mt-0.5 text-xs text-fg-subtle">
            Call Refund policy from your backend, automation, or agent.
          </p>
        </div>
        <PreviewIconButton>
          <MoreHorizontal className="h-4 w-4" />
        </PreviewIconButton>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-hidden p-4">
        <div className="flex items-center gap-2 rounded border border-warning-border bg-warning-bg px-3 py-2">
          <KeyRound className="h-4 w-4 shrink-0 text-warning-fg" />
          <p className="min-w-0 flex-1 text-xs leading-5 text-warning-fg">
            Replace <code className="font-mono">$LEVERIE_API_KEY</code> with a
            key for this workspace.
          </p>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-fg-faint">
            Input fields
          </div>
          <div className="overflow-hidden rounded border border-line">
            {[
              ['Customer tier', 'enum: Gold, Standard'],
              ['Order amount', 'number'],
              ['Opened', 'boolean'],
            ].map(([name, type], index) => (
              <div
                key={name}
                className={`flex items-baseline gap-3 px-3 py-1.5 text-xs ${
                  index % 2 === 1 ? 'bg-surface-muted' : 'bg-surface'
                }`}
              >
                <span className="font-mono font-medium text-fg-secondary">
                  {name}
                </span>
                <span className="min-w-0 truncate text-fg-subtle">{type}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1">
              {['curl', 'JS', 'MCP'].map((label, index) => (
                <span
                  key={label}
                  className={`h-7 rounded px-2.5 py-1.5 text-xs font-medium ${
                    index === 0
                      ? 'bg-brand text-white'
                      : 'border border-line bg-surface text-fg-muted'
                  }`}
                >
                  {label}
                </span>
              ))}
            </div>
            <span className="h-7 rounded border border-line bg-surface px-1.5 py-1.5 text-xs text-fg-muted">
              Production v3
            </span>
          </div>
          <pre className="max-h-72 overflow-auto rounded border border-line bg-ink p-3 pr-12 text-xs leading-5 text-fg-faint">
            <code>{`curl https://leverie.dev/v1/logics/.../evaluate \\
  -H "Authorization: Bearer $LEVERIE_API_KEY" \\
  -d '{"inputs":{"Customer tier":"Gold"}}'`}</code>
          </pre>
          <p className="text-xs leading-5 text-fg-subtle">
            MCP <code className="font-mono">tools/call</code> evaluates the
            production snapshot.
          </p>
        </div>
      </div>
    </div>
  );
}

function ConnectedRunPreview() {
  const facts = [
    ['Purchase date', '2026-05-28', 'reference table', 'resolved'],
    ['Order amount', '¥7,200,000', 'reference table', 'resolved'],
    ['Customer tier', 'Gold', 'api', 'resolved'],
  ] as const;

  return (
    <div className="flex h-full flex-col gap-4 rounded border border-line bg-surface-muted p-5 shadow-xl">
      <div className="rounded border border-line bg-surface p-5">
        <h2 className="text-base font-semibold text-fg">Start a case</h2>
        <p className="mt-1 text-sm leading-6 text-fg-muted">
          Paste an order number, ticket URL, or copied case details.
        </p>
        <div className="mt-3 h-24 rounded border border-line bg-surface px-3 py-2 text-sm leading-6 text-fg-secondary">
          Order #A-10293
          <br />
          Customer asked for refund
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-between">
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-2 rounded border border-line px-4 text-sm font-medium text-fg-secondary"
          >
            <ClipboardPaste className="h-4 w-4" />
            Use clipboard
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-2 rounded bg-brand px-5 text-sm font-medium text-white"
          >
            <Play className="h-4 w-4" />
            Start
          </button>
        </div>
      </div>

      <div className="rounded border border-line bg-surface">
        <div className="flex items-center gap-2 border-b border-line-subtle px-4 py-3">
          <FileText className="h-4 w-4 text-fg-faint" />
          <h2 className="text-sm font-semibold text-fg">Facts</h2>
        </div>
        <table className="w-full border-collapse text-sm">
          <tbody>
            {facts.map(([name, value, source, state]) => (
              <tr
                key={name}
                className="border-b border-line-subtle last:border-0 align-top"
              >
                <td className="px-4 py-2.5 text-fg-muted">{name}</td>
                <td className="px-4 py-2.5 font-medium text-fg">{value}</td>
                <td className="px-4 py-2.5">
                  <span className="rounded bg-surface-subtle px-2 py-0.5 text-xs text-fg-subtle">
                    {source}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <span className="rounded bg-success-bg px-2 py-0.5 text-xs font-medium text-success-fg">
                    {state}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded border border-line bg-surface p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-fg">Questions</h2>
          <p className="mt-1 text-xs text-fg-subtle">
            Answer what systems can't know.
          </p>
          <p className="mt-3 text-sm font-medium text-fg">
            Was the item opened?
          </p>
          <div className="mt-3 inline-flex overflow-hidden rounded border border-line">
            <span className="h-9 bg-surface px-4 py-2 text-sm font-medium text-fg-muted">
              Yes
            </span>
            <span className="h-9 bg-brand px-4 py-2 text-sm font-medium text-white">
              No
            </span>
          </div>
        </div>

        <div className="rounded border border-brand-border bg-surface p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-fg">
                Full refund approved
              </h2>
              <p className="mt-1 text-sm text-fg-muted">
                Within 30 days, unopened, Gold tier.
              </p>
            </div>
            <button
              type="button"
              className="rounded border border-line bg-surface px-3 py-1.5 text-xs font-medium text-fg-muted"
            >
              Copy result
            </button>
          </div>
          <div className="mt-4 rounded border border-line bg-surface-muted p-3">
            <div className="text-xs font-medium text-fg-faint">
              Copy-ready text
            </div>
            <p className="mt-2 text-sm leading-6 text-fg-muted">
              Refund approved based on Refund policy v3.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function EvaluationWorkbenchPreview() {
  return (
    <div className="grid min-w-0 overflow-hidden rounded border border-line bg-surface shadow-xl md:grid-cols-[1fr_360px]">
      <div className="min-w-0 overflow-hidden border-b border-line bg-surface md:border-b-0 md:border-r">
        <DecisionWorkspacePreview compact />
      </div>
      <aside className="flex min-h-[520px] flex-col bg-surface">
        <div className="border-b border-brand-border-subtle">
          <div className="flex min-h-11 items-center justify-between bg-brand-subtle/50 px-4">
            <span className="font-medium text-sm text-fg-secondary">
              Evaluation
            </span>
            <PreviewIconButton>
              <MoreHorizontal className="h-4 w-4" />
            </PreviewIconButton>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div className="space-y-3">
            {[
              ['Customer', 'Individual'],
              ['Amount', '320000'],
              ['KYC', 'Verified'],
              ['Request', 'New application'],
            ].map(([label, value]) => (
              <div key={label}>
                <span className="mb-1 block text-xs font-medium text-fg-muted">
                  {label}
                </span>
                <span className="block h-9 rounded border border-line-strong bg-surface px-2.5 py-1.5 text-sm text-fg">
                  {value}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="flex items-center gap-1 rounded bg-brand px-3 py-1.5 text-sm text-white"
            >
              <Play className="h-3.5 w-3.5" /> Run
            </button>
            <button
              type="button"
              className="rounded border border-line px-3 py-1.5 text-sm text-fg-muted"
            >
              Reset
            </button>
          </div>

          <div className="border-t pt-4">
            <div className="mb-2 text-xs font-medium text-fg-subtle">
              Execution Trace
            </div>
            <TraceCard
              title="1. Intake decision"
              skipped={['1: Customer condition not met']}
              matched="Row 2 matched"
            />
            <div className="rounded border border-success-border bg-success-bg p-3">
              <div className="mb-1 text-sm font-medium text-success-fg">
                Evaluation succeeded
              </div>
              <div className="text-sm">
                <span className="text-fg-subtle">Decision: </span>
                <span className="font-medium">Auto-approve</span>
              </div>
            </div>
          </div>
        </div>
      </aside>
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
      <div className="border-b border-white/10 bg-surface/[0.03] p-6 lg:border-b-0 lg:border-r">
        <div className="space-y-4 rounded border border-white/12 bg-surface p-5 text-fg shadow-2xl shadow-black/25">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-fg-faint">
                LEVERIE Workspace
              </div>
              <div className="mt-1 text-sm text-fg-muted">v3 / Jun 20</div>
            </div>
            <div className="flex items-center gap-2">
              {['Guided', 'Review', 'Detail'].map((mode, index) => (
                <span
                  key={mode}
                  className={
                    index === 1
                      ? 'rounded bg-brand px-3 py-1.5 text-xs font-medium text-white'
                      : 'rounded border border-line bg-surface px-3 py-1.5 text-xs font-medium text-fg-muted'
                  }
                >
                  {mode}
                </span>
              ))}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(180px,0.9fr)_minmax(220px,1.2fr)_minmax(180px,0.9fr)]">
            <section className="rounded border border-line bg-surface p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-fg">Case Facts</h2>
                <span className="text-xs text-fg-faint">
                  3 known / 1 needed
                </span>
              </div>
              <div className="mt-4 space-y-3">
                <FactRowPreview
                  label="Customer tier"
                  value="Gold"
                  source="API"
                />
                <FactRowPreview
                  label="Order amount"
                  value="7200000"
                  source="From table"
                />
              </div>
              <div className="mt-4 border-t border-line pt-3">
                <div className="text-xs font-medium text-fg-subtle">
                  Still needed
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded border border-line bg-surface-muted px-2 py-1 text-xs text-fg-muted">
                    Opened
                  </span>
                </div>
              </div>
            </section>

            <section className="rounded border border-line bg-surface p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-fg">Current Check</h2>
              <p className="mt-1 text-xs leading-5 text-fg-muted">
                Answer the remaining fact to choose between refund outcomes.
              </p>
              <div className="mt-4">
                <div className="block text-base font-semibold text-fg">
                  Was the item opened?
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <span className="min-w-0 rounded border border-line bg-surface px-3 py-2 text-center text-sm font-medium text-fg-muted">
                    Yes
                  </span>
                  <span className="min-w-0 rounded bg-brand px-3 py-2 text-center text-sm font-medium text-white">
                    No
                  </span>
                  <span className="col-span-2 min-w-0 rounded border border-line bg-surface px-3 py-2 text-center text-sm font-medium text-fg-muted">
                    Unknown
                  </span>
                </div>
              </div>
            </section>

            <section className="rounded border border-line bg-surface p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-fg">
                  Decision Status
                </h2>
                <span className="rounded bg-success-bg px-2 py-1 text-xs font-medium text-success-fg">
                  Decision ready
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-fg-muted">
                The current facts reach one matching rule.
              </p>
              <div className="mt-4 border-t border-line pt-3">
                <div className="text-xs font-medium text-fg-subtle">
                  Possible outcomes
                </div>
                <div className="mt-2 rounded border border-line bg-surface-muted p-2 text-xs text-fg-muted">
                  <div className="font-medium text-fg">
                    Full refund approved
                  </div>
                  <div className="mt-0.5 text-fg-faint">certain</div>
                </div>
              </div>
            </section>
          </div>

          <section className="rounded border border-brand-border bg-surface p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-fg">
                  Full refund approved
                </h2>
                <p className="mt-1 text-sm text-fg-muted">
                  Matched Refund policy row 2.
                </p>
              </div>
              <button
                type="button"
                className="rounded border border-line bg-surface px-3 py-1.5 text-xs font-medium text-fg-muted"
              >
                Copy result
              </button>
            </div>
          </section>
        </div>
      </div>
      <div className="grid content-center gap-3 p-6">
        {useCases.map(([title, body]) => (
          <div
            key={title}
            className="grid grid-cols-[2.5rem_1fr] gap-4 rounded-md border border-white/10 bg-surface/[0.06] p-4"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-surface/10 text-brand-fg-light">
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

function FactRowPreview({
  label,
  value,
  source,
}: {
  label: string;
  value: string;
  source: string;
}) {
  return (
    <div className="rounded border border-line bg-surface-muted p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-xs font-medium text-fg-muted">
          {label}
        </span>
        <span className="shrink-0 rounded bg-surface px-1.5 py-0.5 text-[11px] text-fg-faint">
          {source}
        </span>
      </div>
      <span className="mt-1 block rounded border border-line bg-surface px-2 py-1 text-xs text-fg">
        {value}
      </span>
    </div>
  );
}

function PreviewIconButton({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: 'default' | 'drag' | 'danger';
}) {
  const toneClass =
    tone === 'danger'
      ? 'text-danger-fg'
      : tone === 'drag'
        ? 'text-fg-faint'
        : 'text-fg-subtle';
  return (
    <span
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-line bg-surface ${toneClass}`}
    >
      {children}
    </span>
  );
}

function TraceCard({
  title,
  skipped,
  matched,
}: {
  title: string;
  skipped: string[];
  matched: string;
}) {
  return (
    <div className="mb-2 rounded border bg-surface p-3">
      <div className="mb-1 text-sm font-medium">{title}</div>
      {skipped.map((item) => (
        <div key={item} className="py-0.5 pl-4 text-xs text-fg-subtle">
          {item}
        </div>
      ))}
      <div className="py-0.5 pl-4 text-xs text-success-fg">{matched}</div>
    </div>
  );
}

function DecisionWorkspacePreview({ compact = false }: { compact?: boolean }) {
  const previewColumns = [
    { key: 'customer', label: 'Customer' },
    { key: 'amount', label: 'Amount' },
    { key: 'verification', label: 'KYC' },
  ] as const;
  const previewRows = [
    {
      id: 'business-manager-review',
      customer: 'Business',
      amount: '>= ¥5M',
      verification: 'Verified',
      result: 'Manager review',
      warning: 'error',
    },
    {
      id: 'individual-auto-approve',
      customer: 'Individual',
      amount: '< ¥500K',
      verification: 'Verified',
      result: 'Auto-approve',
      warning: null,
    },
    {
      id: 'pending-follow-up',
      customer: 'Any',
      amount: '>= ¥500K',
      verification: 'Pending',
      result: 'Send to follow-up',
      warning: 'warning',
    },
    {
      id: 'default-manual-review',
      customer: 'Any',
      amount: 'Any',
      verification: 'Any',
      result: 'Manual review',
      warning: null,
    },
  ];

  return (
    <div className="min-w-0 bg-surface text-left">
      <div className="flex min-h-11 min-w-0 items-stretch justify-between gap-3 border-b border-brand-border-subtle bg-surface">
        <div className="flex min-w-0 items-end overflow-x-auto px-2 pt-2">
          {['Intake decision', 'Identity check', 'Follow-up'].map(
            (name, index) => (
              <span
                key={name}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-t-md border border-b-0 px-3 text-xs font-medium ${
                  index === 0
                    ? 'border-brand-border bg-surface text-brand-fg-strong'
                    : 'border-transparent text-fg-subtle'
                }`}
              >
                {index === 0 ? <Table2 className="h-3.5 w-3.5" /> : null}
                {name}
              </span>
            ),
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 py-1.5 pr-3 pl-1">
          <div className="flex h-8 items-center gap-0.5 rounded border border-line bg-surface-muted p-0.5">
            <span className="flex h-7 items-center gap-1.5 rounded bg-surface px-2.5 text-xs font-medium text-brand-fg-strong shadow-sm">
              <Table2 className="h-3 w-3" /> Table
            </span>
            <span className="flex h-7 items-center gap-1.5 rounded px-2.5 text-xs font-medium text-fg-subtle">
              <GitBranch className="h-3 w-3" /> Flowchart
              <span className="rounded bg-warning-bg px-1 text-[10px] font-semibold leading-tight text-warning-fg">
                2
              </span>
            </span>
          </div>
          <PreviewIconButton>
            <MoreHorizontal className="h-4 w-4" />
          </PreviewIconButton>
        </div>
      </div>

      <div className="overflow-x-auto pb-3">
        <table
          className="min-w-full border-collapse text-sm"
          style={{ tableLayout: 'fixed' }}
        >
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-14 border-b border-r border-line bg-surface-subtle" />
              <th className="w-10 border-b border-r border-line bg-surface-subtle px-2 text-xs text-fg-subtle">
                #
              </th>
              {previewColumns.map((column) => (
                <th
                  key={column.key}
                  className="min-w-40 border-b border-r border-line bg-surface-subtle px-2 py-1 text-xs font-medium"
                  style={{ width: compact ? 132 : 160 }}
                >
                  <div className="flex items-center gap-1">
                    <PreviewIconButton tone="drag">
                      <GripHorizontal className="h-3.5 w-3.5" />
                    </PreviewIconButton>
                    <span className="min-w-0 flex-1 rounded border border-line bg-surface px-1 py-0.5 text-left text-xs font-normal text-fg-secondary">
                      {column.label}
                    </span>
                    <PreviewIconButton tone="danger">
                      <Trash2 className="h-3.5 w-3.5" />
                    </PreviewIconButton>
                  </div>
                </th>
              ))}
              <th
                className="border-b border-r border-line bg-surface-subtle p-0"
                style={{ width: 32, minWidth: 32, maxWidth: 32 }}
              >
                <span className="flex h-8 items-center justify-center text-fg-faint">
                  +
                </span>
              </th>
              <th
                className="relative border-b border-r border-line bg-surface-subtle px-2 py-1 text-xs font-medium text-fg-secondary"
                style={{ minWidth: compact ? 190 : 240 }}
              >
                <div className="flex items-center justify-between">
                  <span>Conclusion</span>
                  <PreviewIconButton>
                    <Settings className="h-3.5 w-3.5" />
                  </PreviewIconButton>
                </div>
              </th>
              <th className="sticky right-0 z-10 w-16 border-b border-l border-line bg-surface-subtle" />
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, rowIndex) => (
              <tr key={row.id} className="group">
                <td className="sticky left-0 z-10 w-14 border-b border-r bg-surface py-0.5">
                  {row.warning ? (
                    <span
                      className={`pointer-events-none absolute bottom-0 left-0 top-0 w-1 ${
                        row.warning === 'error' ? 'bg-danger' : 'bg-warning'
                      }`}
                    />
                  ) : null}
                  <div className="flex flex-row items-center justify-center gap-1 pl-1">
                    <span className="flex h-7 w-5 items-center justify-center text-danger-fg">
                      {row.warning === 'error' ? '!' : ''}
                    </span>
                    <PreviewIconButton tone="drag">
                      <GripVertical className="h-3.5 w-3.5" />
                    </PreviewIconButton>
                  </div>
                </td>
                <td className="w-10 border-b border-r px-2 py-0.5 text-center text-xs text-fg-faint">
                  {rowIndex + 1}
                </td>
                {previewColumns.map((column) => (
                  <td
                    key={column.key}
                    className="h-8 border-b border-r p-0"
                    style={{ width: compact ? 132 : 160 }}
                  >
                    <PreviewCell>{row[column.key]}</PreviewCell>
                  </td>
                ))}
                <td
                  className="border-b border-r"
                  style={{ width: 32, minWidth: 32, maxWidth: 32 }}
                />
                <td
                  className="h-8 border-b border-r p-0"
                  style={{ minWidth: compact ? 190 : 240 }}
                >
                  <button
                    type="button"
                    className="h-full w-full px-2 py-1 text-left text-xs text-fg-secondary"
                  >
                    <span className="inline-flex max-w-full items-baseline gap-1 rounded border border-line bg-surface-muted px-1.5 py-0.5 leading-tight">
                      <span className="text-[10px] text-fg-faint">
                        Decision
                      </span>
                      <span className="truncate font-medium text-fg-secondary">
                        {row.result}
                      </span>
                    </span>
                  </button>
                </td>
                <td className="sticky right-0 z-10 w-16 border-b border-l bg-surface px-1 py-0.5 text-center">
                  <div className="flex flex-row items-center justify-center gap-0.5 opacity-50">
                    <PreviewIconButton>
                      <Copy className="h-3.5 w-3.5" />
                    </PreviewIconButton>
                    <PreviewIconButton tone="danger">
                      <Trash2 className="h-3.5 w-3.5" />
                    </PreviewIconButton>
                  </div>
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={5 + previewColumns.length} className="border-b p-0">
                <span className="flex w-full items-center justify-center py-1 text-fg-faint">
                  +
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        {!compact ? (
          <div className="border-t border-line bg-surface-muted px-4 py-2 text-xs text-fg-subtle">
            Flowchart shows 2 coverage gaps for enum and boolean branches.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PreviewCell({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="h-full w-full px-2 py-1 text-left text-xs text-fg-secondary"
    >
      {children}
    </button>
  );
}
