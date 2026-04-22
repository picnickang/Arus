import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type { PRItem } from "../types";

interface PRItemsTableProps {
  items: PRItem[];
  isEditable?: boolean;
  onRemove?: (itemId: string) => void;
  isRemoving?: boolean;
}

export function PRItemsTable({ items, isEditable, onRemove, isRemoving }: PRItemsTableProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground" data-testid="text-no-items">
        No items added yet. Add parts to this purchase request.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Part</TableHead>
          <TableHead>Supplier</TableHead>
          <TableHead className="text-right">Qty</TableHead>
          <TableHead>UoM</TableHead>
          <TableHead>Remarks</TableHead>
          {isEditable && <TableHead className="w-12"></TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id} data-testid={`row-pr-item-${item.id}`}>
            <TableCell>
              <div className="font-medium">{item.partName || "Unknown Part"}</div>
              <div className="text-sm text-muted-foreground">{item.partNumber}</div>
            </TableCell>
            <TableCell>{item.supplierName || "-"}</TableCell>
            <TableCell className="text-right font-medium">{item.quantity}</TableCell>
            <TableCell>{item.uom || "-"}</TableCell>
            <TableCell className="max-w-[200px] truncate">{item.remarks || "-"}</TableCell>
            {isEditable && (
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove?.(item.id)}
                  disabled={isRemoving}
                  className="text-destructive hover:text-destructive"
                  data-testid={`button-remove-item-${item.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
