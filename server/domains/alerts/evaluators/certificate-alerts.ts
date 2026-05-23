/**
 * Crew Alert Evaluators - Certificate Expiry
 * Evaluates certificate expiry alerts using data-driven threshold matching
 */

import { differenceInDays } from "date-fns";
import { alertSettingsService } from "../settings-service.js";
import type { CrewAlertResult, EvaluationContext } from "./types.js";
import { getCertificationsNearExpiry } from "./helpers.js";

interface AlertThreshold {
  days: number;
  minDays: number;
  alertType: string;
  severity: "critical" | "warning" | "info";
  titleTemplate: string;
  settingKey: string;
  alertSentKey?: string;
}

function buildAlertThresholds(customDays?: number | null): AlertThreshold[] {
  const thresholds: AlertThreshold[] = [
    {
      days: 0,
      minDays: -Infinity,
      alertType: "cert_expiry",
      severity: "critical",
      titleTemplate: "Certificate Expired",
      settingKey: "always",
    },
    {
      days: 30,
      minDays: 1,
      alertType: "cert_expiry_30",
      severity: "critical",
      titleTemplate: "Certificate Expiring in 30 Days",
      settingKey: "certExpiryDays30",
      alertSentKey: "alertSent30",
    },
    {
      days: 60,
      minDays: 31,
      alertType: "cert_expiry_60",
      severity: "warning",
      titleTemplate: "Certificate Expiring in 60 Days",
      settingKey: "certExpiryDays60",
      alertSentKey: "alertSent60",
    },
    {
      days: 90,
      minDays: 61,
      alertType: "cert_expiry_90",
      severity: "info",
      titleTemplate: "Certificate Expiring in 90 Days",
      settingKey: "certExpiryDays90",
      alertSentKey: "alertSent90",
    },
  ];
  if (customDays && customDays > 90) {
    thresholds.push({
      days: customDays,
      minDays: 91,
      alertType: "cert_expiry_custom",
      severity: "info",
      titleTemplate: `Certificate Expiring in ${customDays} Days`,
      settingKey: "certExpiryCustomDays",
    });
  }
  return thresholds;
}

type CertificateAlertSettings = Record<string, unknown>;
type CertificateRow = Record<string, unknown> & {
  id: string;
  cert: string;
  crewId: string;
  certNumber?: string | null;
  expiresAt: Date | string;
};

function findMatchingThreshold(
  daysUntilExpiry: number,
  thresholds: AlertThreshold[],
  settings: CertificateAlertSettings,
  cert: CertificateRow
): AlertThreshold | null {
  for (const threshold of thresholds) {
    if (daysUntilExpiry > threshold.days) {
      continue;
    }
    if (daysUntilExpiry < threshold.minDays) {
      continue;
    }
    if (threshold.settingKey !== "always" && !settings[threshold.settingKey]) {
      continue;
    }
    if (threshold.alertSentKey && cert[threshold.alertSentKey]) {
      continue;
    }
    return threshold;
  }
  return null;
}

function buildAlertResult(
  cert: CertificateRow,
  daysUntilExpiry: number,
  threshold: AlertThreshold,
  customDays?: number | null
): CrewAlertResult {
  const isExpired = daysUntilExpiry <= 0;
  return {
    triggered: true,
    alertType: threshold.alertType,
    alertKey: `${threshold.alertType}_${cert.id}`,
    severity: threshold.severity,
    title: threshold.titleTemplate,
    message: isExpired
      ? `${cert.cert} certificate for crew member has expired`
      : `${cert.cert} certificate expires in ${daysUntilExpiry} days`,
    entityId: cert.id,
    entityType: "certificate",
    metadata: {
      crewId: cert.crewId,
      certType: cert.cert,
      certNumber: cert.certNumber,
      expiresAt: cert.expiresAt,
      ...(isExpired
        ? { daysExpired: Math.abs(daysUntilExpiry) }
        : { daysRemaining: daysUntilExpiry }),
      ...(threshold.alertType === "cert_expiry_custom" && customDays
        ? { customThreshold: customDays }
        : {}),
    },
  };
}

export async function evaluateCertificateExpiryAlerts(
  ctx: EvaluationContext
): Promise<CrewAlertResult[]> {
  const now = ctx.now || new Date();
  const settings = await alertSettingsService.getCrewAlertSettings(ctx.orgId, (ctx.vesselId ?? undefined));
  if (!settings?.certExpiryAlertsEnabled) {
    return [];
  }

  const thresholds = buildAlertThresholds(settings.certExpiryCustomDays);
  const maxDays = Math.max(...thresholds.map((t) => t.days));
  const certifications = await getCertificationsNearExpiry(ctx.orgId, ctx.vesselId, now, maxDays);

  const results: CrewAlertResult[] = [];
  const settingsRecord = settings as unknown as CertificateAlertSettings;
  for (const certRaw of certifications) {
    const cert = certRaw as unknown as CertificateRow;
    const daysUntilExpiry = differenceInDays(new Date(cert.expiresAt), now);
    const matchedThreshold = findMatchingThreshold(
      daysUntilExpiry,
      thresholds,
      settingsRecord,
      cert
    );
    if (matchedThreshold) {
      results.push(
        buildAlertResult(cert, daysUntilExpiry, matchedThreshold, settings.certExpiryCustomDays)
      );
    }
  }
  return results;
}
