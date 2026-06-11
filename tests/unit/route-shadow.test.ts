/**
 * Route-shadow guard (gap-closure plan G5; audit §2.1).
 *
 * App.tsx mounts `legacyRedirects` BEFORE the route groups inside one wouter
 * <Switch>, so any path registered in both is a permanently-shadowed dead
 * route — the redirect always wins. Wave 1 deleted nine such registrations;
 * this test pins the class shut:
 *
 *   1. No redirect `from` may also be a registered route path.
 *   2. Every redirect target's base path must resolve to a registered route
 *      (or an app-level page), so retired aliases never 404.
 *   3. No redirect target may itself be a redirect source (no chains).
 */

import { describe, it, expect } from "@jest/globals";

// App-level paths registered directly in App.tsx's <Switch>, outside the
// route groups (see App.tsx Router()).
const APP_LEVEL_PATHS = new Set(["/", "/portal-login", "/feedback", "/my-tasks", "/profile"]);

function basePath(p: string): string {
  return (p.split("?")[0] ?? p).split("#")[0] ?? p;
}

async function loadRegisteredPaths(): Promise<Set<string>> {
  const groups = await Promise.all([
    import("../../client/src/routes/operations"),
    import("../../client/src/routes/fleet"),
    import("../../client/src/routes/maintenance"),
    import("../../client/src/routes/crew"),
    import("../../client/src/routes/logistics"),
    import("../../client/src/routes/records"),
    import("../../client/src/routes/analytics"),
    import("../../client/src/routes/system"),
  ]);
  const paths = new Set<string>(APP_LEVEL_PATHS);
  for (const mod of groups) {
    const routes = Object.values(mod).find(Array.isArray) as Array<{ path: string }> | undefined;
    expect(routes).toBeDefined();
    for (const { path } of routes!) {
      paths.add(path);
    }
  }
  return paths;
}

describe("route-shadow guard", () => {
  it("no legacy redirect shadows a live route registration", async () => {
    const { legacyRedirects } = await import("../../client/src/routes/legacy-redirects");
    const registered = await loadRegisteredPaths();

    const shadowed = legacyRedirects
      .map((r: { from: string }) => r.from)
      .filter((from: string) => registered.has(from));

    expect(shadowed).toEqual([]);
  });

  it("every redirect target resolves to a registered route (no 404s)", async () => {
    const { legacyRedirects } = await import("../../client/src/routes/legacy-redirects");
    const registered = await loadRegisteredPaths();

    const dead = legacyRedirects
      .map((r: { from: string; to: string }) => r)
      .filter(({ to }: { to: string }) => !registered.has(basePath(to)))
      .map(({ from, to }: { from: string; to: string }) => `${from} -> ${to}`);

    expect(dead).toEqual([]);
  });

  it("no redirect chains (a target is never itself a redirect source)", async () => {
    const { legacyRedirects } = await import("../../client/src/routes/legacy-redirects");
    const froms = new Set(legacyRedirects.map((r: { from: string }) => r.from));

    const chains = legacyRedirects
      .filter(({ to }: { to: string }) => froms.has(basePath(to)))
      .map(({ from, to }: { from: string; to: string }) => `${from} -> ${to}`);

    expect(chains).toEqual([]);
  });
});
