import {
  ArrowRight,
  Check,
  Cloud,
  CloudUpload,
  LockKeyhole,
  MailCheck,
  Monitor,
  Table2,
} from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Toaster, toast } from 'sonner';
import logoUrl from '@/assets/logo.svg';
import { loadFromStorage } from '@/hooks/useLocalStorage';
import {
  CloudApiError,
  sendVerificationEmail,
  signInEmail,
  signOut,
  signUpEmail,
} from '@/lib/cloudApi';

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
  const [localDraft] = useState(() => loadFromStorage());
  const [migrateLocalDraft, setMigrateLocalDraft] = useState(
    () => localDraft !== null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [pendingVerification, setPendingVerification] =
    useState<VerificationPending | null>(null);

  const persistMigrateChoice = () => {
    if (migrateLocalDraft && localDraft) {
      sessionStorage.setItem('leverie-migrate-local-draft', '1');
    } else {
      sessionStorage.removeItem('leverie-migrate-local-draft');
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
        // Keep the migrate-draft choice so it is honored after the user
        // clicks the verification link and lands on /edit.
        sessionStorage.removeItem('leverie-editor-mode');
        persistMigrateChoice();
        setPendingVerification({ email, reason: 'sign-up' });
        return;
      }
      await signInEmail(email, password);
      sessionStorage.removeItem('leverie-editor-mode');
      persistMigrateChoice();
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
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Toaster position="top-right" richColors />
      <header className="flex h-14 items-center justify-between border-b border-violet-200 bg-gradient-to-r from-violet-50 to-white px-4">
        <img src={logoUrl} alt="LEVERIE" className="h-9" />
        <div className="inline-flex items-center gap-2 text-xs font-medium text-gray-500">
          <LockKeyhole className="h-4 w-4" />
          Cloud workspace
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-5xl grid-cols-1 items-center gap-8 px-5 py-10 md:grid-cols-[1fr_360px]">
        <section>
          <div className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded border border-emerald-200 bg-emerald-50 text-emerald-700">
            <Cloud className="h-5 w-5" />
          </div>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-normal text-gray-950">
            Sign in to edit decision logic in LEVERIE.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-gray-600">
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
                className="rounded border border-gray-200 bg-white p-3"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <Table2 className="h-4 w-4 text-violet-600" />
                  {title}
                </div>
                <p className="mt-2 text-xs leading-5 text-gray-500">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded border border-gray-200 bg-white p-5 shadow-sm">
          {pendingVerification ? (
            <div>
              <div className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded border border-emerald-200 bg-emerald-50 text-emerald-700">
                <MailCheck className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">
                {pendingVerification.reason === 'sign-up'
                  ? 'Confirm your email'
                  : 'Email not verified yet'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                {pendingVerification.reason === 'sign-up'
                  ? 'We sent a verification link to '
                  : 'You need to verify your email before signing in. We can resend the link to '}
                <span className="font-medium text-gray-900">
                  {pendingVerification.email}
                </span>
                {pendingVerification.reason === 'sign-up'
                  ? '. Click it to finish creating your account.'
                  : '.'}
              </p>
              <p className="mt-2 text-xs leading-5 text-gray-500">
                Can't find it? Check your spam folder, or resend below. The link
                expires in 1 hour.
              </p>
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded bg-violet-600 px-3 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {resending ? 'Sending…' : 'Resend verification email'}
              </button>
              <button
                type="button"
                onClick={handleUseDifferentAccount}
                className="mt-2 h-9 w-full rounded border border-gray-200 px-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              <div className="mb-5">
                <h2 className="text-lg font-semibold text-gray-900">
                  {isSignUp ? 'Create account' : 'Sign in'}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Use email and password to continue.
                </p>
              </div>

              {localDraft ? (
                <button
                  type="button"
                  onClick={() => setMigrateLocalDraft((value) => !value)}
                  className={`mb-4 flex w-full items-start gap-3 rounded border p-3 text-left transition-colors ${
                    migrateLocalDraft
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                      : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-white'
                  }`}
                >
                  <span
                    className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                      migrateLocalDraft
                        ? 'border-emerald-500 bg-emerald-600 text-white'
                        : 'border-gray-300 bg-white text-transparent'
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <CloudUpload className="h-4 w-4 shrink-0" />
                      Move browser draft to cloud
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-gray-600">
                      {migrateLocalDraft
                        ? `"${localDraft.name}" will be created as a new cloud logic after sign-in.`
                        : 'Keep the browser draft local and load your cloud workspace normally.'}
                    </span>
                  </span>
                </button>
              ) : null}

              <form onSubmit={handleSubmit} className="space-y-3">
                {isSignUp ? (
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">
                      Name
                    </span>
                    <input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className="h-10 w-full rounded border border-gray-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-300"
                    />
                  </label>
                ) : null}
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">
                    Email
                  </span>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    required
                    className="h-10 w-full rounded border border-gray-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-300"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-gray-600">
                    Password
                  </span>
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    required
                    className="h-10 w-full rounded border border-gray-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-300"
                  />
                </label>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded bg-violet-600 px-3 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {migrateLocalDraft && localDraft
                    ? isSignUp
                      ? 'Create account and move draft'
                      : 'Sign in and move draft'
                    : isSignUp
                      ? 'Create account'
                      : 'Sign in'}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              <button
                type="button"
                onClick={() => setIsSignUp((value) => !value)}
                className="mt-4 h-9 w-full rounded border border-gray-200 px-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                {isSignUp ? 'Use an existing account' : 'Create a new account'}
              </button>

              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs font-medium text-gray-400">or</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              <a
                href="/edit"
                onClick={() => {
                  sessionStorage.setItem('leverie-editor-mode', 'guest');
                }}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded border border-gray-200 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Monitor className="h-4 w-4" />
                Use without signing in
              </a>
              <p className="mt-2 text-xs leading-5 text-gray-500">
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
