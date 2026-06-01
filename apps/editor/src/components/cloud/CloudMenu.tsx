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
import { signInEmail, signUpEmail } from '@/lib/cloudApi';
import { useCloudStore } from '@/store/cloudStore';
import { hasEditableContent, useLogicStore } from '@/store/logicStore';

export function CloudMenu() {
  const t = useT();
  const logic = useLogicStore((s) => s.logic);
  const mode = useCloudStore((s) => s.mode);
  const saveState = useCloudStore((s) => s.saveState);
  const user = useCloudStore((s) => s.user);
  const org = useCloudStore((s) => s.org);
  const orgRole = useCloudStore((s) => s.orgRole);
  const workspace = useCloudStore((s) => s.workspace);
  const error = useCloudStore((s) => s.error);
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
        // Sign-up requires email verification, so no session is established
        // now. Only send the email and stay in local mode — crucially without
        // loading any pre-existing session that may still be in cookies for a
        // different account. The account is entered later via the email link.
        await signUpEmail(
          name || email,
          email,
          password,
          `${window.location.origin}/edit`,
        );
        setOpen(false);
        setIsSignUp(false);
        toast.success(t.verificationEmailSent);
      } else {
        await signInEmail(email, password);
        // Move to /edit so the URL reflects the authenticated editor instead of
        // staying on /local; the cloud session initializes there, and any
        // preserved local draft is offered on the new-logic screen.
        window.location.assign('/edit');
      }
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
              ? 'border-warning-border bg-warning-bg text-warning-fg hover:border-warning-border hover:bg-warning-bg'
              : 'border-line bg-surface text-fg-secondary hover:border-brand-border hover:bg-brand-subtle hover:text-brand-fg-strong'
          }`}
        >
          {mode === 'cloud' ? (
            <Cloud className="h-4 w-4 shrink-0 text-success-fg" />
          ) : (
            <CloudOff className="h-4 w-4 shrink-0 text-warning-fg" />
          )}
          <span className="hidden min-w-0 flex-col items-start leading-tight sm:flex">
            <span className="max-w-[150px] truncate">{workspaceName}</span>
            <span className="max-w-[150px] truncate text-[10px] font-normal text-fg-subtle">
              {status}
            </span>
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-fg-faint" />
        </button>
      </Tooltip>

      {open ? (
        <div className="fixed right-2 top-12 z-50 w-[calc(100vw-1rem)] max-w-96 rounded-md border border-line bg-surface p-3 shadow-lg">
          <div className="mb-3 flex items-start gap-2">
            <div className="mt-0.5 rounded bg-success-bg p-1 text-success-fg">
              {mode === 'cloud' ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <CloudOff className="h-4 w-4 text-fg-subtle" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-fg-secondary">
                {status}
              </div>
              <div className="mt-1 text-xs text-fg-subtle">
                {mode === 'cloud'
                  ? `${t.signedInAs} ${user?.email ?? ''}`
                  : t.localModeDescription}
              </div>
            </div>
            {error ? (
              <div className="mt-1 text-xs text-danger-fg">{error}</div>
            ) : null}
          </div>

          {mode === 'cloud' ? (
            <div className="space-y-3">
              <div className="space-y-2 border-y border-line-subtle py-3">
                <div className="flex items-start gap-2">
                  <UserCircle className="mt-0.5 h-4 w-4 shrink-0 text-fg-faint" />
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-fg-faint">
                      {t.accountSection}
                    </div>
                    <div className="truncate text-sm font-medium text-fg-secondary">
                      {displayName}
                    </div>
                    {user?.name && user.email ? (
                      <div className="truncate text-xs text-fg-subtle">
                        {user.email}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-fg-faint" />
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-fg-faint">
                      {t.organizationSection}
                    </div>
                    <div className="truncate text-sm font-medium text-fg-secondary">
                      {org?.name ?? '-'}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-fg-faint" />
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-fg-faint">
                      {t.workspaceSection}
                    </div>
                    <div className="truncate text-sm font-medium text-fg-secondary">
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
                        className="inline-flex h-8 min-w-0 items-center justify-center gap-1 rounded border border-line px-2 text-xs font-medium text-fg-muted hover:bg-surface-muted"
                      >
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">Org</span>
                      </a>
                      <a
                        href="/settings/workspace"
                        className="inline-flex h-8 min-w-0 items-center justify-center gap-1 rounded border border-line px-2 text-xs font-medium text-fg-muted hover:bg-surface-muted"
                      >
                        <Settings className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{t.workspaceSection}</span>
                      </a>
                    </>
                  ) : null}
                  <button
                    type="button"
                    onClick={signOutToAuth}
                    className="inline-flex h-8 min-w-0 items-center justify-center gap-1 rounded border border-line px-2 text-xs font-medium text-fg-muted hover:bg-surface-muted"
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
                  className="h-8 w-full rounded border border-line px-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
                />
              ) : null}
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t.emailPlaceholder}
                type="email"
                required
                className="h-8 w-full rounded border border-line px-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
              />
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t.passwordPlaceholder}
                type="password"
                required
                className="h-8 w-full rounded border border-line px-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded bg-brand px-2 text-xs font-medium text-white hover:bg-brand-strong disabled:opacity-50"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  {isSignUp ? t.signUp : t.signIn}
                </button>
                <button
                  type="button"
                  onClick={() => setIsSignUp((value) => !value)}
                  className="h-8 rounded border border-line px-2 text-xs font-medium text-fg-muted hover:bg-surface-muted"
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
