import type { Logic } from '@leverie/engine';
import { useEffect, useRef } from 'react';
import { useCloudStore } from '@/store/cloudStore';

export function useCloudAutoSave(logic: Logic, enabled = true) {
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

    const serialized = JSON.stringify(logic);
    if (firstCloudLogic.current?.logicId !== logicId) {
      firstCloudLogic.current = { logicId, serialized };
      return;
    }

    const timer = window.setTimeout(() => {
      void saveCloudDraft(logic);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [enabled, logic, logicId, mode, saveCloudDraft]);
}
