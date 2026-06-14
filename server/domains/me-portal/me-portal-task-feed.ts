import {
  dbAlertStorage,
  dbMaintenanceStorage,
  workOrderService,
} from "../../repositories";
import { crewAdminService } from "../../services/crew-admin-facade";
import { crewTaskService } from "../../services/crew-task-facade";
import type { UserAlarmScope } from "../../services/safety-alarm-facade";
import type { VesselAssignmentEntity } from "../../services/crew-admin-facade";
import { getCrewLinkId } from "./infrastructure/me-portal-queries";
import { scopeForSource, type VisibilityScope } from "@shared/role-dashboard";
import type { MeUser, TaskItem } from "./me-portal-service";

type ScopeResolver = (
  assignments: VesselAssignmentEntity[],
  scope: VisibilityScope | null
) => UserAlarmScope;

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** Normalize a priority field that may arrive as a string or a numeric rank. */
function asPriority(value: unknown): string | null {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return null;
}

export async function buildMePortalTasks(
  user: MeUser,
  resolveScope: ScopeResolver
): Promise<TaskItem[]> {
  const configs = await crewAdminService.resolveEffectiveConfigList(user.orgId, user.id, user.role);
  const assignments = await crewAdminService.getAssignments(user.orgId, user.id);
  const sources = new Set(configs.flatMap((c) => c.taskSources));
  const items: TaskItem[] = [];

  if (sources.has("work_orders")) {
    const scope = resolveScope(assignments, scopeForSource(configs, "work_orders"));
    const workOrders = (await workOrderService.getWorkOrdersWithDetails(
      undefined,
      user.orgId
    )) as unknown[];
    for (const raw of workOrders) {
      if (typeof raw !== "object" || raw === null) {
        continue;
      }
      const wo = raw as Record<string, unknown>;
      const vesselId = asString(wo["vesselId"]);
      if (!scope.fleetWide && vesselId && !scope.vesselIds.includes(vesselId)) {
        continue;
      }
      const id = asString(wo["id"]);
      if (!id) {
        continue;
      }
      items.push({
        id,
        source: "work_orders",
        title: asString(wo["title"]) ?? asString(wo["description"]) ?? "Work order",
        status: asString(wo["status"]),
        priority: asString(wo["priority"]),
        vesselId,
        link: `/work-orders?id=${id}`,
      });
    }
  }

  if (sources.has("maintenance_schedules")) {
    const scope = resolveScope(assignments, scopeForSource(configs, "maintenance_schedules"));
    const schedules = (await dbMaintenanceStorage.getMaintenanceSchedules(
      undefined,
      user.orgId
    )) as unknown[];
    for (const raw of schedules) {
      if (typeof raw !== "object" || raw === null) {
        continue;
      }
      const row = raw as Record<string, unknown>;
      const vesselId = asString(row["vesselId"]);
      if (!scope.fleetWide && vesselId && !scope.vesselIds.includes(vesselId)) {
        continue;
      }
      const id = asString(row["id"]);
      if (!id) {
        continue;
      }
      items.push({
        id,
        source: "maintenance_schedules",
        title:
          asString(row["description"]) ??
          asString(row["maintenanceType"]) ??
          "Maintenance schedule",
        status: asString(row["status"]),
        priority: asPriority(row["priority"]),
        vesselId,
        link: `/maintenance?id=${id}`,
      });
    }
  }

  if (sources.has("alerts")) {
    const scope = resolveScope(assignments, scopeForSource(configs, "alerts"));
    const alerts = (await dbAlertStorage.getAlertNotifications(false, user.orgId)) as unknown[];
    for (const raw of alerts) {
      if (typeof raw !== "object" || raw === null) {
        continue;
      }
      const row = raw as Record<string, unknown>;
      const vesselId = asString(row["vesselId"]);
      if (!scope.fleetWide && vesselId && !scope.vesselIds.includes(vesselId)) {
        continue;
      }
      const id = asString(row["id"]);
      if (!id) {
        continue;
      }
      items.push({
        id,
        source: "alerts",
        title: asString(row["title"]) ?? asString(row["message"]) ?? "Alert",
        status: row["acknowledged"] === true ? "acknowledged" : "active",
        priority: asString(row["severity"]) ?? asString(row["alertType"]),
        vesselId,
        link: `/alerts?id=${id}`,
      });
    }
  }

  if (sources.has("crew_tasks")) {
    const crewMember = await getCrewLinkId(user.orgId, user.id);
    if (crewMember) {
      const tasks = await crewTaskService.listTasks(user.orgId, {
        assignedCrewId: crewMember.id,
      });
      for (const task of tasks) {
        items.push({
          id: task.id,
          source: "crew_tasks",
          title: task.title,
          status: task.status,
          priority: task.priority,
          vesselId: task.vesselId,
          link: `/crew-management?taskId=${task.id}`,
        });
      }
    }
  }

  return items;
}
