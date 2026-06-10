import { matchesQuery } from "../../client/src/components/search/useGlobalSearchResults";
import { getPageItems, getVerbActions } from "../../client/src/components/search/search-actions";

describe("global search matching", () => {
  it("matches case-insensitively across multiple fields", () => {
    expect(matchesQuery("north", "M/V Northern Star")).toBe(true);
    expect(matchesQuery("NORTH", null, undefined, "northern star")).toBe(true);
    expect(matchesQuery("zzz", "M/V Northern Star")).toBe(false);
  });
});

describe("page items respect the hub allow-list", () => {
  it("returns work-orders for an unrestricted account (hubAccess null)", () => {
    const items = getPageItems("work orders", null);
    expect(items.some((i) => i.href === "/work-orders")).toBe(true);
  });

  it("returns nothing for an account with an empty hub allow-list", () => {
    expect(getPageItems("work orders", [])).toHaveLength(0);
  });

  it("excludes pages from non-granted hubs", () => {
    const items = getPageItems("work orders", ["system"]);
    expect(items.some((i) => i.href === "/work-orders")).toBe(false);
  });

  it("caps results at 5", () => {
    expect(getPageItems("e", null).length).toBeLessThanOrEqual(5);
  });
});

describe("verb actions", () => {
  it("surfaces create-work-order for matching queries, pointing at the prefilled flow", () => {
    const actions = getVerbActions("create work");
    expect(actions).toHaveLength(1);
    expect(actions[0]?.href).toBe("/work-orders?action=create");
  });

  it("returns nothing for unrelated queries", () => {
    expect(getVerbActions("hours of rest")).toHaveLength(0);
  });
});
