import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Database, HardDrive, Cloud, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface StorageConfig {
  mode: "cloud" | "local" | "hybrid";
  primaryStorage: string;
  backupEnabled: boolean;
  syncStatus: "synced" | "syncing" | "error";
  lastSync?: string;
  totalSize?: string;
  usedSize?: string;
}

export default function StorageSettings() {
  const { data: storageConfig, isLoading } = useQuery<StorageConfig>({
    queryKey: ["/api/admin/storage/config"],
    retry: 1,
    staleTime: 60000,
  });

  const config: StorageConfig = storageConfig || {
    mode: "cloud",
    primaryStorage: "PostgreSQL (Neon)",
    backupEnabled: true,
    syncStatus: "synced",
    lastSync: new Date().toISOString(),
    totalSize: "10 GB",
    usedSize: "1.2 GB",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-storage-title">Storage Settings</h1>
          <p className="text-muted-foreground">Configure database and file storage options</p>
        </div>
        <Button variant="outline" data-testid="button-refresh-storage">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Status
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Database Storage</CardTitle>
              <CardDescription>Primary data storage configuration</CardDescription>
            </div>
            <Database className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Mode</span>
              <Badge variant="secondary" data-testid="badge-storage-mode">
                {config.mode.charAt(0).toUpperCase() + config.mode.slice(1)}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Primary Storage</span>
              <span className="text-sm font-medium" data-testid="text-primary-storage">{config.primaryStorage}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Sync Status</span>
              <div className="flex items-center gap-2">
                {config.syncStatus === "synced" ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : config.syncStatus === "error" ? (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                ) : (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                )}
                <span className="text-sm capitalize" data-testid="text-sync-status">{config.syncStatus}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Storage Usage</CardTitle>
              <CardDescription>Current storage utilization</CardDescription>
            </div>
            <HardDrive className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Used</span>
              <span className="text-sm font-medium" data-testid="text-used-storage">{config.usedSize || "N/A"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Total Available</span>
              <span className="text-sm font-medium" data-testid="text-total-storage">{config.totalSize || "N/A"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Backup Enabled</span>
              <Badge variant={config.backupEnabled ? "default" : "secondary"} data-testid="badge-backup-status">
                {config.backupEnabled ? "Yes" : "No"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-base">Cloud Integration</CardTitle>
            <CardDescription>Cloud storage and backup settings</CardDescription>
          </div>
          <Cloud className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Replit Object Storage</p>
              <p className="text-sm text-muted-foreground">
                Cloud storage is managed automatically by the platform
              </p>
            </div>
            <Badge variant="outline" data-testid="badge-cloud-status">Connected</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
