import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ExportButton } from "@/components/ui/export-button";
import {
  Shield,
  Database,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Clock,
  FileWarning,
  Activity,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { formatDate } from "@/lib/formatters";
import { DataQualityChart } from "@/components/charts/DataQualityChart";
import { IssueTypeChart } from "@/components/charts/IssueTypeChart";
import { useDataIntegrityData } from "@/features/analytics";

function LoadingSkeleton() {
  return (
    <div className="space-y-6 p-6" data-testid="loading-integrity-dashboard">
      <Skeleton className="h-32 w-full" data-testid="skeleton-header" />
      <Skeleton className="h-64 w-full" data-testid="skeleton-cards" />
      <Skeleton className="h-96 w-full" data-testid="skeleton-report" />
    </div>
  );
}

function ErrorAlert({ error }: { error: Error | unknown }) {
  const message = error instanceof Error ? error.message : "Unknown error";
  return (
    <div className="space-y-6 p-6">
      <Alert variant="destructive" data-testid="alert-status-error">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription data-testid="text-status-error-message">
          Failed to load reconciliation status: {message}
        </AlertDescription>
      </Alert>
    </div>
  );
}

function getHealthRating(percentage: number): {
  variant: "default" | "secondary" | "destructive";
  label: string;
} {
  if (percentage >= 95) {
    return { variant: "default", label: "Excellent" };
  }
  if (percentage >= 80) {
    return { variant: "secondary", label: "Good" };
  }
  return { variant: "destructive", label: "Poor" };
}

function getReportStatusVariant(status: string): "default" | "destructive" | "secondary" {
  if (status === "completed") {
    return "default";
  }
  if (status === "failed") {
    return "destructive";
  }
  return "secondary";
}

function getSeverityVariant(severity: string): "destructive" | "secondary" | "outline" {
  if (severity === "critical") {
    return "destructive";
  }
  if (severity === "warning") {
    return "secondary";
  }
  return "outline";
}

function getNoReportMessage(reportError: Error | unknown): string {
  if (reportError instanceof Error && reportError.message.includes("404")) {
    return 'No reconciliation report available yet. Click "Run Integrity Check" to generate the first report.';
  }

  if (reportError) {
    const errorMsg = reportError instanceof Error ? reportError.message : "Unknown error";
    return `Failed to load reconciliation report: ${errorMsg}`;
  }
  return "No reconciliation report available. The report will appear after the first data integrity check completes.";
}

export function DataIntegrityDashboard() {
  const {
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
  } = useDataIntegrityData();

  if (statusLoading || reportLoading) {
    return <LoadingSkeleton />;
  }
  if (statusError) {
    return <ErrorAlert error={statusError} />;
  }

  const healthRating = getHealthRating(healthPercentage);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Data Integrity Monitor
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Automated telemetry validation and consistency checks
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            data={exportCSVData}
            filename="data-integrity-report"
            formats={exportTableData ? ["csv", "pdf", "pdf-table"] : ["csv", "pdf"]}
            pdfSections={exportPDFSections}
            pdfTableData={exportTableData}
            csvOptions={{
              columns: ["severity", "issueType", "message", "affectedRecords"],
              headers: {
                severity: "Severity",
                issueType: "Issue Type",
                message: "Message",
                affectedRecords: "Affected Records",
              },
            }}
            pdfOptions={{
              title: "Data Integrity Report",
              subtitle: `Generated on ${formatDate(new Date())}`,
            }}
            variant="outline"
            size="default"
            data-testid="button-export-report"
          />
          <Button
            onClick={handleRunReconciliation}
            disabled={status?.isRunning || runReconciliation.isPending}
            data-testid="button-run-reconciliation"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${status?.isRunning || runReconciliation.isPending ? "animate-spin" : ""}`}
            />
            {status?.isRunning ? "Running..." : "Run Check"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-status">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Service Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {status?.enabled ? (
                <>
                  <CheckCircle2
                    className="h-5 w-5 text-green-500"
                    data-testid="icon-service-active"
                  />
                  <span className="text-2xl font-bold text-green-600" data-testid="status-service">
                    Active
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle
                    className="h-5 w-5 text-amber-500"
                    data-testid="icon-service-disabled"
                  />
                  <span className="text-2xl font-bold text-amber-600" data-testid="status-service">
                    Disabled
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Scheduled runs every 60 minutes</p>
          </CardContent>
        </Card>
        <Card data-testid="card-last-run">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Run</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-last-run">
              {status?.lastRun
                ? formatDistanceToNow(new Date(status.lastRun), { addSuffix: true })
                : "Never"}
            </div>
            {status?.nextScheduledRun && (
              <p className="text-xs text-muted-foreground mt-2" data-testid="text-next-run">
                Next: {formatDistanceToNow(new Date(status.nextScheduledRun), { addSuffix: true })}
              </p>
            )}
          </CardContent>
        </Card>
        <Card data-testid="card-health-score">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Health Score</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold" data-testid="text-health-score">
                {healthPercentage}%
              </span>
              <Badge variant={healthRating.variant} data-testid="badge-health-rating">
                {healthRating.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2" data-testid="text-successful-runs">
              {status?.successfulRuns || 0} / {status?.totalRuns || 0} successful runs
            </p>
          </CardContent>
        </Card>
        <Card data-testid="card-total-runs">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Checks</CardTitle>
            <FileWarning className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-runs">
              {status?.totalRuns || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-2" data-testid="text-failed-runs">
              {status?.failedRuns || 0} failed checks
            </p>
          </CardContent>
        </Card>
      </div>

      {status?.isRunning && (
        <Alert data-testid="alert-running">
          <RefreshCw className="h-4 w-4 animate-spin" data-testid="icon-running" />
          <AlertDescription data-testid="text-running-message">
            Data integrity check is currently running. This may take a few minutes depending on data
            volume.
          </AlertDescription>
        </Alert>
      )}

      {latestReport && (
        <Card data-testid="card-latest-report">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Latest Reconciliation Report
            </CardTitle>
            <CardDescription data-testid="text-report-metadata">
              Run completed{" "}
              {formatDistanceToNow(new Date(latestReport.timestamp), { addSuffix: true })}
              {" • "}Duration: {(latestReport.duration / 1000).toFixed(2)}s
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Checks</p>
                <p className="text-2xl font-bold" data-testid="text-total-checks">
                  {latestReport.totalChecks}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Issues Found</p>
                <p
                  className={`text-2xl font-bold ${latestReport.issuesFound > 0 ? "text-amber-600" : "text-green-600"}`}
                  data-testid="text-issues-found"
                >
                  {latestReport.issuesFound}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge
                  variant={getReportStatusVariant(latestReport.status)}
                  data-testid="badge-report-status"
                >
                  {latestReport.status}
                </Badge>
              </div>
            </div>
            {latestReport.issues && latestReport.issues.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Validation Issues</h4>
                <div className="space-y-2">
                  {latestReport.issues.map(
                    (
                      issue: {
                        type: string;
                        severity: string;
                        description: string;
                        table: string;
                        count: number;
                      },
                      index: number
                    ) => (
                      <div
                        key={`${issue.type}-${issue.table}-${issue.severity}`}
                        className="flex items-start justify-between p-3 border rounded-lg"
                        data-testid={`issue-${issue.type}-${index}`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              variant={getSeverityVariant(issue.severity)}
                              data-testid={`badge-severity-${issue.severity}`}
                            >
                              {issue.severity}
                            </Badge>
                            <span
                              className="font-medium text-sm"
                              data-testid={`text-issue-type-${index}`}
                            >
                              {issue.type}
                            </span>
                          </div>
                          <p
                            className="text-sm text-muted-foreground"
                            data-testid={`text-issue-description-${index}`}
                          >
                            {issue.description}
                          </p>
                          <p
                            className="text-xs text-muted-foreground mt-1"
                            data-testid={`text-issue-table-${index}`}
                          >
                            Table: {issue.table}
                          </p>
                        </div>
                        <div className="text-right">
                          <p
                            className="text-lg font-bold"
                            data-testid={`text-issue-count-${index}`}
                          >
                            {issue.count}
                          </p>
                          <p className="text-xs text-muted-foreground">records</p>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
            {latestReport.issues && latestReport.issues.length === 0 && (
              <Alert data-testid="alert-success">
                <CheckCircle2 className="h-4 w-4 text-green-500" data-testid="icon-success" />
                <AlertDescription className="text-green-600" data-testid="text-success-message">
                  No data integrity issues detected in the last reconciliation run.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {!latestReport && !reportLoading && (
        <Alert data-testid="alert-no-report">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription data-testid="text-no-report-message">
            {getNoReportMessage(reportError)}
          </AlertDescription>
        </Alert>
      )}

      {latestReport?.issues && latestReport.issues.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          <DataQualityChart
            report={latestReport}
            isLoading={reportLoading}
            error={reportError instanceof Error ? reportError.message : null}
            data-testid="chart-data-quality"
          />
          <IssueTypeChart
            report={latestReport}
            isLoading={reportLoading}
            error={reportError instanceof Error ? reportError.message : null}
            data-testid="chart-issue-type"
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>About Data Reconciliation</CardTitle>
          <CardDescription>
            Automated background service ensuring data integrity across the system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                What it checks
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
                <li>Orphaned telemetry records without valid equipment</li>
                <li>Data points missing organization context</li>
                <li>Cross-tenant data contamination</li>
                <li>Referential integrity violations</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />
                How it works
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 ml-6 list-disc">
                <li>Runs automatically every 60 minutes</li>
                <li>Non-blocking background processing</li>
                <li>Detailed reporting and metrics</li>
                <li>Manual triggers available for immediate checks</li>
              </ul>
            </div>
          </div>
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              This service helps maintain data quality and prevents integrity issues that could
              affect analytics accuracy or system performance. All validation runs are logged and
              tracked for audit purposes.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
