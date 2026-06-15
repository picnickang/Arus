import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DesktopConnectionPanel } from "@/components/admin/DesktopConnectionPanel";
import { DesktopUpdatePanel } from "@/components/admin/DesktopUpdatePanel";
import { useSoftwareUpdatesData } from "@/features/settings";
import { formatDate } from "@/lib/formatters";
import type { SoftwarePatch } from "@shared/schema";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  Download,
  Github,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { GitHubSettingsTab } from "./system-administration-github-settings-tab";

export function SoftwareUpdatesTab() {
  const s = useSoftwareUpdatesData();

  if (s.isDesktopEnv) {
    return (
      <div className="space-y-6">
        <DesktopConnectionPanel />
        <DesktopUpdatePanel />
      </div>
    );
  }

  if (s.isLoading) {
    return (
      <div className="flex items-center justify-center py-8" data-testid="loading-software-updates">
        Loading software updates...
      </div>
    );
  }

  if (s.hasError) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Software Updates</h3>
            <p className="text-sm text-muted-foreground">
              Manage system updates, patches, and auto-update configuration
            </p>
          </div>
        </div>
        <Card className="border-destructive" data-testid="error-software-updates">
          <CardHeader>
            <CardTitle className="text-destructive">Failed to Load Updates</CardTitle>
            <CardDescription>
              Unable to retrieve software update information. Please check your connection or admin
              permissions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {s.errors.patches && <p data-testid="error-patches">Patches: {s.errors.patches}</p>}
              {s.errors.history && <p data-testid="error-history">History: {s.errors.history}</p>}
              {s.errors.settings && (
                <p data-testid="error-settings">Settings: {s.errors.settings}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DesktopUpdatePanel />
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium" data-testid="heading-software-updates">
            Server Patch Management
          </h3>
          <p className="text-sm text-muted-foreground">
            Manage server-side updates, patches, and auto-update configuration
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => s.checkUpdatesMutation.mutate()}
          disabled={s.checkUpdatesMutation.isPending}
          data-testid="button-check-updates"
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${s.checkUpdatesMutation.isPending ? "animate-spin" : ""}`}
          />
          Check for Updates
        </Button>
      </div>
      <Tabs defaultValue="available" className="space-y-4">
        <TabsList className="inline-flex h-10 items-center justify-start rounded-md bg-muted p-1 text-muted-foreground">
          <TabsTrigger value="available" data-testid="tab-available-updates">
            Available Updates
          </TabsTrigger>
          {/* Phase 2: "Publish Update" tab removed from the visible nav.
              The publish flow had no backing backend route, so it could
              never succeed. See the "publish" TabsContent below for the
              honest "unavailable" notice retained for any deep link. */}
          <TabsTrigger value="github" data-testid="tab-github-releases">
            <Github className="mr-2 h-4 w-4" />
            GitHub
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-update-settings">
            Auto-Update Settings
          </TabsTrigger>
        </TabsList>
        <TabsContent value="available" className="space-y-4">
          <Card data-testid="card-available-updates">
            <CardHeader>
              <CardTitle>Available Updates</CardTitle>
              <CardDescription>
                Software patches ready for download and installation
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Released</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(s.patches ?? [])
                    .filter((patch: SoftwarePatch) => patch.status === "available")
                    .map((patch: SoftwarePatch) => (
                      <TableRow key={patch.id} data-testid={`row-patch-${patch.id}`}>
                        <TableCell className="font-medium" data-testid={`text-version-${patch.id}`}>
                          {patch.version}
                        </TableCell>
                        <TableCell data-testid={`text-from-version-${patch.id}`}>
                          {patch.fromVersion}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              s.getSeverityColor(patch.severity) as
                                | "default"
                                | "secondary"
                                | "destructive"
                                | "outline"
                            }
                            data-testid={`badge-severity-${patch.id}`}
                          >
                            {patch.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              s.getStatusColor(patch.status) as
                                | "default"
                                | "secondary"
                                | "destructive"
                                | "outline"
                            }
                            data-testid={`badge-status-${patch.id}`}
                          >
                            {patch.status}
                          </Badge>
                        </TableCell>
                        <TableCell data-testid={`text-size-${patch.id}`}>
                          {patch.fileSize
                            ? `${(patch.fileSize / 1024 / 1024).toFixed(2)} MB`
                            : "N/A"}
                        </TableCell>
                        <TableCell data-testid={`text-released-${patch.id}`}>
                          {patch.createdAt ? new Date(patch.createdAt).toLocaleDateString() : "N/A"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => s.downloadMutation.mutate(patch.id)}
                              disabled={s.downloadMutation.isPending}
                              data-testid={`button-download-${patch.id}`}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => s.setSelectedPatch(patch)}
                              data-testid={`button-details-${patch.id}`}
                            >
                              Details
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  {(!s.patches ||
                    s.patches.filter((patch: SoftwarePatch) => patch.status === "available")
                      .length === 0) && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-8 text-muted-foreground"
                        data-testid="empty-available-updates"
                      >
                        <CheckCircle className="mx-auto h-12 w-12 mb-2 text-green-500" />
                        <p>System is up to date. No updates available.</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card data-testid="card-patch-history">
            <CardHeader>
              <CardTitle>Patch History</CardTitle>
              <CardDescription>Previously applied patches and rollback points</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Applied At</TableHead>
                    <TableHead>Applied By</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(s.patchHistory ?? []).slice(0, 10).map((patch) => (
                    <TableRow key={patch.id} data-testid={`row-history-${patch.id}`}>
                      <TableCell
                        className="font-medium"
                        data-testid={`text-history-version-${patch.id}`}
                      >
                        {patch.version}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            s.getStatusColor(patch.status) as
                              | "default"
                              | "secondary"
                              | "destructive"
                              | "outline"
                          }
                          data-testid={`badge-history-status-${patch.id}`}
                        >
                          {patch.status}
                        </Badge>
                      </TableCell>
                      <TableCell data-testid={`text-applied-at-${patch.id}`}>
                        {patch.appliedAt ? formatDate(patch.appliedAt) : "N/A"}
                      </TableCell>
                      <TableCell data-testid={`text-applied-by-${patch.id}`}>
                        {patch.appliedBy || "System"}
                      </TableCell>
                      <TableCell>
                        {patch.status === "applied" && patch.backupId && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              patch.backupId && s.rollbackMutation.mutate(patch.backupId)
                            }
                            disabled={s.rollbackMutation.isPending}
                            data-testid={`button-rollback-${patch.id}`}
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Rollback
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!s.patchHistory || s.patchHistory.length === 0) && (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-8 text-muted-foreground"
                        data-testid="empty-patch-history"
                      >
                        No patch history available.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="publish" className="space-y-4">
          {/*
            Phase 2: the publish-update flow is intentionally disabled.
            There is no backing backend route to create/publish a patch,
            so the previous form could never succeed. We render an honest
            "unavailable" notice instead of a broken form + fake toast.
            Rebuilding a real patch-publishing backend is out of scope.
          */}
          <Card data-testid="card-publish-update">
            <CardHeader>
              <CardTitle>Publish Software Update</CardTitle>
              <CardDescription>
                Publishing software updates from the app is not available.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-300"
                data-testid="notice-publish-unavailable"
              >
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">Publishing unavailable</div>
                  <p className="mt-0.5 text-xs">
                    This environment has no patch-publishing service, so updates cannot be created
                    or published here. Releases are managed directly in your deployment pipeline.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="github" className="space-y-4">
          <GitHubSettingsTab />
        </TabsContent>
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Auto-Update Configuration</CardTitle>
              <CardDescription>
                Configure automatic update behavior for server deployments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>Auto-update configuration coming soon</p>
                <p className="text-sm mt-2">
                  Configure maintenance windows and automatic patch deployment
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
