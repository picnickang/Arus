/**
 * Crew Task Infrastructure - Effects Adapter
 * Implements ICrewTaskEffects: immutable audit trail, assignee
 * notifications (queued, durable), and websocket broadcast.
 *
 * Every effect is wrapped so it can NEVER throw — a failed notification or
 * broadcast must not roll back the task mutation that triggered it.
 */

import type { ICrewTaskEffects } from "../domain/ports";
import type { CrewTaskEntity, CrewTaskActor } from "../domain/types";
import { db } from "../../../db";
import { crew, notificationQueue } from "@shared/schema";
import { and, eq } from "drizzle-orm";
import { auditService, type AuditEventType } from "../../../compliance/immutable-audit";
import { getWebSocketServer } from "../../../websocket-server";
import { log } from "../../../lib/structured-logger";

type AssignmentNoticeKind = "assignment" | "status";

export class CrewTaskEffectsAdapter implements ICrewTaskEffects {
  async onCreated(task: CrewTaskEntity, actor?: CrewTaskActor): Promise<void> {
    await this.audit("create", task, actor, undefined, this.snapshot(task), []);
    this.broadcast("crew_task.created", task);
    if (task.assignedCrewId) {
      await this.enqueueAssignmentNotice(task, "assignment");
    }
  }

  async onUpdated(
    before: CrewTaskEntity,
    after: CrewTaskEntity,
    changedFields: string[],
    actor?: CrewTaskActor,
  ): Promise<void> {
    await this.audit(
      "update",
      after,
      actor,
      this.snapshot(before),
      this.snapshot(after),
      changedFields,
    );
    this.broadcast("crew_task.updated", after);

    const reassigned =
      changedFields.includes("assignedCrewId") && !!after.assignedCrewId;
    const statusChanged = changedFields.includes("status");
    if ((reassigned || statusChanged) && after.assignedCrewId) {
      await this.enqueueAssignmentNotice(
        after,
        reassigned ? "assignment" : "status",
      );
    }
  }

  async onDeleted(task: CrewTaskEntity, actor?: CrewTaskActor): Promise<void> {
    await this.audit("delete", task, actor, this.snapshot(task), undefined, []);
    this.broadcast("crew_task.deleted", task);
  }

  private snapshot(task: CrewTaskEntity): Record<string, unknown> {
    return {
      id: task.id,
      vesselId: task.vesselId,
      assignedCrewId: task.assignedCrewId,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      blockedReason: task.blockedReason,
    };
  }

  private async audit(
    eventType: Extract<AuditEventType, "create" | "update" | "delete">,
    task: CrewTaskEntity,
    actor: CrewTaskActor | undefined,
    previousState: Record<string, unknown> | undefined,
    newState: Record<string, unknown> | undefined,
    changedFields: string[],
  ): Promise<void> {
    try {
      await auditService.logEvent({
        orgId: task.orgId,
        eventCategory: "data_modification",
        eventType,
        entityType: "crew_task",
        entityId: task.id,
        previousState,
        newState,
        changedFields: changedFields.length > 0 ? changedFields : undefined,
        performedBy: actor?.id ?? task.createdBy ?? "system",
        performedByType: actor?.id ? "user" : "system",
        performedByName: actor?.name,
        performedByRole: actor?.role,
        vesselId: task.vesselId ?? undefined,
      });
    } catch (err) {
      log("warn", "CrewTasks", "audit log failed", {
        taskId: task.id,
        error: String(err),
      });
    }
  }

  private broadcast(channel: string, task: CrewTaskEntity): void {
    try {
      getWebSocketServer()?.broadcast(channel, { task }, task.orgId);
    } catch (err) {
      log("warn", "CrewTasks", "broadcast failed", {
        taskId: task.id,
        error: String(err),
      });
    }
  }

  private async enqueueAssignmentNotice(
    task: CrewTaskEntity,
    kind: AssignmentNoticeKind,
  ): Promise<void> {
    try {
      if (!task.assignedCrewId) return;

      const [member] = await db
        .select({ name: crew.name, email: crew.email })
        .from(crew)
        .where(and(eq(crew.orgId, task.orgId), eq(crew.id, task.assignedCrewId)))
        .limit(1);

      const recipients = member?.email ? [member.email] : [];
      const subject =
        kind === "status"
          ? `Task status updated: ${task.title}`
          : `New task assigned: ${task.title}`;
      const body =
        kind === "status"
          ? `The task "${task.title}" is now "${task.status}".`
          : `You have been assigned the task "${task.title}" (priority: ${task.priority}).`;

      await db.insert(notificationQueue).values({
        orgId: task.orgId,
        notificationType:
          kind === "status" ? "crew_task_status" : "crew_task_assigned",
        subject,
        body,
        recipients,
        relatedEntityType: "crew_task",
        relatedEntityId: task.id,
      });
    } catch (err) {
      log("warn", "CrewTasks", "notification enqueue failed", {
        taskId: task.id,
        error: String(err),
      });
    }
  }
}

export const crewTaskEffects = new CrewTaskEffectsAdapter();
