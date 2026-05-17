import { Equipment, Vessel } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Trash2, Ship, AlertCircle, History, Calendar } from "lucide-react";
import { formatType, getVesselInfo } from "@/utils/equipmentHelpers";
import { format } from "date-fns";

interface DecommissionedEquipmentTableProps {
  equipment: Equipment[];
  vessels: Vessel[];
  onReinstate: (equipment: Equipment) => void;
  onViewHistory: (equipment: Equipment) => void;
  onDelete: (equipment: Equipment) => void;
}

export function DecommissionedEquipmentTable({
  equipment,
  vessels,
  onReinstate,
  onViewHistory,
  onDelete,
}: DecommissionedEquipmentTableProps) {
  return (
    <Table data-testid="table-decommissioned-equipment">
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Vessel</TableHead>
          <TableHead>Decommissioned</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {equipment.map((item: Equipment) => {
          const vesselInfo = getVesselInfo(item, vessels);
          const decommissionedDate = item.decommissionedAt
            ? format(new Date(item.decommissionedAt), "MMM d, yyyy")
            : "Unknown";

          return (
            <TableRow key={item.id} data-testid={`row-decommissioned-${item.id}`}>
              <TableCell className="font-medium" data-testid={`text-name-${item.id}`}>
                <div>
                  <div>{item.name}</div>
                  {(item.manufacturer || item.model) && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {item.manufacturer} {item.model && `| ${item.model}`}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell data-testid={`text-type-${item.id}`}>
                <Badge variant="outline">{formatType(item.type)}</Badge>
              </TableCell>
              <TableCell data-testid={`text-vessel-${item.id}`}>
                {vesselInfo.name ? (
                  <div className="flex items-center gap-2">
                    <Ship className="h-4 w-4 text-muted-foreground" />
                    <span>{vesselInfo.name}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />
                    <span>Not assigned</span>
                  </div>
                )}
              </TableCell>
              <TableCell data-testid={`text-decommissioned-date-${item.id}`}>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{decommissionedDate}</span>
                </div>
              </TableCell>
              <TableCell data-testid={`text-reason-${item.id}`}>
                <span className="text-sm text-muted-foreground">
                  {item.decommissionedAt ? String(item.decommissionedAt) : "-"}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewHistory(item)}
                    data-testid={`button-history-${item.id}`}
                    aria-label={`View history for ${item.name}`}
                    className="h-8 w-8 p-0"
                  >
                    <History className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onReinstate(item)}
                    data-testid={`button-reinstate-${item.id}`}
                    aria-label={`Reinstate ${item.name}`}
                    className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(item)}
                    data-testid={`button-delete-${item.id}`}
                    aria-label={`Delete ${item.name}`}
                    className="h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
