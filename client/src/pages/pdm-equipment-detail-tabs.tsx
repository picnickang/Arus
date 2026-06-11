import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, type StatusType } from "@/components/shared/StatusBadge";
import { LoadingState } from "@/components/patterns/LoadingState";
import {
  useAnomaliesTabData,
  useMaintenanceHistoryTabData,
} from "@/features/analytics";

export function AnomaliesTab({ equipmentId }: { equipmentId: string }) {
  const { anomalies, isLoading } = useAnomaliesTabData(equipmentId);
  if (isLoading) {
    return <LoadingState variant="card" />;
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Anomaly Detections</CardTitle>
      </CardHeader>
      <CardContent>
        {anomalies && anomalies.length > 0 ? (
          <div className="space-y-3">
            {anomalies.map((anomaly) => (
              <div key={anomaly.id} className="p-4 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{anomaly.sensorKind}</p>
                  <StatusBadge status={(anomaly.severity || "info") as StatusType} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {anomaly.description || "Anomaly detected"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No anomalies detected for this equipment.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function MaintenanceHistoryTab({ equipmentId }: { equipmentId: string }) {
  const { workOrders, isLoading } = useMaintenanceHistoryTabData(equipmentId);
  if (isLoading) {
    return <LoadingState variant="card" />;
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Work Order History</CardTitle>
      </CardHeader>
      <CardContent>
        {workOrders && workOrders.length > 0 ? (
          <div className="space-y-3">
            {workOrders.map((wo) => (
              <div key={wo.id} className="p-4 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{wo.reason || wo.description}</p>
                  <StatusBadge status={(wo.status || "pending") as StatusType} />
                </div>
                <p className="text-sm text-muted-foreground">Type: {wo.maintenanceType}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No maintenance history for this equipment.</p>
        )}
      </CardContent>
    </Card>
  );
}
