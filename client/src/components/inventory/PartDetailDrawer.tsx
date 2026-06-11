import { useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Package,
  Edit2,
  Clipboard,
  AlertTriangle,
  Clock,
  DollarSign,
  MapPin,
  Truck,
  BarChart3,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import type { PartsInventoryItem } from "./VirtualizedInventoryTable";
import { SupplierLinksSection } from "./SupplierLinksSection";

interface PartDetailDrawerProps {
  part: PartsInventoryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (part: PartsInventoryItem) => void;
  onAddToWorkOrder?: (part: PartsInventoryItem) => void;
}

function getStockStatus(part: PartsInventoryItem): {
  status: string;
  label: string;
  color: string;
  icon: typeof CheckCircle;
} {
  if (!part.stock) {
    return {
      status: "unknown",
      label: "No Stock Data",
      color: "text-muted-foreground",
      icon: Package,
    };
  }

  const { quantityOnHand, quantityReserved } = part.stock;
  const available = Math.max(0, quantityOnHand - quantityReserved);
  const minStock = part.minStockLevel;
  const maxStock = part.maxStockLevel;

  if (quantityOnHand <= 0) {
    return {
      status: "out_of_stock",
      label: "Out of Stock",
      color: "text-destructive",
      icon: XCircle,
    };
  }

  if (available <= 0 || available < minStock * 0.5) {
    return {
      status: "critical",
      label: "Critical",
      color: "text-destructive",
      icon: AlertTriangle,
    };
  }

  if (available < minStock) {
    return {
      status: "low_stock",
      label: "Low Stock",
      color: "text-yellow-600",
      icon: AlertTriangle,
    };
  }

  if (available > maxStock) {
    return { status: "excess", label: "Excess Stock", color: "text-blue-600", icon: TrendingUp };
  }
  return { status: "adequate", label: "Adequate", color: "text-green-600", icon: CheckCircle };
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  className,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: typeof Package;
  trend?: "up" | "down" | "neutral";
  className?: string;
}) {
  return (
    <Card className={cn("", className)}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {trend && (
              <span
                className={cn(
                  "text-xs",
                  trend === "up" && "text-green-600",
                  trend === "down" && "text-red-600"
                )}
              >
                {trend === "up" ? <TrendingUp className="h-4 w-4" /> : null}
                {trend === "down" ? <TrendingDown className="h-4 w-4" /> : null}
                {trend === "neutral" ? <Minus className="h-4 w-4 text-muted-foreground" /> : null}
              </span>
            )}
            {Icon && <Icon className="h-8 w-8 text-muted-foreground opacity-50" />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PartDetailDrawer({
  part,
  open,
  onOpenChange,
  onEdit,
  onAddToWorkOrder,
}: PartDetailDrawerProps) {
  const statusInfo = useMemo(() => (part ? getStockStatus(part) : null), [part]);

  const available = useMemo(() => {
    if (!part?.stock) {
      return 0;
    }
    return Math.max(0, part.stock.quantityOnHand - part.stock.quantityReserved);
  }, [part]);

  const totalValue = useMemo(() => {
    if (!part?.stock) {
      return 0;
    }
    const unitCost = part.stock.unitCost ?? part.standardCost ?? 0;
    return unitCost * part.stock.quantityOnHand;
  }, [part]);

  const reorderNeeded = useMemo(() => {
    if (!part) {
      return false;
    }
    return available < part.minStockLevel;
  }, [part, available]);

  if (!part) {
    return null;
  }

  const StatusIcon = statusInfo?.icon ?? Package;
  const unitCost = part.stock?.unitCost ?? part.standardCost ?? 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto" data-testid="part-detail-drawer">
        <SheetHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-xl font-bold truncate pr-8">{part.partName}</SheetTitle>
              <SheetDescription className="flex items-center gap-2 mt-1">
                <code className="text-sm font-mono bg-muted px-2 py-0.5 rounded">
                  {part.partNumber}
                </code>
                <Badge variant="outline">{part.category}</Badge>
                {part.criticality && (
                  <Badge variant={part.criticality === "critical" ? "destructive" : "secondary"}>
                    {part.criticality}
                  </Badge>
                )}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 pb-6">
          <div
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg border",
              statusInfo?.status === "critical" || statusInfo?.status === "out_of_stock"
                ? "bg-destructive/10 border-destructive/20"
                : statusInfo?.status === "low_stock"
                  ? "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800"
                  : statusInfo?.status === "excess"
                    ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
                    : "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
            )}
          >
            <StatusIcon className={cn("h-5 w-5", statusInfo?.color)} />
            <div className="flex-1">
              <p className={cn("font-medium", statusInfo?.color)}>{statusInfo?.label}</p>
              <p className="text-sm text-muted-foreground">
                {available} units available of {part.stock?.quantityOnHand ?? 0} on hand
              </p>
            </div>
            {reorderNeeded && <Badge variant="destructive">Reorder Needed</Badge>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatCard
              title="Available"
              value={available}
              subtitle={`${part.stock?.quantityReserved ?? 0} reserved`}
              icon={Package}
            />
            <StatCard
              title="Unit Cost"
              value={formatCurrency(unitCost, { fallback: "-" })}
              icon={DollarSign}
            />
            <StatCard
              title="Total Value"
              value={formatCurrency(totalValue, { fallback: "-" })}
              subtitle={`${part.stock?.quantityOnHand ?? 0} units`}
              icon={BarChart3}
            />
            <StatCard title="Lead Time" value={`${part.leadTimeDays ?? 7} days`} icon={Clock} />
          </div>

          <div className="flex gap-2">
            {onEdit && (
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onEdit(part)}
                data-testid="btn-edit-part"
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Edit Part
              </Button>
            )}
            {onAddToWorkOrder && (
              <Button
                className="flex-1"
                onClick={() => onAddToWorkOrder(part)}
                disabled={available <= 0}
                data-testid="btn-add-to-work-order"
              >
                <Clipboard className="h-4 w-4 mr-2" />
                Add to Work Order
              </Button>
            )}
          </div>

          <Separator />

          <Tabs defaultValue="details">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="stock">Stock Levels</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Part Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Part Number</span>
                    <span className="font-mono">{part.partNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Category</span>
                    <span>{part.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unit of Measure</span>
                    <span>{part.unitOfMeasure ?? "ea"}</span>
                  </div>
                  {part.description && (
                    <div className="pt-2 border-t">
                      <p className="text-muted-foreground mb-1">Description</p>
                      <p className="text-sm">{part.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Default Supplier
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Supplier</span>
                    <span>{part.supplierName ?? "Not specified"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lead Time</span>
                    <span>{part.leadTimeDays ?? 7} days</span>
                  </div>
                </CardContent>
              </Card>

              {part.id && <SupplierLinksSection inventoryItemId={part.id} />}
            </TabsContent>

            <TabsContent value="stock" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Stock by Location
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">{part.stock?.location ?? "MAIN"}</p>
                        <p className="text-sm text-muted-foreground">Primary Location</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">{part.stock?.quantityOnHand ?? 0}</p>
                        <p className="text-xs text-muted-foreground">
                          {part.stock?.quantityReserved ?? 0} reserved
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Reorder Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Minimum Stock Level</span>
                    <span
                      className={cn(
                        available < part.minStockLevel && "text-destructive font-medium"
                      )}
                    >
                      {part.minStockLevel}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Maximum Stock Level</span>
                    <span
                      className={cn(
                        part.stock &&
                          part.stock.quantityOnHand > part.maxStockLevel &&
                          "text-blue-600 font-medium"
                      )}
                    >
                      {part.maxStockLevel}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">On Order</span>
                    <span>{part.stock?.quantityOnOrder ?? 0}</span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="space-y-4 mt-4">
              <Card>
                <CardContent className="py-8 text-center">
                  <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Stock movement history will be available here
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default PartDetailDrawer;
