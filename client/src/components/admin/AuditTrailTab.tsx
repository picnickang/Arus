/**
 * Audit Trail Tab Component
 *
 * Displays administrative actions and system events audit log.
 * Extracted from system-administration.tsx for better maintainability.
 */

import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminQueryFn } from "@/lib/admin-api";
import type { AdminAuditEvent } from "@shared/schema";
import { formatDate } from "@/lib/formatters";

function AuditTrailTabComponent() {
  const { data: auditEvents, isLoading } = useQuery({
    queryKey: ["/api/admin/audit"],
    queryFn: adminQueryFn(["/api/admin/audit"]),
    enabled: true,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-8">Loading audit trail...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Audit Trail</h3>
        <p className="text-sm text-muted-foreground">
          Complete log of administrative actions and system events
        </p>
      </div>

      <Card data-testid="card-audit-events">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(auditEvents ?? []).map((event: AdminAuditEvent) => (
                <TableRow key={event.id} data-testid={`row-audit-event-${event.id}`}>
                  <TableCell data-testid={`text-timestamp-${event.id}`}>
                    {event.createdAt ? formatDate(event.createdAt) : "N/A"}
                  </TableCell>
                  <TableCell className="font-medium" data-testid={`text-user-${event.id}`}>
                    {event.userId || "System"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" data-testid={`badge-action-${event.id}`}>
                      {event.action}
                    </Badge>
                  </TableCell>
                  <TableCell data-testid={`text-resource-${event.id}`}>
                    {event.resourceType}
                  </TableCell>
                  <TableCell
                    className="font-mono text-sm"
                    data-testid={`text-ip-address-${event.id}`}
                  >
                    {event.ipAddress || "N/A"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={event.outcome === "success" ? "default" : "destructive"}
                      data-testid={`badge-status-${event.id}`}
                    >
                      {event.outcome === "success" ? "Success" : "Failed"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {(!auditEvents || auditEvents.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No audit events found. Administrative actions will appear here.
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

export const AuditTrailTab = memo(AuditTrailTabComponent);
