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
import { useSensorsTabData } from "../../hooks/usePdmEquipmentDetailData";

function formatSensorLabel(sensorType: string): string {
  return sensorType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function SensorsTab({ equipmentId }: { equipmentId: string }) {
  const { sensorConfigs, isLoading } = useSensorsTabData(equipmentId);

  if (isLoading) {
    return <LoadingState variant="table" rows={4} cols={3} />;
  }

  if (!sensorConfigs?.length) {
    return (
      <div
        className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground"
        data-testid="sensors-empty"
      >
        No sensors configured for this equipment.
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table caption="Configured sensors" data-testid="sensors-table">
          <TableHeader>
            <TableRow>
              <TableHead>Sensor</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sensorConfigs.map((sensor) => (
              <TableRow key={sensor.id} data-testid={`sensor-row-${sensor.id}`}>
                <TableCell className="font-medium">
                  {formatSensorLabel(sensor.sensorType)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {sensor.targetUnit ?? sensor.unit ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={sensor.enabled === false ? "outline" : "secondary"}>
                    {sensor.enabled === false ? "disabled" : "enabled"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
