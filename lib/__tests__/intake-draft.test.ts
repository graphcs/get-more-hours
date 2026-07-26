import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  clearIntakeDraft,
  getIntakeDraftServerSnapshot,
  getIntakeDraftSnapshot,
  intakeDraftKey,
  loadIntakeDraft,
  resetIntakeDraftSnapshot,
  saveIntakeDraft,
  subscribeIntakeDraft,
} from "@/lib/intake-draft";
import type { IntakeFormData } from "@/types";

const data: IntakeFormData = {
  firstName: "Jane",
  lastName: "Doe",
  dob: "1948-04-11",
  phone: "(212) 555-0000",
  email: "",
  address: "123 Main Street",
  city: "Brooklyn",
  state: "NY",
  zip: "11201",
  mltc: "healthfirst",
  currentHours: 4,
  currentDays: 5,
  requestedHours: 8,
  requestedDays: 7,
  conditions: ["Diabetes"],
  otherConditions: "",
  changeDescription: "",
  adlLevels: {},
  adlNotes: "",
};

/**
 * The suite runs in vitest's `node` environment (see vitest.config.ts), so
 * `window` has to be stood up by hand. A tiny in-memory Storage is enough and
 * avoids pulling jsdom in just to exercise four functions.
 */
class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
}

const globalWithWindow = globalThis as { window?: { localStorage: Storage } };
const originalWindow = globalWithWindow.window;

describe("intake draft persistence", () => {
  beforeEach(() => {
    globalWithWindow.window = { localStorage: new MemoryStorage() };
  });

  afterAll(() => {
    globalWithWindow.window = originalWindow;
  });

  it("is a no-op on the server, where there is no window", () => {
    globalWithWindow.window = undefined;
    expect(() => saveIntakeDraft("user-1", { step: 1, data })).not.toThrow();
    expect(loadIntakeDraft("user-1")).toBeNull();
    expect(() => clearIntakeDraft("user-1")).not.toThrow();
  });

  it("round-trips a draft for a user", () => {
    saveIntakeDraft("user-1", { step: 1, data });
    const draft = loadIntakeDraft("user-1");
    expect(draft?.step).toBe(1);
    expect(draft?.data.firstName).toBe("Jane");
  });

  it("keys drafts per user so accounts never see each other's intake", () => {
    saveIntakeDraft("user-1", { step: 1, data });
    expect(loadIntakeDraft("user-2")).toBeNull();
    expect(intakeDraftKey("user-1")).not.toBe(intakeDraftKey("user-2"));
  });

  it("clears on submit", () => {
    saveIntakeDraft("user-1", { step: 2, data });
    clearIntakeDraft("user-1");
    expect(loadIntakeDraft("user-1")).toBeNull();
  });

  it("ignores corrupt or foreign-version payloads instead of throwing", () => {
    globalWithWindow.window!.localStorage.setItem(intakeDraftKey("user-1"), "not json");
    expect(loadIntakeDraft("user-1")).toBeNull();

    globalWithWindow.window!.localStorage.setItem(
      intakeDraftKey("user-1"),
      JSON.stringify({ version: 99, step: 1, data })
    );
    expect(loadIntakeDraft("user-1")).toBeNull();
  });

  it("discards drafts older than the max age", () => {
    globalWithWindow.window!.localStorage.setItem(
      intakeDraftKey("user-1"),
      JSON.stringify({
        version: 1,
        step: 1,
        savedAt: Date.now() - 31 * 24 * 60 * 60 * 1000,
        data,
      })
    );
    expect(loadIntakeDraft("user-1")).toBeNull();
    expect(globalWithWindow.window!.localStorage.getItem(intakeDraftKey("user-1"))).toBeNull();
  });
});

describe("useSyncExternalStore adapter", () => {
  beforeEach(() => {
    globalWithWindow.window = { localStorage: new MemoryStorage() };
    resetIntakeDraftSnapshot();
  });

  afterAll(() => {
    globalWithWindow.window = originalWindow;
    resetIntakeDraftSnapshot();
  });

  it("has no draft on the server, so hydration matches the empty form", () => {
    expect(getIntakeDraftServerSnapshot()).toBeNull();
  });

  it("returns a referentially stable snapshot (React would loop otherwise)", () => {
    saveIntakeDraft("user-1", { step: 1, data });
    const first = getIntakeDraftSnapshot("user-1");
    expect(first?.step).toBe(1);
    expect(getIntakeDraftSnapshot("user-1")).toBe(first);
  });

  it("freezes the snapshot so later writes cannot yank the form's contents", () => {
    saveIntakeDraft("user-1", { step: 1, data });
    const first = getIntakeDraftSnapshot("user-1");
    saveIntakeDraft("user-1", { step: 3, data });
    clearIntakeDraft("user-1");
    expect(getIntakeDraftSnapshot("user-1")).toBe(first);
  });

  it("reads a different user's draft independently", () => {
    saveIntakeDraft("user-1", { step: 1, data });
    expect(getIntakeDraftSnapshot("user-2")).toBeNull();
  });

  it("subscribes with a stable no-op unsubscribe", () => {
    expect(typeof subscribeIntakeDraft()).toBe("function");
    expect(() => subscribeIntakeDraft()()).not.toThrow();
  });
});
