import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The display-name ↔ document-type mapping is duplicated across three files:
 *
 *   1. `NAME_MAP`          in lib/document-generation.ts        (type → name)
 *   2. `NAME_TO_TYPE`      in app/api/stripe/webhook/route.ts   (name → type)
 *   3. `DOC_NAME_TO_TYPE`  in components/documents/doc-viewer.tsx (name → type)
 *
 * Documents are matched by their *display name* string at runtime, so renaming
 * one entry without renaming the others silently breaks payment-triggered
 * generation (2) and the manual retry button (3) — with no type error and no
 * runtime exception, just a document that never regenerates.
 *
 * These maps are parsed out of source text rather than imported, because
 * lib/document-generation.ts pulls in lib/openrouter.ts, which constructs an
 * OpenAI client at module scope and throws without OPENROUTER_API_KEY.
 */

const ROOT = join(__dirname, "..");

const DOC_GENERATION = "lib/document-generation.ts";
const STRIPE_WEBHOOK = "app/api/stripe/webhook/route.ts";
const DOC_VIEWER = "components/documents/doc-viewer.tsx";

function read(relPath: string): string {
  return readFileSync(join(ROOT, relPath), "utf8");
}

/**
 * Extracts a `const <name> ... = { "a": "b", ... }` object literal of
 * string→string entries from TypeScript source. Returns null when the
 * identifier exists but is not a plain object literal (e.g. it is derived).
 */
function parseStringMap(source: string, identifier: string): Record<string, string> | null {
  const start = source.search(new RegExp(`const\\s+${identifier}\\b`));
  if (start === -1) {
    throw new Error(`Could not find a \`const ${identifier}\` declaration.`);
  }
  // Only a plain object literal is parseable; anything else (e.g. a derived
  // `Object.fromEntries(...)`) yields null so callers can branch on it.
  const literal = source.slice(start).match(/^const\s+\w+\b[^=]*=\s*\{/);
  if (!literal) return null;

  const open = source.indexOf("{", start);
  const close = source.indexOf("};", open);
  if (close === -1) return null;

  const body = source.slice(open + 1, close);
  const entries: Record<string, string> = {};
  const entryPattern = /["']?([\w\s().—-]+?)["']?\s*:\s*["']([^"']+)["']\s*,/g;
  for (const match of body.matchAll(entryPattern)) {
    entries[match[1].trim()] = match[2];
  }
  return entries;
}

/** type → display name, the single source of truth. */
const NAME_MAP = parseStringMap(read(DOC_GENERATION), "NAME_MAP");

describe("NAME_MAP (lib/document-generation.ts) is the source of truth", () => {
  it("parses to the five known document types", () => {
    expect(NAME_MAP).toEqual({
      stage1_request: "Request for Increase in Plan of Care",
      stage1_lomn: "LOMN Request Template (for your Doctor)",
      stage2_appeal: "Internal Appeal Letter",
      stage3_hearing: "Fair Hearing Request",
      stage3_memo: "Memo of Law",
    });
  });

  it("has no duplicate display names — names are the runtime lookup key", () => {
    const names = Object.values(NAME_MAP!);
    expect(new Set(names).size).toBe(names.length);
  });

  it("agrees with STAGE_MAP on which types exist", () => {
    const stageMap = parseStringMap(read(DOC_GENERATION), "STAGE_MAP");
    // STAGE_MAP values are numbers, so only the keys survive the string parse;
    // fall back to a key-only scan for that map.
    const stageKeys =
      stageMap && Object.keys(stageMap).length > 0
        ? Object.keys(stageMap)
        : (read(DOC_GENERATION)
            .split("STAGE_MAP")[1]
            .split("};")[0]
            .match(/(\w+):\s*\d/g) ?? []).map((s) => s.split(":")[0]);
    expect(stageKeys.sort()).toEqual(Object.keys(NAME_MAP!).sort());
  });
});

describe("app/api/stripe/webhook/route.ts stays in sync", () => {
  const source = read(STRIPE_WEBHOOK);

  it("derives NAME_TO_TYPE from NAME_MAP rather than hardcoding it", () => {
    // Today the webhook inverts NAME_MAP via Object.fromEntries, so it cannot
    // drift. This test locks that in: if someone replaces the derivation with
    // a literal, this fails and the literal-comparison test below takes over.
    expect(source).toMatch(/import\s*\{[^}]*\bNAME_MAP\b[^}]*\}\s*from\s*["']@\/lib\/document-generation["']/);
    expect(source).toMatch(/NAME_TO_TYPE[\s\S]{0,200}Object\.entries\(NAME_MAP\)/);
  });

  it("matches NAME_MAP entry-for-entry if it is ever hardcoded", () => {
    const literal = parseStringMap(source, "NAME_TO_TYPE");
    if (!literal || Object.keys(literal).length === 0) return; // derived — covered above
    expect(literal).toEqual(invert(NAME_MAP!));
  });
});

describe("components/documents/doc-viewer.tsx DOC_NAME_TO_TYPE stays in sync", () => {
  const literal = parseStringMap(read(DOC_VIEWER), "DOC_NAME_TO_TYPE");

  it("is a hardcoded copy (which is exactly why it can drift)", () => {
    expect(literal).not.toBeNull();
    expect(Object.keys(literal!)).toHaveLength(5);
  });

  it("is the exact inverse of NAME_MAP", () => {
    // If this fails: a display name was renamed in one place only. The retry
    // button in doc-viewer will silently stop finding a document type.
    expect(literal).toEqual(invert(NAME_MAP!));
  });

  it("covers every document type NAME_MAP knows about", () => {
    expect(Object.values(literal!).sort()).toEqual(Object.keys(NAME_MAP!).sort());
  });
});

describe("all three maps agree", () => {
  it("round-trips type → name → type for every document type", () => {
    const viewer = parseStringMap(read(DOC_VIEWER), "DOC_NAME_TO_TYPE")!;
    // null ⇒ derived from NAME_MAP, so it is correct by construction.
    const webhook =
      parseStringMap(read(STRIPE_WEBHOOK), "NAME_TO_TYPE") ?? invert(NAME_MAP!);

    for (const [type, name] of Object.entries(NAME_MAP!)) {
      expect(viewer[name], `doc-viewer is missing "${name}"`).toBe(type);
      expect(webhook[name], `stripe webhook is missing "${name}"`).toBe(type);
    }
  });
});

function invert(map: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k]));
}
