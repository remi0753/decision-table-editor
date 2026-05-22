import { ArrowRight, Cloud, LockKeyhole, Monitor, Table2 } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Toaster, toast } from 'sonner';
import logoUrl from '@/assets/logo.svg';
import {
  CloudApiError,
  createOrg,
  getMe,
  signInEmail,
  signUpEmail,
} from '@/lib/cloudApi';

function authErrorMessage(error: unknown) {
  if (error instanceof CloudApiError) return error.message;
  return error instanceof Error ? error.message : 'Authentication failed.';
}

export function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      if (isSignUp) {
        await signUpEmail(name || email, email, password);
        const me = await getMe();
        if (me.orgs.length === 0) {
          await createOrg(name || 'My organization');
        }
      } else {
        await signInEmail(email, password);
      }
      sessionStorage.removeItem('leverie-editor-mode');
      window.location.assign('/edit');
    } catch (error) {
      toast.error(authErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Toaster position="top-right" richColors />
      <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4">
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
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-gray-900">
              {isSignUp ? 'Create account' : 'Sign in'}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Use email and password to continue.
            </p>
          </div>

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
              {isSignUp ? 'Create account' : 'Sign in'}
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
        </section>
      </main>
    </div>
  );
}
