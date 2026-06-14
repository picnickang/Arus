/**
 * Crew Alert Evaluators - Helpers
 * Utility functions for alert evaluation
 */

import { deckLogStorage, engineLogStorage } from "../../../repositories";
import { addDays } from "date-fns";
import type { ICrewAlertDataPort } from "./types.js";

const severityMap: Record<string, "info" | "warning" | "critical"> = {
  critical: "critical",
  warning: "warning",
};

export function getSeverityFromMinSeverity(minSeverity?: string): "info" | "warning" | "critical" {
  return minSeverity ? (severityMap[minSeverity] ?? "info") : "info";
}

export async function getCertificationsNearExpiry(
  crew: ICrewAlertDataPort,
  orgId: string,
  vesselId: string | undefined,
  now: Date,
  maxDays: number
) {
  const cutoffDate = addDays(now, maxDays);
  const crewMembers = await crew.getCrew(orgId, vesselId);
  const crewIds = crewMembers.map((c) => c.id);

  if (crewIds.length === 0) {
    return [];
  }

  const allCerts = await Promise.all(
    crewIds.map((id) => crew.getCrewCertifications(id, orgId))
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
