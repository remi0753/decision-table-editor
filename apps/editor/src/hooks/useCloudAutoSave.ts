import type { Logic } from '@leverie/engine';
import type { WorkspaceConfig } from '@leverie/ui-runtime';
import { useEffect, useRef } from 'react';
import { useCloudStore } from '@/store/cloudStore';

export function useCloudAutoSave(
  logic: Logic,
  workspaceConfig: WorkspaceConfig | null,
  enabled = true,
) {
  const mode = useCloudStore((s) => s.mode);
  const logicId = useCloudStore((s) => s.logicId);
  const saveCloudDraft = useCloudStore((s) => s.saveCloudDraft);
  const firstCloudLogic = useRef<{
    logicId: string;
    serialized: string;
  } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (mode !== 'cloud' || !logicId) return;

    const serialized = JSON.stringify({ logic, workspaceConfig });
    const previous = firstCloudLogic.current;
    if (previous?.logicId !== logicId) {
      firstCloudLogic.current = { logicId, serialized };
      return;
    }
    if (previous.serialized === serialized) return;

    const timer = window.setTimeout(() => {
      firstCloudLogic.current = { logicId, serialized };
      void saveCloudDraft(logic);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [enabled, logic, logicId, mode, saveCloudDraft, workspaceConfig]);
}
