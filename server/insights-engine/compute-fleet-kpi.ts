/**
 * Fleet KPI Computation
 *
 * Compute comprehensive fleet insights using ARUS data.
 */

import { createLogger } from "../lib/structured-logger";
const logger = createLogger("InsightsEngine:ComputeFleetKpi");
import {
  dbDevicesStorage,
  dbEquipmentStorage,
  dbAlertStorage,
  dbTelemetryStorage,
  vesselService,
} from "../repositories";
import type { FleetKPI, InsightBundle } from "./types.js";

/**
 * Compute comprehensive fleet insights using existing ARUS data
 */
export async function computeInsights(
  scope: "fleet" | string = "fleet",
  orgId: string = "default-org-id"
): Promise<InsightBundle> {
  const now = new Date();
  const since7d = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const staleCutoff = new Date(now.getTime() - 30 * 60 * 1000);

  try {
    const [devices, equipment, alerts, telemetryReadings, sensorMappings, allVessels] =
      await Promise.all([
        dbDevicesStorage.getDevices(orgId),
        dbEquipmentStorage.getEquipmentRegistry(orgId),
        dbAlertStorage.getAlertNotifications(undefined, orgId),
        dbTelemetryStorage.getLatestTelemetryReadings(undefined, 1000, undefined, undefined),
        [] as Array<{ id: string }>,
        vesselService.getVessels(orgId),
      ]);

    const vessels = allVessels.length;

    const signalsMapped = sensorMappings.length
      ? sensorMappings.length
      : devices.reduce((sum, d) => {
          const sensorsRaw = typeof d.sensors === "string" ? d.sensors : "";
          const set = new Set(
            sensorsRaw
              .split(",")
              .map((s: string) => s.trim())
              .filter(Boolean)
          );
          return sum + set.size;
        }, 0);

    const signalsDiscovered =
      telemetryReadings.length > 0
        ? new Set(telemetryReadings.map((t) => `${t.equipmentId}-${t.sensorType}`)).size
        : 0;

    const recentAlerts = alerts.filter((a) => (a.createdAt?.getTime() ?? 0) > since7d.getTime());
    const dq7d = recentAlerts.length;

    const perVessel: FleetKPI["perVessel"] = {};
    const latestGapVessels: string[] = [];

    const eqIndex = new Map(
      equipment.map((e) => [
        e.id,
        { vesselId: e.vesselId ?? "unassigned", vesselName: e.vesselName ?? "Unassigned" },
      ])
    );

    type VesselBucket = { name: string; points: typeof telemetryReadings };
    const vesselTelemetry = new Map<string, VesselBucket>();

    for (const t of telemetryReadings) {
      const meta = eqIndex.get(t.equipmentId) ?? {
        vesselId: "unassigned",
        vesselName: "Unassigned",
      };
      if (!vesselTelemetry.has(meta.vesselId)) {
        vesselTelemetry.set(meta.vesselId, { name: meta.vesselName, points: [] });
      }
      vesselTelemetry.get(meta.vesselId)!.points.push(t);
    }

    vesselTelemetry.forEach(({ name, points }, vId) => {
      if (!vId || vId === "unassigned") {
        return;
      }

      const latestReading = points.reduce(
        (a, b) => (a && new Date(a.ts) > new Date(b.ts) ? a : b),
        points[0]
      );
      const lastTsISO = latestReading ? new Date(latestReading.ts).toISOString() : null;
      const stale = lastTsISO ? new Date(lastTsISO) < staleCutoff : true;

      if (stale) {
        latestGapVessels.push(name);
      }

      const vesselAlerts = recentAlerts.filter((a) => {
        const alertEq = equipment.find((e) => e.id === a.equipmentId);
        return alertEq?.vesselId === vId;
      });

      const vesselEquipment = equipment.filter((e) => e.vesselId === vId);
      const totalSignals = vesselEquipment.reduce((sum, eq) => {
        const eqReadings = points.filter((r) => r.equipmentId === eq.id);
        return sum + new Set(eqReadings.map((r) => r.sensorType)).size;
      }, 0);

      perVessel[vId] = {
        vesselName: name,
        lastTs: lastTsISO,
        dq7d: vesselAlerts.length,
        totalSignals,
        stale,
      };
    });

    const kpi: FleetKPI = {
      fleet: { vessels, signalsMapped, signalsDiscovered, dq7d, latestGapVessels },
      perVessel,
    };

    const risks = { critical: [] as string[], warnings: [] as string[] };

    if (latestGapVessels.length > 0) {
      risks.critical.push(
        `Stale telemetry on: ${latestGapVessels.join(", ")} (no updates >30 min)`
      );
    }

    const criticalAlerts = recentAlerts.filter((a) => a.alertType === "critical");
    if (criticalAlerts.length > 0) {
      risks.critical.push(`${criticalAlerts.length} critical alerts in last 7 days`);
    }

    const warningAlerts = recentAlerts.filter((a) => a.alertType === "warning");
    if (warningAlerts.length > 0) {
      risks.warnings.push(`${warningAlerts.length} warning alerts in last 7 days`);
    }

    const equipment_health = await dbEquipmentStorage.getEquipmentHealth(orgId, {});
    const unhealthyEquipment = equipment_health.filter((eq) => eq.healthIndex < 70);
    if (unhealthyEquipment.length > 0) {
      risks.warnings.push(`${unhealthyEquipment.length} equipment units with health <70%`);
    }

    const recommendations: string[] = [];

    if (latestGapVessels.length > 0) {
      recommendations.push(
        "Check connectivity/ingest on stale vessels; verify edge device status."
      );
    }

    if (dq7d > 0) {
      recommendations.push("Review alert configurations; investigate sensor threshold settings.");
    }

    if (signalsDiscovered > signalsMapped) {
      recommendations.push(
        "Map newly discovered signals to improve sensor coverage and analytics."
      );
    }

    if (unhealthyEquipment.length > 0) {
      recommendations.push(
        "Schedule predictive maintenance for equipment with declining health scores."
      );
    }

    const anomalies = criticalAlerts.slice(0, 20).map((alert) => {
      const created = alert.createdAt ?? now;
      const ack = alert.acknowledgedAt ?? now;
      const alertEquipment = equipment.find((e) => e.id === alert.equipmentId);
      return {
        vesselId: alertEquipment?.vesselId || "unassigned",
        src: alert.equipmentId,
        sig: alert.sensorType,
        kind: "threshold_breach",
        severity: alert.alertType,
        tStart: Number.isNaN(created.getTime()) ? now.toISOString() : created.toISOString(),
        tEnd: Number.isNaN(ack.getTime()) ? now.toISOString() : ack.toISOString(),
      };
    });

    const compliance = { notes: [] as string[] };

    if (latestGapVessels.length > 0) {
      compliance.notes.push("Data gaps may affect compliance reporting and audit readiness.");
    }

    logger.info(
      String(
        JSON.stringify({
          msg: "insights_compute_done",
          orgId,
          vessels,
          dq7d,
          staleCount: latestGapVessels.length,
          signalsMapped,
          signalsDiscovered,
          t_ms: Date.now() - now.getTime(),
        })
      )
    );

    return { kpi, risks, recommendations, anomalies, compliance };
  } catch (error) {
    logger.error("Insights computation error:", undefined, error);

    return {
      kpi: {
        fleet: {
          vessels: 0,
          signalsMapped: 0,
          signalsDiscovered: 0,
          dq7d: 0,
          latestGapVessels: [],
        },
        perVessel: {},
      },
      risks: { critical: ["Unable to compute insights"], warnings: [] },
      recommendations: ["Check system connectivity and data availability"],
      anomalies: [],
      compliance: { notes: ["Insights computation failed - verify system status"] },
    };
  }
}
