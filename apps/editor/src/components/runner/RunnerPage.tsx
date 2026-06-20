import { WorkspaceRunner } from '@leverie/ui-runtime';
import { ArrowLeft, ExternalLink, LockKeyhole, RefreshCw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import logoUrl from '@/assets/logo.svg';
import { DataConnectedRunner } from '@/components/runner/DataConnectedRunner';
import {
  CloudApiError,
  getRunner,
  type RunnerLogicResponse,
} from '@/lib/cloudApi';

type RunnerState =
  | { status: 'loading' }
  | { status: 'ready'; data: RunnerLogicResponse }
  | { status: 'error'; title: string; message: string; actionHref?: string };

// Accepts /run/<workspaceId>/<logicId> (production) and
// /run/<workspaceId>/<logicId>@vN (exact version). The `@` in the version ref
// is sometimes URL-encoded as `%40` (e.g. when links are shared or rewritten),
// so each path segment is decoded before validating the logic ref.
function parseRunnerPath(pathname: string) {
  const match = pathname.match(/^\/run\/([^/]+)\/([^/]+)$/);
  if (!match) return null;
  let workspaceId: string;
  let logicRef: string;
  try {
    workspaceId = decodeURIComponent(match[1] ?? '');
    logicRef = decodeURIComponent(match[2] ?? '');
  } catch {
    return null;
  }
  if (!/^[0-9a-f-]{36}(?:@v[1-9][0-9]*)?$/i.test(logicRef)) return null;
  return { workspaceId, logicRef };
}

function formatPublishedAt(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function runnerInitialValues(): Record<string, string> {
  const params = new URLSearchParams(window.location.search);
  const values: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    values[key] = value;
  }
  return values;
}

export function RunnerPage() {
  const runnerRef = useMemo(
    () => parseRunnerPath(window.location.pathname),
    [],
  );
  const [state, setState] = useState<RunnerState>({ status: 'loading' });

  useEffect(() => {
    if (!runnerRef) {
      setState({
        status: 'error',
        title: 'Invalid runner URL',
        message:
          'Use /run/<workspaceId>/<logicId> or /run/<workspaceId>/<logicId>@vN.',
      });
      return;
    }

    let cancelled = false;
    void getRunner(runnerRef.workspaceId, runnerRef.logicRef)
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data });
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof CloudApiError && error.status === 401) {
          setState({
            status: 'error',
            title: 'Sign in required',
            message: 'Sign in to view this shared runner.',
            actionHref: '/auth',
          });
          return;
        }
        setState({
          status: 'error',
          title:
            error instanceof CloudApiError && error.status === 404
              ? 'Runner version not found'
              : 'Runner unavailable',
          message:
            error instanceof Error
              ? error.message
              : 'Could not load this runner.',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [runnerRef]);

  return (
    <div className="min-h-screen bg-surface-muted text-fg">
      <header className="flex h-14 items-center justify-between border-b border-brand-border bg-gradient-to-r from-brand-subtle to-surface px-4">
        <img src={logoUrl} alt="LEVERIE" className="h-9" />
        {state.status === 'ready' && state.data.runner.canEdit ? (
          <a
            href="/edit"
            className="inline-flex h-9 items-center gap-2 rounded border border-line px-3 text-sm font-medium text-fg-secondary hover:bg-surface-muted"
          >
            <ExternalLink className="h-4 w-4" />
            Edit
          </a>
        ) : null}
      </header>

      {state.status === 'loading' ? (
        <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-5">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-fg-subtle">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading runner...
          </div>
        </main>
      ) : state.status === 'error' ? (
        <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-xl flex-col items-center justify-center px-5 text-center">
          <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded border border-line bg-surface text-fg-subtle">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-semibold text-fg">{state.title}</h1>
          <p className="mt-3 text-sm leading-6 text-fg-muted">
            {state.message}
          </p>
          {state.actionHref ? (
            <a
              href={state.actionHref}
              className="mt-6 inline-flex h-10 items-center gap-2 rounded bg-brand px-4 text-sm font-medium text-white hover:bg-brand-strong"
            >
              Sign in
            </a>
          ) : (
            <a
              href="/"
              className="mt-6 inline-flex h-10 items-center gap-2 rounded border border-line bg-surface px-4 text-sm font-medium text-fg-secondary hover:bg-surface-muted"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to LEVERIE
            </a>
          )}
        </main>
      ) : (
        <main className="mx-auto max-w-5xl px-5 py-8">
          <div className="mb-6 border-b border-line pb-5">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-fg-subtle">
              <span>{state.data.workspace.name}</span>
              <span>/</span>
              <span>v{state.data.version.versionNumber}</span>
              <span>/</span>
              <span>{formatPublishedAt(state.data.version.publishedAt)}</span>
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-fg">
              {state.data.logic.name}
            </h1>
            {state.data.logic.description ? (
              <p className="mt-3 max-w-3xl text-sm leading-6 text-fg-muted">
                {state.data.logic.description}
              </p>
            ) : null}
          </div>

          {state.data.dataConnected ? (
            <DataConnectedRunner
              workspaceId={state.data.workspace.id}
              logicRef={runnerRef?.logicRef ?? state.data.logic.id}
              data={state.data}
            />
          ) : (
            <section className="rounded border border-line bg-surface p-5 shadow-sm">
              <WorkspaceRunner
                logic={state.data.version.data}
                workspaceConfig={
                  state.data.version.workspaceConfig ?? undefined
                }
                initialValues={runnerInitialValues()}
                versionLabel={`v${state.data.version.versionNumber}`}
                publishedAtLabel={formatPublishedAt(
                  state.data.version.publishedAt,
                )}
              />
            </section>
          )}
        </main>
      )}
    </div>
  );
}
