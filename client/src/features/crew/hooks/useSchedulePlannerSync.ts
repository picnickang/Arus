import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SchedulePlannerPendingOperation, SyncStatus } from "./useSchedulePlannerDataTypes";

export function useSchedulePlannerSync() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("up_to_date");
  const [pendingOperations, setPendingOperations] = useState<SchedulePlannerPendingOperation[]>([]);

  const computedSyncStatus = useMemo((): SyncStatus => {
    if (!navigator.onLine) {
      return "offline";
    }
    if (pendingOperations.length > 0) {
      return "syncing";
    }
    return syncStatus;
  }, [syncStatus, pendingOperations.length]);

  const addPendingOperation = useCallback(
    (op: Omit<SchedulePlannerPendingOperation, "id" | "timestamp" | "retryCount">) => {
      const newOp: SchedulePlannerPendingOperation = {
        ...op,
        id: `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        retryCount: 0,
      };
      setPendingOperations((prev) => [...prev, newOp]);
      return newOp.id;
    },
    []
  );

  const flushPendingOperations = useCallback(async () => {
    if (!navigator.onLine) {
      return;
    }

    let operationsToFlush: SchedulePlannerPendingOperation[] = [];
    setPendingOperations((prev) => {
      operationsToFlush = [...prev];
      return [];
    });

    if (operationsToFlush.length === 0) {
      return;
    }

    const failedOps: SchedulePlannerPendingOperation[] = [];

    for (const op of operationsToFlush) {
      try {
        if (op.type === "create") {
          await apiRequest("/api/crew-extensions/assignments", {
            method: "POST",
            body: JSON.stringify(op.payload),
          });
        } else if (op.type === "update") {
          await apiRequest(`/api/crew-extensions/assignments/${op.payload["id"]}`, {
            method: "PATCH",
            body: JSON.stringify(op.payload["data"]),
          });
        } else if (op.type === "delete") {
          await apiRequest(`/api/crew-extensions/assignments/${op.payload["id"]}`, {
            method: "DELETE",
          });
        }
      } catch (error) {
        if (op.retryCount < 3) {
          failedOps.push({ ...op, retryCount: op.retryCount + 1 });
        } else {
          toast({
            title: "Sync Failed",
            description: "Some changes could not be saved. Please try again.",
            variant: "destructive",
          });
        }
      }
    }

    if (failedOps.length > 0) {
      setPendingOperations((prev) => [...prev, ...failedOps]);
    }

    queryClient.invalidateQueries({ queryKey: ["/api/crew-extensions/assignments"] });

    setPendingOperations((prev) => {
      if (prev.length === 0) {
        setSyncStatus("up_to_date");
      }
      return prev;
    });
  }, [queryClient, toast]);

  useEffect(() => {
    const handleOnline = () => {
      if (pendingOperations.length > 0) {
        setSyncStatus("syncing");
        flushPendingOperations();
      } else {
        setSyncStatus("up_to_date");
      }
    };
    const handleOffline = () => setSyncStatus("offline");

    if (!navigator.onLine) {
      setSyncStatus("offline");
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [pendingOperations.length, flushPendingOperations]);

  return {
    addPendingOperation,
    flushPendingOperations,
    pendingCount: pendingOperations.length,
    setSyncStatus,
    syncStatus: computedSyncStatus,
  };
}
