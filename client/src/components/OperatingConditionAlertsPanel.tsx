import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useCustomMutation } from "@/hooks/useCrudMutations";
import type { OperatingConditionAlert, Equipment } from "@shared/schema";

interface EnrichedAlert extends OperatingConditionAlert {
  equipment?: Equipment;
}

interface OperatingConditionAlertsPanelProps {
  prefetchedAlerts?: OperatingConditionAlert[] | null;
  prefetchedEquipment?: Equipment[] | null;
}

export function OperatingConditionAlertsPanel({ prefetchedAlerts, prefetchedEquipment }: OperatingConditionAlertsPanelProps = {}) {
  const {
    data: alerts = [],
    isLoading,
    isError,
  } = useQuery<OperatingConditionAlert[]>({
    queryKey: ["/api/operating-condition-alerts", "active"],
    queryFn: () => apiRequest("GET", "/api/operating-condition-alerts?acknowledged=false"),
    staleTime: 120000,
    refetchInterval: 120000,
    initialData: prefetchedAlerts ?? undefined,
  });

  const { data: equipmentList = [] } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
    staleTime: 300000,
    initialData: prefetchedEquipment ?? undefined,
  });

  // Enrich alerts with equipment data
  const enrichedAlerts: EnrichedAlert[] = alerts.map((alert) => ({
    ...alert,
    equipment: equipmentList.find((eq) => eq.id === alert.equipmentId),
  }));

  // Acknowledge mutation
  const acknowledgeMutation = useCustomMutation({
    mutationFn: async (alertId: string) => {
      return apiRequest("POST", `/api/operating-condition-alerts/${alertId}/acknowledge`, {
        acknowledgedBy: "System",
        notes: "",
      });
    },
    invalidateKeys: [["/api/operating-condition-alerts", "active"]],
    successMessage: "Alert acknowledged successfully",
  });

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
        return "destructive";
      case "warning":
        return "default";
      case "info":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-blue-500" />;
    }
  };

  const getThresholdDescription = (alert: OperatingConditionAlert) => {
    const { currentValue, optimalMin, optimalMax, thresholdType } = alert;
    const unit = ""; // Could be added to alert schema if needed

    switch (thresholdType) {
      case "below_optimal":
        return `${currentValue.toFixed(2)}${unit} (Optimal: ${optimalMin?.toFixed(2)} - ${optimalMax?.toFixed(2)}${unit})`;
      case "above_optimal":
        return `${currentValue.toFixed(2)}${unit} (Optimal: ${optimalMin?.toFixed(2)} - ${optimalMax?.toFixed(2)}${unit})`;
      case "below_critical":
        return `${currentValue.toFixed(2)}${unit} (Critical Low: < ${optimalMin?.toFixed(2)}${unit})`;
      case "above_critical":
        return `${currentValue.toFixed(2)}${unit} (Critical High: > ${optimalMax?.toFixed(2)}${unit})`;
      default:
        return `${currentValue.toFixed(2)}${unit}`;
    }
  };

  const criticalAlerts = enrichedAlerts.filter(
    (alert) => alert.severity.toLowerCase() === "critical"
  ).length;
  const warningAlerts = enrichedAlerts.filter(
    (alert) => alert.severity.toLowerCase() === "warning"
  ).length;

  return (
    <Card data-testid="panel-operating-alerts">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Operating Condition Alerts
            </CardTitle>
            <CardDescription>Active violations of optimal operating parameters</CardDescription>
          </div>
          {enrichedAlerts.length > 0 && (
            <div className="flex items-center gap-2">
              {criticalAlerts > 0 && (
                <Badge variant="destructive" data-testid="badge-critical-count">
                  {criticalAlerts} Critical
                </Badge>
              )}
              {warningAlerts > 0 && (
                <Badge variant="default" data-testid="badge-warning-count">
                  {warningAlerts} Warning
                </Badge>
              )}
              <Badge variant="outline" data-testid="badge-total-count">
                {enrichedAlerts.length} Total
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : isError ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-destructive" />
            <p>Failed to load operating condition alerts</p>
          </div>
        ) : enrichedAlerts.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="text-muted-foreground">No active operating condition violations</p>
          </div>
        ) : (
          <div className="space-y-3">
            {enrichedAlerts.map((alert) => (
              <div
                key={alert.id}
                className="p-4 bg-muted/50 rounded-lg border border-border hover:border-primary/50 transition-colors"
                data-testid={`alert-item-${alert.id}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    {getSeverityIcon(alert.severity)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="font-semibold text-foreground">
                          {alert.equipment?.name || alert.equipmentId}
                        </span>
                        <Badge variant={getSeverityColor(alert.severity)} className="capitalize">
                          {alert.severity}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {alert.thresholdType.replaceAll('_', " ")}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground mb-1">
                        <span className="font-medium">{alert.parameterName}:</span>{" "}
                        {getThresholdDescription(alert)}
                      </p>
                      {alert.lifeImpact && (
                        <p className="text-xs text-muted-foreground mb-1">
                          Impact: {alert.lifeImpact}
                        </p>
                      )}
                      {alert.recommendedAction && (
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          Recommended: {alert.recommendedAction}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-right text-sm text-muted-foreground whitespace-nowrap">
                      {alert.alertedAt && (
                        <div className="flex items-center gap-1 justify-end">
                          <Clock className="h-3 w-3" />
                          <span>
                            {formatDistanceToNow(new Date(alert.alertedAt), { addSuffix: true })}
                          </span>
                        </div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => acknowledgeMutation.mutate(alert.id)}
                      disabled={acknowledgeMutation.isPending}
                      data-testid={`button-acknowledge-${alert.id}`}
                    >
                      {acknowledgeMutation.isPending ? "Acknowledging..." : "Acknowledge"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
