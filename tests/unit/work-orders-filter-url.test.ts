import {
  DEFAULT_WORK_ORDER_FILTERS,
  parseFiltersFromSearch,
  serializeFiltersToParams,
  buildWorkOrdersUrl,
} from "../../client/src/features/work-orders/lib/filters-url";

describe("work-order filter URL round-trip", () => {
  it("parses an empty search string to the defaults", () => {
    expect(parseFiltersFromSearch("")).toEqual(DEFAULT_WORK_ORDER_FILTERS);
    expect(parseFiltersFromSearch("?")).toEqual(DEFAULT_WORK_ORDER_FILTERS);
  });

  it("omits default values when serializing", () => {
    const params = serializeFiltersToParams({ ...DEFAULT_WORK_ORDER_FILTERS });
    expect(params.toString()).toBe("");
    expect(buildWorkOrdersUrl({ ...DEFAULT_WORK_ORDER_FILTERS })).toBe("/work-orders");
  });

  it("round-trips non-default filters", () => {
    const filters = {
      ...DEFAULT_WORK_ORDER_FILTERS,
      search: "cooling pump",
      status: "open",
      priority: "1",
      vesselId: "vessel-1",
    };
    const url = buildWorkOrdersUrl(filters);
    expect(url.startsWith("/work-orders?")).toBe(true);
    expect(parseFiltersFromSearch(url.split("?")[1] ?? "")).toEqual(filters);
  });

  it("ignores unknown params and treats empty values as defaults", () => {
    const parsed = parseFiltersFromSearch("?action=create&equipmentId=eq-1&status=&vesselId=v-9");
    expect(parsed.status).toBe("all");
    expect(parsed.vesselId).toBe("v-9");
    expect(parsed.search).toBe("");
  });

  it("never emits banned hub-tab URL prefixes", () => {
    const url = buildWorkOrdersUrl({ ...DEFAULT_WORK_ORDER_FILTERS, status: "open" });
    expect(url.includes("/maint?")).toBe(false);
    expect(url.startsWith("/work-orders")).toBe(true);
  });
});
