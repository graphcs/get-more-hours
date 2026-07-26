import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Every href in the admin sidebar must resolve to a real page under app/.
 * A nav item pointing at a non-existent route is a hard 404 in production and
 * nothing in the type system catches it — `href` is just a string.
 *
 * admin-nav.tsx is parsed as source rather than imported because it is a
 * "use client" component that pulls in lucide-react and the Supabase browser
 * client.
 */

const ROOT = join(__dirname, "..");
const ADMIN_NAV = join(ROOT, "components/admin/admin-nav.tsx");
const APP_DIR = join(ROOT, "app");

/** Pulls `{ href: "/admin/x", label: "X", ... }` entries out of the navItems array. */
function parseNavItems(): { href: string; label: string }[] {
  const source = readFileSync(ADMIN_NAV, "utf8");
  const start = source.indexOf("const navItems");
  expect(start, "navItems declaration not found in admin-nav.tsx").toBeGreaterThan(-1);
  const body = source.slice(start, source.indexOf("];", start));

  const items: { href: string; label: string }[] = [];
  const pattern = /href:\s*["']([^"']+)["']\s*,\s*label:\s*["']([^"']+)["']/g;
  for (const m of body.matchAll(pattern)) {
    items.push({ href: m[1], label: m[2] });
  }
  return items;
}

/** Walks app/ and returns every route path served by a page.tsx. */
function collectRoutes(): string[] {
  const pages: string[] = [];

  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (/^page\.(tsx|ts|jsx|js|mdx)$/.test(entry)) {
        pages.push(full);
      }
    }
  }
  walk(APP_DIR);

  return pages.map((file) => {
    const segments = relative(APP_DIR, file).split(sep).slice(0, -1);
    const routeSegments = segments.filter(
      // Route groups `(marketing)` and private folders `_lib` are not URL segments.
      (s) => !(s.startsWith("(") && s.endsWith(")")) && !s.startsWith("_")
    );
    return "/" + routeSegments.join("/");
  });
}

/** Matches a concrete href against a route pattern, honouring [param] segments. */
function routeMatches(pattern: string, href: string): boolean {
  const p = pattern.split("/").filter(Boolean);
  const h = href.split("/").filter(Boolean);
  if (p.length !== h.length) return false;
  return p.every((seg, i) => (seg.startsWith("[") && seg.endsWith("]")) || seg === h[i]);
}

const navItems = parseNavItems();
const routes = collectRoutes();

/**
 * Hrefs that are knowingly unbacked by a page file. Empty, and it should stay
 * that way: a nav item pointing at a missing route is a production 404, which
 * is exactly what happened with `/admin/settings`.
 */
const KNOWN_MISSING = new Set<string>();

describe("admin sidebar nav", () => {
  it("parses all five nav items from admin-nav.tsx", () => {
    expect(navItems.length).toBeGreaterThanOrEqual(5);
    expect(navItems.map((i) => i.href)).toContain("/admin");
    expect(navItems.map((i) => i.href)).toContain("/admin/settings");
  });

  it("discovers the app router's page files", () => {
    expect(routes).toContain("/");
    expect(routes).toContain("/admin");
    expect(routes).toContain("/login");
  });

  it("uses only absolute, internal hrefs", () => {
    for (const item of navItems) {
      expect(item.href.startsWith("/"), `${item.label}: ${item.href}`).toBe(true);
    }
  });

  it("has no duplicate hrefs", () => {
    const hrefs = navItems.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  const present = navItems.filter((i) => !KNOWN_MISSING.has(i.href));

  it.each(present.map((i) => [i.label, i.href] as const))(
    "%s (%s) resolves to a page under app/",
    (_label, href) => {
      expect(
        routes.some((r) => routeMatches(r, href)),
        `No page file under app/ serves ${href}`
      ).toBe(true);
    }
  );
});

// ── Regression tests for the reported production 404s ────────────────────────
// "Settings" was listed in the admin sidebar with no page file behind it, so
// clicking it returned a 404. `/admin/clients` had the same problem, reachable
// from the dashboard's client rows. Both now have pages; these assertions keep
// them from regressing.
describe("previously-404ing admin routes", () => {
  it.each([["/admin/settings"], ["/admin/clients"]])(
    "%s resolves to a page under app/",
    (href) => {
      expect(
        routes.some((r) => routeMatches(r, href)),
        `No page file under app/ serves ${href} — this was the production 404.`
      ).toBe(true);
    }
  );
});

// Guard against KNOWN_MISSING quietly refilling: anything added to it must be a
// deliberate, temporary decision, and this states the intent is for it to be empty.
describe("KNOWN_MISSING bookkeeping", () => {
  it("is empty — every nav href should resolve", () => {
    expect([...KNOWN_MISSING]).toEqual([]);
  });
});
