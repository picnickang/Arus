/**
 * Push B1 — Cross-tenant feature flag isolation.
 *
 * Asserts that the per-(tenant, user) override resolver in
 * `server/infrastructure/feature-flags.ts` does not leak a flag enabled
 * for tenant A into tenant B's resolution. This is the canary test for
 * the Push B1 isolation contract: if it ever passes for the wrong
 * tenant, RLS is the only thing left protecting the data.
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
import { FeatureFlagManager } from "../../server/infrastructure/feature-flags";

type FeatureFlagManagerInternals = FeatureFlagManager & {
  overrideCache: Map<string, unknown[]>;
  isEnabledFor: (key: string, ctx: { tenantId?: string; userId?: string }) => boolean;
};

describe("Feature flag tenant isolation (Push B1)", () => {
  let manager: FeatureFlagManagerInternals;

  beforeEach(() => {
    // The exported singleton is shared across the test suite; we
    // construct a fresh instance for predictable cache state.
    manager = new FeatureFlagManager() as FeatureFlagManagerInternals;
  });

  it("does not leak a tenant-A override into tenant B", () => {
    // Seed the override cache directly (bypassing the DB so the test
    // stays hermetic). The cache shape is: Map<flag_key, rows[]> where
    // rows are sorted most-specific first.
    manager.overrideCache.set("useTenantScopedWorkOrders", [
      {
        flag_key: "useTenantScopedWorkOrders",
        tenant_id: "tenant-a",
        user_id: null,
        enabled: true,
      },
    ]);

    const aResult = manager.isEnabledFor("useTenantScopedWorkOrders", {
      tenantId: "tenant-a",
    });
    const bResult = manager.isEnabledFor("useTenantScopedWorkOrders", {
      tenantId: "tenant-b",
    });

    expect(aResult).toBe(true);
    expect(bResult).toBe(false);
  });

  it("user override does not bleed across tenants", () => {
    manager.overrideCache.set("newSchedulerEnabled", [
      {
        flag_key: "newSchedulerEnabled",
        tenant_id: "tenant-a",
        user_id: "user-1",
        enabled: true,
      },
    ]);

    expect(
      manager.isEnabledFor("newSchedulerEnabled", {
        tenantId: "tenant-b",
        userId: "user-1",
      })
    ).toBe(false);
  });
});
