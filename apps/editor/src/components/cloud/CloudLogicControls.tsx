import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Check,
  ChevronDown,
  FileText,
  Loader2,
  Rocket,
  Share2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { RunnerShareDialog } from '@/components/cloud/RunnerShareDialog';
import { Tooltip } from '@/components/ui/Tooltip';
import { useT } from '@/i18n/useT';
import { type CloudLogic, listLogics } from '@/lib/cloudApi';
import { useCloudStore } from '@/store/cloudStore';
import { useLogicStore } from '@/store/logicStore';

function canEdit(role: string | null) {
  return role === 'owner' || role === 'admin' || role === 'editor';
}

export function CloudLogicControls() {
  const t = useT();
  const importLogic = useLogicStore((s) => s.importLogic);
  const mode = useCloudStore((s) => s.mode);
  const orgRole = useCloudStore((s) => s.orgRole);
  const workspace = useCloudStore((s) => s.workspace);
  const logicId = useCloudStore((s) => s.logicId);
  const latestVersion = useCloudStore((s) => s.latestVersion);
  const productionVersion = useCloudStore((s) => s.productionVersion);
  const saveState = useCloudStore((s) => s.saveState);
  const publishCloudLogic = useCloudStore((s) => s.publishCloudLogic);
  const switchCloudLogic = useCloudStore((s) => s.switchCloudLogic);
  const [shareOpen, setShareOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [logics, setLogics] = useState<CloudLogic[]>([]);
  const [loadingLogics, setLoadingLogics] = useState(false);

  const editable = canEdit(orgRole);
  const versionLabel = productionVersion
    ? t.productionVersionLabel(productionVersion.versionNumber)
    : latestVersion
      ? t.latestVersionLabel(latestVersion.versionNumber)
      : t.draftOnly;

  const loadWorkspaceLogics = async () => {
    if (!workspace) return;
    setLoadingLogics(true);
    try {
      const result = await listLogics(workspace.id);
      setLogics(result.logics);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not load logics.',
      );
    } finally {
      setLoadingLogics(false);
    }
  };

  if (mode !== 'cloud' || !logicId) {
    return (
      <div className="flex min-w-0 items-center gap-2 rounded border border-gray-100 bg-gray-50 px-2 py-1.5">
        <FileText className="h-4 w-4 shrink-0 text-gray-400" />
        <span className="min-w-0 truncate text-xs font-medium text-gray-500">
          {t.localMode}
        </span>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <DropdownMenu.Root
          open={switcherOpen}
          onOpenChange={(open) => {
            setSwitcherOpen(open);
            if (open) void loadWorkspaceLogics();
          }}
        >
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="inline-flex min-h-9 w-full min-w-0 items-center gap-2 rounded border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-left hover:border-violet-200 hover:bg-violet-50"
              aria-label={t.switchLogic}
            >
              <FileText className="h-4 w-4 shrink-0 text-violet-700" />
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-xs font-semibold text-gray-700">
                  {t.switchLogic}
                </span>
                <span className="truncate text-[10px] font-normal text-gray-500">
                  {workspace?.name ?? t.workspaceSection} · {versionLabel}
                </span>
              </span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="start"
              sideOffset={6}
              className="z-50 w-[min(360px,calc(100vw-1rem))] rounded-md border border-gray-200 bg-white p-1 shadow-lg"
            >
              <DropdownMenu.Label className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                {workspace?.name ?? t.workspaceSection}
              </DropdownMenu.Label>
              {loadingLogics ? (
                <div className="flex items-center gap-2 px-2 py-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t.cloudChecking}
                </div>
              ) : (
                logics.map((cloudLogic) => (
                  <DropdownMenu.Item
                    key={cloudLogic.id}
                    onSelect={() => {
                      if (cloudLogic.id !== logicId) {
                        void switchCloudLogic(cloudLogic.id, importLogic);
                      }
                    }}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-2 text-sm text-gray-700 outline-none data-[highlighted]:bg-violet-50 data-[highlighted]:text-violet-800"
                  >
                    {cloudLogic.id === logicId ? (
                      <Check className="h-4 w-4 shrink-0 text-emerald-700" />
                    ) : (
                      <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                    )}
                    <span className="min-w-0 flex-1 truncate">
                      {cloudLogic.name}
                    </span>
                  </DropdownMenu.Item>
                ))
              )}
              {!loadingLogics && logics.length === 0 ? (
                <div className="px-2 py-2 text-sm text-gray-500">
                  {t.draftOnly}
                </div>
              ) : null}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {editable ? (
          <div className="grid grid-cols-2 gap-2">
            <Tooltip content={t.publish}>
              <button
                type="button"
                onClick={publishCloudLogic}
                disabled={saveState === 'saving'}
                className="inline-flex h-8 min-w-0 items-center justify-center gap-1 rounded border border-emerald-200 bg-emerald-50 px-2 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
              >
                <Rocket className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{t.publish}</span>
              </button>
            </Tooltip>
            <Tooltip content={t.shareRunner}>
              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="inline-flex h-8 min-w-0 items-center justify-center gap-1 rounded border border-gray-200 bg-white px-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                <Share2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{t.shareRunner}</span>
              </button>
            </Tooltip>
          </div>
        ) : null}
      </div>

      {shareOpen ? (
        <RunnerShareDialog
          logicId={logicId}
          latestVersion={latestVersion}
          productionVersion={productionVersion}
          onPublish={publishCloudLogic}
          onClose={() => setShareOpen(false)}
        />
      ) : null}
    </>
  );
}
