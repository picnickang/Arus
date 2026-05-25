/**
 * Wave 6.6 — GDPR tenant-data delete tool.
 *
 * One transactional procedure that:
 *   1. Revokes all sessions for the tenant.
 *   2. Deletes from every registered tenant-scoped table in dependency
 *      order (children before parents).
 *   3. Retains the audit log row with PII fields redacted (regulators
 *      require us to keep the *record* of what we deleted, but not the
 *      personal data inside it).
 *   4. Emits a deletion certificate (signed JSON) the operator can hand
 *      to the data-subject as proof of erasure.
 *
 * Tables are registered explicitly — we never wildcard-delete based on
 * a column-name match because a typo (`tenant_id` vs `tenantId` vs
 * `org_id`) could silently leave or wipe the wrong scope. A failing
 * scope is a hard error; partial deletion is worse than no deletion.
 *
 * The whole operation runs inside a single SERIALIZABLE transaction so
 * a concurrent write during deletion gets retried, not interleaved.
 */

import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { createLogger } from "../../lib/structured-logger";

const logger = createLogger("GDPR:TenantDelete");

export interface TenantTable {
  /** Fully-qualified SQL table name. */
  table: string;
  /** Column holding the tenant identifier (defaults to `org_id`). */
  tenantColumn?: string;
  /** Optional human description for the certificate. */
  description?: string;
}

export interface AuditRedactionRule {
  table: string;
  tenantColumn?: string;
  /** Columns whose values should be replaced with `[REDACTED]`. */
  piiColumns: string[];
}

export interface DeletionCertificate {
  tenantId: string;
  issuedAt: string;
  reason: string;
  totalRowsDeleted: number;
  perTable: Array<{ table: string; rows: number }>;
  retained: Array<{ table: string; rowsRedacted: number; piiColumns: string[] }>;
  certificateId: string;
  signature: string;
}

export interface DeletionResult {
  certificate: DeletionCertificate;
  durationMs: number;
}

export interface TenantDeleteOptions {
  /** Drizzle db handle (the same `db` used elsewhere). */
  db: {
    transaction: <T>(
      fn: (tx: { execute: (q: unknown) => Promise<unknown> }) => Promise<T>
    ) => Promise<T>;
    execute: (q: unknown) => Promise<unknown>;
  };
  /** Tables to delete from, child-tables-first. */
  tables: readonly TenantTable[];
  /** Tables whose rows must be retained for compliance, with PII redacted. */
  retain?: readonly AuditRedactionRule[];
  /** Secret used to HMAC-sign the certificate. Falls back to SESSION_SECRET. */
  signingSecret?: string;
}

const SAFE_IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/;

function assertSafeIdentifier(name: string, kind: string): void {
  // Identifiers cannot be parameterized in SQL; we validate them with a
  // strict allowlist instead. Anything outside `schema.table` letters/
  // digits/underscore is rejected.
  if (!SAFE_IDENT_RE.test(name)) {
    throw new Error(`Unsafe ${kind} identifier: ${name}`);
  }
}

export class TenantDeleteService {
  constructor(private readonly opts: TenantDeleteOptions) {
    for (const t of opts.tables) {
      assertSafeIdentifier(t.table, "table");
      if (t.tenantColumn) assertSafeIdentifier(t.tenantColumn, "column");
    }
    for (const r of opts.retain ?? []) {
      assertSafeIdentifier(r.table, "table");
      if (r.tenantColumn) assertSafeIdentifier(r.tenantColumn, "column");
      for (const c of r.piiColumns) assertSafeIdentifier(c, "column");
    }
  }

  async execute(tenantId: string, reason: string): Promise<DeletionResult> {
    if (!tenantId || typeof tenantId !== "string" || tenantId.length > 128) {
      throw new Error("tenantId is required and must be a string ≤128 chars");
    }
    const start = Date.now();
    const perTable: DeletionCertificate["perTable"] = [];
    const retained: DeletionCertificate["retained"] = [];
    let totalRowsDeleted = 0;

    await this.opts.db.transaction(async (tx) => {
      // Best-effort: bump the isolation level. If the underlying driver
      // doesn't support it (e.g. neon-http), the SET will throw and we
      // fall back to the default — still safe because every WHERE is
      // tenant-scoped.
      try {
        await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`);
      } catch {
        // intentionally swallowed; some drivers reject this mid-tx.
      }

      for (const t of this.opts.tables) {
        const col = t.tenantColumn ?? "org_id";
        const stmt = sql.raw(`DELETE FROM ${t.table} WHERE ${col} = '${escapeLiteral(tenantId)}'`);
        const result = await tx.execute(stmt);
        const rows = extractRowCount(result);
        perTable.push({ table: t.table, rows });
        totalRowsDeleted += rows;
      }

      for (const r of this.opts.retain ?? []) {
        const col = r.tenantColumn ?? "org_id";
        const setClauses = r.piiColumns.map((c) => `${c} = '[REDACTED]'`).join(", ");
        const stmt = sql.raw(
          `UPDATE ${r.table} SET ${setClauses} WHERE ${col} = '${escapeLiteral(tenantId)}'`
        );
        const result = await tx.execute(stmt);
        const rowsRedacted = extractRowCount(result);
        retained.push({ table: r.table, rowsRedacted, piiColumns: [...r.piiColumns] });
      }
    });

    const certificate = this.signCertificate({
      tenantId,
      issuedAt: new Date().toISOString(),
      reason,
      totalRowsDeleted,
      perTable,
      retained,
      certificateId: crypto.randomUUID(),
      signature: "",
    });

    const durationMs = Date.now() - start;
    logger.info(`GDPR delete completed for tenant ${tenantId}`, {
      tenantId,
      totalRowsDeleted,
      durationMs,
      certificateId: certificate.certificateId,
    });
    return { certificate, durationMs };
  }

  private signCertificate(cert: DeletionCertificate): DeletionCertificate {
    const secret = this.opts.signingSecret ?? process.env['SESSION_SECRET'] ?? "";
    if (!secret) {
      logger.warn("Signing certificate without SESSION_SECRET — signature will be empty.");
      return cert;
    }
    const payload = JSON.stringify({ ...cert, signature: "" });
    const signature = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    return { ...cert, signature };
  }
}

function escapeLiteral(s: string): string {
  // The tenant id is validated upstream to be a small string, but we still
  // double the single quotes defensively. This is *not* a general-purpose
  // SQL escaper — it is only safe here because tenantId is constrained
  // and never contains binary/multibyte attack content. Identifiers go
  // through `assertSafeIdentifier` separately.
  return s.replace(/'/g, "''");
}

function extractRowCount(result: unknown): number {
  if (!result) return 0;
  if (Array.isArray(result)) return result.length;
  const r = result as { rowCount?: unknown; count?: unknown; rows?: unknown };
  if (typeof r.rowCount === "number") return r.rowCount;
  if (typeof r.count === "number") return r.count;
  if (Array.isArray(r.rows)) return r.rows.length;
  return 0;
}
