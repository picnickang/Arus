// @ts-nocheck
import { useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { fetchReconciliationStatus, fetchReconciliationReport } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/formatters";
import type { ReconciliationStatus, ReconciliationReport } from "@shared/analytics-types";
import type { PDFSection, PDFTableData } from "@/lib/exportUtils";

export function useDataIntegrityData() {
  const { toast } = useToast();

  const {
    data: status,
    isLoading: statusLoading,
    error: statusError,
  } = useQuery<ReconciliationStatus>({
    queryKey: ["/api/analytics/reconciliation/status"],
    queryFn: () => fetchReconciliationStatus(),
    refetchInterval: 30000,
    staleTime: 0,
  });
  const {
    data: latestReport,
    isLoading: reportLoading,
    error: reportError,
  } = useQuery<ReconciliationReport>({
    queryKey: ["/api/analytics/reconciliation/latest-report"],
    queryFn: () => fetchReconciliationReport(),
    refetchInterval: 30000,
    staleTime: 0,
    retry: false,
  });

  const runReconciliation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/analytics/reconciliation/run"),
    onSuccess: () => {
      toast({
        title: "Reconciliation Started",
        description: "Data integrity check is now running in the background.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/reconciliation/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/reconciliation/latest-report"] });
    },
    onError: (error: Error) => {
      toast({ title: "Reconciliation Failed", description: error.message, variant: "destructive" });
    },
  });

  const healthPercentage = status?.totalRuns
    ? Math.round((status.successfulRuns / status.totalRuns) * 100)
    : 100;

  const exportPDFSections: PDFSection[] = useMemo(
    () =>
      status && latestReport
        ? [
            {
              title: "Service Status",
              content: [
                { key: "Status", value: status.enabled ? "Active" : "Disabled" },
                { key: "Total Runs", value: status.totalRuns.toString() },
                { key: "Successful Runs", value: status.successfulRuns.toString() },
                { key: "Failed Runs", value: status.failedRuns.toString() },
                { key: "Success Rate", value: `${healthPercentage}%` },
                { key: "Last Run", value: status.lastRun ? formatDate(status.lastRun) : "Never" },
              ],
            },
            {
              title: "Latest Reconciliation Report",
              content: [
                { key: "Timestamp", value: formatDate(latestReport.timestamp) },
                { key: "Status", value: latestReport.status },
                { key: "Total Issues", value: latestReport.totalIssues.toString() },
                {
                  key: "Critical Issues",
                  value: latestReport.issuesBySeverity.critical.toString(),
                },
                { key: "Warning Issues", value: latestReport.issuesBySeverity.warning.toString() },
                { key: "Info Issues", value: latestReport.issuesBySeverity.info.toString() },
              ],
            },
            {
              title: "Data Sources Checked",
              content: latestReport.dataSourcesChecked.map((source: string) => ({
                key: source,
                value: "✓ Validated",
              })),
            },
          ]
        : [],
    [status, latestReport, healthPercentage]
  );

  const exportTableData: PDFTableData | undefined = useMemo(
    () =>
      latestReport?.issues.length
        ? {
            headers: ["Severity", "Type", "Message", "Affected Records"],
            rows: latestReport.issues.map((issue) => [
              issue.severity,
              issue.issueType,
              issue.message,
              issue.affectedRecords?.toString() || "N/A",
            ]),
          }
        : undefined,
    [latestReport]
  );

  const exportCSVData = useMemo(
    () =>
      latestReport?.issues.length
        ? latestReport.issues.map((issue) => ({
            severity: issue.severity,
            issueType: issue.issueType,
            message: issue.message,
            affectedRecords: issue.affectedRecords?.toString() || "N/A",
          }))
        : [],
    [latestReport]
  );

  const handleRunReconciliation = useCallback(() => {
    runReconciliation.mutate();
  }, [runReconciliation]);

  return {
    status,
    statusLoading,
    statusError,
    latestReport,
    reportLoading,
    reportError,
    healthPercentage,
    runReconciliation,
    handleRunReconciliation,
    exportPDFSections,
    exportTableData,
    exportCSVData,
  };
}
