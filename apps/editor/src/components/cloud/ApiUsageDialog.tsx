import type { Logic } from '@leverie/engine';
import { Check, Copy, ExternalLink, KeyRound, Loader2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  buildSnippet,
  logicInputFields,
  SNIPPET_LANGS,
  type SnippetLang,
  type VersionTarget,
} from '@/lib/apiSnippets';
import type { CloudVersion } from '@/lib/cloudApi';

type ApiUsageDialogProps = {
  logic: Logic;
  logicId: string;
  /** DB slug used as the MCP tool name. */
  logicSlug: string | null;
  productionVersion: CloudVersion | null;
  latestVersion: CloudVersion | null;
  onClose: () => void;
  onPublish: () => Promise<void>;
};

function apiOrigin() {
  const base = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (base && /^https?:\/\//.test(base)) return base.replace(/\/$/, '');
  return window.location.origin;
}

export function ApiUsageDialog({
  logic,
  logicId,
  logicSlug,
  productionVersion,
  latestVersion,
  onClose,
  onPublish,
}: ApiUsageDialogProps) {
  const hasVersion = Boolean(productionVersion ?? latestVersion);
  const [lang, setLang] = useState<SnippetLang>('curl');
  const [version, setVersion] = useState<VersionTarget>(
    productionVersion ? 'production' : 'latest',
  );
  const [copied, setCopied] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const fields = useMemo(() => logicInputFields(logic), [logic]);
  const snippet = useMemo(
    () =>
      buildSnippet(lang, {
        logic,
        apiOrigin: apiOrigin(),
        logicId,
        logicSlug: logicSlug ?? '',
        version,
      }),
    [lang, logic, logicId, logicSlug, version],
  );

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      toast.success('Snippet copied.');
      window.setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not copy snippet.',
      );
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      await onPublish();
      toast.success('Published. Reopen to copy an API snippet.');
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Publish failed.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-950/30 p-4">
      <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col rounded-md border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Use this logic via API
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Call <span className="font-medium">{logic.name}</span> from your
              backend, automation, or agent.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close API dialog"
            className="inline-flex h-8 w-8 items-center justify-center rounded border border-gray-200 text-gray-500 hover:bg-gray-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {!hasVersion ? (
          <div className="space-y-3 p-4">
            <p className="text-sm leading-6 text-gray-600">
              Publish this logic to call it via the API. Only published versions
              can be evaluated.
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
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            <div className="flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-3 py-2">
              <KeyRound className="h-4 w-4 shrink-0 text-amber-700" />
              <p className="min-w-0 flex-1 text-xs leading-5 text-amber-900">
                Replace <code className="font-mono">$LEVERIE_API_KEY</code> with
                a key for this workspace.{' '}
                <a
                  href="/settings/workspace"
                  className="font-medium underline hover:text-amber-950"
                >
                  Create a key in Workspace settings
                </a>
                . The raw secret is shown only once at creation.
              </p>
            </div>

            {fields.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Input fields
                </div>
                <div className="overflow-hidden rounded border border-gray-200">
                  {fields.map((field, i) => (
                    <div
                      key={field.name}
                      className={`flex items-baseline gap-3 px-3 py-1.5 text-xs ${
                        i % 2 === 1 ? 'bg-gray-50' : 'bg-white'
                      }`}
                    >
                      <span className="font-mono font-medium text-gray-800">
                        {field.name}
                      </span>
                      <span className="min-w-0 truncate text-gray-500">
                        {field.typeLabel}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                This logic has no input fields. Send an empty{' '}
                <code className="font-mono">inputs</code> object.
              </p>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {SNIPPET_LANGS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setLang(option.id)}
                      className={`h-7 rounded px-2.5 text-xs font-medium ${
                        lang === option.id
                          ? 'bg-violet-600 text-white'
                          : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {lang !== 'mcp' ? (
                  <select
                    value={version}
                    onChange={(event) =>
                      setVersion(event.target.value as VersionTarget)
                    }
                    aria-label="Version"
                    className="h-7 rounded border border-gray-200 bg-white px-1.5 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-violet-300"
                  >
                    {productionVersion ? (
                      <option value="production">
                        Production v{productionVersion.versionNumber}
                      </option>
                    ) : null}
                    {latestVersion ? (
                      <option value="latest">
                        Latest v{latestVersion.versionNumber}
                      </option>
                    ) : null}
                  </select>
                ) : null}
              </div>

              <div className="relative">
                <pre className="max-h-72 overflow-auto rounded border border-gray-200 bg-gray-900 p-3 pr-12 text-xs leading-5 text-gray-100">
                  <code>{snippet}</code>
                </pre>
                <button
                  type="button"
                  onClick={() => void copySnippet()}
                  aria-label="Copy snippet"
                  className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded border border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>

              {lang === 'mcp' ? (
                <p className="text-xs leading-5 text-gray-500">
                  MCP <code className="font-mono">tools/call</code> always
                  evaluates the production snapshot.
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
