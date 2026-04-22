import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Bell, BellOff, CheckCircle } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";
import { SeverityBadge } from "./_shared";
import type { RmsAlert } from "./_shared";

export function AlertsTab({
  alerts,
  alertsLoading,
  acknowledgeMutation,
}: {
  alerts: RmsAlert[];
  alertsLoading: boolean;
  acknowledgeMutation: UseMutationResult<void, Error, string, unknown>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Alert History</CardTitle>
        <CardDescription>All triggered alerts in the last 7 days</CardDescription>
      </CardHeader>
      <CardContent>
        {alertsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No alerts in the selected period</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severity</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Vessel</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.id} data-testid={`alert-table-row-${alert.id}`}>
                    <TableCell>
                      <SeverityBadge severity={alert.severity} />
                    </TableCell>
                    <TableCell className="font-medium max-w-[300px] truncate">
                      {alert.title}
                    </TableCell>
                    <TableCell>{alert.vessel_name || alert.vessel_id}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{alert.alert_type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {alert.created_at && format(new Date(alert.created_at), "dd MMM HH:mm")}
                    </TableCell>
                    <TableCell>
                      {alert.acknowledged ? (
                        <Badge
                          variant="secondary"
                          className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Acked
                        </Badge>
                      ) : (
                        <Badge variant="destructive">Open</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {!alert.acknowledged && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => acknowledgeMutation.mutate(alert.id)}
                          disabled={acknowledgeMutation.isPending}
                          data-testid={`btn-ack-table-${alert.id}`}
                        >
                          <BellOff className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
