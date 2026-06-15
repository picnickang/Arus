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
import { useMaintenanceHistoryTabData } from "../../hooks/usePdmEquipmentDetailData";

function statusVariant(status?: string): "default" | "secondary" | "outline" {
  switch ((status ?? "").toLowerCase()) {
    case "completed":
    case "closed":
      return "secondary";
    case "open":
    case "in_progress":
      return "default";
    default:
      return "outline";
  }
}

export function MaintenanceTab({ equipmentId }: { equipmentId: string }) {
  const { workOrders, isLoading } = useMaintenanceHistoryTabData(equipmentId);

  if (isLoading) {
    return <LoadingState variant="table" rows={4} cols={3} />;
  }

  if (!workOrders?.length) {
    return (
      <div
        className="flex h-32 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground"
        data-testid="maintenance-empty"
      >
        No maintenance history for this equipment.
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table caption="Maintenance history" data-testid="maintenance-table">
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workOrders.map((workOrder) => (
              <TableRow key={workOrder.id} data-testid={`work-order-row-${workOrder.id}`}>
                <TableCell>
                  <Badge variant={statusVariant(workOrder.status)}>
                    {workOrder.status ?? "unknown"}
                  </Badge>
                </TableCell>
                <TableCell>{workOrder.maintenanceType ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {workOrder.description ?? workOrder.reason ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
