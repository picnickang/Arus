import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Activity,
  RefreshCw,
  Database,
  AlertCircle,
  CheckCircle,
  Clock,
  BarChart3,
} from "lucide-react";
import { useCustomMutation } from "@/hooks/useCrudMutations";
import { formatDate } from "@/lib/formatters";

interface SyncMetrics {
  totalJournalEntries: number;
  pendingEvents: number;
  failedEvents: number;
  recentActivity: number;
}

interface SyncHealth {
  status: string;
  timestamp: string;
  totalJournalEntries: number;
  pendingEvents: number;
  failedEvents: number;
  recentActivity: number;
}

interface DataIssue {
  code: string;
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  reference?: Record<string, unknown>;
}

interface SyncStatus {
  status: string;
  timestamp: string;
  sync: {
    lastRun: string | null;
    totalIssues: number;
    criticalIssues: number;
    recentActivity: string[];
  };
  metrics: SyncMetrics;
}

interface ReconciliationResult {
  success: boolean;
  issues: DataIssue[];
  stats: {
    totalIssues: number;
    criticalIssues: number;
    checkedEntities: number;
    executionTimeMs: number;
  };
  timestamp: string;
}

export default function SyncAdmin() {
  const [isReconciling, setIsReconciling] = useState(false);
  const [lastResult, setLastResult] = useState<string>("");
  const { toast } = useToast();

  // Fetch sync health metrics (legacy endpoint)
  const { data: syncHealth, isLoading: isLoadingHealth } = useQuery<SyncHealth>({
    queryKey: ["/api/sync/health"],
    refetchInterval: 60000, // Refresh every 60 seconds (slow-changing data)
  });

  // Fetch enhanced sync status with data quality information
  const { data: syncStatus, isLoading: isLoadingSyncStatus } = useQuery<SyncStatus>({
    queryKey: ["/api/sync/status"],
    refetchInterval: 60000, // Refresh every 60 seconds (slow-changing data)
  });

  // Sync mutations using reusable hooks
  const reconcileMutation = useCustomMutation<void, { eventsProcessed: number; costSync: number }>({
    mutationFn: async () => await apiRequest("POST", "/api/sync/reconcile"),
    invalidateKeys: ["/api/sync/health"],
    onSuccess: (data) => {
      toast({
        title: "Reconciliation Complete",
        description: `Processed ${data.eventsProcessed} events. Cost sync: ${data.costSync} updates.`,
      });
      setLastResult(JSON.stringify(data, null, 2));
    },
  });

  const comprehensiveReconcileMutation = useCustomMutation<void, ReconciliationResult>({
    mutationFn: async () =>
      await apiRequest("POST", "/api/sync/reconcile/comprehensive", {
        orgId: "default-org-id",
      }),
    invalidateKeys: ["/api/sync/health", "/api/sync/status"],
    onSuccess: (data: ReconciliationResult) => {
      toast({
        title: data.success
          ? "Comprehensive Reconciliation Complete"
          : "Reconciliation Issues Found",
        description: `Found ${data.stats.totalIssues} issues (${data.stats.criticalIssues} critical) across ${data.stats.checkedEntities} entities.`,
        variant: data.stats.criticalIssues > 0 ? "destructive" : "default",
      });
      setLastResult(JSON.stringify(data, null, 2));
    },
  });

  const processEventsMutation = useCustomMutation<void, { processed: number }>({
    mutationFn: async () => await apiRequest("POST", "/api/sync/process-events"),
    invalidateKeys: ["/api/sync/health", "/api/sync/status"],
    onSuccess: (data) => {
      toast({
        title: "Events Processed",
        description: `Successfully processed ${data.processed} pending events.`,
      });
      setLastResult(JSON.stringify(data, null, 2));
    },
  });

  const handleReconcile = async () => {
    setIsReconciling(true);
    try {
      await reconcileMutation.mutateAsync();
    } finally {
      setIsReconciling(false);
    }
  };

  const getHealthBadge = () => {
    if (isLoadingHealth || isLoadingSyncStatus)
      {return <Badge variant="secondary">Loading...</Badge>;}

    // Check enhanced sync status first if available
    if (syncStatus) {
      const hasCriticalIssues = syncStatus.sync.criticalIssues > 0;
      const hasIssues = syncStatus.sync.totalIssues > 0;
      const hasSystemIssues =
        syncStatus.metrics.failedEvents > 0 || syncStatus.metrics.pendingEvents > 50;

      if (hasCriticalIssues) {return <Badge variant="destructive">Critical Issues</Badge>;}
      if (hasIssues || hasSystemIssues) {return <Badge variant="secondary">Issues Detected</Badge>;}
      return <Badge variant="default">Healthy</Badge>;
    }

    // Fallback to legacy health check
    if (!syncHealth) {return <Badge variant="destructive">Unknown</Badge>;}
    const hasIssues = syncHealth.failedEvents > 0 || syncHealth.pendingEvents > 50;
    return (
      <Badge variant={hasIssues ? "destructive" : "default"}>
        {hasIssues ? "Issues Detected" : "Healthy"}
      </Badge>
    );
  };

  return (
    <Card className="w-full" data-testid="sync-admin-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Synchronization System
            </CardTitle>
            <CardDescription>
              Monitor and manage data synchronization across inventory, work orders, and crew
              assignments.
            </CardDescription>
          </div>
          {getHealthBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enhanced Metrics Overview */}
        {(syncStatus || syncHealth) && (
          <div className="space-y-4">
            {/* Data Quality Overview */}
            {syncStatus && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {syncStatus.sync.totalIssues}
                  </div>
                  <div className="text-sm text-muted-foreground">Data Issues</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {syncStatus.sync.criticalIssues}
                  </div>
                  <div className="text-sm text-muted-foreground">Critical Issues</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {syncStatus.sync.lastRun
                      ? new Date(syncStatus.sync.lastRun).toLocaleDateString()
                      : "Never"}
                  </div>
                  <div className="text-sm text-muted-foreground">Last Reconciliation</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {syncStatus.metrics.recentActivity}
                  </div>
                  <div className="text-sm text-muted-foreground">24h Activity</div>
                </div>
              </div>
            )}

            {/* System Metrics */}
            {syncHealth && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {syncHealth.totalJournalEntries}
                  </div>
                  <div className="text-sm text-muted-foreground">Journal Entries</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {syncHealth.pendingEvents}
                  </div>
                  <div className="text-sm text-muted-foreground">Pending Events</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{syncHealth.failedEvents}</div>
                  <div className="text-sm text-muted-foreground">Failed Events</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {syncHealth.recentActivity}
                  </div>
                  <div className="text-sm text-muted-foreground">24h Activity</div>
                </div>
              </div>
            )}

            {/* Recent Data Quality Activity */}
            {syncStatus?.sync.recentActivity.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Recent Data Quality Activity:</div>
                <div className="space-y-1">
                  {syncStatus.sync.recentActivity.slice(0, 3).map((activity) => (
                    <div key={activity} className="text-xs bg-muted p-2 rounded text-muted-foreground">
                      {activity}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleReconcile}
            disabled={isReconciling || reconcileMutation.isPending}
            className="flex items-center gap-2"
            data-testid="button-reconcile"
          >
            {isReconciling ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            Run Reconciliation
          </Button>

          <Button
            onClick={() => comprehensiveReconcileMutation.mutate()}
            disabled={comprehensiveReconcileMutation.isPending}
            className="flex items-center gap-2"
            data-testid="button-reconcile-comprehensive"
          >
            {comprehensiveReconcileMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            Data Quality Check
          </Button>

          <Button
            onClick={() => processEventsMutation.mutate()}
            disabled={processEventsMutation.isPending}
            variant="outline"
            className="flex items-center gap-2"
            data-testid="button-process-events"
          >
            {processEventsMutation.isPending ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Activity className="h-4 w-4" />
            )}
            Process Events
          </Button>

          <Button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["/api/sync/health"] });
              queryClient.invalidateQueries({ queryKey: ["/api/sync/status"] });
            }}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
            data-testid="button-refresh-metrics"
          >
            <BarChart3 className="h-4 w-4" />
            Refresh Metrics
          </Button>
        </div>

        {/* Status Information */}
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>
              Last updated: {syncHealth ? formatDate(syncHealth.timestamp) : "Never"}
            </span>
          </div>
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <div>
              <div>This system maintains consistency across:</div>
              <ul className="list-disc list-inside ml-4 mt-1">
                <li>Parts catalog ↔ Stock level cost synchronization</li>
                <li>Work order cost calculations and ROI updates</li>
                <li>Audit trails for all data changes</li>
                <li>Real-time event notifications</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Last Operation Result */}
        {lastResult && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Last Operation Result:</div>
            <pre className="text-xs bg-muted p-3 rounded-md overflow-auto">{lastResult}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
