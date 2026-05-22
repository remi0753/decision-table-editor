import { Cloud, CloudOff, LogIn, LogOut, Rocket } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';
import { IconButton } from '@/components/ui/IconButton';
import { Tooltip } from '@/components/ui/Tooltip';
import { useT } from '@/i18n/useT';
import { useCloudStore } from '@/store/cloudStore';
import { useLogicStore } from '@/store/logicStore';

export function CloudMenu() {
  const t = useT();
  const logic = useLogicStore((s) => s.logic);
  const importLogic = useLogicStore((s) => s.importLogic);
  const mode = useCloudStore((s) => s.mode);
  const saveState = useCloudStore((s) => s.saveState);
  const user = useCloudStore((s) => s.user);
  const workspace = useCloudStore((s) => s.workspace);
  const error = useCloudStore((s) => s.error);
  const signIn = useCloudStore((s) => s.signIn);
  const signUp = useCloudStore((s) => s.signUp);
  const signOutToAuth = useCloudStore((s) => s.signOutToAuth);
  const publishCloudLogic = useCloudStore((s) => s.publishCloudLogic);
  const [open, setOpen] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <div className="relative">
      <Tooltip content={status}>
        <IconButton
          size="md"
          tone="primary"
          onClick={() => setOpen((value) => !value)}
          aria-label={status}
          className={mode === 'cloud' ? 'text-emerald-700' : undefined}
        >
          {mode === 'cloud' ? <Cloud /> : <CloudOff />}
        </IconButton>
      </Tooltip>

      {open ? (
        <div className="absolute right-0 top-10 z-50 w-80 rounded border border-gray-200 bg-white p-3 shadow-lg">
          <div className="mb-3">
            <div className="text-sm font-semibold text-gray-800">{status}</div>
            <div className="mt-1 text-xs text-gray-500">
              {mode === 'cloud'
                ? `${user?.email ?? ''}${workspace ? ` · ${workspace.name}` : ''}`
                : t.localModeDescription}
            </div>
            {error ? (
              <div className="mt-1 text-xs text-red-600">{error}</div>
            ) : null}
          </div>

          {mode === 'cloud' ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={publishCloudLogic}
                disabled={saveState === 'saving'}
                className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
              >
                <Rocket className="h-3.5 w-3.5" />
                {t.publish}
              </button>
              <button
                type="button"
                onClick={signOutToAuth}
                className="inline-flex h-8 items-center justify-center gap-1 rounded border border-gray-200 px-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                <LogOut className="h-3.5 w-3.5" />
                {t.signOut}
              </button>
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
