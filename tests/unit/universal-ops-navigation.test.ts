import { describe, expect, it } from "@jest/globals";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { navigationCategories } from "@/config/navigationConfig";
import {
  buildUniversalOpsNavModel,
  isUniversalOpsShellRoute,
  resolveActiveOpsHubId,
} from "@/application/navigation/universal-ops-navigation";

const REPO_ROOT = resolve(process.cwd());

function ids(items: { id: string }[]): string[] {
  return items.map((item) => item.id);
}

describe("universal admin ops navigation", () => {
  it("resolves every admin hub and deep link to the correct active hub", () => {
    const cases: Array<[string, string]> = [
      ["/operations", "operations"],
      ["/attention-inbox", "operations"],
      ["/fleet", "fleet"],
      ["/fleet/vessel-1", "fleet"],
      ["/vessel-intelligence/vessel-1/overview", "fleet"],
      ["/vessel-intelligence/vessel-1/section-maps/map-1/edit", "fleet"],
      ["/maint", "maintenance"],
      ["/work-orders", "maintenance"],
      ["/crew-management", "crew"],
      ["/crew-scheduler", "crew"],
      ["/logistics?tab=inventory", "logistics"],
      ["/service-orders", "logistics"],
      ["/logs/deck", "records"],
      ["/rms-monitoring", "records"],
      ["/analytics", "analytics"],
      ["/knowledge-base", "analytics"],
      ["/system", "system"],
      ["/system-administration", "system"],
    ];

    for (const [path, hubId] of cases) {
      expect(resolveActiveOpsHubId(path)).toBe(hubId);
      expect(isUniversalOpsShellRoute(path)).toBe(true);
    }
  });

  it("does not apply the admin shell to user-portal and auth pages", () => {
    for (const path of ["/", "/my-tasks", "/feedback", "/profile", "/portal-login"]) {
      expect(resolveActiveOpsHubId(path)).toBeNull();
      expect(isUniversalOpsShellRoute(path)).toBe(false);
    }
  });

  it("builds permitted primary hubs from navigationCategories without local shell copies", () => {
    const model = buildUniversalOpsNavModel({
      currentPath: "/vessel-intelligence/vessel-1/overview",
      hubAccess: null,
    });

    expect(ids(model.primaryHubs)).toEqual(navigationCategories.map((category) => category.id));
    expect(model.activeHub?.id).toBe("fleet");
    expect(model.activeChildren[0]).toMatchObject({ name: "Fleet Triage", href: "/fleet" });
    expect(model.activeChildren.map((child) => child.href)).toEqual(
      navigationCategories
        .find((category) => category.id === "fleet")
        ?.children.map((child) => child.href)
    );
  });

  it("filters primary hubs by explicit hub access while keeping active child navigation contextual", () => {
    const model = buildUniversalOpsNavModel({
      currentPath: "/logistics?tab=inventory",
      hubAccess: ["fleet", "logistics"],
    });

    expect(ids(model.primaryHubs)).toEqual(["fleet", "logistics"]);
    expect(model.activeHub?.id).toBe("logistics");
    expect(model.activeChildren.map((child) => child.href)).toContain("/logistics?tab=inventory");
    expect(model.activeChildren.map((child) => child.href)).toContain("/service-orders");
  });

  it("does not expose contextual children for a hub outside explicit hub access", () => {
    const model = buildUniversalOpsNavModel({
      currentPath: "/maint",
      hubAccess: ["fleet", "logistics"],
    });

    expect(ids(model.primaryHubs)).toEqual(["fleet", "logistics"]);
    expect(model.activeHub).toBeUndefined();
    expect(model.activeChildren).toEqual([]);
  });

  it("wires admin routes through the shared universal shell instead of the VI-only shell", () => {
    const app = readFileSync(resolve(REPO_ROOT, "client/src/App.tsx"), "utf8");
    const shell = readFileSync(
      resolve(REPO_ROOT, "client/src/components/ops/UniversalOpsShell.tsx"),
      "utf8"
    );
    const fleet = readFileSync(resolve(REPO_ROOT, "client/src/pages/fleet-hub.tsx"), "utf8");
    const vesselIntelligence = readFileSync(
      resolve(REPO_ROOT, "client/src/pages/vessel-intelligence/index.tsx"),
      "utf8"
    );

    expect(app).toContain("UniversalOpsShell");
    expect(app).toContain("resolveCurrentRouteHubId");
    expect(app).toContain("routePatternMatchesCurrent");
    expect(app).toContain("usesUniversalOpsShell");
    expect(app).toContain("<UniversalOpsShell");
    expect(app).toContain("!usesUniversalOpsShell && <BottomNav />");

    expect(shell).toContain('testId="universal-ops-shell"');
    expect(shell).toContain('testId="universal-ops-rail"');
    expect(shell).toContain('data-testid="universal-ops-subnav"');
    expect(shell).toContain('data-testid="universal-ops-mobile-menu-trigger"');
    expect(shell).toContain('data-testid="universal-ops-mobile-drawer"');
    expect(shell).toContain("buildUniversalOpsNavModel");

    expect(fleet).not.toContain("VesselIntelligenceShell");
    expect(vesselIntelligence).not.toContain("VesselIntelligenceShell");
  });
});
