import { useCallback, useEffect, useState } from "react";

import { getOfflineSyncSnapshot } from "@/lib/offline-sync";
import { queryClient, replayQueuedApiRequests } from "@/lib/queryClient";

import { ConnectivityBanner } from "./ConnectivityBanner";

export function ConnectivityBannerWithSync() {
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  const refreshPendingCount = useCallback(async () => {
    const cache = queryClient.getMutationCache();
    const activeMutations = cache.getAll().filter((m) => m.state.status === "pending").length;
    const snapshot = await getOfflineSyncSnapshot().catch(() => ({
      pending: [],
      conflicts: [],
      lastSyncTime: null,
    }));
    setPendingCount(activeMutations + snapshot.pending.length);
    setLastSyncTime(snapshot.lastSyncTime);
  }, []);

  useEffect(() => {
    refreshPendingCount();
    const cache = queryClient.getMutationCache();
    const unsubscribe = cache.subscribe(() => {
      void refreshPendingCount();
    });
    const handleSyncChange = () => void refreshPendingCount();
    const handleOnline = () => {
      void replayQueuedApiRequests().finally(refreshPendingCount);
    };
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "ARUS_SYNC_OUTBOX_REQUEST") {
        void replayQueuedApiRequests().finally(refreshPendingCount);
      }
    };
    window.addEventListener("arus:offline-sync-changed", handleSyncChange);
    window.addEventListener("online", handleOnline);
    navigator.serviceWorker?.addEventListener("message", handleServiceWorkerMessage);

    if (navigator.onLine) {
      void replayQueuedApiRequests().finally(refreshPendingCount);
    }

    return () => {
      unsubscribe();
      window.removeEventListener("arus:offline-sync-changed", handleSyncChange);
      window.removeEventListener("online", handleOnline);
      navigator.serviceWorker?.removeEventListener("message", handleServiceWorkerMessage);
    };
  }, [refreshPendingCount]);

  // Poll only while something is pending. A transition from zero is always
  // announced by the mutation cache subscription or the offline-sync event
  // (broadcastOfflineSyncChange fires on enqueue), which re-arms this.
  useEffect(() => {
    if (pendingCount === 0) {
      return;
    }
    const interval = window.setInterval(refreshPendingCount, 15000);
    return () => window.clearInterval(interval);
  }, [pendingCount, refreshPendingCount]);

  return <ConnectivityBanner pendingSyncCount={pendingCount} lastSyncTime={lastSyncTime} />;
}
