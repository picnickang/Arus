import { openDB, DBSchema, IDBPDatabase } from "idb";

export type OperationType = "create" | "update" | "delete";
export type EntityType = "assignment" | "leave" | "certification";

export interface PendingOperation {
  id: string;
  entityType: EntityType;
  entityId: string;
  operationType: OperationType;
  payload: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
  lastError?: string;
  lastModifiedAt?: string;
}

export interface SyncConflict {
  operationId: string;
  entityType: EntityType;
  entityId: string;
  localVersion: Record<string, unknown>;
  serverVersion: Record<string, unknown>;
  resolvedAt?: string;
  resolution?: "local" | "server" | "merged";
}

interface OfflineSyncDB extends DBSchema {
  pendingOperations: {
    key: string;
    value: PendingOperation;
    indexes: {
      "by-entity": [EntityType, string];
      "by-created": string;
    };
  };
  conflicts: {
    key: string;
    value: SyncConflict;
    indexes: {
      "by-entity": [EntityType, string];
    };
  };
  syncMetadata: {
    key: string;
    value: {
      key: string;
      value: unknown;
    };
  };
}

const DB_NAME = "arus-offline-sync";
const DB_VERSION = 1;

let dbInstance: IDBPDatabase<OfflineSyncDB> | null = null;

async function getDB(): Promise<IDBPDatabase<OfflineSyncDB>> {
  if (dbInstance) return dbInstance;

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

export async function queueOperation(
  entityType: EntityType,
  entityId: string,
  operationType: OperationType,
  payload: Record<string, unknown>,
  lastModifiedAt?: string
): Promise<string> {
  const db = await getDB();

  const existingOps = await db.getAllFromIndex(
    "pendingOperations",
    "by-entity",
    [entityType, entityId]
  );

  const existingOp = existingOps.find(
    (op) => op.operationType === operationType
  );
  if (existingOp) {
    const updatedOp: PendingOperation = {
      ...existingOp,
      payload: { ...existingOp.payload, ...payload },
      lastModifiedAt: lastModifiedAt || new Date().toISOString(),
    };
    await db.put("pendingOperations", updatedOp);
    return existingOp.id;
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

  await db.add("pendingOperations", operation);
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
  return db.getAllFromIndex("pendingOperations", "by-entity", [
    entityType,
    entityId,
  ]);
}

export async function markOperationFailed(
  operationId: string,
  error: string
): Promise<void> {
  const db = await getDB();
  const op = await db.get("pendingOperations", operationId);
  if (op) {
    op.retryCount += 1;
    op.lastError = error;
    await db.put("pendingOperations", op);
  }
}

export async function removeOperation(operationId: string): Promise<void> {
  const db = await getDB();
  await db.delete("pendingOperations", operationId);
}

export async function clearAllOperations(): Promise<void> {
  const db = await getDB();
  await db.clear("pendingOperations");
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
  if (!conflict) return;

  conflict.resolution = resolution;
  conflict.resolvedAt = new Date().toISOString();
  await db.put("conflicts", conflict);

  if (resolution === "server") {
    await removeOperation(operationId);
  } else if (resolution === "local" || resolution === "merged") {
    const op = await db.get("pendingOperations", operationId);
    if (op) {
      op.payload = mergedPayload || op.payload;
      op.retryCount = 0;
      op.lastError = undefined;
      await db.put("pendingOperations", op);
    }
  }
}

export async function clearResolvedConflicts(): Promise<void> {
  const db = await getDB();
  const conflicts = await db.getAll("conflicts");
  const resolved = conflicts.filter((c) => c.resolvedAt);
  for (const conflict of resolved) {
    await db.delete("conflicts", conflict.operationId);
  }
}

export async function setSyncMetadata(
  key: string,
  value: unknown
): Promise<void> {
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
}

export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

export type OnlineStatusCallback = (online: boolean) => void;
const onlineStatusListeners: Set<OnlineStatusCallback> = new Set();

export function subscribeToOnlineStatus(
  callback: OnlineStatusCallback
): () => void {
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
  let synced = 0;
  let failed = 0;
  let conflicts = 0;

  for (const op of operations) {
    if (op.retryCount >= 5) {
      continue;
    }

    try {
      const result = await executor(op);

      if (result.success) {
        await removeOperation(op.id);
        synced++;
      } else if (result.serverVersion) {
        await addConflict(
          op.id,
          op.entityType,
          op.entityId,
          op.payload,
          result.serverVersion
        );
        conflicts++;
      } else {
        await markOperationFailed(op.id, "Sync failed without conflict");
        failed++;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
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
