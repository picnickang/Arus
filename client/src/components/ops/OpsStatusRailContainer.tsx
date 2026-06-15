import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";

import { useOperationalWorkflow } from "@/features/workflow/useOperationalWorkflow";
import { getOfflineSyncSnapshot } from "@/lib/offline-sync";
import { queryClient } from "@/lib/queryClient";

import OpsStatusRail, { type OpsRailRisk } from "./OpsStatusRail";

/** Safely read a risk's href from the opaque action payload (no cast). */
function readRiskHref(payload: unknown): string | undefined {
  return payload !== null &&
    typeof payload === "object" &&
    "href" in payload &&
    typeof payload.href === "string"
    ? payload.href
    : undefined;
}

/**
 * Wires the presentational OpsStatusRail to live ops data, reusing existing
 * sources (no new data layer): the attention workflow for risks + handover,
 * and the offline-sync snapshot for the outbox (mirrors ConnectivityBannerWithSync).
 * Rail actions navigate to the relevant surface — the rail never mutates.
 */
export function OpsStatusRailContainer({
  hideWhenIdle = false,
}: {
  hideWhenIdle?: boolean;
} = {}) {
  const [, setLocation] = useLocation();
  const { attentionItems, handover } = useOperationalWorkflow();
  const [outboxCount, setOutboxCount] = useState(0);
  const [hasConflict, setHasConflict] = useState(false);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  const refresh = useCallback(async () => {
    const active = queryClient
      .getMutationCache()
      .getAll()
      .filter((m) => m.state.status === "pending").length;
    const snapshot = await getOfflineSyncSnapshot().catch(() => ({
      pending: [],
      conflicts: [],
      lastSyncTime: null,
    }));
    setOutboxCount(active + snapshot.pending.length);
    setHasConflict(snapshot.conflicts.length > 0);
  }, []);

  useEffect(() => {
    void refresh();
    const unsubscribe = queryClient.getMutationCache().subscribe(() => void refresh());
    const handleSyncChange = () => void refresh();
    const handleOnline = () => {
      setIsOnline(true);
      void refresh();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("arus:offline-sync-changed", handleSyncChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      unsubscribe();
      window.removeEventListener("arus:offline-sync-changed", handleSyncChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [refresh]);

  const risks: OpsRailRisk[] = attentionItems
    .filter((item) => item.severity === "critical" || item.severity === "warning")
    .slice(0, 3)
    .map((item) => ({
      id: item.id,
      label: item.title,
      severity: item.severity === "critical" ? "high" : "medium",
      href: item.href,
    }));

  const handleAction = (action: string, payload?: unknown) => {
    switch (action) {
      case "open-risk": {
        const href = readRiskHref(payload);
        setLocation(href ?? "/attention-inbox");
        break;
      }
      case "review-outbox":
        setLocation("/offline-outbox");
        break;
      case "open-handover":
        setLocation("/briefing");
        break;
      case "refresh-status":
        void refresh();
        break;
      default:
        break;
    }
  };

  return (
    <OpsStatusRail
      risks={risks}
      outboxCount={outboxCount}
      outboxHasConflict={hasConflict}
      handoverOpenItems={handover.openAttentionItems}
      isOnline={isOnline}
      onAction={handleAction}
      hideWhenIdle={hideWhenIdle}
    />
  );
}
