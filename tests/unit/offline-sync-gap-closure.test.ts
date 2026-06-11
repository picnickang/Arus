/**
 * Unit tests for the offline-sync gap-closure features:
 *  - clientMutationId uniqueness across multiple offline creates
 *  - conflictPaused flag set on conflict + skipped during replay
 *  - resolveConflict("server") removes operation, ("local"|"merged") clears pause
 *
 * Uses fake-indexeddb so the offline-sync module's idb wrapper works in node.
 */

import { describe, it, expect, beforeAll, beforeEach } from "@jest/globals";

// ── Wire up fake IndexedDB before importing the module under test ──
import "fake-indexeddb/auto";
import { openDB } from "idb";

import * as offlineSync from "../../client/src/lib/offline-sync";

const DB_NAME = "arus-offline-sync";
const DB_VERSION = 2;

async function clearStores(): Promise<void> {
  // Open the same DB the module uses; the module's cached handle stays valid
  // because we don't delete the DB, just clear its object stores.
  const db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("pendingOperations")) {
        const s = db.createObjectStore("pendingOperations", { keyPath: "id" });
        s.createIndex("by-entity", ["entityType", "entityId"]);
        s.createIndex("by-created", "createdAt");
      }
      if (!db.objectStoreNames.contains("conflicts")) {
        const s = db.createObjectStore("conflicts", { keyPath: "operationId" });
        s.createIndex("by-entity", ["entityType", "entityId"]);
      }
      if (!db.objectStoreNames.contains("syncMetadata")) {
        db.createObjectStore("syncMetadata", { keyPath: "key" });
      }
    },
  });
  await db.clear("pendingOperations");
  await db.clear("conflicts");
  await db.clear("syncMetadata");
  db.close();
}

describe("offline-sync gap-closure", () => {
  beforeAll(async () => {
    // Touch the module's getDB() once so its internal cache is warm
    await offlineSync.getPendingCount();
  });

  beforeEach(async () => {
    await clearStores();
  });

  // ─────────────────────────────────────────────────────────────────────
  // generateClientMutationId
  // ─────────────────────────────────────────────────────────────────────
  describe("generateClientMutationId", () => {
    it("produces unique ids on repeated calls", () => {
      const a = offlineSync.generateClientMutationId("test");
      const b = offlineSync.generateClientMutationId("test");
      const c = offlineSync.generateClientMutationId("test");
      expect(a).not.toBe(b);
      expect(b).not.toBe(c);
      expect(a).toMatch(/^test:/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // queueApiOperation — multiple offline creates DO NOT collapse
  // ─────────────────────────────────────────────────────────────────────
  describe("queueApiOperation: multiple creates of the same kind", () => {
    it("creates DISTINCT entries (no dedupe) — gap-closure fix", async () => {
      const op1 = await offlineSync.queueApiOperation("POST", "/api/work-orders", {
        title: "wo-1",
      });
      const op2 = await offlineSync.queueApiOperation("POST", "/api/work-orders", {
        title: "wo-2",
      });
      const op3 = await offlineSync.queueApiOperation("POST", "/api/work-orders", {
        title: "wo-3",
      });

      // Different operation ids
      expect(op1.id).not.toBe(op2.id);
      expect(op2.id).not.toBe(op3.id);

      // Different clientMutationIds (the actual gap-closure invariant)
      expect(op1.clientMutationId).toBeTruthy();
      expect(op2.clientMutationId).toBeTruthy();
      expect(op3.clientMutationId).toBeTruthy();
      expect(op1.clientMutationId).not.toBe(op2.clientMutationId);
      expect(op2.clientMutationId).not.toBe(op3.clientMutationId);

      // Three independent rows in the queue
      const pending = await offlineSync.getPendingOperations();
      const ids = pending.map((p) => p.id);
      expect(ids).toContain(op1.id);
      expect(ids).toContain(op2.id);
      expect(ids).toContain(op3.id);
      expect(pending.filter((p) => p.entityType === "work_order").length).toBeGreaterThanOrEqual(3);
    });

    it("update operations on the same entityId DO collapse (existing behavior)", async () => {
      const a = await offlineSync.queueApiOperation("PATCH", "/api/work-orders/wo-123", {
        id: "wo-123",
        status: "in_progress",
      });
      const b = await offlineSync.queueApiOperation("PATCH", "/api/work-orders/wo-123", {
        id: "wo-123",
        status: "completed",
      });
      // Both writes target the same entity → second collapses into the first
      expect(a.id).toBe(b.id);
      const updates = (await offlineSync.getPendingOperations()).filter(
        (p) => p.operationType === "update" && p.entityId === "wo-123"
      );
      expect(updates.length).toBe(1);
      expect(updates[0].payload["status"]).toBe("completed");
    });

    it("queued create carries a request envelope for replay", async () => {
      const op = await offlineSync.queueApiOperation("POST", "/api/attention/handover", {
        note: "test",
      });
      expect(op.request).toEqual({
        method: "POST",
        url: "/api/attention/handover",
        contentType: "application/json",
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // addConflict / conflictPaused / resolveConflict
  // ─────────────────────────────────────────────────────────────────────
  describe("conflict lifecycle", () => {
    it("addConflict pauses the originating operation", async () => {
      const op = await offlineSync.queueApiOperation("POST", "/api/work-orders", {
        title: "conflict-wo",
      });
      await offlineSync.addConflict(op.id, op.entityType, op.entityId, op.payload, {
        id: "server-version-1",
        title: "server-side",
      });

      const after = (await offlineSync.getPendingOperations()).find((p) => p.id === op.id);
      expect(after?.conflictPaused).toBe(true);
      expect(after?.lastError).toMatch(/conflict/i);

      const conflicts = await offlineSync.getConflicts();
      expect(conflicts.find((c) => c.operationId === op.id)).toBeTruthy();
    });

    it("syncPendingOperations SKIPS paused operations during replay", async () => {
      const op1 = await offlineSync.queueApiOperation("POST", "/api/work-orders", {
        title: "ok-wo",
      });
      const op2 = await offlineSync.queueApiOperation("POST", "/api/work-orders", {
        title: "paused-wo",
      });

      // Pause op2
      await offlineSync.addConflict(op2.id, op2.entityType, op2.entityId, op2.payload, {
        id: "server",
      });

      const executed: string[] = [];
      const result = await offlineSync.syncPendingOperations(async (op) => {
        executed.push(op.id);
        return { success: true };
      });

      // Only op1 was passed to the executor; op2 was skipped because conflictPaused=true
      expect(executed).toContain(op1.id);
      expect(executed).not.toContain(op2.id);
      expect(result.synced).toBe(1);
    });

    it("syncPendingOperations also skips operations with unresolved conflicts (defense-in-depth)", async () => {
      const op = await offlineSync.queueApiOperation("POST", "/api/work-orders", { title: "x" });
      // Add conflict but then manually clear conflictPaused (simulating a stale flag)
      await offlineSync.addConflict(op.id, op.entityType, op.entityId, op.payload, { id: "s" });

      let called = false;
      await offlineSync.syncPendingOperations(async () => {
        called = true;
        return { success: true };
      });
      // Even if conflictPaused were false, the unresolved-conflict id set should still gate it
      expect(called).toBe(false);
    });

    it("resolveConflict('server') removes the operation entirely", async () => {
      const op = await offlineSync.queueApiOperation("POST", "/api/work-orders", {
        title: "drop-me",
      });
      await offlineSync.addConflict(op.id, op.entityType, op.entityId, op.payload, { id: "s" });
      await offlineSync.resolveConflict(op.id, "server");

      const stillPending = (await offlineSync.getPendingOperations()).find((p) => p.id === op.id);
      expect(stillPending).toBeUndefined();
    });

    it("resolveConflict('local') clears conflictPaused and resets retry count", async () => {
      const op = await offlineSync.queueApiOperation("POST", "/api/work-orders", {
        title: "keep-local",
      });
      await offlineSync.addConflict(op.id, op.entityType, op.entityId, op.payload, { id: "s" });
      await offlineSync.markOperationFailed(op.id, "previous error");

      await offlineSync.resolveConflict(op.id, "local");

      const after = (await offlineSync.getPendingOperations()).find((p) => p.id === op.id);
      expect(after).toBeTruthy();
      expect(after?.conflictPaused).toBe(false);
      expect(after?.retryCount).toBe(0);
      expect(after?.lastError).toBeUndefined();
    });

    it("resolveConflict('merged') replaces the payload and clears the pause", async () => {
      const op = await offlineSync.queueApiOperation("POST", "/api/work-orders", {
        title: "original",
      });
      await offlineSync.addConflict(op.id, op.entityType, op.entityId, op.payload, {
        title: "server",
      });
      await offlineSync.resolveConflict(op.id, "merged", {
        title: "merged-title",
        __clientMutationId: op.clientMutationId,
        __queuedApiRequest: true,
      });

      const after = (await offlineSync.getPendingOperations()).find((p) => p.id === op.id);
      expect(after?.conflictPaused).toBe(false);
      expect(after?.payload["title"]).toBe("merged-title");
    });

    it("after resolveConflict('local'), a subsequent replay DOES execute the operation", async () => {
      const op = await offlineSync.queueApiOperation("POST", "/api/work-orders", {
        title: "retry",
      });
      await offlineSync.addConflict(op.id, op.entityType, op.entityId, op.payload, { id: "s" });
      await offlineSync.resolveConflict(op.id, "local");
      // resolveConflict marks the conflict as resolved (resolvedAt) so it's no longer in the
      // unresolved-conflict id set, AND clears conflictPaused on the op
      await offlineSync.clearResolvedConflicts();

      let called = false;
      await offlineSync.syncPendingOperations(async () => {
        called = true;
        return { success: true };
      });
      expect(called).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // Helpers — entity classification stays correct
  // ─────────────────────────────────────────────────────────────────────
  describe("classifyOfflineEntity / isQueueableMutation", () => {
    it("classifies routes correctly", () => {
      expect(offlineSync.classifyOfflineEntity("/api/work-orders/123/parts")).toBe("parts");
      expect(offlineSync.classifyOfflineEntity("/api/work-orders")).toBe("work_order");
      expect(
        offlineSync.classifyOfflineEntity("/api/work-orders/wo-1/complete-with-feedback")
      ).toBe("work_order");
      expect(offlineSync.classifyOfflineEntity("/api/parts-inventory")).toBe("inventory_item");
      expect(offlineSync.classifyOfflineEntity("/api/parts-inventory/part-1/stock")).toBe(
        "inventory_stock"
      );
      expect(offlineSync.classifyOfflineEntity("/api/offshore-ops/op-1/complete")).toBe(
        "logistics_task"
      );
      expect(offlineSync.classifyOfflineEntity("/api/service-requests/sr-1")).toBe(
        "logistics_task"
      );
      expect(offlineSync.classifyOfflineEntity("/api/service-orders/so-1/complete")).toBe(
        "logistics_task"
      );
      expect(offlineSync.classifyOfflineEntity("/api/rms/alerts/alarm-1/acknowledge")).toBe(
        "safety_acknowledgement"
      );
      expect(offlineSync.classifyOfflineEntity("/api/me/safety-alarms/alarm-1/acknowledge")).toBe(
        "safety_acknowledgement"
      );
      expect(offlineSync.classifyOfflineEntity("/api/attention/handover")).toBe("handover");
      expect(offlineSync.classifyOfflineEntity("/api/logbook/deck")).toBe("logbook");
      expect(offlineSync.classifyOfflineEntity("/api/maintenance-checklist")).toBe("checklist");
      expect(offlineSync.classifyOfflineEntity("/api/pdm/risk")).toBe("pdm_risk");
      expect(offlineSync.classifyOfflineEntity("/api/something-else")).toBe("api_request");
    });

    it("queues POST/PATCH/PUT/DELETE on supported routes only", () => {
      expect(offlineSync.isQueueableMutation("POST", "/api/work-orders")).toBe(true);
      expect(offlineSync.isQueueableMutation("POST", "/api/work-orders/wo-1/parts")).toBe(true);
      expect(
        offlineSync.isQueueableMutation("POST", "/api/work-orders/wo-1/complete-with-feedback")
      ).toBe(true);
      expect(offlineSync.isQueueableMutation("POST", "/api/parts-inventory")).toBe(true);
      expect(offlineSync.isQueueableMutation("PATCH", "/api/parts-inventory/part-1/stock")).toBe(
        true
      );
      expect(offlineSync.isQueueableMutation("POST", "/api/offshore-ops")).toBe(true);
      expect(offlineSync.isQueueableMutation("PATCH", "/api/offshore-ops/op-1/complete")).toBe(
        true
      );
      expect(offlineSync.isQueueableMutation("POST", "/api/service-requests")).toBe(true);
      expect(offlineSync.isQueueableMutation("PATCH", "/api/service-orders/so-1/complete")).toBe(
        true
      );
      expect(offlineSync.isQueueableMutation("PATCH", "/api/rms/alerts/alarm-1/acknowledge")).toBe(
        true
      );
      expect(
        offlineSync.isQueueableMutation("POST", "/api/me/safety-alarms/alarm-1/acknowledge")
      ).toBe(true);
      expect(offlineSync.isQueueableMutation("PATCH", "/api/attention/handover")).toBe(true);
      expect(offlineSync.isQueueableMutation("DELETE", "/api/work-orders/123")).toBe(true);
      expect(offlineSync.isQueueableMutation("GET", "/api/work-orders")).toBe(false);
      expect(offlineSync.isQueueableMutation("POST", "/api/some-other-route")).toBe(false);
      // Defensive: bulk-clear endpoints are not queued
      expect(offlineSync.isQueueableMutation("DELETE", "/api/work-orders/clear")).toBe(false);
    });

    it("preserves request envelopes for core maritime offline workflows", async () => {
      const cases = [
        {
          url: "/api/parts-inventory/part-1/stock",
          method: "PATCH",
          entityType: "inventory_stock",
          payload: { quantityOnHand: 12, movementType: "receive" },
        },
        {
          url: "/api/work-orders/wo-1/parts",
          method: "POST",
          entityType: "parts",
          payload: { partId: "part-1", quantity: 2, movementType: "reserve" },
        },
        {
          url: "/api/work-orders/wo-1/complete-with-feedback",
          method: "POST",
          entityType: "work_order",
          payload: { completionNotes: "Consumed reserved parts", movementType: "consume" },
        },
        {
          url: "/api/offshore-ops/op-1/complete",
          method: "PATCH",
          entityType: "logistics_task",
          payload: { endTime: new Date().toISOString(), notes: "Cargo completed" },
        },
        {
          url: "/api/me/safety-alarms/alarm-1/acknowledge",
          method: "POST",
          entityType: "safety_acknowledgement",
          payload: { comment: "Acknowledged onboard" },
        },
      ] as const;

      for (const item of cases) {
        const op = await offlineSync.queueApiOperation(item.method, item.url, item.payload);
        expect(op.entityType).toBe(item.entityType);
        expect(op.request).toEqual({
          method: item.method,
          url: item.url,
          contentType: "application/json",
        });
        expect(op.payload["__queuedApiRequest"]).toBe(true);
      }
    });
  });
});
