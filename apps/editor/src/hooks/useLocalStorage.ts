import type { Logic } from '@leverie/engine';
import { LogicSchema } from '@leverie/engine';
import { useEffect } from 'react';
import { toast } from 'sonner';

const STORAGE_KEY = 'decision-table-editor-v2';

export function useAutoSave(logic: Logic, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logic));
    } catch {
      toast.error(
        'データの自動保存に失敗しました。「エクスポート」からファイルに保存してください。',
      );
    }
  }, [logic, enabled]);
}

export function loadFromStorage(): Logic | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const result = LogicSchema.safeParse(parsed);
    return result.success ? (result.data as Logic) : null;
  } catch {
    return null;
  }
}
