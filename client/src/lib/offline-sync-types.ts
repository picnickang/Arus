import type { DBSchema } from "idb";

export type OperationType = "create" | "update" | "delete";

export type EntityType =
  | "assignment"
  | "leave"
  | "certification"
  | "inventory_item"
  | "inventory_stock"
  | "logistics_task"
  | "work_order"
  | "logbook"
  | "checklist"
  | "alert"
  | "safety_acknowledgement"
  | "handover"
  | "parts"
  | "pdm_risk"
  | "api_request";

export interface PendingOperation {
  id: string;
  entityType: EntityType;
  entityId: string;
  operationType: OperationType;
  payload: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
  lastError?: string | undefined;
  lastModifiedAt?: string | undefined;
  clientMutationId?: string | undefined;
  conflictPaused?: boolean | undefined;
  request?:
    | {
        method: string;
        url: string;
        contentType?: string | undefined;
      }
    | undefined;
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

export interface OfflineSyncDB extends DBSchema {
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
