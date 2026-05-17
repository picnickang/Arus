import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { QuickReorderButton } from "./QuickReorderButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  Eye,
  Edit2,
  Trash2,
  Package,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";

export interface PartsInventoryItem {
  id: string;
  partNumber: string;
  partName: string;
  description?: string | null;
  category: string;
  unitOfMeasure?: string | null;
  standardCost?: number | null;
  criticality?: string | null;
  leadTimeDays?: number | null;
  minStockLevel: number;
  maxStockLevel: number;
  supplierId?: string | null;
  supplierName?: string | null;
  stock?: {
    id: string;
    quantityOnHand: number;
    quantityReserved: number;
    quantityOnOrder?: number;
    availableQuantity: number;
    unitCost: number;
    location?: string;
    status: string;
  } | null;
}

interface VirtualizedInventoryTableProps {
  items: PartsInventoryItem[];
  isLoading?: boolean;
  sortField: string;
  sortDirection: "asc" | "desc";
  onSort: (field: string) => void;
  onRowClick?: (item: PartsInventoryItem) => void;
  onEdit?: (item: PartsInventoryItem) => void;
  onDelete?: (item: PartsInventoryItem) => void;
  selectedItems?: Set<string>;
  onSelectionChange?: (itemId: string, selected: boolean) => void;
  rowHeight?: number;
}

const COLUMNS = [
  { key: "partNumber", label: "Part #", width: 120, sortable: true },
  { key: "partName", label: "Name", width: 200, sortable: true },
  { key: "category", label: "Category", width: 120, sortable: true },
  { key: "available", label: "Available", width: 100, sortable: true, align: "right" as const },
  { key: "quantityOnHand", label: "On Hand", width: 80, sortable: true, align: "right" as const },
  {
    key: "quantityReserved",
    label: "Reserved",
    width: 80,
    sortable: true,
    align: "right" as const,
  },
  { key: "unitCost", label: "Unit Cost", width: 100, sortable: true, align: "right" as const },
  { key: "totalValue", label: "Total Value", width: 100, sortable: true, align: "right" as const },
  { key: "status", label: "Status", width: 100, sortable: true },
  { key: "actions", label: "", width: 60, sortable: false },
];

function getStockStatus(item: PartsInventoryItem): string {
  if (!item.stock) {
    return "unknown";
  }
  const { quantityOnHand, quantityReserved } = item.stock;
  const available = Math.max(0, quantityOnHand - quantityReserved);
  const minStock = item.minStockLevel;
  const maxStock = item.maxStockLevel;

  if (quantityOnHand <= 0) {
    return "out_of_stock";
  }
  if (available <= 0) {
    return "critical";
  }
  if (available < minStock * 0.5) {
    return "critical";
  }
  if (available < minStock) {
    return "low_stock";
  }
  if (available > maxStock) {
    return "excess_stock";
  }
  return "adequate";
}

function getStatusBadge(status: string) {
  const statusConfig: Record<
    string,
    {
      variant: "default" | "destructive" | "secondary" | "outline";
      label: string;
      icon: typeof CheckCircle;
    }
  > = {
    out_of_stock: { variant: "destructive", label: "Out of Stock", icon: XCircle },
    critical: { variant: "destructive", label: "Critical", icon: AlertTriangle },
    low_stock: { variant: "secondary", label: "Low Stock", icon: AlertTriangle },
    excess_stock: { variant: "outline", label: "Excess", icon: Package },
    adequate: { variant: "default", label: "Adequate", icon: CheckCircle },
    unknown: { variant: "outline", label: "Unknown", icon: Package },
  };

  const config = statusConfig[status] || statusConfig.unknown;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="flex items-center gap-1 whitespace-nowrap">
      <Icon className="h-3 w-3" />
      <span className="hidden sm:inline">{config.label}</span>
    </Badge>
  );
}

function formatCurrencyDisplay(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "-";
  }
  return formatCurrency(value);
}

function SortableHeader({
  column,
  sortField,
  sortDirection,
  onSort,
}: {
  column: (typeof COLUMNS)[0];
  sortField: string;
  sortDirection: "asc" | "desc";
  onSort: (field: string) => void;
}) {
  if (!column.sortable) {
    return <span>{column.label}</span>;
  }

  const isActive = sortField === column.key;
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "-ml-3 h-8 data-[state=open]:bg-accent",
        column.align === "right" && "justify-end -mr-3"
      )}
      onClick={() => onSort(column.key)}
      data-testid={`sort-${column.key}`}
    >
      {column.label}
      {isActive ? (
        sortDirection === "asc" ? (
          <ChevronUp className="ml-1 h-4 w-4" />
        ) : (
          <ChevronDown className="ml-1 h-4 w-4" />
        )
      ) : (
        <ChevronUp className="ml-1 h-4 w-4 opacity-0 group-hover:opacity-50" />
      )}
    </Button>
  );
}

export function VirtualizedInventoryTable({
  items,
  isLoading = false,
  sortField,
  sortDirection,
  onSort,
  onRowClick,
  onEdit,
  onDelete,
  selectedItems = new Set(),
  onSelectionChange,
  rowHeight = 48,
}: VirtualizedInventoryTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  if (isLoading) {
    return (
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              {COLUMNS.map((column) => (
                <TableHead key={column.key} style={{ width: column.width }}>
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }).map((_, index) => (
              <TableRow key={`skeleton-row-${index}`}>
                {COLUMNS.map((column) => (
                  <TableCell key={column.key}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              {COLUMNS.map((column) => (
                <TableHead key={column.key} style={{ width: column.width }}>
                  <SortableHeader
                    column={column}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={onSort}
                  />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        </Table>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No parts found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Try adjusting your search or filter criteria
          </p>
        </div>
      </div>
    );
  }

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div
      className="border rounded-lg overflow-x-auto flex flex-col"
      data-testid="virtualized-inventory-table"
    >
      <div className="bg-muted/50 flex-none">
        <Table>
          <TableHeader>
            <TableRow>
              {onSelectionChange && <TableHead style={{ width: 40, minWidth: 40 }} />}
              {COLUMNS.map((column) => (
                <TableHead
                  key={column.key}
                  style={{ width: column.width, minWidth: column.width }}
                  className={cn(column.align === "right" && "text-right")}
                >
                  <SortableHeader
                    column={column}
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={onSort}
                  />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        </Table>
      </div>
      <div
        ref={parentRef}
        className="overflow-auto flex-1"
        style={{ maxHeight: 600 }}
        data-testid="inventory-scroll-container"
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {virtualItems.map((virtualRow) => {
            const item = items[virtualRow.index];
            const status = getStockStatus(item);
            const available = item.stock
              ? Math.max(0, item.stock.quantityOnHand - item.stock.quantityReserved)
              : 0;
            const unitCost = item.stock?.unitCost ?? item.standardCost ?? 0;
            const totalValue = unitCost * (item.stock?.quantityOnHand ?? 0);

            return (
              <div
                key={item.id}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                role="button"
                tabIndex={0}
                className={cn(
                  "flex items-center border-b cursor-pointer hover:bg-muted/50 transition-colors",
                  selectedItems.has(item.id) && "bg-primary/5"
                )}
                onClick={() => onRowClick?.(item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onRowClick?.(item);
                  }
                }}
                data-testid={`inventory-row-${item.id}`}
              >
                {onSelectionChange && (
                  <div
                    className="px-2 flex items-center justify-center"
                    style={{ width: 40, minWidth: 40 }}
                  >
                    <Checkbox
                      checked={selectedItems.has(item.id)}
                      onCheckedChange={(checked) => {
                        onSelectionChange(item.id, !!checked);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`checkbox-select-${item.id}`}
                    />
                  </div>
                )}
                <div
                  className="font-mono text-sm px-4 truncate"
                  style={{ width: 120, minWidth: 120 }}
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="truncate block">{item.partNumber}</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{item.partNumber}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="px-4" style={{ width: 200, minWidth: 200 }}>
                  <div className="flex flex-col">
                    <span className="font-medium truncate">{item.partName}</span>
                    {item.supplierName && (
                      <span className="text-xs text-muted-foreground truncate">
                        {item.supplierName}
                      </span>
                    )}
                  </div>
                </div>
                <div className="px-4" style={{ width: 120, minWidth: 120 }}>
                  <Badge variant="outline" className="text-xs">
                    {item.category}
                  </Badge>
                </div>
                <div className="px-4 text-right font-medium" style={{ width: 100, minWidth: 100 }}>
                  <span
                    className={cn(
                      status === "critical" || status === "out_of_stock" ? "text-destructive" : "",
                      status === "low_stock" ? "text-yellow-600" : ""
                    )}
                  >
                    {available}
                  </span>
                </div>
                <div className="px-4 text-right" style={{ width: 80, minWidth: 80 }}>
                  {item.stock?.quantityOnHand ?? 0}
                </div>
                <div className="px-4 text-right" style={{ width: 80, minWidth: 80 }}>
                  {item.stock?.quantityReserved ?? 0}
                </div>
                <div className="px-4 text-right" style={{ width: 100, minWidth: 100 }}>
                  {formatCurrencyDisplay(unitCost)}
                </div>
                <div className="px-4 text-right" style={{ width: 100, minWidth: 100 }}>
                  {formatCurrencyDisplay(totalValue)}
                </div>
                <div className="px-4 flex items-center gap-1" style={{ width: 100, minWidth: 100 }}>
                  {getStatusBadge(status)}
                  {(status === "critical" ||
                    status === "low_stock" ||
                    status === "out_of_stock") && (
                    <span onClick={(e) => e.stopPropagation()}>
                      <QuickReorderButton part={item as unknown as Parameters<typeof QuickReorderButton>[0]["part"]} variant="icon" onReorderCreated={() => {}} />
                    </span>
                  )}
                </div>
                <div className="px-4" style={{ width: 60, minWidth: 60 }}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`actions-${item.id}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onRowClick?.(item);
                        }}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      {onEdit && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(item);
                          }}
                        >
                          <Edit2 className="mr-2 h-4 w-4" />
                          Edit Part
                        </DropdownMenuItem>
                      )}
                      {onDelete && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(item);
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default VirtualizedInventoryTable;
