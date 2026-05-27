/**
 * LR-3.5 / V2 (ML-2) — RAG vector-search org-id pre-filter contract.
 *
 * The only real pgvector nearest-neighbour query in the codebase lives
 * in `server/services/rag/semantic-cache.ts::semanticLookup`. Its
 * org-isolation contract is structural: `WHERE org_id = $orgId` must
 * sit INSIDE the same SELECT that performs the `<=>` distance scan and
 * the `ORDER BY ... LIMIT 1`. If a future edit moves the org filter
 * into an outer query (or drops it entirely), Postgres will compute
 * the top-K across the GLOBAL set of embeddings and a cross-tenant
 * leak becomes possible — the failure is silent (it returns 0 or 1
 * row, same shape as the correct behaviour).
 *
 * This file pins the SQL shape so the contract is unmissable in code
 * review. We read the source as text and assert:
 *   (a) the `org_id = ${orgId}` clause exists in the body,
 *   (b) it appears in the WHERE clause that is co-located with the
 *       `<=>` distance scan and the `LIMIT` (i.e. the same SQL
 *       statement, NOT a post-filter on a JS array),
 *   (c) no `.filter(... orgId ...)` post-pass exists in the function
 *       body (which would indicate a regression to a post-filter).
 *
 * The companion text marker `LR-3.5 / V2` in the source comment block
 * is also asserted so a removal of the explanatory comment shows up as
 * a test failure and forces a code-review conversation.
 */

import { describe, it, expect } from "@jest/globals";
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

function extractFunction(src: string, signature: string): string {
  const start = src.indexOf(signature);
  if (start === -1) throw new Error(`signature not found: ${signature}`);
  // Crude but stable: from the signature to the matching closing
  // brace at the same indentation as the function opener.
  let depth = 0;
  let i = src.indexOf("{", start);
  if (i === -1) throw new Error("opening brace not found");
  const bodyStart = i;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return src.slice(bodyStart, i + 1);
    }
  }
  throw new Error("function body not closed");
}

describe("LR-3.5 V2 — RAG vector pre-filter contract", () => {
  it("semanticLookup applies WHERE org_id = ${orgId} co-located with the <=> scan and LIMIT", () => {
    const src = readSource();
    const body = extractFunction(src, "private async semanticLookup");

    // The org filter must appear in the SQL body — interpolated, not a
    // string literal — and the same SQL block must carry the <=>
    // distance operator AND a LIMIT. This is the structural promise.
    expect(body).toMatch(/WHERE\s+org_id\s*=\s*\$\{orgId\}/);
    expect(body).toMatch(/<=>\s*\$\{embeddingStr\}::vector/);
    expect(body).toMatch(/LIMIT\s+1/);

    // Concretely: there must be a single sql\`...\` template whose body
    // contains all three. (If someone splits the org filter into a
    // separate SQL call and post-filters in JS, this fails.)
    const sqlBlockMatch = body.match(/sql`([\s\S]*?)`/);
    expect(sqlBlockMatch).not.toBeNull();
    const sqlBlock = sqlBlockMatch![1]!;
    expect(sqlBlock).toMatch(/WHERE\s+org_id\s*=\s*\$\{orgId\}/);
    expect(sqlBlock).toMatch(/<=>/);
    expect(sqlBlock).toMatch(/LIMIT\s+1/);
  });

  it("semanticLookup has no JS-side .filter(... orgId ...) post-pass on the rows", () => {
    const body = extractFunction(readSource(), "private async semanticLookup");
    // A regression to a post-filter would look like
    // `results.rows.filter(r => r.org_id === orgId)`. Forbid it.
    expect(body).not.toMatch(/\.filter\(\s*\(?[\w$]+\)?\s*=>[^}]*org_?[Ii]d/);
  });

  it("source carries the LR-3.5 / V2 marker comment so a stripped explanation is loud", () => {
    expect(readSource()).toMatch(/LR-3\.5\s*\/\s*V2/);
  });

  it("vector-search-service stubs return [] (cannot leak by construction)", async () => {
    const mod = await import("../../server/vector-search-service");
    await expect(mod.searchKnowledgeBase("anything")).resolves.toEqual([]);
    await expect(mod.searchSimilarChunks({})).resolves.toEqual([]);
  });
});
