import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface WarehouseExportEntry {
  date: string;
  parquetKey: string;
  rowCount: number;
  exportedAt: string;
  sizeBytes: number;
}

interface WarehouseExportRunSummary {
  orgId: string;
  date: string;
  status: "exported" | "skipped-empty" | "failed";
  rowCount: number;
  sizeBytes: number;
  durationMs: number;
  parquetKey?: string;
  errorMessage?: string;
  startedAt: string;
  finishedAt: string;
}

interface WarehouseExportJobSummary {
  date: string;
  orgsTotal: number;
  orgsExported: number;
  orgsSkipped: number;
  orgsFailed: number;
  rowsExported: number;
  bytesExported: number;
  retentionDeleted: number;
  durationMs: number;
  perOrg: WarehouseExportRunSummary[];
}

interface WarehouseManifest {
  orgId: string;
  updatedAt: string;
  exports: WarehouseExportEntry[];
}

interface StatusResponse {
  recentRuns: WarehouseExportJobSummary[];
  manifest: WarehouseManifest | null;
  retentionDays: number;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  const rs = Math.round(s - m * 60);
  return `${m}m ${rs}s`;
}

function statusBadge(status: WarehouseExportRunSummary["status"]) {
  if (status === "exported") return <Badge data-testid={`badge-status-${status}`}>Exported</Badge>;
  if (status === "skipped-empty")
    return (
      <Badge variant="secondary" data-testid={`badge-status-${status}`}>
        Skipped (empty)
      </Badge>
    );
  return (
    <Badge variant="destructive" data-testid={`badge-status-${status}`}>
      Failed
    </Badge>
  );
}

function findGaps(entries: WarehouseExportEntry[]): string[] {
  if (entries.length < 2) return [];
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));
  const gaps: string[] = [];
  const oneDay = 24 * 60 * 60 * 1000;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(`${sorted[i - 1]!.date}T00:00:00Z`).getTime();
    const cur = new Date(`${sorted[i]!.date}T00:00:00Z`).getTime();
    let cursor = prev + oneDay;
    while (cursor < cur) {
      gaps.push(new Date(cursor).toISOString().slice(0, 10));
      cursor += oneDay;
    }
  }
  return gaps;
}

function yesterdayUtcDateStr(): string {
  const now = new Date();
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(todayStart - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function AdminTelemetryWarehousePage() {
  const { toast } = useToast();
  const [orgIdInput, setOrgIdInput] = useState("");
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [rerunDate, setRerunDate] = useState(yesterdayUtcDateStr());
  const [rerunOrgIds, setRerunOrgIds] = useState("");

  const statusQuery = useQuery<StatusResponse>({
    queryKey: ["/api/admin/telemetry-warehouse/status", { limit: 14 }],
  });

  const manifestQuery = useQuery<StatusResponse>({
    queryKey: [
      "/api/admin/telemetry-warehouse/status",
      { limit: 1, orgId: selectedOrgId ?? "" },
    ],
    enabled: !!selectedOrgId,
  });

  const rerunMutation = useMutation({
    mutationFn: async (body: { date: string; orgIds?: string[] }) =>
      apiRequest<WarehouseExportJobSummary>(
        "POST",
        "/api/admin/telemetry-warehouse/run",
        body,
      ),
    onSuccess: (summary) => {
      toast({
        title: "Export run complete",
        description: `${summary.date}: ${summary.orgsExported} exported, ${summary.orgsSkipped} skipped, ${summary.orgsFailed} failed`,
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/admin/telemetry-warehouse/status"],
      });
    },
    onError: (e: unknown) =>
      toast({
        title: "Re-run failed",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      }),
  });

  const manifest = manifestQuery.data?.manifest ?? null;
  const gaps = useMemo(() => (manifest ? findGaps(manifest.exports) : []), [manifest]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">
          Telemetry Warehouse Exports
        </h1>
        <p className="text-sm text-muted-foreground">
          Daily Parquet exports of rolled-up telemetry to object storage.{" "}
          {statusQuery.data?.retentionDays
            ? `Retention: ${statusQuery.data.retentionDays} days.`
            : "Retention not configured."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
        </CardHeader>
        <CardContent>
          {statusQuery.isLoading ? (
            <p data-testid="text-runs-loading">Loading…</p>
          ) : (statusQuery.data?.recentRuns ?? []).length === 0 ? (
            <p
              className="text-sm text-muted-foreground"
              data-testid="text-runs-empty"
            >
              No runs recorded since process start. Trigger a re-run below or
              wait for the next nightly job.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Orgs (ok / skip / fail)</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                  <TableHead className="text-right">Size</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead className="text-right">Retention pruned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(statusQuery.data?.recentRuns ?? []).map((run, idx) => (
                  <RunRow key={`${run.date}-${idx}`} run={run} index={idx} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inspect org manifest</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-end">
            <div className="flex-1">
              <Label htmlFor="manifest-org-id">Org ID</Label>
              <Input
                id="manifest-org-id"
                data-testid="input-manifest-org-id"
                value={orgIdInput}
                onChange={(e) => setOrgIdInput(e.target.value)}
                placeholder="acme-corp"
              />
            </div>
            <Button
              data-testid="button-load-manifest"
              disabled={!orgIdInput.trim()}
              onClick={() => setSelectedOrgId(orgIdInput.trim())}
            >
              Load manifest
            </Button>
          </div>

          {selectedOrgId && (
            <div className="space-y-3">
              {manifestQuery.isLoading ? (
                <p data-testid="text-manifest-loading">Loading manifest…</p>
              ) : !manifest ? (
                <p
                  className="text-sm text-muted-foreground"
                  data-testid="text-manifest-empty"
                >
                  No manifest found for{" "}
                  <span className="font-mono">{selectedOrgId}</span>.
                </p>
              ) : (
                <>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-mono" data-testid="text-manifest-org">
                      {manifest.orgId}
                    </span>{" "}
                    · {manifest.exports.length} export
                    {manifest.exports.length === 1 ? "" : "s"} · updated{" "}
                    {new Date(manifest.updatedAt).toLocaleString()}
                  </div>

                  {gaps.length > 0 && (
                    <div
                      className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"
                      data-testid="alert-manifest-gaps"
                    >
                      <div className="font-medium text-destructive">
                        {gaps.length} missing date{gaps.length === 1 ? "" : "s"}{" "}
                        between earliest and latest export
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {gaps.slice(0, 30).map((d) => (
                          <Badge
                            key={d}
                            variant="destructive"
                            className="font-mono text-xs"
                            data-testid={`badge-gap-${d}`}
                          >
                            {d}
                          </Badge>
                        ))}
                        {gaps.length > 30 && (
                          <span className="text-xs text-muted-foreground">
                            +{gaps.length - 30} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Rows</TableHead>
                        <TableHead className="text-right">Size</TableHead>
                        <TableHead>Exported at</TableHead>
                        <TableHead>Parquet key</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {manifest.exports.map((e) => (
                        <TableRow
                          key={e.date}
                          data-testid={`row-manifest-${e.date}`}
                        >
                          <TableCell className="font-mono text-sm">
                            {e.date}
                          </TableCell>
                          <TableCell className="text-right">
                            {e.rowCount.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatBytes(e.sizeBytes)}
                          </TableCell>
                          <TableCell className="text-xs">
                            {new Date(e.exportedAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-mono text-xs break-all">
                            {e.parquetKey}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Re-run export for date</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Re-runs are overwrite-idempotent on the same UTC date. Leave Org IDs
            blank to re-run for every org that has rollups for the date.
          </p>
          <div className="flex flex-col md:flex-row gap-3 items-end">
            <div>
              <Label htmlFor="rerun-date">UTC date</Label>
              <Input
                id="rerun-date"
                type="date"
                data-testid="input-rerun-date"
                value={rerunDate}
                onChange={(e) => setRerunDate(e.target.value)}
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="rerun-org-ids">
                Org IDs (comma-separated, optional)
              </Label>
              <Input
                id="rerun-org-ids"
                data-testid="input-rerun-org-ids"
                value={rerunOrgIds}
                onChange={(e) => setRerunOrgIds(e.target.value)}
                placeholder="acme-corp, beta-inc"
              />
            </div>
            <Button
              data-testid="button-rerun-export"
              disabled={!rerunDate || rerunMutation.isPending}
              onClick={() => {
                const orgIds = rerunOrgIds
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean);
                rerunMutation.mutate({
                  date: rerunDate,
                  ...(orgIds.length > 0 && { orgIds }),
                });
              }}
            >
              {rerunMutation.isPending ? "Running…" : "Re-run export"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RunRow({
  run,
  index,
}: {
  run: WarehouseExportJobSummary;
  index: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TableRow data-testid={`row-run-${index}`}>
        <TableCell className="font-mono text-sm">
          <button
            type="button"
            className="underline-offset-2 hover:underline"
            data-testid={`button-toggle-run-${index}`}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "▾" : "▸"} {run.date}
          </button>
        </TableCell>
        <TableCell className="text-sm">
          <span data-testid={`text-run-orgs-${index}`}>
            {run.orgsExported} / {run.orgsSkipped} /{" "}
            <span
              className={run.orgsFailed > 0 ? "text-destructive font-medium" : ""}
            >
              {run.orgsFailed}
            </span>{" "}
            <span className="text-muted-foreground">
              of {run.orgsTotal}
            </span>
          </span>
        </TableCell>
        <TableCell className="text-right">
          {run.rowsExported.toLocaleString()}
        </TableCell>
        <TableCell className="text-right">
          {formatBytes(run.bytesExported)}
        </TableCell>
        <TableCell className="text-right">
          {formatDuration(run.durationMs)}
        </TableCell>
        <TableCell className="text-right">{run.retentionDeleted}</TableCell>
      </TableRow>
      {open && (
        <TableRow data-testid={`row-run-details-${index}`}>
          <TableCell colSpan={6} className="bg-muted/40 p-3">
            {run.perOrg.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No per-org results recorded.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Org ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Rows</TableHead>
                    <TableHead className="text-right">Size</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {run.perOrg.map((o) => (
                    <TableRow
                      key={`${o.orgId}-${o.date}`}
                      data-testid={`row-perorg-${o.orgId}`}
                    >
                      <TableCell className="font-mono text-xs">
                        {o.orgId}
                      </TableCell>
                      <TableCell>{statusBadge(o.status)}</TableCell>
                      <TableCell className="text-right">
                        {o.rowCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatBytes(o.sizeBytes)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatDuration(o.durationMs)}
                      </TableCell>
                      <TableCell className="text-xs text-destructive break-all">
                        {o.errorMessage ?? ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
