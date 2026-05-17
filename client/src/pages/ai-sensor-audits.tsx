import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Play,
  RefreshCw,
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/navigation";

interface AuditRun {
  id: string;
  runType: string;
  status: string;
  testsPassed: number;
  testsFailed: number;
  totalTests: number;
  executionTimeMs: number;
  diagnosticMetrics: Record<string, unknown>;
  modelPerformance: Record<string, unknown>;
  featureRankings: Array<{ feature: string; importance: number; [key: string]: unknown }>;
  triggeredBy: string;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

interface AuditStats {
  totalRuns: number;
  recentRuns: number;
  successRate: number;
  averageExecutionTime: number;
  lastRun: AuditRun | null;
}

export default function AISensorAudits() {
  const { toast } = useToast();
  const [selectedAudit, setSelectedAudit] = useState<AuditRun | null>(null);

  // Fetch audit history
  const { data: audits = [], isLoading: auditsLoading } = useQuery<AuditRun[]>({
    queryKey: ["/api/ai/sensor-optimization/audits"],
  });

  // Fetch audit stats
  const { data: stats } = useQuery<AuditStats>({
    queryKey: ["/api/ai/sensor-optimization/audit-stats"],
  });

  // Run audit mutation
  const runAuditMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/ai/sensor-optimization/audit", {
        method: "POST",
        body: JSON.stringify({ runType: "manual", triggeredBy: "admin-dashboard" }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Audit Started",
        description: "AI Sensor Optimization audit is now running...",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/sensor-optimization/audits"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/sensor-optimization/audit-stats"] });
    },
    onError: (error) => {
      toast({
        title: "Audit Failed",
        description: error instanceof Error ? error.message : "Failed to start audit",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string, testsPassed: number, testsFailed: number) => {
    if (status === "running") {
      return (
        <Badge
          variant="outline"
          className="bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
        >
          <Clock className="w-3 h-3 mr-1" />
          Running
        </Badge>
      );
    }

    if (status === "failed") {
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" />
          Failed
        </Badge>
      );
    }

    if (testsFailed === 0) {
      return (
        <Badge variant="default" className="bg-green-500">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Pass
        </Badge>
      );
    }
    return (
      <Badge
        variant="outline"
        className="bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400"
      >
        <AlertCircle className="w-3 h-3 mr-1" />
        Partial
      </Badge>
    );
  };

  return (
    <div className="min-h-screen">
      <PageHeader title="AI Sensor Optimization Audits" />
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-end">
          <Button
            data-testid="button-run-audit"
            onClick={() => runAuditMutation.mutate()}
            disabled={runAuditMutation.isPending}
          >
            {runAuditMutation.isPending ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run Audit
              </>
            )}
          </Button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card data-testid="card-total-runs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Runs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalRuns}</div>
              </CardContent>
            </Card>

            <Card data-testid="card-success-rate">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Success Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</div>
              </CardContent>
            </Card>

            <Card data-testid="card-avg-time">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Avg Execution Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(stats.averageExecutionTime / 1000).toFixed(1)}s
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-recent-runs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Recent Runs (30d)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.recentRuns}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Audit History Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Audit History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {auditsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading audit history...</div>
            ) : audits.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No audits run yet. Click "Run Audit" to start your first validation.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Run Type</TableHead>
                      <TableHead>Tests Passed</TableHead>
                      <TableHead>Execution Time</TableHead>
                      <TableHead>Started At</TableHead>
                      <TableHead>Triggered By</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audits.map((audit) => (
                      <TableRow key={audit.id} data-testid={`row-audit-${audit.id}`}>
                        <TableCell>
                          {getStatusBadge(audit.status, audit.testsPassed, audit.testsFailed)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{audit.runType}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono">
                            {audit.testsPassed}/{audit.totalTests}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono">
                            {audit.executionTimeMs
                              ? `${(audit.executionTimeMs / 1000).toFixed(1)}s`
                              : "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {format(new Date(audit.startedAt), "MMM d, yyyy HH:mm")}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {audit.triggeredBy}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            data-testid={`button-view-${audit.id}`}
                            onClick={() => setSelectedAudit(audit)}
                          >
                            View Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audit Details Modal */}
        {selectedAudit && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Audit Run Details</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedAudit(null)}>
                    Close
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Status</div>
                    <div className="mt-1">
                      {getStatusBadge(
                        selectedAudit.status,
                        selectedAudit.testsPassed,
                        selectedAudit.testsFailed
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Execution Time</div>
                    <div className="mt-1 font-mono">
                      {(selectedAudit.executionTimeMs / 1000).toFixed(2)}s
                    </div>
                  </div>
                </div>

                {selectedAudit.modelPerformance && (
                  <div>
                    <h3 className="font-semibold mb-2">Model Performance</h3>
                    <div className="grid grid-cols-3 gap-4">
                      {Object.entries(selectedAudit.modelPerformance).map(
                        // @ts-ignore -- bulk-silence
                        ([model, perf]: [string, { accuracy: string; trainingTimeMs: number }]) => (
                          <Card key={model}>
                            <CardHeader className="pb-2">
                              <CardTitle className="text-sm">{model.toUpperCase()}</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="text-2xl font-bold">{perf.accuracy}</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {perf.trainingTimeMs}ms
                              </div>
                            </CardContent>
                          </Card>
                        )
                      )}
                    </div>
                  </div>
                )}

                {selectedAudit.featureRankings && selectedAudit.featureRankings.length > 0 && (
                  <div>
                    <h3 className="font-semibold mb-2">Feature Rankings</h3>
                    <div className="space-y-2">
                      {selectedAudit.featureRankings.map((ranking, i) => (
                        <div key={i} className="flex items-center justify-between">
                          {/* @ts-ignore */}
                          <span className="text-sm">{ranking.sensor}</span>
                          {/* @ts-ignore */}
                          <Badge variant="outline">{ranking.confidence.toFixed(1)}%</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedAudit.errorMessage && (
                  <div className="bg-destructive/10 p-4 rounded border border-destructive/20">
                    <h3 className="font-semibold text-destructive mb-2">Error</h3>
                    <pre className="text-sm whitespace-pre-wrap">{selectedAudit.errorMessage}</pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
