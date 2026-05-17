/**
 * Alert Settings - Cooldown Management
 * Alert cooldown and deduplication logic
 */

import { db } from "../../../db.js";
import { alertCooldown, type AlertCooldown } from "@shared/schema";
import { eq, and, lte, sql } from "drizzle-orm";
import { hasPostgresFeatures } from "../../../config/runtimeEnv.js";
import type { ClaimResult, CooldownSnapshot } from "./types.js";

export async function getCooldown(
  orgId: string,
  alertType: string,
  alertKey: string,
  vesselId?: string
): Promise<AlertCooldown | undefined> {
  const conditions = [
    eq(alertCooldown.orgId, orgId),
    eq(alertCooldown.alertType, alertType),
    eq(alertCooldown.alertKey, alertKey),
  ];
  if (vesselId) {
    conditions.push(eq(alertCooldown.vesselId, vesselId));
  } else {
    conditions.push(sql`${alertCooldown.vesselId} IS NULL`);
  }

  const [result] = await db
    .select()
    .from(alertCooldown)
    .where(and(...conditions))
    .limit(1);
  return result;
}

export async function isInCooldown(
  orgId: string,
  alertType: string,
  alertKey: string,
  cooldownMs: number,
  vesselId?: string
): Promise<boolean> {
  const cooldown = await getCooldown(orgId, alertType, alertKey, vesselId);
  if (!cooldown) {
    return false;
  }
  const threshold = new Date(Date.now() - cooldownMs);
  return cooldown.lastEmailAt !== null && cooldown.lastEmailAt >= threshold;
}

export async function recordAlertSent(
  orgId: string,
  alertType: string,
  alertKey: string,
  vesselId?: string,
  entityId?: string
): Promise<AlertCooldown> {
  const existing = await getCooldown(orgId, alertType, alertKey, vesselId);
  if (existing) {
    const [updated] = await db
      .update(alertCooldown)
      .set({
        lastAlertAt: new Date(),
        alertCount: (existing.alertCount || 0) + 1,
        updatedAt: new Date(),
      })
      .where(eq(alertCooldown.id, existing.id))
      .returning();
    return updated;
  }
  const [created] = await db
    .insert(alertCooldown)
    .values({
      orgId,
      alertType,
      alertKey,
      vesselId,
      entityId,
      lastAlertAt: new Date(),
      alertCount: 1,
    })
    .returning();
  return created;
}

export async function recordEmailSent(cooldownId: string): Promise<void> {
  await db
    .update(alertCooldown)
    .set({ lastEmailAt: new Date(), updatedAt: new Date() })
    .where(eq(alertCooldown.id, cooldownId));
}

export async function atomicClaimAlertSlot(
  orgId: string,
  alertType: string,
  alertKey: string,
  cooldownMs: number,
  vesselId?: string,
  entityId?: string
): Promise<ClaimResult> {
  const now = new Date();
  const cooldownThreshold = new Date(now.getTime() - cooldownMs);
  const claimTimeout = new Date(now.getTime() - 5 * 60 * 1000);

  if (!hasPostgresFeatures) {
    return atomicClaimAlertSlotSQLite(orgId, alertType, alertKey, cooldownMs, vesselId, entityId);
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        const buildQuery = (v?: string, e?: string) => {
          if (v && e) {
            return tx.execute(
              sql`SELECT id, last_email_at, last_alert_at, alert_count, updated_at FROM alert_cooldown WHERE org_id = ${orgId} AND vessel_id = ${v} AND alert_type = ${alertType} AND alert_key = ${alertKey} AND entity_id = ${e} FOR UPDATE LIMIT 1`
            );
          }
          if (v) {
            return tx.execute(
              sql`SELECT id, last_email_at, last_alert_at, alert_count, updated_at FROM alert_cooldown WHERE org_id = ${orgId} AND vessel_id = ${v} AND alert_type = ${alertType} AND alert_key = ${alertKey} AND entity_id IS NULL FOR UPDATE LIMIT 1`
            );
          }
          if (e) {
            return tx.execute(
              sql`SELECT id, last_email_at, last_alert_at, alert_count, updated_at FROM alert_cooldown WHERE org_id = ${orgId} AND vessel_id IS NULL AND alert_type = ${alertType} AND alert_key = ${alertKey} AND entity_id = ${e} FOR UPDATE LIMIT 1`
            );
          }
          return tx.execute(
            sql`SELECT id, last_email_at, last_alert_at, alert_count, updated_at FROM alert_cooldown WHERE org_id = ${orgId} AND vessel_id IS NULL AND alert_type = ${alertType} AND alert_key = ${alertKey} AND entity_id IS NULL FOR UPDATE LIMIT 1`
          );
        };
        const existingQuery = await buildQuery(vesselId, entityId);

        if (existingQuery.rows.length > 0) {
          const row = existingQuery.rows[0] as {
            id: string;
            last_email_at: Date | null;
            last_alert_at: Date;
            alert_count: number;
            updated_at: Date;
          };
          const cooldownActive =
            row.last_email_at && new Date(row.last_email_at) >= cooldownThreshold;
          const claimInProgress = !row.last_email_at && new Date(row.last_alert_at) >= claimTimeout;
          if (cooldownActive || claimInProgress) {
            return {
              claimed: false,
              reason: cooldownActive ? "Cooldown active" : "Claim in progress",
            };
          }
          const snapshot: CooldownSnapshot = {
            lastAlertAt: row.last_alert_at,
            lastEmailAt: row.last_email_at,
            alertCount: row.alert_count,
            claimUpdatedAt: now,
          };
          await tx.execute(
            sql`UPDATE alert_cooldown SET last_alert_at = ${now}, last_email_at = NULL, alert_count = alert_count + 1, updated_at = ${now} WHERE id = ${row.id}`
          );
          return { claimed: true, cooldownId: row.id, snapshot };
        }

        const insertResult = await tx.execute(
          sql`INSERT INTO alert_cooldown (id, org_id, vessel_id, alert_type, alert_key, entity_id, last_alert_at, last_email_at, alert_count, created_at, updated_at) VALUES (gen_random_uuid(), ${orgId}, ${vesselId || null}, ${alertType}, ${alertKey}, ${entityId || null}, ${now}, NULL, 1, ${now}, ${now}) RETURNING id`
        );
        const newRow = insertResult.rows[0] as { id: string };
        return {
          claimed: true,
          cooldownId: newRow.id,
          snapshot: { lastAlertAt: now, lastEmailAt: null, alertCount: 0, claimUpdatedAt: now },
        };
      });
    } catch (err: any) {
      if (
        (err.code === "23505" ||
          err.message?.includes("unique") ||
          err.message?.includes("duplicate")) &&
        attempt < 2
      ) {
        await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
        continue;
      }
      return { claimed: false, reason: "Database error" };
    }
  }
  return { claimed: false, reason: "Max retries exceeded" };
}

async function atomicClaimAlertSlotSQLite(
  orgId: string,
  alertType: string,
  alertKey: string,
  cooldownMs: number,
  vesselId?: string,
  entityId?: string
): Promise<ClaimResult> {
  const now = new Date();
  const cooldownThreshold = new Date(now.getTime() - cooldownMs);
  try {
    const existing = await db
      .select()
      .from(alertCooldown)
      .where(
        and(
          eq(alertCooldown.orgId, orgId),
          eq(alertCooldown.alertType, alertType),
          eq(alertCooldown.alertKey, alertKey),
          vesselId ? eq(alertCooldown.vesselId, vesselId) : sql`vessel_id IS NULL`,
          entityId ? eq(alertCooldown.entityId, entityId) : sql`entity_id IS NULL`
        )
      )
      .limit(1);
    if (existing.length > 0) {
      const row = existing[0];
      if (row.lastEmailAt && new Date(row.lastEmailAt) >= cooldownThreshold) {
        return { claimed: false, reason: "Cooldown active" };
      }
      const snapshot: CooldownSnapshot = {
        lastAlertAt: row.lastAlertAt,
        lastEmailAt: row.lastEmailAt,
        alertCount: row.alertCount,
        claimUpdatedAt: now,
      };
      await db
        .update(alertCooldown)
        .set({
          lastAlertAt: now,
          lastEmailAt: null,
          alertCount: row.alertCount + 1,
          updatedAt: now,
        })
        .where(eq(alertCooldown.id, row.id));
      return { claimed: true, cooldownId: row.id, snapshot };
    }
    const [newRow] = await db
      .insert(alertCooldown)
      .values({
        orgId,
        vesselId: vesselId || null,
        alertType,
        alertKey,
        entityId: entityId || null,
        lastAlertAt: now,
        lastEmailAt: null,
        alertCount: 1,
      })
      .returning({ id: alertCooldown.id });
    return {
      claimed: true,
      cooldownId: newRow.id,
      snapshot: { lastAlertAt: now, lastEmailAt: null, alertCount: 0, claimUpdatedAt: now },
    };
  } catch {
    return { claimed: true, cooldownId: undefined, reason: "SQLite fallback" };
  }
}

export async function revertCooldownClaim(
  cooldownId: string,
  snapshot: CooldownSnapshot
): Promise<boolean> {
  if (!hasPostgresFeatures) {
    await db
      .update(alertCooldown)
      .set({
        lastAlertAt: snapshot.lastAlertAt,
        lastEmailAt: snapshot.lastEmailAt,
        alertCount: snapshot.alertCount,
        updatedAt: new Date(),
      })
      .where(eq(alertCooldown.id, cooldownId));
    return true;
  }
  const result = await db.execute(
    sql`UPDATE alert_cooldown SET last_alert_at = ${snapshot.lastAlertAt}, last_email_at = ${snapshot.lastEmailAt}, alert_count = ${snapshot.alertCount}, updated_at = ${new Date()} WHERE id = ${cooldownId} AND updated_at = ${snapshot.claimUpdatedAt}`
  );
  return (result.rowCount || 0) > 0;
}

export async function cleanupExpiredCooldowns(hoursOld: number = 24): Promise<number> {
  const cutoff = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
  const result = await db.delete(alertCooldown).where(lte(alertCooldown.lastAlertAt, cutoff));
  return result.rowCount || 0;
}
