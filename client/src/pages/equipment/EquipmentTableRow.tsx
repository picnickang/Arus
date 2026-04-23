import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Eye, Pencil, Ship, Trash2, Wrench } from "lucide-react";
import { HealthBadge } from "./HealthBadge";
import { StatusBadge } from "./StatusBadge";
import { CertStatusBadge } from "./CertStatusBadge";
import type { EquipmentItem, GetVesselName } from "./types";

export function EquipmentTableRow({
  item,
  getVesselName,
  handleView,
  handleEdit,
  handleDelete,
  handleSetupSensors,
  allCerts,
}: {
  item: EquipmentItem;
  getVesselName: GetVesselName;
  handleView: (item: EquipmentItem) => void;
  handleEdit: (item: EquipmentItem) => void;
  handleDelete: (item: EquipmentItem) => void;
  handleSetupSensors: (item: EquipmentItem) => void;
  allCerts: Array<{
    equipmentId?: string | null;
    status?: string;
    expiryDate?: string | Date | null;
  }>;
}) {
  return (
    <TableRow
      className="cursor-pointer hover:bg-accent/50"
      onClick={() => handleView(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleView(item);
        }
      }}
      tabIndex={0}
      data-testid={`row-equipment-${item.id}`}
    >
      <TableCell>
        <div>
          <div className="font-medium">{item.name}</div>
          {(item.manufacturer || item.model) && (
            <div className="text-xs text-muted-foreground">
              {item.manufacturer}
              {item.model && ` • ${item.model}`}
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{item.type || "Unknown"}</Badge>
      </TableCell>
      <TableCell>
        {item.vesselId ? (
          <div className="flex items-center gap-1.5">
            <Ship className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-sm">{getVesselName(item.vesselId)}</span>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </TableCell>
      <TableCell>
        <HealthBadge health={item.health} />
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <StatusBadge isActive={item.isActive ?? true} />
          <CertStatusBadge equipmentId={item.id} allCerts={allCerts} />
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div
          className="flex items-center justify-end gap-1"
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
        >
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation();
              handleView(item);
            }}
            data-testid={`button-view-${item.id}`}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation();
              handleSetupSensors(item);
            }}
            data-testid={`button-sensors-${item.id}`}
          >
            <Wrench className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(item);
            }}
            data-testid={`button-edit-${item.id}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(item);
            }}
            data-testid={`button-delete-${item.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
