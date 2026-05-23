import { ExternalLink, LogIn, Shield } from 'lucide-react';
import logoUrl from '@/assets/logo.svg';

export function AccessPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4">
        <img src={logoUrl} alt="LEVERIE" className="h-9" />
        <a
          href="/auth"
          className="inline-flex h-8 items-center gap-2 rounded border border-gray-200 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <LogIn className="h-4 w-4" />
          Sign in
        </a>
      </header>
      <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-3xl items-center px-5 py-12">
        <section>
          <div className="mb-5 inline-flex h-10 w-10 items-center justify-center rounded border border-emerald-200 bg-emerald-50 text-emerald-700">
            <Shield className="h-5 w-5" />
          </div>
          <h1 className="text-3xl font-semibold tracking-normal text-gray-950">
            Open a shared Runner link.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-gray-600">
            Viewer and runner accounts open published Runner URLs shared by an
            editor. Ask your team for a Runner invite if you do not have one.
          </p>
          <a
            href="/edit"
            className="mt-6 inline-flex h-10 items-center gap-2 rounded bg-violet-600 px-4 text-sm font-medium text-white hover:bg-violet-700"
          >
            <ExternalLink className="h-4 w-4" />
            Open editor
          </a>
        </section>
      </main>
    </div>
  );
}
