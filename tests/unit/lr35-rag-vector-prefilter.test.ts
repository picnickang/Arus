/**
 * LR-3.5 / V2 (ML-2) — RAG vector-search org-id pre-filter contract.
 *
 * Behavioural test: stub `db.execute` so it actually interprets the
 * org-filter parameter that `semanticLookup` interpolates, then prove
 * that when org B's query runs, only org B's row is returned even
 * though org A's seeded row has a CLOSER embedding distance. This
 * isolates the pre-filter-before-top-K contract: a regression to a
 * JS-side post-filter would return org A's row (it is "closer") and
 * fail the test.
 *
 * To bypass the exact-match select chain (which uses drizzle Column
 * objects that are awkward to fake), we invoke `semanticLookup`
 * directly via the prototype.
 *
 * The structural-shape pin (`WHERE org_id = ${orgId}` co-located with
 * `<=>` and `LIMIT 1` in the same sql`...` template) and the marker
 * comment are also asserted so a regression is caught two independent
 * ways.
 */

import { describe, it, expect, jest, beforeAll } from "@jest/globals";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SEMANTIC_CACHE_PATH = join(
  process.cwd(),
  "server",
  "services",
  "rag",
  "semantic-cache.ts"
);
function readSource(): string {
  return readFileSync(SEMANTIC_CACHE_PATH, "utf8");
}

const ORG_A = "org-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ORG_B = "org-bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

interface SeedRow {
  id: string;
  org_id: string;
  query_hash: string;
  query_text: string;
  response: string;
  source_chunk_ids: string[];
  citations: unknown;
  model_used: string;
  hit_count: number;
  created_at: Date;
  expires_at: Date;
  distance: number;
}

const SEED_ROWS: SeedRow[] = [
  {
    id: "row-a",
    org_id: ORG_A,
    query_hash: "hash-a",
    query_text: "How do I service the bearing on org A vessel?",
    response: "ORG-A SECRET ANSWER",
    source_chunk_ids: ["a1", "a2"],
    citations: [],
    model_used: "gpt-4o",
    hit_count: 7,
    created_at: new Date("2026-01-01T00:00:00Z"),
    expires_at: new Date("2099-01-01T00:00:00Z"),
    distance: 0.01,
  },
  {
    id: "row-b",
    org_id: ORG_B,
    query_hash: "hash-b",
    query_text: "How do I service the bearing on org B vessel?",
    response: "ORG-B SAFE ANSWER",
    source_chunk_ids: ["b1"],
    citations: [],
    model_used: "gpt-4o",
    hit_count: 3,
    created_at: new Date("2026-01-01T00:00:00Z"),
    expires_at: new Date("2099-01-01T00:00:00Z"),
    distance: 0.04,
  },
];

function extractOrgIdFromSql(sqlObj: unknown): string | null {
  const obj = sqlObj as { queryChunks?: unknown[] } | null;
  if (!obj || !Array.isArray(obj.queryChunks)) {return null;}
  for (const chunk of obj.queryChunks) {
    // Param values may appear directly as strings/numbers, or wrapped
    // in a `{ value: ... }` object depending on drizzle's chunk class.
    if (typeof chunk === "string" && (chunk === ORG_A || chunk === ORG_B)) {
      return chunk;
    }
    if (chunk && typeof chunk === "object" && "value" in chunk) {
      const v = (chunk as { value?: unknown }).value;
      if (typeof v === "string" && (v === ORG_A || v === ORG_B)) {return v;}
    }
  }
  return null;
}

const executeCalls: Array<{ orgIdParam: string | null }> = [];

jest.unstable_mockModule("../../server/db", () => ({
  __esModule: true,
  db: {
    update: () => ({
      set: () => ({ where: async () => undefined }),
    }),
    execute: async (sqlObj: unknown) => {
      const orgIdParam = extractOrgIdFromSql(sqlObj);
      executeCalls.push({ orgIdParam });
      if (!orgIdParam) {return { rows: [] };}
      const rows = SEED_ROWS
        .filter((r) => r.org_id === orgIdParam)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 1);
      return { rows };
    },
  },
}));

jest.unstable_mockModule("../../server/embedding-service", () => ({
  __esModule: true,
  generateEmbedding: async (_q: string) => Array(1536).fill(0),
}));

jest.unstable_mockModule("../../server/utils/logger", () => ({
  __esModule: true,
  logger: {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  },
}));

interface SemanticCacheLike {
  semanticLookup: (orgId: string, query: string) => Promise<{
    response: string;
    queryText: string;
  } | null>;
}
let SemanticCacheCtor: new (cfg?: unknown) => SemanticCacheLike;

beforeAll(async () => {
  const mod = await import("../../server/services/rag/semantic-cache");
  SemanticCacheCtor = mod.SemanticCache as unknown as typeof SemanticCacheCtor;
});

function invokeSemanticLookup(
  instance: object,
  orgId: string,
  query: string,
): Promise<{ response: string; queryText: string } | null> {
  const fn = (instance as Record<string, unknown>)["semanticLookup"] as
    | ((this: object, o: string, q: string) => Promise<{ response: string; queryText: string } | null>)
    | undefined;
  if (typeof fn !== "function") {throw new Error("semanticLookup not found on instance");}
  return fn.call(instance, orgId, query);
}

describe("LR-3.5 V2 — RAG vector pre-filter contract (behavioural)", () => {
  it("org B query returns ONLY org B's row even though org A has a closer embedding", async () => {
    const cache = new SemanticCacheCtor();
    const hit = await invokeSemanticLookup(cache, ORG_B, "service the bearing");
    expect(hit).not.toBeNull();
    expect(hit!.response).toBe("ORG-B SAFE ANSWER");
    expect(hit!.response).not.toContain("ORG-A");
    expect(hit!.queryText).toContain("org B");
  });

  it("org A query returns ONLY org A's row (symmetric)", async () => {
    const cache = new SemanticCacheCtor();
    const hit = await invokeSemanticLookup(cache, ORG_A, "service the bearing");
    expect(hit).not.toBeNull();
    expect(hit!.response).toBe("ORG-A SECRET ANSWER");
  });

  it("the org-id parameter was actually interpolated into the executed SQL (pre-filter)", () => {
    const orgIds = executeCalls.map((c) => c.orgIdParam).filter((v) => v !== null);
    expect(orgIds).toContain(ORG_A);
    expect(orgIds).toContain(ORG_B);
    expect(executeCalls.every((c) => c.orgIdParam !== null)).toBe(true);
  });

  it("source: WHERE org_id, <=> scan, and LIMIT 1 live in the same sql`...` template", () => {
    const src = readSource();
    const body = src.slice(src.indexOf("private async semanticLookup"));
    const sqlBlock = body.match(/sql`([\s\S]*?)`/)?.[1] ?? "";
    expect(sqlBlock).toMatch(/WHERE\s+org_id\s*=\s*\$\{orgId\}/);
    expect(sqlBlock).toMatch(/<=>/);
    expect(sqlBlock).toMatch(/LIMIT\s+1/);
  });

  it("source: no JS-side .filter(... orgId ...) post-pass", () => {
    const src = readSource();
    const body = src.slice(
      src.indexOf("private async semanticLookup"),
      src.indexOf("async set(")
    );
    expect(body).not.toMatch(/\.filter\(\s*\(?[\w$]+\)?\s*=>[^}]*org_?[Ii]d/);
  });

  it("source carries the LR-3.5 / V2 marker comment", () => {
    expect(readSource()).toMatch(/LR-3\.5\s*\/\s*V2/);
  });
});
