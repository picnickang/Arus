/**
 * Crew Task Infrastructure - Effects Adapter
 * Implements ICrewTaskEffects: immutable audit trail, assignee
 * notifications (queued, durable), and websocket broadcast.
 *
 * Every effect is wrapped so it can NEVER throw — a failed notification or
 * broadcast must not roll back the task mutation that triggered it.
 */

import type { ICrewTaskEffects, ICrewTaskEventRepository } from "../domain/ports";
import type { CrewTaskEntity, CrewTaskActor, CrewTaskEventEntity } from "../domain/types";
import { db } from "../../../db";
import { crew, notificationQueue } from "@shared/schema-runtime";
import { and, eq } from "drizzle-orm";
import { auditService, type AuditEventType } from "../../../compliance/immutable-audit";
import { getWebSocketServer } from "../../../websocket-server";
import { log } from "../../../lib/structured-logger";
import { crewTaskEventRepository } from "./crew-task-event-repository-adapter";

type AssignmentNoticeKind = "assignment" | "status";

export class CrewTaskEffectsAdapter implements ICrewTaskEffects {
  constructor(private readonly eventRepo: ICrewTaskEventRepository = crewTaskEventRepository) {}

  async onCreated(task: CrewTaskEntity, actor?: CrewTaskActor): Promise<void> {
    await this.audit("create", task, actor, undefined, this.snapshot(task), []);
    await this.recordEvent(task, "created", "Task created", actor);
    this.broadcast("crew_task.created", task);
    if (task.assignedCrewId) {
      await this.enqueueAssignmentNotice(task, "assignment");
    }
  }

  async onUpdated(
    before: CrewTaskEntity,
    after: CrewTaskEntity,
    changedFields: string[],
    actor?: CrewTaskActor
  ): Promise<void> {
    await this.audit(
      "update",
      after,
      actor,
      this.snapshot(before),
      this.snapshot(after),
      changedFields
    );
    await this.recordChangeEvents(before, after, changedFields, actor);
    this.broadcast("crew_task.updated", after);

    const reassigned = changedFields.includes("assignedCrewId") && !!after.assignedCrewId;
    const statusChanged = changedFields.includes("status");
    if ((reassigned || statusChanged) && after.assignedCrewId) {
      await this.enqueueAssignmentNotice(after, reassigned ? "assignment" : "status");
    }
  }

  async onDeleted(task: CrewTaskEntity, actor?: CrewTaskActor): Promise<void> {
    await this.audit("delete", task, actor, this.snapshot(task), undefined, []);
    this.broadcast("crew_task.deleted", task);
  }

  async onCommented(
    task: CrewTaskEntity,
    event: CrewTaskEventEntity,
    _actor?: CrewTaskActor
  ): Promise<void> {
    this.broadcast("crew_task.commented", task, { eventId: event.id });
  }

  /** Persist auto system events for the meaningful field changes. */
  private async recordChangeEvents(
    before: CrewTaskEntity,
    after: CrewTaskEntity,
    changedFields: string[],
    actor?: CrewTaskActor
  ): Promise<void> {
    if (changedFields.includes("status")) {
      await this.recordEvent(
        after,
        "status_changed",
        `Status changed from "${before.status}" to "${after.status}"`,
        actor,
        { from: before.status, to: after.status }
      );
    }
    if (changedFields.includes("assignedCrewId")) {
      const name = await this.crewName(after.orgId, after.assignedCrewId);
      const message = after.assignedCrewId
        ? `Reassigned to ${name ?? "a crew member"}`
        : "Unassigned";
      await this.recordEvent(after, "reassigned", message, actor, {
        from: before.assignedCrewId,
        to: after.assignedCrewId,
      });
    }
    if (changedFields.includes("assignedTo")) {
      const message = after.assignedTo ? `Owner set to ${after.assignedTo}` : "Owner cleared";
      await this.recordEvent(after, "owner_changed", message, actor, {
        from: before.assignedTo,
        to: after.assignedTo,
      });
    }
    if (changedFields.includes("linkedSourceId") || changedFields.includes("linkedSourceType")) {
      const message = after.linkedSourceId
        ? `Linked to ${after.linkedSourceLabel ?? after.linkedSourceType ?? "a source"}`
        : "Linked source removed";
      await this.recordEvent(after, "linked_source", message, actor, {
        type: after.linkedSourceType,
        id: after.linkedSourceId,
        label: after.linkedSourceLabel,
      });
    }
  }

  private async recordEvent(
    task: CrewTaskEntity,
    eventType: string,
    message: string,
    actor: CrewTaskActor | undefined,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      await this.eventRepo.add({
        orgId: task.orgId,
        taskId: task.id,
        eventType,
        message,
        actorId: actor?.id,
        actorName: actor?.name,
        actorRole: actor?.role,
        metadata,
      });
    } catch (err) {
      log("warn", "CrewTasks", "activity event write failed", {
        taskId: task.id,
        eventType,
        error: String(err),
      });
    }
  }

  private async crewName(orgId: string, crewId: string | null): Promise<string | null> {
    if (!crewId) {
      return null;
    }
    try {
      const [member] = await db
        .select({ name: crew.name })
        .from(crew)
        .where(and(eq(crew.orgId, orgId), eq(crew.id, crewId)))
        .limit(1);
      return member?.name ?? null;
    } catch {
      return null;
    }
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
      assignedTo: task.assignedTo,
      linkedSourceType: task.linkedSourceType,
      linkedSourceId: task.linkedSourceId,
      linkedSourceLabel: task.linkedSourceLabel,
    };
  }

  private async audit(
    eventType: Extract<AuditEventType, "create" | "update" | "delete">,
    task: CrewTaskEntity,
    actor: CrewTaskActor | undefined,
    previousState: Record<string, unknown> | undefined,
    newState: Record<string, unknown> | undefined,
    changedFields: string[]
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

  private broadcast(channel: string, task: CrewTaskEntity, extra?: Record<string, unknown>): void {
    try {
      getWebSocketServer()?.broadcast(channel, { task, ...extra }, task.orgId);
    } catch (err) {
      log("warn", "CrewTasks", "broadcast failed", {
        taskId: task.id,
        error: String(err),
      });
    }
  }

  private async enqueueAssignmentNotice(
    task: CrewTaskEntity,
    kind: AssignmentNoticeKind
  ): Promise<void> {
    try {
      if (!task.assignedCrewId) {
        return;
      }

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
        notificationType: kind === "status" ? "crew_task_status" : "crew_task_assigned",
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
