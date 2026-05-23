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
              できること
            </a>
            <a href="#flow" className="hover:text-violet-800">
              使い方
            </a>
            <a href="#fit" className="hover:text-violet-800">
              向いている業務
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <a
              href="/auth"
              className="whitespace-nowrap rounded-md border border-violet-200 bg-white/80 px-3 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-white hover:text-violet-800"
            >
              ログイン
            </a>
            <a
              href="/edit"
              onClick={startGuestEditor}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-sm shadow-violet-600/20 hover:bg-violet-700"
            >
              <span className="sm:hidden">試す</span>
              <span className="hidden sm:inline">試してみる</span>
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
                業務ルールを、AIにも人にも読める形へ
              </p>
              <h1 className="max-w-3xl text-5xl font-semibold leading-[1.06] tracking-normal text-gray-950 md:text-7xl">
                判断ルールを、
                <br />
                コードではなく表で育てる。
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-gray-700 md:text-xl">
                LEVERIE は、問い合わせ対応・審査・承認・振り分けのような
                「もしこうなら、こうする」を、Excel
                感覚の決定テーブルとして作成・確認・共有できるツールです。
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a
                  href="/edit"
                  onClick={startGuestEditor}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-violet-600 px-5 py-3 text-base font-semibold text-white shadow-lg shadow-violet-600/25 hover:bg-violet-700"
                >
                  無料でエディタを開く
                  <ArrowRight className="h-5 w-5" aria-hidden="true" />
                </a>
                <a
                  href="/auth"
                  className="inline-flex items-center justify-center gap-2 rounded-md border border-violet-200 bg-white/80 px-5 py-3 text-base font-semibold text-gray-800 shadow-sm hover:bg-white hover:text-violet-800"
                >
                  チームで使う
                </a>
              </div>
              <div className="mt-8 grid max-w-2xl gap-3 text-sm font-medium text-gray-600 sm:grid-cols-3">
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-violet-600" />
                  JSON不要
                </span>
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-violet-600" />
                  矛盾を検知
                </span>
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-violet-600" />
                  AI連携に展開
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
                業務の人が直せるルールは、現場の変化に強い。
              </h2>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <ValueBlock
                icon={<Table2 />}
                title="表で書ける"
                body="条件と結果を行に並べるだけ。Word の文章や複雑なフローチャートより、変更箇所が見つけやすくなります。"
              />
              <ValueBlock
                icon={<ShieldCheck />}
                title="抜け漏れを見つける"
                body="重複、到達しない行、対応漏れを自動でチェック。担当者の経験だけに頼らず、ルール品質を保てます。"
              />
              <ValueBlock
                icon={<Bot />}
                title="AIにも渡せる"
                body="人が読める表を、実行可能な判断ロジックとして扱えます。AI エージェントの判断を安定させたい場面に向いています。"
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
                マニュアルの判断を、そのまま動く業務ロジックへ。
              </h2>
              <p className="mt-5 text-base leading-8 text-gray-700">
                入力項目を決め、条件を表に並べ、サンプルで試す。
                いつもの業務言葉のまま、チームで確認できる形にできます。
              </p>
            </div>
            <div className="grid gap-3">
              {[
                [
                  '1',
                  '項目を決める',
                  '金額、顧客区分、申請理由などを選択肢や数値として整理します。',
                ],
                [
                  '2',
                  '条件を並べる',
                  '上から順に読める表へ。複数の表に分けて、大きな判断も無理なく扱えます。',
                ],
                [
                  '3',
                  'その場で試す',
                  '入力例を入れると、どの行が選ばれたかまで確認できます。',
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
                  判断が多く、変更も多い仕事に。
                </h2>
              </div>
              <p className="text-base leading-8 text-white/70">
                LEVERIE は「正解が毎回同じであるべき判断」に向いています。
                ルールの根拠を説明したい、改訂を素早く反映したい、 AI
                に任せる前に決定性を担保したい場面で力を発揮します。
              </p>
            </div>
            <div className="mt-10 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {[
                '問い合わせ振り分け',
                '返金・補償判定',
                'ローン・保険審査',
                '社内承認フロー',
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
                サンプルを触ってみる
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
    { key: 'customer', label: '顧客区分' },
    { key: 'amount', label: '申請金額' },
    { key: 'verification', label: '本人確認' },
    { key: 'result', label: '結果' },
  ] as const;
  const previewRows = [
    {
      id: '1',
      customer: '法人',
      amount: '>= 500万',
      verification: '完了',
      result: '上長レビュー',
    },
    {
      id: '2',
      customer: '個人',
      amount: '< 50万',
      verification: '完了',
      result: '自動承認',
    },
    {
      id: '3',
      customer: 'すべて',
      amount: '>= 50万',
      verification: '未完了',
      result: '追加確認へ',
    },
    {
      id: '4',
      customer: 'すべて',
      amount: 'すべて',
      verification: 'すべて',
      result: '担当者確認',
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
          審査ルール v3
        </span>
      </div>
      <div className="grid gap-4 lg:grid-cols-[11rem_1fr]">
        <div className="hidden rounded-md border border-violet-200 bg-white p-3 lg:block">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-gray-400">
            Tables
          </p>
          {['受付判定', '本人確認', '追加確認'].map((item, index) => (
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
            2件の未対応パターンを検出
          </div>
        </div>
        <div className="overflow-hidden rounded-md border border-violet-200 bg-white">
          <div className="flex items-center justify-between border-b border-violet-200 bg-violet-50 px-4 py-3">
            <div>
              <p className="text-sm font-bold text-gray-950">受付判定</p>
              <p className="text-xs text-gray-500">
                条件に合う最初の行が選ばれます
              </p>
            </div>
            <span className="rounded-md bg-violet-600 px-2.5 py-1 text-xs font-semibold text-white">
              テストOK
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
            <PreviewMetric label="一致した行" value="2行目" />
            <PreviewMetric label="出力" value="自動承認" />
            <PreviewMetric label="根拠" value="条件を表示" />
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
