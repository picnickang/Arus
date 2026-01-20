import type { PartsInventoryItem } from "@/components/inventory/VirtualizedInventoryTable";

export type StockStatus = "out_of_stock" | "critical" | "low_stock" | "adequate" | "excess_stock" | "unknown";

export function getStockStatus(part: PartsInventoryItem): StockStatus {
  if (!part.stock) {
    return "unknown";
  }
  const { quantityOnHand, quantityReserved = 0 } = part.stock;
  const available = Math.max(0, quantityOnHand - quantityReserved);
  const minStock = part.minStockLevel ?? 1;
  const maxStock = part.maxStockLevel ?? 1000;

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

export function getAvailableQuantity(part: PartsInventoryItem): number {
  if (!part.stock) {
    return 0;
  }
  return Math.max(0, part.stock.quantityOnHand - (part.stock.quantityReserved || 0));
}

export function getPartValue(part: PartsInventoryItem): number {
  const cost = part.stock?.unitCost || part.standardCost || 0;
  const qty = part.stock?.quantityOnHand || 0;
  return cost * qty;
}

export interface InventoryStats {
  totalParts: number;
  totalValue: number;
  criticalCount: number;
  lowStockCount: number;
  adequateCount: number;
  categories: number;
}

export function calculateInventoryStats(parts: PartsInventoryItem[]): InventoryStats {
  const totalParts = parts.length;
  let totalValue = 0;
  let criticalCount = 0;
  let lowStockCount = 0;
  let adequateCount = 0;

  parts.forEach((part) => {
    totalValue += getPartValue(part);
    const status = getStockStatus(part);
    if (status === "out_of_stock" || status === "critical") { criticalCount++; }
    else if (status === "low_stock") { lowStockCount++; }
    else if (status === "adequate") { adequateCount++; }
  });

  const categories = new Set(parts.map((part) => part.category)).size;

  return { totalParts, totalValue, criticalCount, lowStockCount, adequateCount, categories };
}

const STATUS_ORDER: Record<StockStatus, number> = {
  critical: 0,
  out_of_stock: 1,
  low_stock: 2,
  adequate: 3,
  excess_stock: 4,
  unknown: 5,
};

export type SortField = "partName" | "partNumber" | "category" | "available" | "unitCost" | "totalValue" | "status";
export type SortDirection = "asc" | "desc";

export function sortParts(
  parts: PartsInventoryItem[],
  sortField: string,
  sortDirection: SortDirection
): PartsInventoryItem[] {
  return [...parts].sort((a, b) => {
    let aValue: string | number;
    let bValue: string | number;

    switch (sortField) {
      case "partName":
        aValue = (a.partName || "").toLowerCase();
        bValue = (b.partName || "").toLowerCase();
        break;
      case "partNumber":
        aValue = (a.partNumber || "").toLowerCase();
        bValue = (b.partNumber || "").toLowerCase();
        break;
      case "category":
        aValue = (a.category || "").toLowerCase();
        bValue = (b.category || "").toLowerCase();
        break;
      case "available":
        aValue = getAvailableQuantity(a);
        bValue = getAvailableQuantity(b);
        break;
      case "unitCost":
        aValue = a.stock?.unitCost || a.standardCost || 0;
        bValue = b.stock?.unitCost || b.standardCost || 0;
        break;
      case "totalValue":
        aValue = getPartValue(a);
        bValue = getPartValue(b);
        break;
      case "status":
        aValue = STATUS_ORDER[getStockStatus(a)];
        bValue = STATUS_ORDER[getStockStatus(b)];
        break;
      default:
        aValue = (a.partName || "").toLowerCase();
        bValue = (b.partName || "").toLowerCase();
    }

    if (aValue < bValue) {
      return sortDirection === "asc" ? -1 : 1;
    }

    if (aValue > bValue) {
      return sortDirection === "asc" ? 1 : -1;
    }
    return 0;
  });
}
