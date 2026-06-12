import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Eye, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import type { WorkOrder } from "@shared/schema";
import {
  COLUMNS,
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  ROW_HEIGHT,
  getTotalWidth,
} from "./work-order-table-config";
import {
  TruncatedCell,
  SortableHeader,
  WorkOrderTableSkeleton,
  WorkOrderTableEmpty,
} from "./WorkOrderTableHelpers";

interface VirtualizedWorkOrderTableProps {
  workOrders: WorkOrder[];
  equipment: Array<{ id: string; name?: string }>;
  vessels: Array<{ id: string; name?: string }>;
  crew: Array<{ id: string; name?: string }>;
  isLoading: boolean;
  onView: (order: WorkOrder) => void;
  onEdit: (order: WorkOrder) => void;
  onDelete: (order: WorkOrder) => void;
  sortColumn: string;
  sortDirection: "asc" | "desc";
  onSort: (column: string) => void;
}

export function VirtualizedWorkOrderTable({
  workOrders,
  equipment,
  vessels,
  crew,
  isLoading,
  onView,
  onEdit,
  onDelete,
  sortColumn,
  sortDirection,
  onSort,
}: VirtualizedWorkOrderTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const getEquipmentName = (equipmentId: string) => {
    if (!equipmentId) {
      return "—";
    }
    const eq = equipment.find((e) => e.id === equipmentId);
    return eq?.name || equipmentId.slice(0, 8).toUpperCase();
  };

  const getVesselName = (vesselId: string | null) => {
    if (!vesselId) {
      return "—";
    }
    const vessel = vessels.find((v) => v.id === vesselId);
    return vessel?.name || vesselId.slice(0, 8).toUpperCase();
  };

  const getCrewName = (crewId: string | null) => {
    if (!crewId) {
      return "Unassigned";
    }
    const member = crew.find((c) => c.id === crewId);
    return member?.name || crewId.slice(0, 8).toUpperCase();
  };

  const rowVirtualizer = useVirtualizer({
    count: workOrders.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const totalWidth = getTotalWidth();

  if (isLoading) {
    return <WorkOrderTableSkeleton />;
  }
  if (workOrders.length === 0) {
    return <WorkOrderTableEmpty />;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="border rounded-lg overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
        <div className="overflow-x-auto">
          <div style={{ minWidth: `${totalWidth}px` }}>
            <TableHeader sortColumn={sortColumn} sortDirection={sortDirection} onSort={onSort} />
            <div
              ref={parentRef}
              className="h-[400px] md:h-[600px] overflow-auto"
              style={{ contain: "strict" }}
            >
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const order = workOrders[virtualRow.index];
                  if (!order) {
                    return null;
                  }
                  return (
                    <WorkOrderRow
                      key={order.id}
                      order={order}
                      virtualRow={virtualRow}
                      getEquipmentName={getEquipmentName}
                      getVesselName={getVesselName}
                      getCrewName={getCrewName}
                      onView={onView}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <TableFooter count={workOrders.length} />
      </div>
    </TooltipProvider>
  );
}

function TableHeader({
  sortColumn,
  sortDirection,
  onSort,
}: {
  sortColumn: string;
  sortDirection: "asc" | "desc";
  onSort: (col: string) => void;
}) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700 px-4 py-3.5 flex items-center">
      {COLUMNS.map((col, idx) => (
        <div
          key={col.key}
          style={{ width: col.width, minWidth: col.width }}
          className={cn(
            "pr-3",
            (col as { flex?: boolean }).flex && "flex-1",
            idx === COLUMNS.length - 1 && "text-right"
          )}
        >
          {[
            "woNumber",
            "vessel",
            "equipment",
            "priority",
            "status",
            "dueDate",
            "createdAt",
          ].includes(col.key) ? (
            <SortableHeader
              columnKey={col.key}
              sortColumn={sortColumn}
              sortDirection={sortDirection}
              onSort={onSort}
            >
              {col.label}
            </SortableHeader>
          ) : (
            <span className="font-semibold text-xs uppercase tracking-wide text-slate-600 dark:text-slate-300">
              {col.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

interface WorkOrderRowProps {
  order: WorkOrder;
  virtualRow: { index: number; size: number; start: number };
  getEquipmentName: (id: string) => string;
  getVesselName: (id: string | null) => string;
  getCrewName: (id: string | null) => string;
  onView: (order: WorkOrder) => void;
  onEdit: (order: WorkOrder) => void;
  onDelete: (order: WorkOrder) => void;
}

function WorkOrderRow({
  order,
  virtualRow,
  getEquipmentName,
  getVesselName,
  getCrewName,
  onView,
  onEdit,
  onDelete,
}: WorkOrderRowProps) {
  const statusConfig = STATUS_CONFIG[order.status] ??
    STATUS_CONFIG["open"] ?? { label: order.status, className: "", icon: () => null };
  const priorityConfig = PRIORITY_CONFIG[order.priority] ??
    PRIORITY_CONFIG[3] ?? { label: String(order.priority), className: "" };
  const StatusIcon = statusConfig.icon;

  return (
    <div
      data-testid={`row-wo-${order.id}`}
      role="button"
      tabIndex={0}
      className={cn(
        "absolute left-0 w-full flex items-center px-4 border-b border-slate-100 dark:border-slate-800",
        "hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer",
        virtualRow.index % 2 === 0
          ? "bg-white dark:bg-slate-900"
          : "bg-slate-50/50 dark:bg-slate-800/20"
      )}
      style={{ height: `${virtualRow.size}px`, transform: `translateY(${virtualRow.start}px)` }}
      onClick={() => onView(order)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onView(order);
        }
      }}
    >
      <Cell width={COLUMNS[0].width}>
        <span className="font-mono text-sm font-medium text-slate-900 dark:text-white">
          {order.woNumber || `WO-${order.id.slice(0, 6).toUpperCase()}`}
        </span>
      </Cell>
      <Cell width={COLUMNS[1].width}>
        <TruncatedCell
          text={getVesselName(order.vesselId)}
          className="text-sm text-slate-700 dark:text-slate-300"
          maxWidth={COLUMNS[1].width - 12}
        />
      </Cell>
      <Cell width={COLUMNS[2].width}>
        <TruncatedCell
          text={getEquipmentName(order.equipmentId)}
          className="text-sm font-medium text-slate-900 dark:text-white"
          maxWidth={COLUMNS[2].width - 12}
        />
      </Cell>
      <Cell width={COLUMNS[3].width} flex>
        <TruncatedCell
          text={order.reason || ""}
          className="text-sm text-slate-600 dark:text-slate-400"
          maxWidth={COLUMNS[3].width - 12}
        />
      </Cell>
      <Cell width={COLUMNS[4].width}>
        <Badge
          variant="outline"
          className={cn("text-xs font-medium px-2.5 py-0.5", priorityConfig.className)}
        >
          {priorityConfig.label}
        </Badge>
      </Cell>
      <Cell width={COLUMNS[5].width}>
        <Badge
          variant="outline"
          className={cn(
            "text-xs font-medium px-2.5 py-0.5 inline-flex items-center gap-1.5",
            statusConfig.className
          )}
        >
          <StatusIcon className="h-3.5 w-3.5" />
          <span>{statusConfig.label}</span>
        </Badge>
      </Cell>
      <Cell width={COLUMNS[6].width}>
        <TruncatedCell
          text={getCrewName(order.assignedCrewId)}
          className={cn(
            "text-sm",
            order.assignedCrewId
              ? "text-slate-700 dark:text-slate-300"
              : "text-slate-400 dark:text-slate-500 italic"
          )}
          maxWidth={COLUMNS[6].width - 12}
        />
      </Cell>
      <Cell width={COLUMNS[7].width}>
        {order.plannedEndDate ? (
          <span className="text-sm text-slate-700 dark:text-slate-300">
            {format(new Date(order.plannedEndDate), "MMM d, yyyy")}
          </span>
        ) : (
          <span className="text-sm text-slate-400 dark:text-slate-500">—</span>
        )}
      </Cell>
      <Cell width={COLUMNS[8].width}>
        {order.createdAt ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-sm text-slate-500 dark:text-slate-400 cursor-default">
                {formatDistanceToNow(new Date(order.createdAt), { addSuffix: false })}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-sm">{format(new Date(order.createdAt), "PPpp")}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-sm text-slate-400 dark:text-slate-500">—</span>
        )}
      </Cell>
      <div
        style={{ width: COLUMNS[9].width, minWidth: COLUMNS[9].width }}
        className="flex items-center justify-end gap-0.5"
        onMouseDown={(e) => e.stopPropagation()}
        role="presentation"
      >
        <ActionButton
          icon={Eye}
          tooltip="View Details"
          onClick={() => onView(order)}
          testId={`button-view-wo-${order.id}`}
        />
        <ActionButton
          icon={Edit}
          tooltip="Edit"
          onClick={() => onEdit(order)}
          testId={`button-edit-wo-${order.id}`}
        />
        <ActionButton
          icon={Trash2}
          tooltip="Delete"
          onClick={() => onDelete(order)}
          testId={`button-delete-wo-${order.id}`}
          variant="danger"
        />
      </div>
    </div>
  );
}

function Cell({
  width,
  flex,
  children,
}: {
  width: number;
  flex?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ width, minWidth: width }} className={cn("pr-3", flex && "flex-1")}>
      {children}
    </div>
  );
}

function ActionButton({
  icon: Icon,
  tooltip,
  onClick,
  testId,
  variant,
}: {
  icon: typeof Eye;
  tooltip: string;
  onClick: () => void;
  testId: string;
  variant?: "danger";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8",
            variant === "danger"
              ? "text-slate-400 hover:text-red-600 dark:text-slate-500 dark:hover:text-red-400"
              : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          )}
          onClick={onClick}
          data-testid={testId}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function TableFooter({ count }: { count: number }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
      <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
        {count} work order{count !== 1 ? "s" : ""}
      </span>
      <span className="text-xs text-slate-400 dark:text-slate-500">
        Click any row to view details
      </span>
    </div>
  );
}
