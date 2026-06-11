import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CloudOff, RefreshCw, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/navigation/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { replayQueuedApiRequests } from "@/lib/queryClient";
import {
  clearAllOperations,
  getOfflineSyncSnapshot,
  removeOperation,
  resolveConflict,
  type PendingOperation,
  type SyncConflict,
} from "@/lib/offline-sync";

function formatDate(value?: string | Date | null) {
  if (!value) {
    return "Never";
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  return date.toLocaleString();
}

function labelForOperation(op: PendingOperation): string {
  const target = op.request?.url || op.entityId;
  return `${op.operationType.toUpperCase()} ${op.entityType.replace(/_/g, " ")} • ${target}`;
}

function entityTone(entityType: string): "default" | "secondary" | "outline" | "destructive" {
  if (entityType === "work_order" || entityType === "logbook" || entityType === "checklist") {
    return "default";
  }
  if (entityType === "alert" || entityType === "pdm_risk") {
    return "destructive";
  }
  return "outline";
}

function PayloadPreview({ payload }: { payload: Record<string, unknown> }) {
  const entries = Object.entries(payload)
    .filter(([key]) => !key.startsWith("__"))
    .slice(0, 5);
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">No payload details captured.</p>;
  }
  return (
    <dl className="grid gap-1 text-xs text-muted-foreground md:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className="rounded-md bg-muted/40 p-2">
          <dt className="font-medium text-foreground">{key}</dt>
          <dd className="truncate">
            {typeof value === "object" ? JSON.stringify(value) : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function OfflineOutboxPage() {
  const isNavigatorOnline = typeof navigator === "undefined" ? true : navigator.onLine;
  const { toast } = useToast();
  const [pending, setPending] = useState<PendingOperation[]>([]);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const refresh = useCallback(async () => {
    const snapshot = await getOfflineSyncSnapshot();
    setPending(snapshot.pending);
    setConflicts(snapshot.conflicts.filter((conflict) => !conflict.resolvedAt));
    setLastSyncTime(snapshot.lastSyncTime);
  }, []);

  useEffect(() => {
    void refresh();
    const handleChange = () => void refresh();
    window.addEventListener("arus:offline-sync-changed", handleChange);
    window.addEventListener("online", handleChange);
    window.addEventListener("offline", handleChange);
    return () => {
      window.removeEventListener("arus:offline-sync-changed", handleChange);
      window.removeEventListener("online", handleChange);
      window.removeEventListener("offline", handleChange);
    };
  }, [refresh]);

  const unresolvedConflictIds = useMemo(
    () => new Set(conflicts.map((conflict) => conflict.operationId)),
    [conflicts]
  );

  const counts = useMemo(
    () => ({
      workOrders: pending.filter((op) => op.entityType === "work_order").length,
      logbooks: pending.filter((op) => op.entityType === "logbook").length,
      checklists: pending.filter((op) => op.entityType === "checklist").length,
      alerts: pending.filter((op) => op.entityType === "alert" || op.entityType === "pdm_risk")
        .length,
    }),
    [pending]
  );

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await replayQueuedApiRequests();
      await refresh();
      toast({
        title: "Offline outbox sync complete",
        description: `${result.synced} synced, ${result.failed} failed, ${result.conflicts} conflict(s).`,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClear = async () => {
    if (
      !confirm(
        "Clear all queued offline changes? Use this only if you are sure these vessel changes should not sync."
      )
    ) {
      return;
    }
    await clearAllOperations();
    await refresh();
  };

  const handleResolveConflict = async (
    conflict: SyncConflict,
    resolution: "local" | "server" | "merged"
  ) => {
    const mergedPayload =
      resolution === "merged"
        ? {
            ...conflict.serverVersion,
            ...conflict.localVersion,
            __mergedFromConflict: true,
            __conflictResolvedAt: new Date().toISOString(),
          }
        : undefined;

    await resolveConflict(conflict.operationId, resolution, mergedPayload);
    await refresh();
    toast({
      title: "Conflict updated",
      description:
        resolution === "server"
          ? "The local queued change was discarded and the server version was kept."
          : "The queued change is ready to retry on the next sync.",
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6">
      <PageHeader
        title="Offline Outbox"
        subtitle="Queued vessel changes, sync status, and conflicts."
      />
      <div className="space-y-6 px-4 pt-2 lg:px-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CloudOff className="h-5 w-5 text-primary" />
                  Onboard sync state
                </CardTitle>
                <CardDescription>
                  Core vessel workflows are queued here when connectivity drops: work orders,
                  logbooks, checklists, alerts, handover, and PdM actions.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleSync}
                  disabled={isSyncing || pending.length === 0 || !isNavigatorOnline}
                >
                  <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
                  {isSyncing ? "Syncing..." : "Sync now"}
                </Button>
                <Button variant="outline" onClick={handleClear} disabled={pending.length === 0}>
                  <Trash2 className="h-4 w-4" />
                  Clear queue
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-5">
            <div className="rounded-lg border p-4">
              <div className="text-2xl font-bold">{pending.length}</div>
              <div className="text-sm text-muted-foreground">Pending changes</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-2xl font-bold">{conflicts.length}</div>
              <div className="text-sm text-muted-foreground">Conflicts</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-2xl font-bold">{counts.workOrders}</div>
              <div className="text-sm text-muted-foreground">Work orders</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-2xl font-bold">{counts.logbooks + counts.checklists}</div>
              <div className="text-sm text-muted-foreground">Logs/checklists</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm font-medium">Last sync</div>
              <div className="mt-1 text-sm text-muted-foreground">{formatDate(lastSyncTime)}</div>
            </div>
          </CardContent>
        </Card>

        {conflicts.length > 0 && (
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Conflicts need review
              </CardTitle>
              <CardDescription>
                These changes reached the server but conflicted with newer vessel data. Review
                before clearing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {conflicts.map((conflict) => (
                <div key={conflict.operationId} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="destructive">{conflict.entityType}</Badge>
                    <span className="text-xs text-muted-foreground">{conflict.entityId}</span>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        Local queued change
                      </p>
                      <PayloadPreview payload={conflict.localVersion} />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">
                        Server version
                      </p>
                      <PayloadPreview payload={conflict.serverVersion} />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => handleResolveConflict(conflict, "local")}>
                      Keep local and retry
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResolveConflict(conflict, "merged")}
                    >
                      Merge and retry
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleResolveConflict(conflict, "server")}
                    >
                      Use server / discard local
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Queued changes
            </CardTitle>
            <CardDescription>
              Pending items are replayed in order. Conflicted items pause until you choose a
              resolution.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No offline changes are waiting to sync.
              </div>
            ) : (
              pending.map((op) => (
                <div key={op.id} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={entityTone(op.entityType)}>
                          {op.entityType.replace(/_/g, " ")}
                        </Badge>
                        <Badge variant="outline">{op.operationType}</Badge>
                        {op.retryCount > 0 && (
                          <Badge variant="destructive">{op.retryCount} failed attempt(s)</Badge>
                        )}
                        {(op.conflictPaused || unresolvedConflictIds.has(op.id)) && (
                          <Badge variant="destructive">Conflict paused</Badge>
                        )}
                      </div>
                      <h3 className="mt-2 font-semibold">{labelForOperation(op)}</h3>
                      <p className="text-xs text-muted-foreground">
                        Queued {formatDate(op.createdAt)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeOperation(op.id).then(refresh)}
                    >
                      Remove
                    </Button>
                  </div>
                  {op.lastError && (
                    <div className="mt-3 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                      {op.lastError}
                    </div>
                  )}
                  <Separator className="my-3" />
                  <PayloadPreview payload={op.payload} />
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
