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
import { Settings, Trash2 } from "lucide-react";
import type { UseMutationResult } from "@tanstack/react-query";
import { CreateAlertConfigDialog } from "./CreateAlertConfigDialog";
import type { AlertConfig, Vessel } from "./_shared";

export function ConfigsTab({
  vessels,
  alertConfigs,
  configsLoading,
  deleteConfigMutation,
}: {
  vessels: Vessel[];
  alertConfigs: AlertConfig[];
  configsLoading: boolean;
  deleteConfigMutation: UseMutationResult<void, Error, string, unknown>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Alert Configurations
          </CardTitle>
          <CardDescription>Threshold, geofence, and bunkering alert rules</CardDescription>
        </div>
        <CreateAlertConfigDialog vessels={vessels} />
      </CardHeader>
      <CardContent>
        {configsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : alertConfigs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No alert configurations set up</p>
            <p className="text-sm">
              Create alert rules to monitor fuel thresholds, geofences, and bunkering events
            </p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Vessel</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead>Cooldown</TableHead>
                  <TableHead>Last Triggered</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alertConfigs.map((cfg) => (
                  <TableRow key={cfg.id} data-testid={`config-row-${cfg.id}`}>
                    <TableCell className="font-medium">{cfg.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{cfg.alert_type}</Badge>
                    </TableCell>
                    <TableCell>{cfg.vessel_name || cfg.vessel_id}</TableCell>
                    <TableCell>
                      <Badge variant={cfg.enabled ? "default" : "secondary"}>
                        {cfg.enabled ? "Active" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell>{cfg.cooldown_minutes} min</TableCell>
                    <TableCell className="text-sm">
                      {cfg.last_triggered_at
                        ? format(new Date(cfg.last_triggered_at), "dd MMM HH:mm")
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => deleteConfigMutation.mutate(cfg.id)}
                        disabled={deleteConfigMutation.isPending}
                        data-testid={`btn-delete-config-${cfg.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
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
  );
}
