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
import { Eye, Pencil, Trash2, Ship, AlertCircle, CheckCircle, Wrench, Power, History } from "lucide-react";
import { formatType, formatLocation, getVesselInfo } from "@/utils/equipmentHelpers";
import { StatusBadge } from "@/components/shared/StatusBadge";

interface EquipmentTableProps {
  equipment: Equipment[];
  vessels: Vessel[];
  onView: (equipment: Equipment) => void;
  onEdit: (equipment: Equipment) => void;
  onDelete: (equipment: Equipment) => void;
  onSetupSensors?: (equipment: Equipment) => void;
  onDecommission?: (equipment: Equipment) => void;
  onViewHistory?: (equipment: Equipment) => void;
  paginationMeta?: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  } | null;
  onPageChange?: (page: number) => void;
}

function renderVesselCell(equipment: Equipment, vessels: Vessel[]) {
  const vesselInfo = getVesselInfo(equipment, vessels);

  if (!vesselInfo.name) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span>Not assigned</span>
      </div>
    );
  }

  if (!vesselInfo.isLinked) {
    return (
      <div className="flex items-center gap-2 text-orange-600">
        <AlertCircle className="h-4 w-4" />
        <span>{vesselInfo.name}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Ship className="h-4 w-4 text-blue-600" />
      <span>{vesselInfo.name}</span>
      <CheckCircle className="h-3 w-3 text-green-600" />
    </div>
  );
}

export function EquipmentTable({
  equipment,
  vessels,
  onView,
  onEdit,
  onDelete,
  onSetupSensors,
  onDecommission,
  onViewHistory,
  paginationMeta,
  onPageChange,
}: EquipmentTableProps) {
  return (
    <>
      <Table data-testid="table-equipment">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Vessel</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {equipment.map((item: Equipment) => (
            <TableRow key={item.id} data-testid={`row-equipment-${item.id}`}>
              <TableCell className="font-medium" data-testid={`text-name-${item.id}`}>
                <div>
                  <div>{item.name}</div>
                  {(item.manufacturer || item.model) && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {item.manufacturer} {item.model && `• ${item.model}`}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell data-testid={`text-type-${item.id}`}>
                <Badge variant="outline">{formatType(item.type)}</Badge>
              </TableCell>
              <TableCell data-testid={`text-vessel-${item.id}`}>
                {renderVesselCell(item, vessels)}
              </TableCell>
              <TableCell data-testid={`text-location-${item.id}`}>
                {item.location ? (
                  formatLocation(item.location)
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge
                  status={item.isActive ? "active" : "inactive"}
                  dataTestId={`status-${item.isActive ? "active" : "inactive"}-${item.id}`}
                />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onView(item)}
                    data-testid={`button-view-${item.id}`}
                    aria-label={`View ${item.name}`}
                    className="h-8 w-8 p-0"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {onSetupSensors && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSetupSensors(item)}
                      data-testid={`button-setup-sensors-${item.id}`}
                      aria-label={`Setup sensors for ${item.name}`}
                      className="h-8 w-8 p-0"
                    >
                      <Wrench className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(item)}
                    data-testid={`button-edit-${item.id}`}
                    aria-label={`Edit ${item.name}`}
                    className="h-8 w-8 p-0"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {onViewHistory && (
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
                  )}
                  {onDecommission && item.isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDecommission(item)}
                      data-testid={`button-decommission-${item.id}`}
                      aria-label={`Decommission ${item.name}`}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Power className="h-4 w-4" />
                    </Button>
                  )}
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
          ))}
        </TableBody>
      </Table>

      {paginationMeta?.totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between px-2 py-4 border-t">
          <div className="text-sm text-muted-foreground" data-testid="text-pagination-info">
            Showing {(paginationMeta.page - 1) * paginationMeta.pageSize + 1} to{" "}
            {Math.min(paginationMeta.page * paginationMeta.pageSize, paginationMeta.total)} of{" "}
            {paginationMeta.total} results
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(paginationMeta.page - 1)}
              disabled={paginationMeta.page === 1}
              data-testid="button-previous-page"
            >
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {(() => {
                const { page, totalPages } = paginationMeta;
                const maxVisible = 5;
                let startPage = 1;
                let endPage = totalPages;

                if (totalPages > maxVisible) {
                  const halfWindow = Math.floor(maxVisible / 2);
                  startPage = Math.max(1, page - halfWindow);
                  endPage = Math.min(totalPages, startPage + maxVisible - 1);

                  if (endPage - startPage < maxVisible - 1) {
                    startPage = Math.max(1, endPage - maxVisible + 1);
                  }
                }

                const pages = Array.from(
                  { length: endPage - startPage + 1 },
                  (_, i) => startPage + i
                );

                return pages.map((pageNumber) => {
                  const isActive = pageNumber === page;
                  return (
                    <Button
                      key={pageNumber}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => onPageChange(pageNumber)}
                      className="w-8"
                      data-testid={`button-page-${pageNumber}`}
                    >
                      {pageNumber}
                    </Button>
                  );
                });
              })()}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(paginationMeta.page + 1)}
              disabled={paginationMeta.page === paginationMeta.totalPages}
              data-testid="button-next-page"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
