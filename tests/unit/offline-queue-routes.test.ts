/**
 * X5: pins the shared offline-queue route registry. Every queueable family
 * must have a valid classification (a member of the client EntityType union),
 * and queueability/classification must stay in lockstep — the server mounts
 * idempotency middleware on exactly these prefixes.
 */

import { describe, it, expect } from "@jest/globals";
import {
  OFFLINE_QUEUE_ROUTE_FAMILIES,
  OFFLINE_FALLBACK_ENTITY_TYPE,
  classifyOfflineEntityPath,
  getQueueablePrefixes,
  isQueueableMutationPath,
} from "../../shared/offline-queue-routes";
import type { EntityType } from "../../client/src/lib/offline-sync";

// Mirrors the EntityType union in client/src/lib/offline-sync.ts; the
// satisfies-check below fails to compile if the union and this list drift.
const KNOWN_ENTITY_TYPES = [
  "assignment",
  "leave",
  "certification",
  "inventory_item",
  "inventory_stock",
  "logistics_task",
  "work_order",
  "logbook",
  "checklist",
  "alert",
  "safety_acknowledgement",
  "handover",
  "parts",
  "pdm_risk",
  "api_request",
] as const satisfies readonly EntityType[];

describe("offline-queue route registry (X5)", () => {
  it("every family declares a known entity type and at least one /api prefix", () => {
    for (const family of OFFLINE_QUEUE_ROUTE_FAMILIES) {
      expect(KNOWN_ENTITY_TYPES).toContain(family.entityType as EntityType);
      expect(family.queuePrefixes.length).toBeGreaterThan(0);
      for (const prefix of family.queuePrefixes) {
        expect(prefix.startsWith("/api/")).toBe(true);
      }
      for (const refinement of family.refinements ?? []) {
        expect(KNOWN_ENTITY_TYPES).toContain(refinement.entityType as EntityType);
      }
    }
  });

  it("every queueable prefix is itself queueable and classifies to its family", () => {
    for (const family of OFFLINE_QUEUE_ROUTE_FAMILIES) {
      for (const prefix of family.queuePrefixes) {
        expect(isQueueableMutationPath("POST", prefix)).toBe(true);
        expect(classifyOfflineEntityPath(prefix)).toBe(family.entityType);
      }
    }
  });

  it("queueable prefixes are unique (no double idempotency mounts)", () => {
    const prefixes = getQueueablePrefixes();
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });

  it("unknown routes are not queueable and classify to the fallback", () => {
    expect(isQueueableMutationPath("POST", "/api/some-unknown-route")).toBe(false);
    expect(classifyOfflineEntityPath("/api/some-unknown-route")).toBe(OFFLINE_FALLBACK_ENTITY_TYPE);
  });

  it("bulk clears are never queueable", () => {
    expect(isQueueableMutationPath("DELETE", "/api/work-orders/clear")).toBe(false);
    expect(isQueueableMutationPath("DELETE", "/api/alerts/clear")).toBe(false);
  });
});
