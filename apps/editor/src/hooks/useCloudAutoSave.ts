import type { Logic } from '@leverie/engine';
import { useEffect, useRef } from 'react';
import { useCloudStore } from '@/store/cloudStore';

export function useCloudAutoSave(logic: Logic) {
  const mode = useCloudStore((s) => s.mode);
  const saveCloudDraft = useCloudStore((s) => s.saveCloudDraft);
  const firstCloudLogic = useRef<string | null>(null);

  useEffect(() => {
    if (mode !== 'cloud') return;

    const serialized = JSON.stringify(logic);
    if (firstCloudLogic.current === null) {
      firstCloudLogic.current = serialized;
      return;
    }

    const timer = window.setTimeout(() => {
      void saveCloudDraft(logic);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [logic, mode, saveCloudDraft]);
}
