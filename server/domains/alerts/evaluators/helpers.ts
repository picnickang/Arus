/**
 * Crew Alert Evaluators - Helpers
 * Utility functions for alert evaluation
 */

import { dbCrewStorage } from "../../../repositories";
import { deckLogStorage, engineLogStorage } from "../../../repositories";
import { addDays } from "date-fns";

const severityMap: Record<string, "info" | "warning" | "critical"> = {
  critical: "critical",
  warning: "warning",
};

export function getSeverityFromMinSeverity(minSeverity?: string): "info" | "warning" | "critical" {
  return minSeverity ? (severityMap[minSeverity] ?? "info") : "info";
}

export async function getCertificationsNearExpiry(
  orgId: string,
  vesselId: string | undefined,
  now: Date,
  maxDays: number
) {
  const cutoffDate = addDays(now, maxDays);
  const crew = await dbCrewStorage.getCrew(orgId, vesselId);
  const crewIds = crew.map((c) => c.id);

  if (crewIds.length === 0) {
    return [];
  }

  const allCerts = await Promise.all(
    crewIds.map((id) => dbCrewStorage.getCrewCertifications(id, orgId))
  );
  const certs = allCerts.flat();
  return certs.filter((cert) => {
    if (!cert.expiresAt) {
      return false;
    }
    const expiryDate = new Date(cert.expiresAt);
    return expiryDate <= cutoffDate;
  });
}

export async function getUnsignedLogbooks(
  orgId: string,
  vesselId: string | undefined,
  graceHours: number,
  now: Date
) {
  const graceDate = new Date(now.getTime() - graceHours * 60 * 60 * 1000);
  const deckLogs = await deckLogStorage.getDeckLogDaily(orgId, { vesselId, status: "draft" });
  const engineLogs = await engineLogStorage.getEngineLogDaily(orgId, { vesselId, status: "draft" });

  const unsignedDeck = deckLogs.filter((log) => {
    const logDate = new Date(log.logDate);
    return logDate < graceDate && !log.signedAt;
  });

  const unsignedEngine = engineLogs.filter((log) => {
    const logDate = new Date(log.logDate);
    return logDate < graceDate && !log.signedAt;
  });

  return { deck: unsignedDeck, engine: unsignedEngine };
}
