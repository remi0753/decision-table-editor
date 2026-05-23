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
import { type ReactNode, useEffect } from 'react';
import { toast } from 'sonner';
import logoUrl from '@/assets/logo.svg';
import { AccessPage } from '@/components/access/AccessPage';
import { AuthPage } from '@/components/auth/AuthPage';
import { InvitePage } from '@/components/invite/InvitePage';
import { AppLayout } from '@/components/layout/AppLayout';
import { RunnerPage } from '@/components/runner/RunnerPage';
import { OrgSettingsPage } from '@/components/settings/OrgSettingsPage';
import { loadFromStorage } from '@/hooks/useLocalStorage';
import { useUndoRedoShortcuts } from '@/hooks/useUndoRedoShortcuts';
import { useT } from '@/i18n/useT';
import { useCloudStore } from '@/store/cloudStore';
import { clearHistory } from '@/store/historyStore';
import { useLogicStore } from '@/store/logicStore';
import { useUiStore } from '@/store/uiStore';

function EditorApp() {
  const importLogic = useLogicStore((s) => s.importLogic);
  const logic = useLogicStore((s) => s.logic);
  const initializeCloud = useCloudStore((s) => s.initializeCloud);
  const setSelectedTable = useUiStore((s) => s.setSelectedTable);
  const t = useT();

  useUndoRedoShortcuts();

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect
  useEffect(() => {
    const isGuest = sessionStorage.getItem('leverie-editor-mode') === 'guest';
    const shouldMigrateLocalDraft =
      sessionStorage.getItem('leverie-migrate-local-draft') === '1';
    if (isGuest) {
      const saved = loadFromStorage();
      if (saved) {
        importLogic(saved);
      } else {
        toast.info(t.newLogicCreated);
      }
      useCloudStore.setState({
        mode: 'local',
        saveState: 'idle',
        user: null,
        workspace: null,
        logicId: null,
        draftRevision: null,
        lastSavedAt: null,
        error: null,
      });
      clearHistory();
      return;
    }

    const localDraft = shouldMigrateLocalDraft ? loadFromStorage() : null;
    if (localDraft) {
      importLogic(localDraft);
    }

    toast.info(t.cloudChecking, { id: 'cloud-session-checking' });
    void initializeCloud(localDraft ?? logic, importLogic, {
      requireAuth: true,
      migrateLocalDraft: Boolean(localDraft),
    }).finally(() => {
      const cloud = useCloudStore.getState();
      if (
        cloud.mode === 'cloud' &&
        (cloud.orgRole === 'viewer' || cloud.orgRole === 'runner') &&
        cloud.workspace &&
        cloud.logicId
      ) {
        const version = cloud.productionVersion ?? cloud.latestVersion;
        if (version) {
          window.location.assign(
            `/run/${cloud.workspace.id}/${cloud.logicId}@v${version.versionNumber}`,
          );
          return;
        }
        window.location.assign('/access');
        return;
      }
      if (shouldMigrateLocalDraft) {
        sessionStorage.removeItem('leverie-migrate-local-draft');
      }
      clearHistory();
    });
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect
  useEffect(() => {
    setSelectedTable(logic.entryTableId);
  }, []);

  return <AppLayout />;
}

function TopPage() {
  const startGuestEditor = () => {
    sessionStorage.setItem('leverie-editor-mode', 'guest');
  };

  return (
    <div className="min-h-screen bg-violet-50 text-gray-950">
      <header className="fixed inset-x-0 top-0 z-30 border-b border-violet-200 bg-violet-50/88 px-4 backdrop-blur md:px-8">
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
          className="border-y border-violet-200 bg-white px-4 py-16 md:px-8"
        >
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-violet-600">
                Why LEVERIE
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-normal md:text-5xl">
                Rules your operators can edit are rules that survive change.
              </h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <ValueBlock
                icon={<Table2 />}
                title="Write it as a table"
                body="Lay out conditions and outcomes row by row. Easier to navigate than a Word doc or sprawling flowchart."
              />
              <ValueBlock
                icon={<ShieldCheck />}
                title="Find what's missing"
                body="Auto-checks catch duplicates, unreachable rows, and missing cases — so quality doesn't depend on tribal knowledge."
              />
              <ValueBlock
                icon={<Bot />}
                title="Hand it to AI"
                body="The same human-readable table runs as executable logic — perfect for keeping AI agents on script."
              />
            </div>
          </div>
        </section>

        <section id="flow" className="bg-violet-100 px-4 py-16 md:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-violet-700">
                From Rulebook To Running Logic
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-normal md:text-5xl">
                Turn handbook judgment into live business logic.
              </h2>
              <p className="mt-5 text-base leading-8 text-gray-700">
                Define your inputs, lay out conditions, try a sample. Keep using
                your team's own vocabulary — no translation required.
              </p>
            </div>
            <div className="grid gap-3">
              {[
                [
                  '1',
                  'Define the inputs',
                  'Map fields like amount, customer tier, and request reason into options or numbers.',
                ],
                [
                  '2',
                  'Lay out the conditions',
                  'Build a top-down readable table. Split across tables when judgments get bigger.',
                ],
                [
                  '3',
                  'Test it on the spot',
                  'Plug in a sample and see exactly which row fired.',
                ],
              ].map(([number, title, body]) => (
                <div
                  key={number}
                  className="grid grid-cols-[3rem_1fr] gap-4 rounded-md border border-violet-200 bg-white/85 p-4 shadow-sm"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-md bg-violet-600 text-lg font-bold text-white">
                    {number}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <p className="mt-1 text-sm leading-6 text-gray-600">
                      {body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="fit"
          className="bg-violet-950 px-4 py-16 text-white md:px-8"
        >
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-violet-200">
                  Use Cases
                </p>
                <h2 className="mt-3 text-3xl font-semibold tracking-normal md:text-5xl">
                  For work full of decisions — and full of changes.
                </h2>
              </div>
              <p className="text-base leading-8 text-white/70">
                LEVERIE shines wherever the same input should always reach the
                same answer. Use it when you need to explain the rationale, push
                revisions fast, or lock in determinism before you hand things to
                AI.
              </p>
            </div>
            <div className="mt-10 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {[
                'Inquiry routing',
                'Refunds & claims',
                'Loan & insurance review',
                'Internal approvals',
              ].map((label) => (
                <div
                  key={label}
                  className="rounded-md border border-white/12 bg-white/[0.06] p-4"
                >
                  <GitBranch
                    className="mb-5 h-5 w-5 text-violet-200"
                    aria-hidden="true"
                  />
                  <p className="text-lg font-semibold">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
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

function ValueBlock({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-md border border-violet-200 bg-violet-50/60 p-5 shadow-sm">
      <div className="mb-7 flex h-11 w-11 items-center justify-center rounded-md bg-violet-600 text-white [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </div>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-gray-600">{body}</p>
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
              <p className="text-xs text-gray-500">
                First matching row wins
              </p>
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

export default function App() {
  if (window.location.pathname.startsWith('/run/')) return <RunnerPage />;
  if (window.location.pathname === '/invite') return <InvitePage />;
  if (window.location.pathname === '/settings/org') return <OrgSettingsPage />;
  if (window.location.pathname === '/edit') return <EditorApp />;
  if (window.location.pathname === '/auth') return <AuthPage />;
  if (window.location.pathname === '/access') return <AccessPage />;
  return <TopPage />;
}
