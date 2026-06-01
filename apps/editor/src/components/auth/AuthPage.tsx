import {
  ArrowRight,
  Cloud,
  LockKeyhole,
  MailCheck,
  Monitor,
  Table2,
} from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Toaster, toast } from 'sonner';
import logoUrl from '@/assets/logo.svg';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import {
  loadFromStorage,
  stashDraftForMigration,
} from '@/hooks/useLocalStorage';
import {
  CloudApiError,
  sendVerificationEmail,
  signInEmail,
  signOut,
  signUpEmail,
} from '@/lib/cloudApi';
import { hasEditableContent } from '@/store/logicStore';

function authErrorMessage(error: unknown) {
  if (error instanceof CloudApiError) return error.message;
  return error instanceof Error ? error.message : 'Authentication failed.';
}

// `/edit` is on the same origin as the SPA. We pass the full URL so Better
// Auth's verification redirect lands the browser back on the editor (rather
// than on the API origin in split-host dev setups).
function buildVerificationCallbackURL() {
  return `${window.location.origin}/edit`;
}

type VerificationPending = {
  email: string;
  // 'sign-up' the very first time we sent the email after creating the
  // account, 'sign-in' when an existing-but-unverified user tries to log in.
  // Only used to tailor the headline so the message matches what the user
  // just did.
  reason: 'sign-up' | 'sign-in';
};

export function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [pendingVerification, setPendingVerification] =
    useState<VerificationPending | null>(null);

  // Authentication itself makes no decision about the local draft. We only
  // preserve it across the transition: if the user came from local mode with
  // real work, copy it into a persistent slot so the post-auth "new logic"
  // screen can offer to start from it (the choice lives there, not here). The
  // slot survives the sign-up + email-verification round trip, which can land
  // on /edit in a different tab where the sessionStorage draft would be gone.
  const preserveLocalDraftForHandoff = () => {
    const draft = loadFromStorage();
    if (draft && hasEditableContent(draft)) {
      stashDraftForMigration(draft);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (isSignUp) {
        await signUpEmail(
          name || email,
          email,
          password,
          buildVerificationCallbackURL(),
        );
        preserveLocalDraftForHandoff();
        setPendingVerification({ email, reason: 'sign-up' });
        return;
      }
      await signInEmail(email, password);
      preserveLocalDraftForHandoff();
      window.location.assign('/edit');
    } catch (error) {
      if (
        !isSignUp &&
        error instanceof CloudApiError &&
        error.code === 'EMAIL_NOT_VERIFIED'
      ) {
        setPendingVerification({ email, reason: 'sign-in' });
        return;
      }
      toast.error(authErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!pendingVerification) return;
    setResending(true);
    try {
      // If a stale session for a different account is still in cookies, the
      // /send-verification-email endpoint short-circuits with EMAIL_MISMATCH.
      // Drop any existing session first so the call falls through to the
      // unauthenticated branch that looks up the user by email.
      await signOut().catch(() => undefined);
      await sendVerificationEmail(
        pendingVerification.email,
        buildVerificationCallbackURL(),
      );
      toast.success('Verification email sent.');
    } catch (error) {
      toast.error(authErrorMessage(error));
    } finally {
      setResending(false);
    }
  };

  const handleUseDifferentAccount = () => {
    setPendingVerification(null);
    setPassword('');
  };

  return (
    <div className="min-h-screen bg-surface-muted text-fg">
      <Toaster position="top-right" richColors />
      <header className="flex h-14 items-center justify-between border-b border-brand-border bg-gradient-to-r from-brand-subtle to-surface px-4">
        <img src={logoUrl} alt="LEVERIE" className="h-9" />
        <div className="inline-flex items-center gap-3">
          <div className="inline-flex items-center gap-2 text-xs font-medium text-fg-subtle">
            <LockKeyhole className="h-4 w-4" />
            Cloud workspace
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-5xl grid-cols-1 items-center gap-8 px-5 py-10 md:grid-cols-[1fr_360px]">
        <section>
          <div className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded border border-brand-border bg-brand-subtle text-brand-fg">
            <Cloud className="h-5 w-5" />
          </div>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-normal text-fg">
            Sign in to edit decision logic in LEVERIE.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-fg-muted">
            Drafts, versions, and production publishes now live in your cloud
            workspace. You can also continue without signing in for a local
            browser-only session.
          </p>
          <div className="mt-8 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              ['Draft save', 'Autosaved with conflict detection'],
              ['Publish', 'Create immutable versions'],
              ['Workspace', 'Shared by org membership'],
            ].map(([title, body]) => (
              <div
                key={title}
                className="rounded border border-line bg-surface p-3"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-fg-secondary">
                  <Table2 className="h-4 w-4 text-brand-fg" />
                  {title}
                </div>
                <p className="mt-2 text-xs leading-5 text-fg-subtle">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded border border-line bg-surface p-5 shadow-sm">
          {pendingVerification ? (
            <div>
              <div className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded border border-success-border bg-success-bg text-success-fg">
                <MailCheck className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-semibold text-fg">
                {pendingVerification.reason === 'sign-up'
                  ? 'Confirm your email'
                  : 'Email not verified yet'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-fg-muted">
                {pendingVerification.reason === 'sign-up'
                  ? 'We sent a verification link to '
                  : 'You need to verify your email before signing in. We can resend the link to '}
                <span className="font-medium text-fg">
                  {pendingVerification.email}
                </span>
                {pendingVerification.reason === 'sign-up'
                  ? '. Click it to finish creating your account.'
                  : '.'}
              </p>
              <p className="mt-2 text-xs leading-5 text-fg-subtle">
                Can't find it? Check your spam folder, or resend below. The link
                expires in 1 hour.
              </p>
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded bg-brand px-3 text-sm font-medium text-white hover:bg-brand-strong disabled:opacity-50"
              >
                {resending ? 'Sending…' : 'Resend verification email'}
              </button>
              <button
                type="button"
                onClick={handleUseDifferentAccount}
                className="mt-2 h-9 w-full rounded border border-line px-3 text-sm font-medium text-fg-muted hover:bg-surface-muted"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-fg">
                  {isSignUp ? 'Create account' : 'Sign in'}
                </h2>
                <p className="mt-1 text-sm text-fg-subtle">
                  Use email and password to continue.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                {isSignUp ? (
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
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    required
                    className="h-10 w-full rounded border border-line px-3 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
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
                  {isSignUp ? 'Create account' : 'Sign in'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              <button
                type="button"
                onClick={() => setIsSignUp((value) => !value)}
                className="mt-4 h-9 w-full rounded border border-line px-3 text-sm font-medium text-fg-muted hover:bg-surface-muted"
              >
                {isSignUp ? 'Use an existing account' : 'Create a new account'}
              </button>

              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-surface-strong" />
                <span className="text-xs font-medium text-fg-faint">or</span>
                <div className="h-px flex-1 bg-surface-strong" />
              </div>

              <a
                href="/local"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded border border-line px-3 text-sm font-medium text-fg-secondary hover:bg-surface-muted"
              >
                <Monitor className="h-4 w-4" />
                Use without signing in
              </a>
              <p className="mt-2 text-xs leading-5 text-fg-subtle">
                Local mode saves only in this browser and cannot publish cloud
                versions.
              </p>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
