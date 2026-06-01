import {
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Loader2,
  LogOut,
  Mail,
  ShieldAlert,
  UserPlus,
} from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Toaster, toast } from 'sonner';
import logoUrl from '@/assets/logo.svg';
import {
  acceptInvitation,
  CloudApiError,
  type InvitationPreview,
  previewInvitation,
  signInEmail,
  signOut,
  signUpEmail,
} from '@/lib/cloudApi';

type AuthMode = 'sign-in' | 'sign-up';

function errorMessage(error: unknown) {
  if (error instanceof CloudApiError) return error.message;
  return error instanceof Error ? error.message : 'Invitation request failed.';
}

function safeRedirectPath(value: string | null) {
  // Only allow same-origin absolute paths. The first char must be '/' and the
  // second must be neither '/' nor '\\' — browsers normalise a backslash to a
  // forward slash when resolving URLs, so a value like '/\\evil.com' would
  // otherwise parse as the protocol-relative '//evil.com' and redirect off-site.
  if (!value || !/^\/[^/\\]/.test(value)) return '/edit';
  return value;
}

function statusText(status: InvitationPreview['invitation']['status']) {
  switch (status) {
    case 'accepted':
      return 'This invitation has already been accepted.';
    case 'expired':
      return 'This invitation has expired.';
    case 'revoked':
      return 'This invitation was revoked.';
    default:
      return 'You have been invited to join this organization.';
  }
}

export function InvitePage() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') ?? '';
  const redirect = safeRedirectPath(params.get('redirect'));
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('sign-in');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const result = await previewInvitation(token);
        if (cancelled) return;
        setPreview(result);
        // Default to sign-up; the user can switch to sign-in via the toggle.
        // We intentionally do not precompute account presence here — the API
        // no longer returns it because it would let any invitation holder
        // enumerate which addresses have LEVERIE accounts.
        setAuthMode('sign-up');
      } catch (error) {
        toast.error(errorMessage(error));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const acceptAndContinue = async () => {
    setSubmitting(true);
    try {
      const result = await acceptInvitation(token);
      if (result.org?.id) {
        sessionStorage.setItem('leverie-preferred-org-id', result.org.id);
      }
      toast.success('Invitation accepted.');
      window.location.assign(redirect);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleAuthSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!preview) return;

    setSubmitting(true);
    try {
      if (authMode === 'sign-up') {
        // Holding the invitation token already proves ownership of the
        // invited email, so the server marks new invitee accounts as verified
        // (see auth.ts). With auto sign-in disabled globally we still need to
        // explicitly sign in before accepting.
        await signUpEmail(
          name || preview.invitation.email,
          preview.invitation.email,
          password,
          `${window.location.origin}/edit`,
        );
        await signInEmail(preview.invitation.email, password);
      } else {
        await signInEmail(preview.invitation.email, password);
      }
      const result = await acceptInvitation(token);
      if (result.org?.id) {
        sessionStorage.setItem('leverie-preferred-org-id', result.org.id);
      }
      toast.success('Invitation accepted.');
      window.location.assign(redirect);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwitchAccount = async () => {
    await signOut().catch(() => undefined);
    const next = new URL('/invite', window.location.origin);
    next.searchParams.set('token', token);
    if (redirect !== '/edit') next.searchParams.set('redirect', redirect);
    window.location.assign(`${next.pathname}${next.search}`);
  };

  const invitedEmail = preview?.invitation.email ?? '';
  const canAcceptDirectly =
    preview?.invitation.status === 'pending' &&
    preview.authHint.currentUserMatchesInvitation;
  const needsAccountSwitch =
    preview?.invitation.status === 'pending' &&
    preview.authHint.currentUserEmail !== null &&
    !preview.authHint.currentUserMatchesInvitation;
  const canShowAuthForm =
    preview?.invitation.status === 'pending' &&
    !preview.authHint.currentUserEmail;

  return (
    <div className="min-h-screen bg-surface-muted text-fg">
      <Toaster position="top-right" richColors />
      <header className="flex h-14 items-center justify-between border-b border-brand-border bg-gradient-to-r from-brand-subtle to-surface px-4">
        <img src={logoUrl} alt="LEVERIE" className="h-9" />
        <div className="inline-flex items-center gap-2 text-xs font-medium text-fg-subtle">
          <Mail className="h-4 w-4" />
          Organization invitation
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-5xl items-center px-5 py-10">
        <section className="grid w-full grid-cols-1 gap-8 md:grid-cols-[1fr_380px]">
          <div>
            <div className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded border border-success-border bg-success-bg text-success-fg">
              <UserPlus className="h-5 w-5" />
            </div>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-normal text-fg">
              Join your LEVERIE organization.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-fg-muted">
              Create an account or sign in with the invited email address. Your
              existing workspaces stay intact.
            </p>
          </div>

          <div className="rounded border border-line bg-surface p-5 shadow-sm">
            {loading ? (
              <div className="flex min-h-64 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-fg-faint" />
              </div>
            ) : !token || !preview ? (
              <div className="py-8 text-center">
                <ShieldAlert className="mx-auto h-8 w-8 text-danger-fg" />
                <h2 className="mt-3 text-base font-semibold text-fg">
                  Invitation link is invalid
                </h2>
                <p className="mt-2 text-sm leading-6 text-fg-subtle">
                  Ask your organization admin to send a new invitation.
                </p>
              </div>
            ) : (
              <div>
                <div className="mb-5">
                  <div className="mb-3 inline-flex rounded bg-success-bg px-2 py-1 text-xs font-semibold text-success-fg">
                    {preview.org.name}
                  </div>
                  <h2 className="text-lg font-semibold text-fg">
                    {statusText(preview.invitation.status)}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-fg-subtle">
                    {invitedEmail} will join as{' '}
                    <span className="font-medium text-fg-secondary">
                      {preview.invitation.role}
                    </span>
                    .
                  </p>
                </div>

                {preview.invitation.status !== 'pending' ? (
                  <a
                    href="/auth"
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded bg-brand px-3 text-sm font-medium text-white hover:bg-brand-strong"
                  >
                    Continue to sign in
                    <ArrowRight className="h-4 w-4" />
                  </a>
                ) : canAcceptDirectly ? (
                  <button
                    type="button"
                    onClick={() => void acceptAndContinue()}
                    disabled={submitting}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded bg-brand px-3 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Accept invitation
                  </button>
                ) : needsAccountSwitch ? (
                  <div className="space-y-4">
                    <div className="rounded border border-warning-border bg-warning-bg p-3 text-sm leading-6 text-warning-fg">
                      This invitation is for {invitedEmail}. You are signed in
                      as {preview.authHint.currentUserEmail}.
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleSwitchAccount()}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded bg-brand px-3 text-sm font-medium text-white hover:bg-brand-strong"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out and continue
                    </button>
                  </div>
                ) : canShowAuthForm ? (
                  <form onSubmit={handleAuthSubmit} className="space-y-3">
                    {authMode === 'sign-up' ? (
                      <label className="block">
                        <span className="mb-1 block text-xs font-medium text-fg-muted">
                          Name
                        </span>
                        <input
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          className="h-10 w-full rounded border border-line px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
                        />
                      </label>
                    ) : null}
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-fg-muted">
                        Email
                      </span>
                      <input
                        value={invitedEmail}
                        type="email"
                        readOnly
                        className="h-10 w-full rounded border border-line bg-surface-muted px-3 text-sm text-fg-muted"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-fg-muted">
                        Password
                      </span>
                      <input
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        type="password"
                        required
                        className="h-10 w-full rounded border border-line px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex h-10 w-full items-center justify-center gap-2 rounded bg-brand px-3 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-50"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : authMode === 'sign-up' ? (
                        <UserPlus className="h-4 w-4" />
                      ) : (
                        <KeyRound className="h-4 w-4" />
                      )}
                      {authMode === 'sign-up'
                        ? 'Create account and join'
                        : 'Sign in and join'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAuthMode((mode) =>
                          mode === 'sign-up' ? 'sign-in' : 'sign-up',
                        )
                      }
                      className="h-9 w-full rounded border border-line px-3 text-sm font-medium text-fg-muted hover:bg-surface-muted"
                    >
                      {authMode === 'sign-up'
                        ? 'I already have an account'
                        : 'Create a new account'}
                    </button>
                  </form>
                ) : null}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
