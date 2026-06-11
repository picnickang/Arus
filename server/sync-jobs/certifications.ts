/**
 * Sync Jobs - Crew Certification Expiry Check
 */

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("SyncJobs:Certifications");
import { db } from "../db.js";
import { crewCertification } from "@shared/schema.js";
import { eq, sql, and, lt, gte } from "drizzle-orm";
import type { DataIntegrityCheckResult } from "./types.js";

/**
 * Check for crew certifications expiring within 30 days
 */
export async function checkCrewCertificationExpiry(
  orgId: string
): Promise<DataIntegrityCheckResult> {
  const issues: DataIntegrityCheckResult["issues"] = [];

  try {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const { crew } = await import("@shared/schema.js");

    const expiringCerts = await db
      .select({
        crewId: crewCertification.crewId,
        cert: crewCertification.cert,
        expiresAt: crewCertification.expiresAt,
        issuedBy: crewCertification.issuedBy,
      })
      .from(crewCertification)
      .innerJoin(crew, eq(crew.id, crewCertification.crewId))
      .where(
        and(
          eq(crew.orgId, orgId),
          lt(crewCertification.expiresAt, thirtyDaysFromNow),
          gte(crewCertification.expiresAt, new Date())
        )
      );

    for (const cert of expiringCerts) {
      const daysUntilExpiry = Math.ceil(
        (cert.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      const severity =
        daysUntilExpiry <= 7 ? "critical" : daysUntilExpiry <= 14 ? "high" : "medium";

      issues.push({
        code: "CREW_CERTIFICATION_EXPIRING",
        message: `Crew certification ${cert.cert} expires in ${daysUntilExpiry} days (${cert.expiresAt.toLocaleDateString()})`,
        severity,
        reference: {
          crewId: cert.crewId,
          certification: cert.cert,
          expiresAt: cert.expiresAt,
          issuedBy: cert.issuedBy,
          daysUntilExpiry,
        },
      });
    }

    const entitiesChecked = await db
      .select({ count: sql<number>`count(*)` })
      .from(crewCertification)
      .then((r) => r[0]?.count || 0);

    return { issues, entitiesChecked };
  } catch (error) {
    logger.error("Crew certification expiry check failed:", undefined, error);
    return {
      issues: [
        {
          code: "CERTIFICATION_EXPIRY_CHECK_ERROR",
          message: `Failed to check certification expiry: ${error instanceof Error ? error.message : "Unknown error"}`,
          severity: "high",
        },
      ],
      entitiesChecked: 0,
    };
  }
}
