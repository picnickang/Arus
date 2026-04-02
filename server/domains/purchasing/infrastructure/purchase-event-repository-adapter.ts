import { db } from "../../../db";
import { eq, and, sql, inArray } from "drizzle-orm";
import {
  purchaseRequests,
  purchaseRequestEvents,
  purchaseOrderEvents,
  purchaseOrders,
  users,
} from "@shared/schema";
import type { IPurchaseEventRepository } from "../domain/ports";
import type { PipelineDataSources, RawEvent } from "../domain/types";

export class PurchaseEventRepositoryAdapter implements IPurchaseEventRepository {
  async getPipelineData(prId: string, orgId: string): Promise<PipelineDataSources | null> {
    const [pr] = await db
      .select({
        id: purchaseRequests.id,
        status: purchaseRequests.status,
        createdAt: purchaseRequests.createdAt,
        sentAt: purchaseRequests.sentAt,
        closedAt: purchaseRequests.closedAt,
      })
      .from(purchaseRequests)
      .where(and(eq(purchaseRequests.id, prId), eq(purchaseRequests.orgId, orgId)));

    if (!pr) return null;

    const prEvents = await db
      .select({
        id: purchaseRequestEvents.id,
        eventType: purchaseRequestEvents.eventType,
        userId: purchaseRequestEvents.userId,
        details: purchaseRequestEvents.details,
        createdAt: purchaseRequestEvents.createdAt,
      })
      .from(purchaseRequestEvents)
      .where(
        and(
          eq(purchaseRequestEvents.prId, prId),
          eq(purchaseRequestEvents.orgId, orgId)
        )
      )
      .orderBy(sql`${purchaseRequestEvents.createdAt} ASC`);

    const linkedPoIds = await this.findLinkedPOIds(prId, orgId);

    let poEvents: RawEvent[] = [];
    if (linkedPoIds.length > 0) {
      for (const poId of linkedPoIds) {
        const events = await db
          .select({
            id: purchaseOrderEvents.id,
            eventType: purchaseOrderEvents.eventType,
            userId: purchaseOrderEvents.userId,
            details: purchaseOrderEvents.details,
            createdAt: purchaseOrderEvents.createdAt,
          })
          .from(purchaseOrderEvents)
          .where(
            and(
              eq(purchaseOrderEvents.poId, poId),
              eq(purchaseOrderEvents.orgId, orgId)
            )
          )
          .orderBy(sql`${purchaseOrderEvents.createdAt} ASC`);
        poEvents.push(...(events as RawEvent[]));
      }
    }

    return {
      prEvents: prEvents as RawEvent[],
      poEvents,
      prStatus: pr.status,
      prCreatedAt: pr.createdAt,
      prSentAt: pr.sentAt,
      prClosedAt: pr.closedAt,
    };
  }

  private async findLinkedPOIds(prId: string, orgId: string): Promise<string[]> {
    const events = await db
      .select({
        eventType: purchaseRequestEvents.eventType,
        details: purchaseRequestEvents.details,
      })
      .from(purchaseRequestEvents)
      .where(
        and(
          eq(purchaseRequestEvents.prId, prId),
          eq(purchaseRequestEvents.orgId, orgId)
        )
      );

    const poIds = new Set<string>();
    for (const evt of events) {
      const details = evt.details as Record<string, unknown> | null;
      if (!details) continue;

      if (details.poId && typeof details.poId === "string") {
        poIds.add(details.poId);
      }
      if (Array.isArray(details.purchaseOrders)) {
        for (const po of details.purchaseOrders) {
          if (po && typeof po === "object") {
            const poObj = po as Record<string, unknown>;
            if (typeof poObj.poId === "string") poIds.add(poObj.poId);
            else if (typeof poObj.id === "string") poIds.add(poObj.id);
          }
        }
      }
    }

    if (poIds.size === 0) {
      const poCreationEvents = await db
        .select({ poId: purchaseOrderEvents.poId, details: purchaseOrderEvents.details })
        .from(purchaseOrderEvents)
        .where(
          and(
            eq(purchaseOrderEvents.orgId, orgId),
            eq(purchaseOrderEvents.eventType, "created")
          )
        );

      for (const evt of poCreationEvents) {
        const details = evt.details as Record<string, unknown> | null;
        if (details?.prId === prId) {
          poIds.add(evt.poId);
        }
      }
    }

    return Array.from(poIds);
  }

  async resolveUserNames(userIds: string[]): Promise<Map<string, string>> {
    const nameMap = new Map<string, string>();
    if (userIds.length === 0) return nameMap;

    const uniqueIds = [...new Set(userIds)];
    const rows = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, uniqueIds));

    for (const row of rows) {
      nameMap.set(row.id, row.name);
    }
    return nameMap;
  }
}
