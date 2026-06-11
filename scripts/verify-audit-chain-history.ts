/**
 * Verify historical audit chains (Task #211 / LR-3.5 / AUD-2)
 *
 * One-shot read-only sweep that loads every `immutable_audit_trail`
 * row from the configured database, groups them by `org_id`, and
 * runs `verifyAuditChain()` against each tenant's chain. The
 * verifier dispatches on the per-row `hash_version` column so v1
 * (pre-orgId binding) rows must still validate alongside v2 rows
 * written after the LR-3.5 cut-over.
 *
 * Usage:
 *   tsx scripts/verify-audit-chain-history.ts
 *   tsx scripts/verify-audit-chain-history.ts --json
 *
 * Exits 0 when every per-org chain is valid, 1 when any chain fails
 * verification, 2 on infrastructure errors (DB unreachable, etc).
 *
 * Safe to run against production: read-only, no writes.
 */

import { sql } from "drizzle-orm";
import { db, pool } from "../server/db";
import { verifyAuditChain } from "../server/compliance/immutable-audit/verify";
import type { ChainVerificationResult } from "../server/compliance/immutable-audit/types";

type OrgReport = {
  orgId: string;
  rowCount: number;
  v1Count: number;
  v2Count: number;
  result: ChainVerificationResult;
};

async function main(): Promise<void> {
  const jsonOut = process.argv.includes("--json");

  // Distinct orgs + per-version row counts in a single round-trip.
  const stats = await db.execute<{
    org_id: string;
    row_count: string;
    v1_count: string;
    v2_count: string;
  }>(sql`
    SELECT
      org_id,
      COUNT(*)::text AS row_count,
      COUNT(*) FILTER (WHERE hash_version = 1)::text AS v1_count,
      COUNT(*) FILTER (WHERE hash_version = 2)::text AS v2_count
    FROM immutable_audit_trail
    GROUP BY org_id
    ORDER BY org_id
  `);

  const rows =
    (stats as unknown as { rows?: Array<Record<string, string>> }).rows ??
    (stats as unknown as Array<Record<string, string>>);

  const reports: OrgReport[] = [];
  for (const row of rows) {
    const orgId = row.org_id;
    if (!orgId) {
      continue;
    }
    const result = await verifyAuditChain(orgId);
    reports.push({
      orgId,
      rowCount: Number(row.row_count ?? 0),
      v1Count: Number(row.v1_count ?? 0),
      v2Count: Number(row.v2_count ?? 0),
      result,
    });
  }

  const failed = reports.filter((r) => !r.result.valid);
  const totalRows = reports.reduce((acc, r) => acc + r.rowCount, 0);
  const totalV1 = reports.reduce((acc, r) => acc + r.v1Count, 0);
  const totalV2 = reports.reduce((acc, r) => acc + r.v2Count, 0);

  if (jsonOut) {
    console.log(
      JSON.stringify(
        {
          ok: failed.length === 0,
          orgsScanned: reports.length,
          totalRows,
          totalV1,
          totalV2,
          failed: failed.map((r) => ({
            orgId: r.orgId,
            rowCount: r.rowCount,
            v1Count: r.v1Count,
            v2Count: r.v2Count,
            brokenAt: r.result.brokenAt,
            brokenRecordId: r.result.brokenRecordId,
            error: r.result.error,
          })),
        },
        null,
        2
      )
    );
  } else {
    console.log(
      `Scanned ${reports.length} org chain(s), ${totalRows} row(s) total (v1=${totalV1}, v2=${totalV2}).`
    );
    for (const r of reports) {
      const tag = r.result.valid ? "OK" : "FAIL";
      const detail = r.result.valid
        ? `${r.result.recordsVerified}/${r.rowCount} verified`
        : `broken at #${r.result.brokenAt} (${r.result.brokenRecordId}): ${r.result.error}`;
      console.log(
        `  [${tag}] org=${r.orgId} rows=${r.rowCount} v1=${r.v1Count} v2=${r.v2Count} — ${detail}`
      );
    }
    if (failed.length > 0) {
      console.error(`\n${failed.length} org chain(s) FAILED verification.`);
    } else {
      console.log(`\nAll ${reports.length} org chain(s) verified successfully.`);
    }
  }

  process.exitCode = failed.length === 0 ? 0 : 1;
}

main()
  .catch((err) => {
    console.error("verify-audit-chain-history: infrastructure error", err);
    process.exitCode = 2;
  })
  .finally(async () => {
    try {
      await pool?.end();
    } catch {
      // ignore
    }
  });
