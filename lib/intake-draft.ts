import type { IntakeFormData } from "@/types";

/**
 * Client-side persistence for the in-progress intake wizard.
 *
 * The form previously promised "Your progress is saved automatically" while
 * holding everything in React state, so any refresh, browser-back or session
 * cookie refresh silently wiped all four steps. A draft is small, per-user and
 * short-lived, so `localStorage` is enough — no table, no migration.
 *
 * Every entry point is safe to call during SSR (returns a no-op) and never
 * throws: private-mode/quota failures must not take the form down.
 */

const DRAFT_VERSION = 1;
const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface IntakeDraft {
  version: number;
  step: number;
  savedAt: number;
  data: Partial<IntakeFormData>;
}

export function intakeDraftKey(userId: string): string {
  return `gmh:intake-draft:v${DRAFT_VERSION}:${userId}`;
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    // Storage can be blocked entirely (Safari private mode, strict cookie
    // policies). Treat it as "no draft" rather than crashing the wizard.
    return null;
  }
}

export function loadIntakeDraft(userId: string): IntakeDraft | null {
  const store = storage();
  if (!store || !userId) return null;

  try {
    const raw = store.getItem(intakeDraftKey(userId));
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const draft = parsed as Partial<IntakeDraft>;
    if (draft.version !== DRAFT_VERSION) return null;
    if (typeof draft.data !== "object" || draft.data === null) return null;
    if (
      typeof draft.savedAt === "number" &&
      Date.now() - draft.savedAt > DRAFT_MAX_AGE_MS
    ) {
      clearIntakeDraft(userId);
      return null;
    }

    return {
      version: DRAFT_VERSION,
      step: typeof draft.step === "number" ? draft.step : 0,
      savedAt: typeof draft.savedAt === "number" ? draft.savedAt : Date.now(),
      data: draft.data,
    };
  } catch {
    return null;
  }
}

export function saveIntakeDraft(
  userId: string,
  draft: { step: number; data: IntakeFormData }
): void {
  const store = storage();
  if (!store || !userId) return;

  try {
    const payload: IntakeDraft = {
      version: DRAFT_VERSION,
      step: draft.step,
      savedAt: Date.now(),
      data: draft.data,
    };
    store.setItem(intakeDraftKey(userId), JSON.stringify(payload));
  } catch {
    // Quota exceeded or storage disabled — the form still works in memory.
  }
}

export function clearIntakeDraft(userId: string): void {
  const store = storage();
  if (!store || !userId) return;

  try {
    store.removeItem(intakeDraftKey(userId));
  } catch {
    // Nothing to do.
  }
}

// ── useSyncExternalStore adapter ─────────────────────────────────────────────
// The wizard reads the stored draft through useSyncExternalStore rather than
// copying it into state from an effect: React uses the *server* snapshot while
// hydrating and swaps to the client snapshot immediately afterwards, so there
// is neither a hydration mismatch nor a setState inside an effect body.
//
// getSnapshot must return a referentially stable value or React re-renders
// forever, so the read is memoised per storage key. The snapshot is
// deliberately frozen for the life of the page: it is only ever the *starting
// point* for the form, and later writes (save/clear) must not yank the form's
// contents out from under the user.

let snapshotCache: { key: string; value: IntakeDraft | null } | null = null;

/** Stable no-op: nothing else in this tab mutates the draft behind our back. */
export function subscribeIntakeDraft(): () => void {
  return () => {};
}

/** Client snapshot — the draft as it stood when this page first read it. */
export function getIntakeDraftSnapshot(userId: string): IntakeDraft | null {
  const key = intakeDraftKey(userId);
  if (snapshotCache?.key === key) return snapshotCache.value;

  const value = loadIntakeDraft(userId);
  snapshotCache = { key, value };
  return value;
}

/** Server snapshot — there is no storage during SSR. */
export function getIntakeDraftServerSnapshot(): IntakeDraft | null {
  return null;
}

/** Test seam: drops the memoised snapshot. */
export function resetIntakeDraftSnapshot(): void {
  snapshotCache = null;
}
