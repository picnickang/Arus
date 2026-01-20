/**
 * Crew Alert Evaluators - Helpers
 * Utility functions for alert evaluation
 */

import { storage } from "../../../storage.js";
import { addDays } from "date-fns";

const severityMap: Record<string, "info" | "warning" | "critical"> = {
  critical: "critical",
  warning: "warning",
};

export function getSeverityFromMinSeverity(minSeverity?: string): "info" | "warning" | "critical" {
  return minSeverity ? (severityMap[minSeverity] ?? "info") : "info";
}

export async function getCertificationsNearExpiry(orgId: string, vesselId: string | undefined, now: Date, maxDays: number) {
  const cutoffDate = addDays(now, maxDays);
  const crew = vesselId ? await storage.getCrewByVessel(vesselId) : await storage.getCrew(orgId);
  const crewIds = crew.map((c: any) => c.id);
  
  if (crewIds.length === 0) { return []; }
  
  const certs = await storage.getCrewCertificationsByCrewIds(crewIds, orgId);
  return certs.filter((cert: any) => {
    if (!cert.expiresAt) { return false; }
    const expiryDate = new Date(cert.expiresAt);
    return expiryDate <= cutoffDate;
  });
}

export async function getUnsignedLogbooks(orgId: string, vesselId: string | undefined, graceHours: number, now: Date) {
  const graceDate = new Date(now.getTime() - graceHours * 60 * 60 * 1000);
  const deckLogs = await storage.getDeckLogDaily(orgId, { vesselId, status: "draft" });
  const engineLogs = await storage.getEngineLogDaily(orgId, { vesselId, status: "draft" });
  
  const unsignedDeck = deckLogs.filter((log: any) => {
    const logDate = new Date(log.logDate);
    return logDate < graceDate && !log.signedAt;
  });
  
  const unsignedEngine = engineLogs.filter((log: any) => {
    const logDate = new Date(log.logDate);
    return logDate < graceDate && !log.signedAt;
  });
  
  return { deck: unsignedDeck, engine: unsignedEngine };
}
