/**
 * Single source of truth for which API route families participate in the
 * offline outbox.
 *
 * The client uses this table to decide which mutations are queueable offline
 * and how queued operations are classified; the server mounts idempotency
 * middleware on exactly the same families, so every replayable mutation lands
 * on an idempotency-protected route. Adding a family here wires up both sides
 * at once — `tests/unit/offline-queue-routes.test.ts` pins the invariants.
 */

export interface OfflineEntityRefinement {
  /** Tested against the URL path (query string stripped). First match wins. */
  pattern: RegExp;
  entityType: string;
}

export interface OfflineQueueRouteFamily {
  /** Entity type recorded on queued operations when no refinement matches. */
  entityType: string;
  /**
   * Path prefixes that make a mutation queueable. The server mounts
   * idempotency middleware on each of these.
   */
  queuePrefixes: readonly string[];
  /**
   * Broader prefixes used only for entity classification (defaults to
   * `queuePrefixes`). Lets e.g. all `/api/logbook/*` URLs classify as
   * "logbook" while only deck/engine logs are queueable.
   */
  classifyPrefixes?: readonly string[];
  refinements?: readonly OfflineEntityRefinement[];
}

export const OFFLINE_QUEUE_ROUTE_FAMILIES: readonly OfflineQueueRouteFamily[] = [
  {
    entityType: "inventory_item",
    queuePrefixes: ["/api/parts-inventory"],
    refinements: [{ pattern: /\/stock$/, entityType: "inventory_stock" }],
  },
  {
    entityType: "work_order",
    queuePrefixes: ["/api/work-orders"],
    refinements: [{ pattern: /\/parts/, entityType: "parts" }],
  },
  {
    entityType: "logistics_task",
    queuePrefixes: ["/api/offshore-ops", "/api/service-requests", "/api/service-orders"],
  },
  {
    entityType: "api_request",
    queuePrefixes: ["/api/me/safety-alarms"],
    refinements: [{ pattern: /\/acknowledge$/, entityType: "safety_acknowledgement" }],
  },
  {
    entityType: "alert",
    queuePrefixes: ["/api/admin/safety-alarms"],
  },
  {
    entityType: "logbook",
    queuePrefixes: ["/api/logbook/deck", "/api/logbook/engine"],
    classifyPrefixes: ["/api/logbook/"],
  },
  {
    entityType: "checklist",
    queuePrefixes: ["/api/maintenance-checklist"],
  },
  {
    entityType: "handover",
    queuePrefixes: ["/api/attention/"],
  },
  {
    entityType: "alert",
    queuePrefixes: ["/api/rms/alerts"],
    refinements: [{ pattern: /\/acknowledge$/, entityType: "safety_acknowledgement" }],
  },
  {
    entityType: "alert",
    queuePrefixes: ["/api/alerts"],
  },
  {
    entityType: "pdm_risk",
    queuePrefixes: ["/api/pdm/risk"],
  },
];

const MUTATION_VERBS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Fallback classification for queueable URLs outside every family. */
export const OFFLINE_FALLBACK_ENTITY_TYPE = "api_request";

export function classifyOfflineEntityPath(url: string): string {
  const path = url.split("?")[0] ?? url;
  for (const family of OFFLINE_QUEUE_ROUTE_FAMILIES) {
    const prefixes = family.classifyPrefixes ?? family.queuePrefixes;
    if (!prefixes.some((prefix) => path.startsWith(prefix))) {
      continue;
    }
    const refined = family.refinements?.find((refinement) => refinement.pattern.test(path));
    return refined ? refined.entityType : family.entityType;
  }
  return OFFLINE_FALLBACK_ENTITY_TYPE;
}

export function isQueueableMutationPath(method: string, url: string): boolean {
  const verb = method.toUpperCase();
  if (!MUTATION_VERBS.has(verb)) {
    return false;
  }

  // Bulk clears are intentionally not replayable: a queued "clear" replayed
  // hours later would wipe records created in the meantime.
  if (verb === "DELETE" && /\/clear(?:$|[/?#])/.test(url)) {
    return false;
  }

  return OFFLINE_QUEUE_ROUTE_FAMILIES.some((family) =>
    family.queuePrefixes.some((prefix) => url.startsWith(prefix))
  );
}

/** Every queueable prefix — the server mounts idempotency middleware on each. */
export function getQueueablePrefixes(): string[] {
  return OFFLINE_QUEUE_ROUTE_FAMILIES.flatMap((family) => [...family.queuePrefixes]);
}
