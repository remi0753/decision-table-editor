import {
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  Send,
  X,
} from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  CloudApiError,
  type CloudVersion,
  type RunnerShareRole,
  shareRunner,
} from '@/lib/cloudApi';

type RunnerShareDialogProps = {
  logicId: string;
  productionVersion: CloudVersion | null;
  latestVersion: CloudVersion | null;
  onClose: () => void;
  onPublish: () => Promise<void>;
};

function errorMessage(error: unknown) {
  if (error instanceof CloudApiError) return error.message;
  return error instanceof Error ? error.message : 'Runner share failed.';
}

function absoluteUrl(value: string) {
  if (/^https?:\/\//.test(value)) return value;
  return new URL(value, window.location.origin).toString();
}

export function RunnerShareDialog({
  logicId,
  productionVersion,
  latestVersion,
  onClose,
  onPublish,
}: RunnerShareDialogProps) {
  const version = productionVersion ?? latestVersion;
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<RunnerShareRole>('runner');
  const [runnerUrl, setRunnerUrl] = useState('');
  const [acceptUrl, setAcceptUrl] = useState('');
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [sending, setSending] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState<'runner' | 'invite' | null>(null);

  const versionLabel = useMemo(() => {
    if (!version) return 'No published version';
    return productionVersion
      ? `Production v${version.versionNumber}`
      : `Latest v${version.versionNumber}`;
  }, [productionVersion, version]);

  const ensureRunnerUrl = async () => {
    if (runnerUrl) return runnerUrl;
    if (!version) return '';
    setLoadingUrl(true);
    try {
      const result = await shareRunner({
        logicId,
        versionNumber: version.versionNumber,
      });
      const nextUrl = absoluteUrl(result.runnerPath);
      setRunnerUrl(nextUrl);
      return nextUrl;
    } finally {
      setLoadingUrl(false);
    }
  };

  const copyRunnerUrl = async () => {
    try {
      const url = await ensureRunnerUrl();
      if (!url) return;
      await navigator.clipboard.writeText(url);
      setCopied('runner');
      toast.success('Runner URL copied.');
      window.setTimeout(() => setCopied(null), 1600);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const copyInviteUrl = async () => {
    if (!acceptUrl) return;
    await navigator.clipboard.writeText(absoluteUrl(acceptUrl));
    setCopied('invite');
    toast.success('Invitation link copied.');
    window.setTimeout(() => setCopied(null), 1600);
  };

  const handleInvite = async (event: FormEvent) => {
    event.preventDefault();
    if (!version) return;
    setSending(true);
    try {
      const result = await shareRunner({
        logicId,
        email,
        role,
        versionNumber: version.versionNumber,
      });
      setRunnerUrl(absoluteUrl(result.runnerPath));
      if (result.acceptUrl) setAcceptUrl(absoluteUrl(result.acceptUrl));
      setEmail('');
      toast.success('Runner invitation sent.');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSending(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await onPublish();
      toast.success('Published. Reopen Share to copy the Runner URL.');
      onClose();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-950/30 p-4">
      <div className="w-full max-w-lg rounded-md border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Share Runner
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">{versionLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share dialog"
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          {!version ? (
            <div className="space-y-3">
              <p className="text-sm leading-6 text-gray-600">
                Publish this logic to create a fixed Runner URL for viewers and
                runners.
              </p>
              <button
                type="button"
                onClick={() => void handlePublish()}
                disabled={publishing}
                className="inline-flex h-9 items-center justify-center gap-2 rounded bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {publishing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ExternalLink className="h-4 w-4" />
                )}
                Publish
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Runner URL
                </div>
                <div className="flex gap-2">
                  <input
                    value={runnerUrl || 'Generate a URL for this version'}
                    readOnly
                    className="h-9 min-w-0 flex-1 rounded border border-gray-200 bg-gray-50 px-3 text-sm text-gray-600"
                  />
                  <button
                    type="button"
                    onClick={() => void copyRunnerUrl()}
                    disabled={loadingUrl}
                    className="inline-flex h-9 w-9 items-center justify-center rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    aria-label="Copy Runner URL"
                  >
                    {loadingUrl ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : copied === 'runner' ? (
                      <Check className="h-4 w-4 text-emerald-700" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <form onSubmit={handleInvite} className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_128px]">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">
                      Email
                    </span>
                    <input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      type="email"
                      required
                      className="h-9 w-full rounded border border-gray-200 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-300"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-gray-600">
                      Role
                    </span>
                    <select
                      value={role}
                      onChange={(event) =>
                        setRole(event.target.value as RunnerShareRole)
                      }
                      className="h-9 w-full rounded border border-gray-200 bg-white px-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-300"
                    >
                      <option value="runner">Runner</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={sending}
                  className="inline-flex h-9 w-full items-center justify-center gap-2 rounded bg-violet-600 px-3 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Send Runner invite
                </button>
              </form>

              {acceptUrl ? (
                <div className="flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 p-2">
                  <Mail className="h-4 w-4 shrink-0 text-emerald-700" />
                  <div className="min-w-0 flex-1 truncate text-xs text-emerald-900">
                    {acceptUrl}
                  </div>
                  <button
                    type="button"
                    onClick={() => void copyInviteUrl()}
                    className="inline-flex h-7 w-7 items-center justify-center rounded border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-100"
                    aria-label="Copy invitation link"
                  >
                    {copied === 'invite' ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
