import { Badge } from "@/components/ui/badge";

export function StockBadge({
  part,
}: {
  part: {
    minStockLevel?: number | null;
    reorderPoint?: number | null;
    criticality?: string | null;
  };
}) {
  const qty = part.minStockLevel ? part.reorderPoint || 1 : 1;
  const min = part.minStockLevel ?? 0;
  if (qty === 0) {
    return (
      <Badge variant="destructive" className="text-[10px]">
        Out of Stock
      </Badge>
    );
  }
  if (min > 0 && qty <= min) {
    return (
      <Badge variant="secondary" className="text-[10px] bg-yellow-500/15 text-yellow-500">
        Low Stock
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px] bg-green-500/15 text-green-500">
      In Stock
    </Badge>
  );
}
