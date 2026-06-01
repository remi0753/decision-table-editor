import type { Logic } from '@leverie/engine';
import { LogicSchema } from '@leverie/engine';
import { useEffect } from 'react';
import { toast } from 'sonner';

// Local ("guest") mode keeps its working draft in sessionStorage, scoped to a
// single browser tab: opening /local in a fresh tab always starts blank, an
// accidental reload keeps the in-progress work, and closing the tab discards
// it. Persisting beyond that is intentionally a cloud (sign-up) feature.
const SESSION_DRAFT_KEY = 'leverie-local-draft';

// When a local-mode user chooses to bring their draft to the cloud, we copy it
// into this persistent slot so it survives the sign-up + email-verification
// round trip — which can land back on /edit in a different tab, where
// sessionStorage would be empty. The slot is always overwritten with the
// latest draft and cleared once consumed (or ignored once stale).
const MIGRATE_KEY = 'leverie-migrate-draft';
const MIGRATE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function parseLogic(raw: unknown): Logic | null {
  const result = LogicSchema.safeParse(raw);
  return result.success ? (result.data as Logic) : null;
}

export function useAutoSave(logic: Logic, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    try {
      sessionStorage.setItem(SESSION_DRAFT_KEY, JSON.stringify(logic));
    } catch {
      toast.error(
        'データの自動保存に失敗しました。「エクスポート」からファイルに保存してください。',
      );
    }
  }, [logic, enabled]);
}

export function loadFromStorage(): Logic | null {
  try {
    const raw = sessionStorage.getItem(SESSION_DRAFT_KEY);
    if (!raw) return null;
    return parseLogic(JSON.parse(raw));
  } catch {
    return null;
  }
}

// Promote the current local draft into the persistent migration slot. Always
// overwrites: only one "draft to bring to the cloud" can be pending per
// browser, and the latest sign-up/in action reflects the user's intent.
export function stashDraftForMigration(logic: Logic) {
  try {
    localStorage.setItem(
      MIGRATE_KEY,
      JSON.stringify({ logic, savedAt: Date.now() }),
    );
  } catch {
    // Migration is a convenience; ignore quota/availability failures.
  }
}

export function loadMigrationDraft(): Logic | null {
  try {
    const raw = localStorage.getItem(MIGRATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.savedAt === 'number' &&
      Date.now() - parsed.savedAt > MIGRATE_MAX_AGE_MS
    ) {
      return null;
    }
    return parseLogic(parsed?.logic);
  } catch {
    return null;
  }
}

export function clearMigrationDraft() {
  try {
    localStorage.removeItem(MIGRATE_KEY);
  } catch {
    // ignore
  }
}
