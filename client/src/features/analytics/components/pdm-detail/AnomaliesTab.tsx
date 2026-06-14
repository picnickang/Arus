import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/patterns/LoadingState";
import { useAnomaliesTabData } from "../../hooks/usePdmEquipmentDetailData";

function severityVariant(severity?: string): "destructive" | "secondary" | "outline" {
  switch ((severity ?? "").toLowerCase()) {
    case "critical":
    case "high":
      return "destructive";
    case "warning":
    case "medium":
      return "secondary";
    default:
      return "outline";
  }
}

export function AnomaliesTab({ equipmentId }: { equipmentId: string }) {
  const { anomalies, isLoading } = useAnomaliesTabData(equipmentId);

  if (isLoading) {
    return <LoadingState variant="table" rows={4} cols={3} />;
  }

  if (!anomalies?.length) {
    return (
      <div
        className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground"
        data-testid="anomalies-empty"
      >
        No anomalies detected for this equipment.
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table caption="Detected anomalies" data-testid="anomalies-table">
          <TableHeader>
            <TableRow>
              <TableHead>Severity</TableHead>
              <TableHead>Sensor</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {anomalies.map((anomaly) => (
              <TableRow key={anomaly.id} data-testid={`anomaly-row-${anomaly.id}`}>
                <TableCell>
                  <Badge variant={severityVariant(anomaly.severity)}>
                    {anomaly.severity ?? "unknown"}
                  </Badge>
                </TableCell>
                <TableCell>{anomaly.sensorKind ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {anomaly.description ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
