import { useEffect } from 'react';
import { toast } from 'sonner';
import { LogicSchema } from '@/lib/schema';
import type { Logic } from '@/types/logic';

const STORAGE_KEY = 'decision-table-editor-v2';

export function useAutoSave(logic: Logic) {
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(logic));
    } catch {
      toast.error(
        'データの自動保存に失敗しました。「エクスポート」からファイルに保存してください。',
      );
    }
  }, [logic]);
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
