import { jest } from "@jest/globals";

type RedisMock = {
  get: jest.Mock;
  setex: jest.Mock;
  del: jest.Mock;
  keys: jest.Mock;
  ping: jest.Mock;
};

let redisEnabled = true;
const redisMock: RedisMock = {
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  ping: jest.fn(),
};

jest.unstable_mockModule("../../server/lib/redis-client.js", () => ({
  getSharedRedisClient: jest.fn(async () => redisMock),
  isRedisEnabled: jest.fn(() => redisEnabled),
}));

const cacheModule = await import("../../server/lib/cache");

const {
  CacheClient,
  analyticsCacheKeys,
  cachedAnalytics,
  invalidateAnalyticsCache,
  __resetCacheErrorWindowsForTests,
} = cacheModule;

describe("CacheClient", () => {
  beforeEach(() => {
    redisEnabled = true;
    __resetCacheErrorWindowsForTests();
    redisMock.get.mockReset();
    redisMock.setex.mockReset();
    redisMock.del.mockReset();
    redisMock.keys.mockReset();
    redisMock.ping.mockReset();
  });

  it("gracefully bypasses Redis when the client is disabled", async () => {
    const cache = new CacheClient({ ttl: 60, keyPrefix: "inventory" }, false);

    await expect(cache.get("parts:list")).resolves.toBeNull();
    await expect(cache.set("parts:list", [{ id: "part-a" }])).resolves.toBeUndefined();
    await expect(cache.del("parts:list")).resolves.toBeUndefined();
    await expect(cache.invalidatePattern("parts:*")).resolves.toBeUndefined();
    await expect(cache.healthCheck()).resolves.toBe(false);

    expect(redisMock.get).not.toHaveBeenCalled();
    expect(redisMock.setex).not.toHaveBeenCalled();
    expect(redisMock.del).not.toHaveBeenCalled();
    expect(redisMock.keys).not.toHaveBeenCalled();
    expect(cache.isHealthy()).toBe(false);
  });

  it("prefixes keys, parses hits, records misses, and swallows corrupt cache values", async () => {
    const cache = new CacheClient({ ttl: 60, keyPrefix: "inventory" });

    redisMock.get.mockResolvedValueOnce(JSON.stringify({ id: "part-a" }));
    await expect(cache.get("parts:part-a")).resolves.toEqual({ id: "part-a" });
    expect(redisMock.get).toHaveBeenLastCalledWith("inventory:parts:part-a");

    redisMock.get.mockResolvedValueOnce(null);
    await expect(cache.get("parts:missing")).resolves.toBeNull();

    redisMock.get.mockResolvedValueOnce("{not-json");
    await expect(cache.get("parts:corrupt")).resolves.toBeNull();
  });

  it("writes, deletes, invalidates patterns, and reports health through the shared client", async () => {
    const cache = new CacheClient({ ttl: 900, keyPrefix: "analytics" });

    await cache.set("equipment-health:all", { healthy: true });
    await cache.set("equipment-health:one", { healthy: false }, 30);
    await cache.del(["equipment-health:all", "equipment-health:one"]);
    await cache.del([]);

    redisMock.keys.mockResolvedValueOnce([
      "analytics:org-a:anomalies:eq-1:critical",
      "analytics:org-a:anomalies:eq-1:warning",
    ]);
    await cache.invalidatePattern("org-a:anomalies:eq-1*");

    redisMock.keys.mockResolvedValueOnce([]);
    await cache.invalidatePattern("org-a:anomalies:eq-2*");

    redisMock.ping.mockResolvedValueOnce("PONG");
    await expect(cache.healthCheck()).resolves.toBe(true);
    redisMock.ping.mockRejectedValueOnce(new Error("redis down"));
    await expect(cache.healthCheck()).resolves.toBe(false);

    expect(redisMock.setex).toHaveBeenNthCalledWith(
      1,
      "analytics:equipment-health:all",
      900,
      JSON.stringify({ healthy: true })
    );
    expect(redisMock.setex).toHaveBeenNthCalledWith(
      2,
      "analytics:equipment-health:one",
      30,
      JSON.stringify({ healthy: false })
    );
    expect(redisMock.del).toHaveBeenCalledWith(
      "analytics:equipment-health:all",
      "analytics:equipment-health:one"
    );
    expect(redisMock.del).toHaveBeenCalledWith(
      "analytics:org-a:anomalies:eq-1:critical",
      "analytics:org-a:anomalies:eq-1:warning"
    );
    expect(cache.isHealthy()).toBe(true);
  });
});

describe("analytics cache helpers", () => {
  beforeEach(() => {
    redisEnabled = true;
    __resetCacheErrorWindowsForTests();
    redisMock.get.mockReset();
    redisMock.setex.mockReset();
    redisMock.del.mockReset();
    redisMock.keys.mockReset();
    redisMock.ping.mockReset();
  });

  it("builds org-scoped analytics keys for optional dimensions", () => {
    expect(analyticsCacheKeys.equipmentHealth("org-a")).toBe("org-a:equipment-health:all");
    expect(analyticsCacheKeys.equipmentHealth("org-a", "eq-1")).toBe("org-a:equipment-health:eq-1");
    expect(analyticsCacheKeys.anomalies("org-a")).toBe("org-a:anomalies:all");
    expect(analyticsCacheKeys.anomalies("org-a", "eq-1")).toBe("org-a:anomalies:eq-1");
    expect(analyticsCacheKeys.anomalies("org-a", "eq-1", "critical")).toBe(
      "org-a:anomalies:eq-1:critical"
    );
    expect(analyticsCacheKeys.failurePredictions("org-a", "eq-1", "high")).toBe(
      "org-a:failure-predictions:eq-1:high"
    );
    expect(analyticsCacheKeys.llmCosts("org-a", "2026-06")).toBe("org-a:llm-costs:2026-06");
  });

  it("returns cached analytics hits without calling the fetch function", async () => {
    redisMock.get.mockResolvedValueOnce(JSON.stringify({ score: 91 }));
    const fetchFn = jest.fn(async () => ({ score: 12 }));

    await expect(cachedAnalytics("org-a:equipment-health:all", fetchFn, 120)).resolves.toEqual({
      score: 91,
    });

    expect(fetchFn).not.toHaveBeenCalled();
    expect(redisMock.get).toHaveBeenCalledWith("analytics:org-a:equipment-health:all");
    expect(redisMock.setex).not.toHaveBeenCalled();
  });

  it("fills analytics cache on miss and falls back to fresh data on cache errors", async () => {
    redisMock.get.mockResolvedValueOnce(null);
    const fetchMiss = jest.fn(async () => ({ score: 55 }));

    await expect(cachedAnalytics("org-a:equipment-health:all", fetchMiss, 120)).resolves.toEqual({
      score: 55,
    });

    expect(fetchMiss).toHaveBeenCalledTimes(1);
    expect(redisMock.setex).toHaveBeenCalledWith(
      "analytics:org-a:equipment-health:all",
      120,
      JSON.stringify({ score: 55 })
    );

    redisMock.get.mockRejectedValueOnce(new Error("redis read failed"));
    const fetchFallback = jest.fn(async () => ({ score: 72 }));
    await expect(cachedAnalytics("org-a:equipment-health:all", fetchFallback)).resolves.toEqual({
      score: 72,
    });
    expect(fetchFallback).toHaveBeenCalledTimes(1);
  });

  it("invalidates only tenant-scoped analytics cache patterns", async () => {
    redisMock.keys.mockResolvedValue([]);

    await invalidateAnalyticsCache.equipmentHealth("org-a", "eq-1");
    await invalidateAnalyticsCache.rulPredictions("org-a", "eq-1");
    await invalidateAnalyticsCache.anomalies("org-a", "eq-1");
    await invalidateAnalyticsCache.anomalies("org-a");
    await invalidateAnalyticsCache.failurePredictions("org-a", "eq-1");
    await invalidateAnalyticsCache.failurePredictions("org-a");
    await invalidateAnalyticsCache.mlModels("org-a");
    await invalidateAnalyticsCache.allForOrg("org-a");

    expect(redisMock.del).toHaveBeenCalledWith("analytics:org-a:equipment-health:eq-1");
    expect(redisMock.del).toHaveBeenCalledWith("analytics:org-a:equipment-health:all");
    expect(redisMock.del).toHaveBeenCalledWith("analytics:org-a:rul:eq-1");
    expect(redisMock.del).toHaveBeenCalledWith("analytics:org-a:rul:all");
    expect(redisMock.keys).toHaveBeenCalledWith("analytics:org-a:anomalies:eq-1*");
    expect(redisMock.keys).toHaveBeenCalledWith("analytics:org-a:anomalies*");
    expect(redisMock.keys).toHaveBeenCalledWith("analytics:org-a:failure-predictions:eq-1*");
    expect(redisMock.keys).toHaveBeenCalledWith("analytics:org-a:failure-predictions*");
    expect(redisMock.keys).toHaveBeenCalledWith("analytics:org-a:ml-models*");
    expect(redisMock.keys).toHaveBeenCalledWith("analytics:org-a:*");
  });
});
