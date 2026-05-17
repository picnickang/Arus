import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  queueOperation,
  getPendingOperations,
  getConflicts,
  syncPendingOperations,
  resolveConflict,
  isOnline,
  subscribeToOnlineStatus,
  getPendingCount,
  hasConflicts,
  PendingOperation,
  SyncConflict,
  EntityType,
  OperationType,
} from "@/lib/offline-sync";
import { apiRequest } from "@/lib/queryClient";

export interface OfflineSyncState {
  isOnline: boolean;
  pendingCount: number;
  hasConflicts: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
}

export interface UseOfflineSyncResult {
  state: OfflineSyncState;
  queueCreate: (
    entityType: EntityType,
    entityId: string,
    payload: Record<string, unknown>
  ) => Promise<void>;
  queueUpdate: (
    entityType: EntityType,
    entityId: string,
    payload: Record<string, unknown>,
    lastModifiedAt?: string
  ) => Promise<void>;
  queueDelete: (entityType: EntityType, entityId: string) => Promise<void>;
  syncNow: () => Promise<void>;
  getPending: () => Promise<PendingOperation[]>;
  getConflictList: () => Promise<SyncConflict[]>;
  resolveConflictAs: (
    operationId: string,
    resolution: "local" | "server" | "merged",
    mergedPayload?: Record<string, unknown>
  ) => Promise<void>;
}

const SYNC_INTERVAL_MS = 30000;

export function useOfflineSync(): UseOfflineSyncResult {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [state, setState] = useState<OfflineSyncState>({
    isOnline: isOnline(),
    pendingCount: 0,
    hasConflicts: false,
    isSyncing: false,
    lastSyncTime: null,
  });

  const updateCounts = useCallback(async () => {
    const [pending, conflicts] = await Promise.all([getPendingCount(), hasConflicts()]);
    setState((prev) => ({
      ...prev,
      pendingCount: pending,
      hasConflicts: conflicts,
    }));
  }, []);

  const executeOperation = useCallback(
    async (
      op: PendingOperation
    ): Promise<{ success: boolean; serverVersion?: Record<string, unknown> }> => {
      const endpoints: Record<EntityType, string> = {
        assignment: "/api/scheduler/assignments",
        leave: "/api/crew/leave",
        certification: "/api/crew/certifications",
      } as any;

      const baseUrl = endpoints[op.entityType];
      if (!baseUrl) {
        return { success: false };
      }

      try {
        if (op.operationType === "create") {
          await apiRequest("POST", baseUrl, op.payload);
          return { success: true };
        }
        if (op.operationType === "update") {
          await apiRequest("PATCH", `${baseUrl}/${op.entityId}`, {
            ...op.payload,
            lastModifiedAt: op.lastModifiedAt,
          });
          return { success: true };
        }
        if (op.operationType === "delete") {
          await apiRequest("DELETE", `${baseUrl}/${op.entityId}`);
          return { success: true };
        }

        return { success: false };
      } catch (error: unknown) {
        const errorObj = error as { status?: number; response?: Response; message?: string };

        if (errorObj.status === 409 || errorObj.message?.includes("409")) {
          let serverVersion: Record<string, unknown> = {};

          if (errorObj.response) {
            try {
              const data = await errorObj.response.json();
              serverVersion = data.currentVersion || data;
            } catch {
              serverVersion = { conflictDetected: true };
            }
          }

          return { success: false, serverVersion };
        }

        throw error;
      }
    },
    []
  );

  const syncNow = useCallback(async () => {
    if (!isOnline() || state.isSyncing) {
      return;
    }

    setState((prev) => ({ ...prev, isSyncing: true }));

    try {
      const result = await syncPendingOperations(executeOperation);

      if (result.synced > 0) {
        queryClient.invalidateQueries({ queryKey: ["/api/crew/assignments"] });
        queryClient.invalidateQueries({ queryKey: ["/api/crew/leave"] });
        queryClient.invalidateQueries({ queryKey: ["/api/crew/certifications"] });

        toast({
          title: "Sync Complete",
          description: `${result.synced} operation(s) synced successfully`,
        });
      }

      if (result.conflicts > 0) {
        toast({
          title: "Sync Conflicts",
          description: `${result.conflicts} conflict(s) require resolution`,
          variant: "destructive",
        });
      }

      if (result.failed > 0) {
        toast({
          title: "Sync Errors",
          description: `${result.failed} operation(s) failed to sync`,
          variant: "destructive",
        });
      }

      await updateCounts();
      setState((prev) => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: result.synced > 0 ? new Date() : prev.lastSyncTime,
      }));
    } catch (error) {
      setState((prev) => ({ ...prev, isSyncing: false }));
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    }
  }, [state.isSyncing, executeOperation, queryClient, toast, updateCounts]);

  const queueAndOptimistic = useCallback(
    async (
      entityType: EntityType,
      entityId: string,
      operationType: OperationType,
      payload: Record<string, unknown>,
      lastModifiedAt?: string
    ) => {
      await queueOperation(entityType, entityId, operationType, payload, lastModifiedAt);
      await updateCounts();

      if (isOnline()) {
        syncNow();
      }
    },
    [updateCounts, syncNow]
  );

  const queueCreate = useCallback(
    async (entityType: EntityType, entityId: string, payload: Record<string, unknown>) => {
      await queueAndOptimistic(entityType, entityId, "create", payload);
    },
    [queueAndOptimistic]
  );

  const queueUpdate = useCallback(
    async (
      entityType: EntityType,
      entityId: string,
      payload: Record<string, unknown>,
      lastModifiedAt?: string
    ) => {
      await queueAndOptimistic(entityType, entityId, "update", payload, lastModifiedAt);
    },
    [queueAndOptimistic]
  );

  const queueDelete = useCallback(
    async (entityType: EntityType, entityId: string) => {
      await queueAndOptimistic(entityType, entityId, "delete", {});
    },
    [queueAndOptimistic]
  );

  const resolveConflictAs = useCallback(
    async (
      operationId: string,
      resolution: "local" | "server" | "merged",
      mergedPayload?: Record<string, unknown>
    ) => {
      await resolveConflict(operationId, resolution, mergedPayload);
      await updateCounts();

      if (resolution !== "server" && isOnline()) {
        syncNow();
      }

      toast({
        title: "Conflict Resolved",
        description: `Conflict resolved using ${resolution} version`,
      });
    },
    [updateCounts, syncNow, toast]
  );

  useEffect(() => {
    updateCounts();

    const unsubscribe = subscribeToOnlineStatus((online) => {
      setState((prev) => ({ ...prev, isOnline: online }));

      if (online) {
        toast({
          title: "Back Online",
          description: "Syncing pending changes...",
        });
        syncNow();
      } else {
        toast({
          title: "Offline Mode",
          description: "Changes will be saved locally and synced when online",
        });
      }
    });

    syncIntervalRef.current = setInterval(() => {
      if (isOnline()) {
        syncNow();
      }
    }, SYNC_INTERVAL_MS);

    return () => {
      unsubscribe();
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [updateCounts, syncNow, toast]);

  return {
    state,
    queueCreate,
    queueUpdate,
    queueDelete,
    syncNow,
    getPending: getPendingOperations,
    getConflictList: getConflicts,
    resolveConflictAs,
  };
}
