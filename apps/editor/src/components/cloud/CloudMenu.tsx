import {
  Building2,
  CheckCircle2,
  ChevronDown,
  Cloud,
  CloudOff,
  LogIn,
  LogOut,
  Settings,
  UserCircle,
} from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Tooltip } from '@/components/ui/Tooltip';
import { stashDraftForMigration } from '@/hooks/useLocalStorage';
import { useT } from '@/i18n/useT';
import { useCloudStore } from '@/store/cloudStore';
import { hasEditableContent, useLogicStore } from '@/store/logicStore';

export function CloudMenu() {
  const t = useT();
  const logic = useLogicStore((s) => s.logic);
  const importLogic = useLogicStore((s) => s.importLogic);
  const mode = useCloudStore((s) => s.mode);
  const saveState = useCloudStore((s) => s.saveState);
  const user = useCloudStore((s) => s.user);
  const org = useCloudStore((s) => s.org);
  const orgRole = useCloudStore((s) => s.orgRole);
  const workspace = useCloudStore((s) => s.workspace);
  const error = useCloudStore((s) => s.error);
  const signIn = useCloudStore((s) => s.signIn);
  const signUp = useCloudStore((s) => s.signUp);
  const signOutToAuth = useCloudStore((s) => s.signOutToAuth);
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  const status =
    mode === 'checking'
      ? t.cloudChecking
      : mode === 'selecting'
        ? 'Choose cloud workspace'
        : mode === 'cloud'
          ? saveState === 'saving'
            ? t.cloudSaving
            : saveState === 'conflict'
              ? t.cloudConflict
              : saveState === 'error'
                ? t.cloudError
                : t.cloudSaved
          : t.localSaved;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      // Authentication only authenticates. If there is real local work, preserve
      // it across the transition so the post-auth "new logic" screen can offer
      // to start from it — the choice lives there, not on this sign-in form.
      if (mode === 'local' && hasEditableContent(logic)) {
        stashDraftForMigration(logic);
      }
      if (isSignUp) {
        await signUp(name || email, email, password, logic, importLogic);
      } else {
        await signIn(email, password, logic, importLogic);
      }
      setOpen(false);
      toast.success(t.cloudConnected);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.cloudError);
    } finally {
      setSubmitting(false);
    }
  };

  const displayName = user?.name || user?.email || t.localMode;
  const workspaceName = workspace?.name ?? t.localMode;

  return (
    <div ref={rootRef} className="relative">
      <Tooltip content={status}>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label={t.accountMenu}
          className={`inline-flex h-8 max-w-[240px] items-center gap-2 rounded border px-2.5 text-xs font-medium shadow-sm transition-colors ${
            mode === 'local'
              ? 'border-amber-300 bg-amber-50 text-amber-900 hover:border-amber-400 hover:bg-amber-100'
              : 'border-gray-200 bg-white text-gray-700 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-800'
          }`}
        >
          {mode === 'cloud' ? (
            <Cloud className="h-4 w-4 shrink-0 text-emerald-700" />
          ) : (
            <CloudOff className="h-4 w-4 shrink-0 text-amber-600" />
          )}
          <span className="hidden min-w-0 flex-col items-start leading-tight sm:flex">
            <span className="max-w-[150px] truncate">{workspaceName}</span>
            <span className="max-w-[150px] truncate text-[10px] font-normal text-gray-500">
              {status}
            </span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        </button>
      </Tooltip>

      {open ? (
        <div className="fixed right-2 top-12 z-50 w-[calc(100vw-1rem)] max-w-96 rounded-md border border-gray-200 bg-white p-3 shadow-lg">
          <div className="mb-3 flex items-start gap-2">
            <div className="mt-0.5 rounded bg-emerald-50 p-1 text-emerald-700">
              {mode === 'cloud' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <CloudOff className="h-4 w-4 text-gray-500" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-gray-800">
                {status}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                {mode === 'cloud'
                  ? `${t.signedInAs} ${user?.email ?? ''}`
                  : t.localModeDescription}
              </div>
            </div>
            {error ? (
              <div className="mt-1 text-xs text-red-600">{error}</div>
            ) : null}
          </div>

          {mode === 'cloud' ? (
            <div className="space-y-3">
              <div className="space-y-2 border-y border-gray-100 py-3">
                <div className="flex items-start gap-2">
                  <UserCircle className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      {t.accountSection}
                    </div>
                    <div className="truncate text-sm font-medium text-gray-800">
                      {displayName}
                    </div>
                    {user?.name && user.email ? (
                      <div className="truncate text-xs text-gray-500">
                        {user.email}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      {t.organizationSection}
                    </div>
                    <div className="truncate text-sm font-medium text-gray-800">
                      {org?.name ?? '-'}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      {t.workspaceSection}
                    </div>
                    <div className="truncate text-sm font-medium text-gray-800">
                      {workspaceName}
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-[repeat(auto-fit,minmax(92px,1fr))] gap-2">
                  {orgRole === 'owner' || orgRole === 'admin' ? (
                    <>
                      <a
                        href="/settings/org"
                        className="inline-flex h-8 min-w-0 items-center justify-center gap-1 rounded border border-gray-200 px-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">Org</span>
                      </a>
                      <a
                        href="/settings/workspace"
                        className="inline-flex h-8 min-w-0 items-center justify-center gap-1 rounded border border-gray-200 px-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        <Settings className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{t.workspaceSection}</span>
                      </a>
                    </>
                  ) : null}
                  <button
                    type="button"
                    onClick={signOutToAuth}
                    className="inline-flex h-8 min-w-0 items-center justify-center gap-1 rounded border border-gray-200 px-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    <LogOut className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{t.signOut}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-2">
              {isSignUp ? (
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t.namePlaceholder}
                  className="h-8 w-full rounded border border-gray-200 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-300"
                />
              ) : null}
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t.emailPlaceholder}
                type="email"
                required
                className="h-8 w-full rounded border border-gray-200 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-300"
              />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t.passwordPlaceholder}
                type="password"
                required
                className="h-8 w-full rounded border border-gray-200 px-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-300"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded bg-violet-600 px-2 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  {isSignUp ? t.signUp : t.signIn}
                </button>
                <button
                  type="button"
                  onClick={() => setIsSignUp((value) => !value)}
                  className="h-8 rounded border border-gray-200 px-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                >
                  {isSignUp ? t.useExistingAccount : t.createAccount}
                </button>
              </div>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
