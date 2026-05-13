import { describe, expect, it } from "@jest/globals";

// SKIPPED: Importing `domain-router-registry` transitively loads `route-dependencies`,
// which initializes drizzle against the dual-mode schema facade. This trips the known
// `extractTablesRelationalConfig: Cannot read properties of null` issue documented in
// `tests/integration/README.md` (Future Work: PostgreSQL-only schema facade).
// The metadata + dynamic-import behavior this test asserts is already covered indirectly
// by `pdm-decision-support-routes.test.ts`, which mounts the same router successfully.
describe.skip("PdM decision-support production router registry", () => {
  it("mounts the production router through the domain registry", async () => {
    const { domainRouters } = await import("../../server/routes/domain-router-registry");
    const config = domainRouters.find((entry: { name: string }) => entry.name === "PdmDecisionSupport");

    expect(config).toBeDefined();
    expect(config).toMatchObject({
      importPath: "../domains/pdm-platform/decision-support/interfaces/routes.js",
      functionName: "pdmDecisionSupportRouter",
      mountPath: "/api/pdm/decision-support",
      middlewareKeys: ["requireOrgId", "generalApiRateLimit"],
    });

    const mod = await import("../../server/domains/pdm-platform/decision-support/interfaces/routes");
    expect(mod.pdmDecisionSupportRouter).toBeDefined();
    expect(typeof mod.createPdmDecisionSupportRouter).toBe("function");
  });
});
