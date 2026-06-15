import { openDB, type IDBPDatabase } from "idb";
import { classifyOfflineEntityPath, isQueueableMutationPath } from "@shared/offline-queue-routes";
import type {
  EntityType,
  OfflineSyncDB,
  OperationType,
  PendingOperation,
  SyncConflict,
} from "./offline-sync-types";

export type {
  EntityType,
  OperationType,
  PendingOperation,
  SyncConflict,
} from "./offline-sync-types";

const DB_NAME = "arus-offline-sync";
const DB_VERSION = 2;

let dbInstance: IDBPDatabase<OfflineSyncDB> | null = null;

async function getDB(): Promise<IDBPDatabase<OfflineSyncDB>> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB<OfflineSyncDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("pendingOperations")) {
        const opStore = db.createObjectStore("pendingOperations", {
          keyPath: "id",
        });
        opStore.createIndex("by-entity", ["entityType", "entityId"]);
        opStore.createIndex("by-created", "createdAt");
      }

      if (!db.objectStoreNames.contains("conflicts")) {
        const conflictStore = db.createObjectStore("conflicts", {
          keyPath: "operationId",
        });
        conflictStore.createIndex("by-entity", ["entityType", "entityId"]);
      }

      if (!db.objectStoreNames.contains("syncMetadata")) {
        db.createObjectStore("syncMetadata", { keyPath: "key" });
      }
    },
  });

  return dbInstance;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateClientMutationId(prefix = "client-mutation"): string {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}:${randomPart}`;
}

/**
 * Hard cap on queued offline operations. Overflow rejects loudly instead of
 * silently evicting older entries — these are maritime work records, and a
 * dropped one is worse than a blocked save.
 */
export const MAX_PENDING_OPERATIONS = 500;

export class OfflineQueueFullError extends Error {
  readonly code = "OFFLINE_QUEUE_FULL";

  constructor() {
    super(
      `Offline outbox is full (${MAX_PENDING_OPERATIONS} pending changes). Reconnect and sync before saving more changes.`
    );
    this.name = "OfflineQueueFullError";
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Recursively merge a dedup patch onto an existing queued payload. A shallow
 * spread replaces a nested object wholesale — patching only `{ description }`
 * onto `{ maintenanceWindow: {...}, description }` would drop
 * `maintenanceWindow` — so plain-object branches merge key-by-key. Arrays and
 * scalars are replaced (last write wins), matching the previous behaviour for
 * non-object fields.
 */
function deepMergePayload(
  base: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const existing = out[key];
    out[key] =
      isPlainObject(existing) && isPlainObject(value)
        ? deepMergePayload(existing, value)
        : value;
  }
  return out;
}

export async function queueOperation(
  entityType: EntityType,
  entityId: string,
  operationType: OperationType,
  payload: Record<string, unknown>,
  lastModifiedAt?: string
): Promise<string> {
  const db = await getDB();

  const shouldDedupe = operationType !== "create" || payload["__allowOfflineCreateDedupe"] === true;

  // Dedup lookup, cap check, and write share one readwrite transaction so two
  // concurrent queue calls for the same entity cannot both miss the lookup and
  // insert duplicates.
  const tx = db.transaction("pendingOperations", "readwrite");
  const store = tx.objectStore("pendingOperations");

  const existingOps = shouldDedupe
    ? await store.index("by-entity").getAll([entityType, entityId])
    : [];

  const existingOp = existingOps.find((op) => op.operationType === operationType);
  if (existingOp) {
    const updatedOp: PendingOperation = {
      ...existingOp,
      payload: deepMergePayload(existingOp.payload, payload),
      lastModifiedAt: lastModifiedAt || new Date().toISOString(),
    };
    await store.put(updatedOp);
    await tx.done;
    broadcastOfflineSyncChange();
    return existingOp.id;
  }

  if ((await store.count()) >= MAX_PENDING_OPERATIONS) {
    await tx.done;
    throw new OfflineQueueFullError();
  }

  const operation: PendingOperation = {
    id: generateId(),
    entityType,
    entityId,
    operationType,
    payload,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    lastModifiedAt: lastModifiedAt || new Date().toISOString(),
  };

  await store.add(operation);
  await tx.done;
  broadcastOfflineSyncChange();
  return operation.id;
}

export async function getPendingOperations(): Promise<PendingOperation[]> {
  const db = await getDB();
  return db.getAllFromIndex("pendingOperations", "by-created");
}

export async function getPendingOperationsByEntity(
  entityType: EntityType,
  entityId: string
): Promise<PendingOperation[]> {
  const db = await getDB();
  return db.getAllFromIndex("pendingOperations", "by-entity", [entityType, entityId]);
}

export async function markOperationFailed(operationId: string, error: string): Promise<void> {
  const db = await getDB();
  const op = await db.get("pendingOperations", operationId);
  if (op) {
    op.retryCount += 1;
    op.lastError = error;
    op.lastAttemptedAt = Date.now();
    await db.put("pendingOperations", op);
    broadcastOfflineSyncChange();
  }
}

export async function removeOperation(operationId: string): Promise<void> {
  const db = await getDB();
  await db.delete("pendingOperations", operationId);
  broadcastOfflineSyncChange();
}

export async function clearAllOperations(): Promise<void> {
  const db = await getDB();
  await db.clear("pendingOperations");
  broadcastOfflineSyncChange();
}

export async function addConflict(
  operationId: string,
  entityType: EntityType,
  entityId: string,
  localVersion: Record<string, unknown>,
  serverVersion: Record<string, unknown>
): Promise<void> {
  const db = await getDB();
  const conflict: SyncConflict = {
    operationId,
    entityType,
    entityId,
    localVersion,
    serverVersion,
  };
  await db.put("conflicts", conflict);

  const op = await db.get("pendingOperations", operationId);
  if (op) {
    op.conflictPaused = true;
    op.lastError = "Conflict needs review before this change can sync.";
    await db.put("pendingOperations", op);
  }

  broadcastOfflineSyncChange();
}

export async function getConflicts(): Promise<SyncConflict[]> {
  const db = await getDB();
  return db.getAll("conflicts");
}

export async function getConflictsByEntity(
  entityType: EntityType,
  entityId: string
): Promise<SyncConflict[]> {
  const db = await getDB();
  return db.getAllFromIndex("conflicts", "by-entity", [entityType, entityId]);
}

export async function resolveConflict(
  operationId: string,
  resolution: "local" | "server" | "merged",
  mergedPayload?: Record<string, unknown>
): Promise<void> {
  const db = await getDB();
  const conflict = await db.get("conflicts", operationId);
  if (!conflict) {
    return;
  }

  conflict.resolution = resolution;
  conflict.resolvedAt = new Date().toISOString();
  await db.put("conflicts", conflict);
  broadcastOfflineSyncChange();

  if (resolution === "server") {
    await removeOperation(operationId);
  } else if (resolution === "local" || resolution === "merged") {
    const op = await db.get("pendingOperations", operationId);
    if (op) {
      op.payload = mergedPayload || op.payload;
      op.retryCount = 0;
      op.lastError = undefined;
      op.conflictPaused = false;
      await db.put("pendingOperations", op);
    }
  }
}

export async function getUnresolvedConflictOperationIds(): Promise<Set<string>> {
  const conflicts = await getConflicts();
  return new Set(
    conflicts.filter((conflict) => !conflict.resolvedAt).map((conflict) => conflict.operationId)
  );
}

export async function clearResolvedConflicts(): Promise<void> {
  const db = await getDB();
  const conflicts = await db.getAll("conflicts");
  const resolved = conflicts.filter((c) => c.resolvedAt);
  for (const conflict of resolved) {
    await db.delete("conflicts", conflict.operationId);
  }
  if (resolved.length > 0) {
    broadcastOfflineSyncChange();
  }
}

export async function setSyncMetadata(key: string, value: unknown): Promise<void> {
  const db = await getDB();
  await db.put("syncMetadata", { key, value });
}

export async function getSyncMetadata<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  const result = await db.get("syncMetadata", key);
  return result?.value as T | undefined;
}

export async function getLastSyncTime(): Promise<Date | null> {
  const timestamp = await getSyncMetadata<string>("lastSyncTime");
  return timestamp ? new Date(timestamp) : null;
}

export async function setLastSyncTime(time: Date): Promise<void> {
  await setSyncMetadata("lastSyncTime", time.toISOString());
  broadcastOfflineSyncChange();
}

export function isOnline(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

type OnlineStatusCallback = (online: boolean) => void;
const onlineStatusListeners: Set<OnlineStatusCallback> = new Set();

export function subscribeToOnlineStatus(callback: OnlineStatusCallback): () => void {
  onlineStatusListeners.add(callback);

  const handleOnline = () => {
    onlineStatusListeners.forEach((cb) => cb(true));
  };

  const handleOffline = () => {
    onlineStatusListeners.forEach((cb) => cb(false));
  };

  if (typeof window !== "undefined") {
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
  }

  return () => {
    onlineStatusListeners.delete(callback);
    if (typeof window !== "undefined") {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    }
  };
}

export interface SyncResult {
  synced: number;
  failed: number;
  conflicts: number;
}

export async function syncPendingOperations(
  executor: (
    op: PendingOperation
  ) => Promise<{ success: boolean; serverVersion?: Record<string, unknown> }>
): Promise<SyncResult> {
  if (!isOnline()) {
    return { synced: 0, failed: 0, conflicts: 0 };
  }

  const operations = await getPendingOperations();
  const unresolvedConflictIds = await getUnresolvedConflictOperationIds();
  let synced = 0;
  let failed = 0;
  let conflicts = 0;

  for (const op of operations) {
    if (op.retryCount >= 5 || op.conflictPaused || unresolvedConflictIds.has(op.id)) {
      continue;
    }

    try {
      const result = await executor(op);

      if (result.success) {
        await removeOperation(op.id);
        synced++;
      } else if (result.serverVersion) {
        await addConflict(op.id, op.entityType, op.entityId, op.payload, result.serverVersion);
        conflicts++;
      } else {
        await markOperationFailed(op.id, "Sync failed without conflict");
        failed++;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await markOperationFailed(op.id, errorMessage);
      failed++;
    }
  }

  if (synced > 0) {
    await setLastSyncTime(new Date());
  }

  return { synced, failed, conflicts };
}

export async function getPendingCount(): Promise<number> {
  const operations = await getPendingOperations();
  return operations.length;
}

export async function hasConflicts(): Promise<boolean> {
  const conflicts = await getConflicts();
  return conflicts.some((c) => !c.resolvedAt);
}

const MUTATION_TO_OPERATION: Record<string, OperationType> = {
  POST: "create",
  PUT: "update",
  PATCH: "update",
  DELETE: "delete",
};

export function classifyOfflineEntity(url: string): EntityType {
  // The registry is shared with the server (which mounts idempotency
  // middleware on the same families); entity types are validated against the
  // EntityType union in tests/unit/offline-queue-routes.test.ts.
  return classifyOfflineEntityPath(url) as EntityType;
}

export function isQueueableMutation(method: string, url: string): boolean {
  return isQueueableMutationPath(method, url);
}

export async function queueApiOperation(
  method: string,
  url: string,
  payload: Record<string, unknown> | undefined
): Promise<PendingOperation> {
  const verb = method.toUpperCase();
  const entityType = classifyOfflineEntity(url);
  const operationType = MUTATION_TO_OPERATION[verb] || "update";
  const routeEntityId = (url.split("?")[0] ?? "").split("/").filter(Boolean).slice(-1)[0];
  const clientMutationId =
    (payload?.["clientMutationId"] as string | undefined) ||
    (payload?.["__clientMutationId"] as string | undefined) ||
    (operationType === "create" ? generateClientMutationId(entityType) : undefined);
  const entityId =
    operationType === "create"
      ? `client:${clientMutationId}`
      : (payload?.["id"] as string | undefined) ||
        (payload?.["workOrderId"] as string | undefined) ||
        (payload?.["equipmentId"] as string | undefined) ||
        routeEntityId ||
        "pending";

  const id = await queueOperation(
    entityType,
    String(entityId),
    operationType,
    {
      ...(payload || {}),
      __clientMutationId: clientMutationId,
      __queuedApiRequest: true,
    },
    new Date().toISOString()
  );

  const db = await getDB();
  const operation = await db.get("pendingOperations", id);
  if (!operation) {
    throw new Error("Queued operation could not be read back from offline store");
  }

  operation.clientMutationId = clientMutationId;
  operation.request = { method: verb, url, contentType: "application/json" };
  await db.put("pendingOperations", operation);
  broadcastOfflineSyncChange();
  return operation;
}

export function broadcastOfflineSyncChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("arus:offline-sync-changed"));
  }
}

export async function getOfflineSyncSnapshot(): Promise<{
  pending: PendingOperation[];
  conflicts: SyncConflict[];
  lastSyncTime: Date | null;
}> {
  const [pending, conflicts, lastSyncTime] = await Promise.all([
    getPendingOperations(),
    getConflicts(),
    getLastSyncTime(),
  ]);
  return { pending, conflicts, lastSyncTime };
}
