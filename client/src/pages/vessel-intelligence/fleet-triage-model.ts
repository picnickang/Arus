import {
  alertTitleFor,
  equipmentNameFor,
  vesselIdFor,
  vesselNameFor,
  workOrderTitleFor,
  type EquipmentRecord,
  type RegistrySummaryRecord,
  type VesselIntelligenceAlertRecord,
  type VesselIntelligenceWorkOrderRecord,
  type VesselRecord,
} from "./data";
import { buildFleetSectionEquipmentSummary } from "./fleet-section-equipment-model";
import type {
  FleetTriageInputs,
  FleetTriageSeverity,
  FleetTriageVessel,
  FleetTriageViewModel,
} from "./fleet-triage-types";

const CLOSED_STATUSES = new Set([
  "archived",
  "cancelled",
  "canceled",
  "closed",
  "complete",
  "completed",
  "done",
  "resolved",
]);

const WARNING_SEVERITIES = new Set(["medium", "warning", "warn", "caution", "moderate"]);
const CRITICAL_SEVERITIES = new Set(["critical", "high", "severe", "emergency"]);

function normalize(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase().replace(/\s+/g, "_") : "";
}

function titleLabel(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }
  return value
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function rawLabel(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function lastHeartbeatLabel(value: unknown, now: Date): string {
  if (!value) {
    return "No heartbeat";
  }
  const date = new Date(String(value));
  if (!Number.isFinite(date.getTime())) {
    return "No heartbeat";
  }
  const deltaHours = Math.max(0, Math.round((now.getTime() - date.getTime()) / 36e5));
  if (deltaHours < 1) {
    return "Now";
  }
  if (deltaHours < 24) {
    return `${deltaHours}h ago`;
  }
  return `${Math.round(deltaHours / 24)}d ago`;
}

function isClosedStatus(status: unknown): boolean {
  return CLOSED_STATUSES.has(normalize(status));
}

function isActiveAlert(alert: VesselIntelligenceAlertRecord): boolean {
  return !alert.acknowledged && !isClosedStatus(alert.status);
}

function alertRisk(alert: VesselIntelligenceAlertRecord): number {
  const severity = normalize(alert.severity);
  if (CRITICAL_SEVERITIES.has(severity)) {
    return 24;
  }
  if (WARNING_SEVERITIES.has(severity)) {
    return 12;
  }
  return 5;
}

function isOpenWorkOrder(workOrder: VesselIntelligenceWorkOrderRecord): boolean {
  return !isClosedStatus(workOrder.status);
}

function isOverdue(workOrder: VesselIntelligenceWorkOrderRecord, now: Date): boolean {
  if (!workOrder.dueDate || !isOpenWorkOrder(workOrder)) {
    return false;
  }
  const due = new Date(workOrder.dueDate);
  return Number.isFinite(due.getTime()) && due.getTime() < now.getTime();
}

function equipmentRisk(equipment: EquipmentRecord): number {
  const status = normalize(equipment.healthStatus ?? equipment.status);
  if (CRITICAL_SEVERITIES.has(status) || status === "down" || status === "offline") {
    return 10;
  }
  if (WARNING_SEVERITIES.has(status) || status === "degraded") {
    return 5;
  }
  return 0;
}

function severityForScore(score: number | null, hasRegistrySummary: boolean): FleetTriageSeverity {
  if (!hasRegistrySummary) {
    return "missing";
  }
  if (score === null) {
    return "missing";
  }
  if (score < 70) {
    return "critical";
  }
  if (score < 86) {
    return "warning";
  }
  return "healthy";
}

function dueLabelFor(workOrder: VesselIntelligenceWorkOrderRecord, now: Date): string {
  if (!workOrder.dueDate) {
    return "Unscheduled";
  }
  const due = new Date(workOrder.dueDate);
  if (!Number.isFinite(due.getTime())) {
    return "Unscheduled";
  }
  const deltaHours = Math.round((due.getTime() - now.getTime()) / 36e5);
  if (deltaHours < 0) {
    return `${Math.abs(deltaHours)}h overdue`;
  }
  if (deltaHours < 24) {
    return `${deltaHours}h`;
  }
  return `${Math.round(deltaHours / 24)}d`;
}

function firstSectionLabel(summary: RegistrySummaryRecord | undefined): string {
  const section =
    summary?.activeSectionMap?.sections?.[0] ?? summary?.sectionMaps?.[0]?.sections?.[0];
  return section
    ? `${String(section.sectionNo).padStart(2, "0")} ${section.name}`
    : "No section map";
}

function firstEquipmentLabel(items: EquipmentRecord[]): string {
  return items[0] ? equipmentNameFor(items[0]) : "No equipment linked";
}

function sideElevationStatus(summary: RegistrySummaryRecord | undefined): string {
  const diagram =
    summary?.diagrams.find((item) => normalize(item.diagramType) === "side_elevation") ??
    (normalize(summary?.activeDiagram?.diagramType) === "side_elevation"
      ? summary?.activeDiagram
      : undefined);
  return normalize(diagram?.status) || "not_uploaded";
}

function vesselStatus(vessel: VesselRecord, derived: FleetTriageSeverity): FleetTriageSeverity {
  const status = normalize(vessel.status);
  if (status === "offline" || status === "stale") {
    return "missing";
  }
  if (status === "warning" || status === "watch") {
    return "warning";
  }
  if (status === "critical") {
    return "critical";
  }
  return derived;
}

function buildVesselRow(
  vessel: VesselRecord,
  input: FleetTriageInputs,
  now: Date
): FleetTriageVessel {
  const vesselId = vesselIdFor(vessel);
  const vesselAlerts = input.alerts.filter(
    (alert) => alert.vesselId === vesselId && isActiveAlert(alert)
  );
  const vesselWorkOrders = input.workOrders.filter(
    (workOrder) => workOrder.vesselId === vesselId && isOpenWorkOrder(workOrder)
  );
  const vesselEquipment = input.equipment.filter((equipment) => equipment.vesselId === vesselId);
  const overdueWorkOrders = vesselWorkOrders.filter((workOrder) => isOverdue(workOrder, now));
  const summary = input.summariesByVesselId?.[vesselId];
  const hasRegistrySummary = Boolean(summary);
  const base = {
    vesselId,
    vesselName: vesselNameFor(vessel),
    vesselClassLabel: titleLabel(vessel.vesselClass, "Class not specified"),
    conditionLabel: rawLabel(vessel.condition, "Condition not specified"),
    onlineStatusLabel: rawLabel(vessel.onlineStatus ?? vessel.status, "Status not specified"),
    lastHeartbeatLabel: lastHeartbeatLabel(vessel.lastHeartbeat, now),
    sideElevationStatus: sideElevationStatus(summary),
    sectionEquipmentSummary: buildFleetSectionEquipmentSummary(summary, vesselEquipment),
  };
  const risk =
    vesselAlerts.reduce((total, alert) => total + alertRisk(alert), 0) +
    overdueWorkOrders.length * 8 +
    Math.max(0, vesselWorkOrders.length - overdueWorkOrders.length) * 3 +
    vesselEquipment.reduce((total, equipment) => total + equipmentRisk(equipment), 0) +
    (summary?.validationIssues ?? []).filter((issue) => normalize(issue.severity) === "blocker")
      .length *
      4;
  const healthScore = hasRegistrySummary ? Math.max(0, Math.min(100, 100 - risk)) : null;
  const derivedStatus = vesselStatus(vessel, severityForScore(healthScore, hasRegistrySummary));

  const highestAlert = [...vesselAlerts].sort((a, b) => alertRisk(b) - alertRisk(a))[0];
  const firstOverdue = overdueWorkOrders[0];
  const riskyEquipment = vesselEquipment.find((equipment) => equipmentRisk(equipment) > 0);

  if (highestAlert) {
    return {
      ...base,
      healthScore,
      status: derivedStatus,
      topIssue: alertTitleFor(highestAlert),
      topIssueKind: "alert",
      actionLabel: "Open alerts",
      actionHref: `/vessel-intelligence/${vesselId}/alerts`,
      sectionLabel: firstSectionLabel(summary),
      equipmentLabel: firstEquipmentLabel(vesselEquipment),
      ownerLabel: "Fleet ops",
      dueLabel: "Now",
      activeAlerts: vesselAlerts.length,
      overdueWorkOrders: overdueWorkOrders.length,
      openWorkOrders: vesselWorkOrders.length,
      linkedEquipment: vesselEquipment.length,
      hasRegistrySummary,
    };
  }

  if (firstOverdue) {
    return {
      ...base,
      healthScore,
      status: derivedStatus,
      topIssue: workOrderTitleFor(firstOverdue),
      topIssueKind: "work_order",
      actionLabel: "Review WO",
      actionHref: `/vessel-intelligence/${vesselId}/maintenance`,
      sectionLabel: firstSectionLabel(summary),
      equipmentLabel: firstEquipmentLabel(vesselEquipment),
      ownerLabel: "Chief Eng",
      dueLabel: dueLabelFor(firstOverdue, now),
      activeAlerts: vesselAlerts.length,
      overdueWorkOrders: overdueWorkOrders.length,
      openWorkOrders: vesselWorkOrders.length,
      linkedEquipment: vesselEquipment.length,
      hasRegistrySummary,
    };
  }

  if (riskyEquipment) {
    return {
      ...base,
      healthScore,
      status: derivedStatus,
      topIssue: `${equipmentNameFor(riskyEquipment)} status needs review`,
      topIssueKind: "equipment",
      actionLabel: "Open section",
      actionHref: `/vessel-intelligence/${vesselId}/sections`,
      sectionLabel: firstSectionLabel(summary),
      equipmentLabel: equipmentNameFor(riskyEquipment),
      ownerLabel: "Technical",
      dueLabel: "Today",
      activeAlerts: vesselAlerts.length,
      overdueWorkOrders: overdueWorkOrders.length,
      openWorkOrders: vesselWorkOrders.length,
      linkedEquipment: vesselEquipment.length,
      hasRegistrySummary,
    };
  }

  if (!hasRegistrySummary) {
    return {
      ...base,
      healthScore,
      status: "missing",
      topIssue: "Vessel intelligence data unavailable",
      topIssueKind: "data",
      actionLabel: "Check data",
      actionHref: `/vessel-intelligence/${vesselId}/overview`,
      sectionLabel: "No section map",
      equipmentLabel: firstEquipmentLabel(vesselEquipment),
      ownerLabel: "Tech",
      dueLabel: "Now",
      activeAlerts: vesselAlerts.length,
      overdueWorkOrders: overdueWorkOrders.length,
      openWorkOrders: vesselWorkOrders.length,
      linkedEquipment: vesselEquipment.length,
      hasRegistrySummary,
    };
  }

  return {
    ...base,
    healthScore,
    status: derivedStatus,
    topIssue: "No active critical alerts",
    topIssueKind: "none",
    actionLabel: "Open twin",
    actionHref: `/vessel-intelligence/${vesselId}/overview`,
    sectionLabel: firstSectionLabel(summary),
    equipmentLabel: firstEquipmentLabel(vesselEquipment),
    ownerLabel: "Fleet ops",
    dueLabel: "Clear",
    activeAlerts: vesselAlerts.length,
    overdueWorkOrders: overdueWorkOrders.length,
    openWorkOrders: vesselWorkOrders.length,
    linkedEquipment: vesselEquipment.length,
    hasRegistrySummary,
  };
}

export function buildFleetTriageViewModel(input: FleetTriageInputs): FleetTriageViewModel {
  const now = input.now ?? new Date();
  const vessels = input.vessels
    .map((vessel) => buildVesselRow(vessel, input, now))
    .sort((a, b) => {
      const statusRank: Record<FleetTriageSeverity, number> = {
        critical: 0,
        warning: 1,
        missing: 2,
        healthy: 3,
      };
      const statusDelta = statusRank[a.status] - statusRank[b.status];
      if (statusDelta !== 0) {
        return statusDelta;
      }
      return (a.healthScore ?? -1) - (b.healthScore ?? -1);
    });

  const actionRows = vessels.filter((vessel) => vessel.topIssueKind !== "none");
  const openAlerts = vessels.reduce((total, vessel) => total + vessel.activeAlerts, 0);
  const overdueWorkOrders = vessels.reduce((total, vessel) => total + vessel.overdueWorkOrders, 0);
  const openWorkOrders = vessels.reduce((total, vessel) => total + vessel.openWorkOrders, 0);
  const missingFeeds = vessels.filter((vessel) => !vessel.hasRegistrySummary).length;
  const scored = vessels.filter((vessel) => vessel.healthScore !== null);
  const avgHealth =
    scored.length > 0
      ? Math.round(
          scored.reduce((total, vessel) => total + (vessel.healthScore ?? 0), 0) / scored.length
        )
      : null;
  const dataFreshnessPercent =
    vessels.length > 0
      ? Math.round(((vessels.length - missingFeeds) / vessels.length) * 100)
      : null;

  return {
    vessels,
    priorityVesselId: vessels[0]?.vesselId ?? "",
    actionRows,
    hasData: vessels.length > 0,
    dataFreshnessPercent,
    queue: [
      {
        id: "technical-alerts",
        label: "Open technical alerts",
        value: openAlerts,
        severity: openAlerts > 0 ? "critical" : "healthy",
        href: "/attention-inbox",
      },
      {
        id: "overdue-work-orders",
        label: "Overdue work orders",
        value: overdueWorkOrders,
        severity: overdueWorkOrders > 0 ? "warning" : "healthy",
        href: "/work-orders",
      },
      {
        id: "open-work",
        label: "Open technical work",
        value: openWorkOrders,
        severity: openWorkOrders > 0 ? "warning" : "healthy",
        href: "/work-orders",
      },
      {
        id: "missing-data",
        label: "Missing data feeds",
        value: missingFeeds,
        severity: missingFeeds > 0 ? "missing" : "healthy",
        href: "/fleet",
      },
    ],
    kpis: [
      {
        id: "avg-health",
        label: "Avg Health",
        value: avgHealth === null ? "No data" : String(avgHealth),
        trendLabel: avgHealth === null ? "Missing" : avgHealth >= 86 ? "Stable" : "Watch",
        severity: avgHealth === null ? "missing" : avgHealth >= 86 ? "healthy" : "warning",
      },
      {
        id: "open-alerts",
        label: "Open Alerts",
        value: String(openAlerts),
        trendLabel: openAlerts > 0 ? "Needs triage" : "Clear",
        severity: openAlerts > 0 ? "critical" : "healthy",
      },
      {
        id: "open-cases",
        label: "Open Work",
        value: String(openWorkOrders),
        trendLabel: overdueWorkOrders > 0 ? `${overdueWorkOrders} overdue` : "On track",
        severity: overdueWorkOrders > 0 ? "warning" : "healthy",
      },
      {
        id: "data-freshness",
        label: "Data Freshness",
        value: dataFreshnessPercent === null ? "No data" : `${dataFreshnessPercent}%`,
        trendLabel: missingFeeds > 0 ? "Partial" : "Live",
        severity: missingFeeds > 0 ? "missing" : "healthy",
      },
    ],
    markers: vessels.map((vessel, index) => ({
      vesselId: vessel.vesselId,
      vesselName: vessel.vesselName,
      status: vessel.status,
      x: 16 + ((index * 23) % 70),
      y: 14 + ((index * 17) % 36),
      href: vessel.actionHref,
    })),
  };
}
