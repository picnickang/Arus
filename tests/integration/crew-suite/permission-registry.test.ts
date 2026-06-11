/**
 * §L — Permission registry endpoint (live dev server).
 *
 * Regression guard: the handler previously serialized `actions` as the
 * ACTIONS object (Record<code, def>) while the response contract requires
 * an array, so the endpoint always returned HTTP 500. This pins the fixed
 * contract: 200 + resources[]/actions[]/categories, with actions as a
 * proper array carrying the canonical action codes.
 */
import { describe, it, expect } from "@jest/globals";
import { api } from "./helpers";

interface Registry {
  resources: Array<{ code: string; name?: string }>;
  actions: Array<{ code: string; name?: string }>;
  categories: unknown;
}

describe("Permission registry (§L)", () => {
  it("returns 200 with array-shaped resources and actions", async () => {
    const res = await api<Registry>("GET", "/api/permissions/registry");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.resources)).toBe(true);
    expect(Array.isArray(res.data.actions)).toBe(true);
    expect(res.data.resources.length).toBeGreaterThan(0);
    expect(res.data.actions.length).toBeGreaterThan(0);
    expect(res.data.categories).toBeDefined();
  });

  it("exposes canonical action codes (view/create/edit/delete)", async () => {
    const res = await api<Registry>("GET", "/api/permissions/registry");
    const codes = res.data.actions.map((a) => a.code);
    for (const expected of ["view", "create", "edit", "delete"]) {
      expect(codes).toContain(expected);
    }
  });

  it("each resource entry carries a code", async () => {
    const res = await api<Registry>("GET", "/api/permissions/registry");
    expect(res.data.resources.every((r) => typeof r.code === "string" && r.code.length > 0)).toBe(
      true
    );
  });
});
