/**
 * Configuration Audit Log Tab Component
 * 
 * Displays configuration changes with hot-reload tracking.
 * Extracted from system-administration.tsx for better maintainability.
 */

import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { adminQueryFn } from "@/lib/admin-api";
import type { ConfigAuditLog } from "@shared/schema";
import { formatDate } from "@/lib/formatters";

function ConfigAuditLogTabComponent() {
  const {
    data: auditLogs,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["/api/admin/config-audit"],
    queryFn: adminQueryFn(["/api/admin/config-audit"]),
    enabled: true,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8" data-testid="loading-config-audit">
        Loading configuration audit log...
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">Configuration Audit Log</h3>
          <p className="text-sm text-muted-foreground">
            Track all configuration changes with hot-reload support
          </p>
        </div>
        <Card className="border-destructive" data-testid="error-config-audit">
          <CardHeader>
            <CardTitle className="text-destructive">Failed to Load Audit Log</CardTitle>
            <CardDescription>
              Unable to retrieve configuration audit log. Please check your connection or admin
              permissions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{(error)?.message || "Failed to load audit log"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium" data-testid="heading-config-audit">
          Configuration Audit Log
        </h3>
        <p className="text-sm text-muted-foreground">
          Track all configuration changes with hot-reload support
        </p>
      </div>

      <Card data-testid="card-config-audit-log">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Change Type</TableHead>
                <TableHead>Changed By</TableHead>
                <TableHead>Auto-Reload</TableHead>
                <TableHead>Requires Restart</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(auditLogs ?? []).map((log: ConfigAuditLog) => (
                <TableRow key={log.id} data-testid={`row-config-${log.id}`}>
                  <TableCell data-testid={`text-timestamp-${log.id}`}>
                    {log.changedAt ? formatDate(log.changedAt) : "N/A"}
                  </TableCell>
                  <TableCell className="font-mono text-sm" data-testid={`text-key-${log.id}`}>
                    {log.key}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" data-testid={`badge-change-type-${log.id}`}>
                      {log.changeType}
                    </Badge>
                  </TableCell>
                  <TableCell data-testid={`text-changed-by-${log.id}`}>
                    {log.changedByName || log.changedBy || "System"}
                  </TableCell>
                  <TableCell>
                    {log.autoReload ? (
                      <CheckCircle
                        className="h-4 w-4 text-green-500"
                        data-testid={`icon-auto-reload-${log.id}`}
                      />
                    ) : (
                      <span
                        className="text-muted-foreground"
                        data-testid={`text-no-reload-${log.id}`}
                      >
                        -
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {log.requiresRestart ? (
                      <AlertTriangle
                        className="h-4 w-4 text-yellow-500"
                        data-testid={`icon-restart-${log.id}`}
                      />
                    ) : (
                      <span
                        className="text-muted-foreground"
                        data-testid={`text-no-restart-${log.id}`}
                      >
                        -
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!auditLogs || auditLogs.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-muted-foreground"
                    data-testid="empty-config-audit"
                  >
                    No configuration changes recorded.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export const ConfigAuditLogTab = memo(ConfigAuditLogTabComponent);
