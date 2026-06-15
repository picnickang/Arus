/**
 * GDPR - Database Storage
 */

import { eq, and, gte, lte, sql, type SQL } from "drizzle-orm";
import { tableColumns } from "../_helpers/table-columns";
import { db } from "../../db-config";
import { dataSubjectRequests, engineerOverrides } from "@shared/schema-runtime";
import type {
  DataSubjectRequest,
  InsertDataSubjectRequest,
  EngineerOverride,
  InsertEngineerOverride,
} from "@shared/schema";

export class DatabaseGdprStorage {
  async getDataSubjectRequests(
    orgId?: string,
    status?: string,
    type?: string
  ): Promise<DataSubjectRequest[]> {
    const conditions = [];
    if (orgId) {
      conditions.push(eq(dataSubjectRequests.orgId, orgId));
    }
    if (status) {
      conditions.push(eq(dataSubjectRequests.status, status));
    }
    if (type) {
      conditions.push(eq(dataSubjectRequests.requestType, type));
    }
    const query =
      conditions.length > 0
        ? db
            .select()
            .from(dataSubjectRequests)
            .where(and(...conditions))
        : db.select().from(dataSubjectRequests);
    return query.orderBy(sql`${dataSubjectRequests.createdAt} DESC`);
  }
  async getDataSubjectRequest(id: string): Promise<DataSubjectRequest | undefined> {
    const [result] = await db
      .select()
      .from(dataSubjectRequests)
      .where(eq(dataSubjectRequests.id, id));
    return result;
  }
  async createDataSubjectRequest(request: InsertDataSubjectRequest): Promise<DataSubjectRequest> {
    const [n] = await db.insert(dataSubjectRequests).values(request).returning();
    if (!n) {
      throw new Error("Failed to create data subject request");
    }
    return n;
  }
  async updateDataSubjectRequest(
    id: string,
    updates: Partial<InsertDataSubjectRequest>
  ): Promise<DataSubjectRequest> {
    const [u] = await db
      .update(dataSubjectRequests)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(dataSubjectRequests.id, id))
      .returning();
    if (!u) {
      throw new Error(`Data subject request ${id} not found`);
    }
    return u;
  }
  async deleteDataSubjectRequest(id: string): Promise<void> {
    await db.delete(dataSubjectRequests).where(eq(dataSubjectRequests.id, id));
  }
  async processDataSubjectRequest(
    id: string,
    processedBy: string,
    result: Record<string, unknown>
  ): Promise<DataSubjectRequest> {
    const [u] = await db
      .update(dataSubjectRequests)
      .set({
        status: "completed",
        processedBy,
        processedAt: new Date(),
        result,
        updatedAt: new Date(),
      } as never)
      .where(eq(dataSubjectRequests.id, id))
      .returning();
    if (!u) {
      throw new Error(`Data subject request ${id} not found`);
    }
    return u;
  }
  async getDataSubjectRequestsByEmail(email: string): Promise<DataSubjectRequest[]> {
    const col = tableColumns(dataSubjectRequests)["subjectEmail"];
    if (!col) {
      return [];
    }
    return db
      .select()
      .from(dataSubjectRequests)
      .where(eq(col, email))
      .orderBy(sql`${dataSubjectRequests.createdAt} DESC`);
  }
  async getPendingDataSubjectRequests(orgId?: string): Promise<DataSubjectRequest[]> {
    const conditions = [eq(dataSubjectRequests.status, "pending")];
    if (orgId) {
      conditions.push(eq(dataSubjectRequests.orgId, orgId));
    }
    return db
      .select()
      .from(dataSubjectRequests)
      .where(and(...conditions))
      .orderBy(dataSubjectRequests.createdAt);
  }

  async getDataSubjectRequestWithOrg(
    id: string,
    orgId: string
  ): Promise<DataSubjectRequest | undefined> {
    const [result] = await db
      .select()
      .from(dataSubjectRequests)
      .where(and(eq(dataSubjectRequests.id, id), eq(dataSubjectRequests.orgId, orgId)));
    return result;
  }

  async getDataSubjectRequestsFiltered(
    orgId: string,
    filters: {
      status?: string;
      requestType?: string;
      requesterEmail?: string;
      fromDate?: Date;
      toDate?: Date;
    }
  ): Promise<DataSubjectRequest[]> {
    const conditions: SQL[] = [eq(dataSubjectRequests.orgId, orgId)];
    if (filters.status) {
      conditions.push(eq(dataSubjectRequests.status, filters.status));
    }
    if (filters.requestType) {
      conditions.push(eq(dataSubjectRequests.requestType, filters.requestType));
    }
    if (filters.requesterEmail) {
      conditions.push(eq(dataSubjectRequests.requesterEmail, filters.requesterEmail));
    }
    // fromDate/toDate were accepted but never applied — the date filter was a
    // silent no-op, returning every DSAR regardless of the requested window.
    if (filters.fromDate) {
      conditions.push(gte(dataSubjectRequests.createdAt, filters.fromDate));
    }
    if (filters.toDate) {
      conditions.push(lte(dataSubjectRequests.createdAt, filters.toDate));
    }
    return db
      .select()
      .from(dataSubjectRequests)
      .where(and(...conditions))
      .orderBy(sql`${dataSubjectRequests.createdAt} DESC`);
  }

  async acknowledgeDataSubjectRequest(
    id: string,
    acknowledgedBy: string,
    orgId: string
  ): Promise<DataSubjectRequest> {
    const [u] = await db
      .update(dataSubjectRequests)
      .set({
        status: "in_progress",
        acknowledgedAt: new Date(),
        assignedTo: acknowledgedBy,
        updatedAt: new Date(),
      })
      .where(and(eq(dataSubjectRequests.id, id), eq(dataSubjectRequests.orgId, orgId)))
      .returning();
    if (!u) {
      throw new Error(`Data subject request ${id} not found`);
    }
    return u;
  }

  async completeDataSubjectRequest(
    id: string,
    completedBy: string,
    notes: string | undefined,
    orgId: string
  ): Promise<DataSubjectRequest> {
    const [u] = await db
      .update(dataSubjectRequests)
      .set({
        status: "completed",
        completedAt: new Date(),
        processingNotes: notes,
        updatedAt: new Date(),
      })
      .where(and(eq(dataSubjectRequests.id, id), eq(dataSubjectRequests.orgId, orgId)))
      .returning();
    if (!u) {
      throw new Error(`Data subject request ${id} not found`);
    }
    return u;
  }

  async rejectDataSubjectRequest(
    id: string,
    rejectedBy: string,
    reason: string,
    orgId: string
  ): Promise<DataSubjectRequest> {
    const [u] = await db
      .update(dataSubjectRequests)
      .set({
        status: "rejected",
        rejectionReason: reason,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(dataSubjectRequests.id, id), eq(dataSubjectRequests.orgId, orgId)))
      .returning();
    if (!u) {
      throw new Error(`Data subject request ${id} not found`);
    }
    return u;
  }

  /**
   * Collect a data subject's personal data for a DSAR access request (Art. 15).
   *
   * Resolves the subject across id types (crewId ↔ userId ↔ email) so every
   * category is queried by the right key, and captures per-source errors in
   * `_errors` instead of silently swallowing them. See
   * docs/design/gdpr-dsar-completion.md (linking keys pending sign-off).
   */
  async collectUserDataForDsar(
    orgId: string,
    identifier: string,
    identifierType: "email" | "userId" | "crewId"
  ): Promise<Record<string, unknown>> {
    const result: Record<string, unknown[]> = {
      users: [],
      crewMembers: [],
      restRecords: [],
      workOrders: [],
      auditEvents: [],
    };
    const errors: Record<string, string> = {};
    const firstStr = (rows: unknown[], key: string): string | null => {
      const v = (rows[0] as Record<string, unknown> | undefined)?.[key];
      return typeof v === "string" ? v : null;
    };
    const safe = async (
      key: keyof typeof result,
      run: () => Promise<{ rows?: unknown[] }>
    ): Promise<void> => {
      try {
        const rows = (await run()).rows ?? [];
        // Sequential awaits — no concurrent writers to `result`.
        // eslint-disable-next-line require-atomic-updates
        result[key] = rows;
      } catch (e) {
        errors[key] = e instanceof Error ? e.message : String(e);
      }
    };

    // Phase 1 — resolve the subject's crew + user rows from whichever id we got.
    const crewWhere = (): SQL => {
      if (identifierType === "crewId") {return sql`id = ${identifier}`;}
      if (identifierType === "email") {return sql`email = ${identifier}`;}
      return sql`user_id = ${identifier}`;
    };
    await safe("crewMembers", () =>
      db.execute(
        sql`SELECT id, name, email, rank, department, user_id FROM crew WHERE ${crewWhere()} AND org_id = ${orgId}`
      )
    );
    const crewId =
      identifierType === "crewId" ? identifier : firstStr(result["crewMembers"]!, "id");
    const linkedUserId = firstStr(result["crewMembers"]!, "user_id");

    const usersWhere = (): SQL => {
      if (identifierType === "email") {return sql`email = ${identifier}`;}
      if (identifierType === "userId") {return sql`id = ${identifier}`;}
      return sql`id = ${linkedUserId}`;
    };
    await safe("users", () =>
      db.execute(
        sql`SELECT id, email, name, role FROM users WHERE ${usersWhere()} AND org_id = ${orgId}`
      )
    );
    const userId =
      identifierType === "userId" ? identifier : firstStr(result["users"]!, "id");
    const email =
      identifierType === "email"
        ? identifier
        : (firstStr(result["users"]!, "email") ?? firstStr(result["crewMembers"]!, "email"));

    // Phase 2 — gather the records linked to the resolved subject keys.
    if (crewId) {
      await safe("restRecords", () =>
        db.execute(
          sql`SELECT id, crew_id, crew_name, month, year, created_at FROM crew_rest_sheet WHERE crew_id = ${crewId} AND org_id = ${orgId} ORDER BY created_at DESC`
        )
      );
      await safe("workOrders", () =>
        db.execute(
          sql`SELECT id, title, status, assigned_crew_id FROM work_orders WHERE assigned_crew_id = ${crewId} AND org_id = ${orgId} ORDER BY created_at DESC`
        )
      );
    }
    if (userId || email) {
      await safe("auditEvents", () =>
        db.execute(
          sql`SELECT id, event_type, event_category, performed_by, performed_by_name, created_at
              FROM immutable_audit_trail
              WHERE org_id = ${orgId} AND (performed_by = ${userId} OR performed_by = ${email})
              ORDER BY created_at DESC`
        )
      );
    }

    return Object.keys(errors).length > 0 ? { ...result, _errors: errors } : result;
  }

  /**
   * Erase a data subject's personal data (GDPR Art. 17).
   *
   * DRAFT — implements docs/design/gdpr-dsar-completion.md; the per-table
   * policy below should be confirmed by a compliance owner.
   *
   * Strategy is ANONYMIZE, not hard-delete: crew/user rows are referenced by
   * retained operational records and by the append-only, hash-chained
   * `immutable_audit_trail` (deleting would break referential integrity / the
   * audit chain), and several record classes carry statutory retention. We
   * overwrite identifying PII on `users` + `crew` (atomic, in one transaction)
   * and retain — with documented exemptions — the records that merely reference
   * the now-anonymized ids. Returns a structured report. `dryRun` previews the
   * affected row counts without writing and without changing the DSAR status.
   */
  async executeDataErasure(
    dsarId: string,
    orgId: string,
    erasedBy: string,
    reason?: string,
    options?: { dryRun?: boolean }
  ): Promise<Record<string, unknown>> {
    const request = await this.getDataSubjectRequestWithOrg(dsarId, orgId);
    if (!request) {
      throw new Error(`DSAR ${dsarId} not found`);
    }
    const subjectId = request.requesterId ?? null;
    const subjectEmail = request.requesterEmail ?? null;
    if (!subjectId && !subjectEmail) {
      throw new Error(
        `DSAR ${dsarId} has no requesterId/requesterEmail to identify the subject`
      );
    }
    const dryRun = options?.dryRun ?? false;

    const NAME_TOMB = "[erased]";
    const EMAIL_TOMB = `erased-${dsarId}@redacted.invalid`;
    const rowCount = (r: { rows?: unknown[] }): number => r.rows?.length ?? 0;
    const countOf = (r: { rows?: unknown[] }): number =>
      Number((r.rows?.[0] as { n?: number } | undefined)?.n ?? 0);

    const report: Record<string, { action: string; rows?: number; reason?: string }> = {
      immutable_audit_trail: {
        action: "retain",
        reason:
          "append-only, hash-chained ledger — modifying it breaks chain verification (legal + technical exemption). NOTE: performed_by_name is a denormalized PII residue here; sign-off needed on how to handle it without breaking the chain",
      },
      work_orders: {
        action: "retain",
        reason: "operational/maintenance record retention; references the anonymized crew row",
      },
    };

    if (dryRun) {
      const u = await db.execute(
        sql`SELECT count(*) AS n FROM users WHERE org_id = ${orgId} AND (id = ${subjectId} OR email = ${subjectEmail})`
      );
      const c = await db.execute(
        sql`SELECT count(*) AS n FROM crew WHERE org_id = ${orgId} AND (id = ${subjectId} OR user_id = ${subjectId} OR email = ${subjectEmail})`
      );
      report["users"] = { action: "anonymize", rows: countOf(u) };
      report["crew"] = { action: "anonymize", rows: countOf(c) };
      return { dsarId, status: request.status, dryRun: true, report };
    }

    await db.transaction(async (tx) => {
      const u = await tx.execute(
        sql`UPDATE users
            SET name = ${NAME_TOMB}, email = ${EMAIL_TOMB}, username = NULL, phone = NULL
            WHERE org_id = ${orgId} AND (id = ${subjectId} OR email = ${subjectEmail})
            RETURNING id`
      );
      const c = await tx.execute(
        sql`UPDATE crew
            SET name = ${NAME_TOMB}, email = NULL, phone = NULL, address = NULL,
                photo_path = NULL, emergency_contact_name = NULL,
                emergency_contact_phone = NULL, crew_code = NULL, notes = NULL
            WHERE org_id = ${orgId}
              AND (id = ${subjectId} OR user_id = ${subjectId} OR email = ${subjectEmail})
            RETURNING id`
      );
      report["users"] = { action: "anonymize", rows: rowCount(u) };
      report["crew"] = { action: "anonymize", rows: rowCount(c) };

      // crew_rest_sheet is retained (STCW), but it denormalizes the crew name —
      // scrub that PII copy on the retained rows so the name doesn't survive.
      const crewIds = (c.rows ?? [])
        .map((r) => (r as { id?: string }).id)
        .filter((v): v is string => typeof v === "string");
      if (crewIds.length > 0) {
        const rs = await tx.execute(
          sql`UPDATE crew_rest_sheet SET crew_name = ${NAME_TOMB}
              WHERE org_id = ${orgId} AND crew_id IN (${sql.join(
                crewIds.map((id) => sql`${id}`),
                sql`, `
              )})
              RETURNING id`
        );
        report["crew_rest_sheet"] = {
          action: "anonymize_pii_retain_record",
          rows: rowCount(rs),
          reason: "STCW record retained; denormalized crew_name scrubbed",
        };
      }

      // work_order_tasks / work_order_completions retain the operational record
      // (completed_by id) but denormalize the actor's NAME — scrub that copy.
      const userIds = (u.rows ?? [])
        .map((r) => (r as { id?: string }).id)
        .filter((v): v is string => typeof v === "string");
      if (userIds.length > 0) {
        const ids = sql.join(
          userIds.map((id) => sql`${id}`),
          sql`, `
        );
        for (const table of ["work_order_tasks", "work_order_completions"] as const) {
          const r = await tx.execute(
            sql`UPDATE ${sql.identifier(table)} SET completed_by_name = ${NAME_TOMB}
                WHERE org_id = ${orgId} AND completed_by IN (${ids})
                RETURNING id`
          );
          report[table] = {
            action: "anonymize_pii_retain_record",
            rows: rowCount(r),
            reason: "operational record retained; denormalized completed_by_name scrubbed",
          };
        }
      }

      await tx.execute(
        sql`UPDATE data_subject_requests
            SET status = 'completed', processing_notes = ${
              `Erasure (anonymization) executed by ${erasedBy}. Reason: ${reason || "DSAR erasure"}. ` +
              `Report: ${JSON.stringify(report)}`
            }
            WHERE id = ${dsarId} AND org_id = ${orgId}`
      );
    });

    return { dsarId, status: "completed", erasedBy, dryRun: false, report };
  }

  async getMlEngineerOverrides(
    equipmentId?: string,
    overrideType?: string,
    isActive?: boolean
  ): Promise<EngineerOverride[]> {
    const conditions = [];
    if (equipmentId) {
      conditions.push(eq(engineerOverrides.equipmentId, equipmentId));
    }
    if (overrideType) {
      conditions.push(eq(engineerOverrides.overrideType, overrideType));
    }
    if (isActive !== undefined) {
      const col = tableColumns(engineerOverrides)["isActive"];
      if (col) {
        conditions.push(eq(col, isActive));
      }
    }
    const query =
      conditions.length > 0
        ? db
            .select()
            .from(engineerOverrides)
            .where(and(...conditions))
        : db.select().from(engineerOverrides);
    return query.orderBy(sql`${engineerOverrides.createdAt} DESC`);
  }
  async getMlEngineerOverride(id: string): Promise<EngineerOverride | undefined> {
    const [result] = await db.select().from(engineerOverrides).where(eq(engineerOverrides.id, id));
    return result;
  }
  async createMlEngineerOverride(override: InsertEngineerOverride): Promise<EngineerOverride> {
    const [n] = await db.insert(engineerOverrides).values(override).returning();
    if (!n) {
      throw new Error("Failed to create engineer override");
    }
    return n;
  }
  async updateMlEngineerOverride(
    id: string,
    updates: Partial<InsertEngineerOverride>
  ): Promise<EngineerOverride> {
    const [u] = await db
      .update(engineerOverrides)
      .set({ ...updates, updatedAt: new Date() } as never)
      .where(eq(engineerOverrides.id, id))
      .returning();
    if (!u) {
      throw new Error(`ML engineer override ${id} not found`);
    }
    return u;
  }
  async deleteMlEngineerOverride(id: string): Promise<void> {
    await db.delete(engineerOverrides).where(eq(engineerOverrides.id, id));
  }
  async getActiveOverridesForEquipment(equipmentId: string): Promise<EngineerOverride[]> {
    const isActiveCol = tableColumns(engineerOverrides)["isActive"];
    const c: SQL[] = [eq(engineerOverrides.equipmentId, equipmentId)];
    if (isActiveCol) {
      c.push(eq(isActiveCol, true));
    }
    return db
      .select()
      .from(engineerOverrides)
      .where(and(...c))
      .orderBy(sql`${engineerOverrides.createdAt} DESC`);
  }
  async deactivateOverride(id: string, deactivatedBy: string): Promise<EngineerOverride> {
    const [u] = await db
      .update(engineerOverrides)
      .set({
        isActive: false,
        deactivatedBy,
        deactivatedAt: new Date(),
        updatedAt: new Date(),
      } as never)
      .where(eq(engineerOverrides.id, id))
      .returning();
    if (!u) {
      throw new Error(`ML engineer override ${id} not found`);
    }
    return u;
  }
}
