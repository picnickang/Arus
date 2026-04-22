/**
 * Bulk Selection Bar Component
 *
 * Floating action bar for bulk operations on table-selected items.
 * Appears at bottom of viewport with smooth slide-up animation.
 *
 * @module BulkSelectionBar
 *
 * ## Architecture
 *
 * ### Floating Action Bar Pattern
 * - Fixed positioning at bottom center of viewport
 * - Appears only when items are selected (selectedCount > 0)
 * - Neutral background (distinct from critical alert bar)
 * - Smooth slide-in animation from bottom
 *
 * ### Action Buttons
 * - Clear: Always visible, clears all selections
 * - Enable: Optional, bulk enable selected items
 * - Disable: Optional, bulk disable selected items
 * - Delete: Optional, bulk delete selected items (destructive)
 *
 * ## Features
 * - Responsive button layout
 * - Clear visual separation between actions
 * - Accessibility attributes (data-testid)
 * - Conditional rendering based on selectedCount
 *
 * ## Usage Pattern
 *
 * ```tsx
 * const [selectedIds, setSelectedIds] = useState<string[]>([]);
 *
 * <BulkSelectionBar
 *   selectedCount={selectedIds.length}
 *   onClear={() => setSelectedIds([])}
 *   onDelete={handleBulkDelete}
 *   onEnable={handleBulkEnable}
 *   onDisable={handleBulkDisable}
 * />
 * ```
 *
 * @see {@link docs/api/sensor-management.md} for bulk operation APIs
 */

import { Button } from "@/components/ui/button";
import { Trash2, Power, PowerOff, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Props for BulkSelectionBar component
 *
 * @interface BulkSelectionBarProps
 * @property {number} selectedCount - Number of items currently selected
 * @property {() => void} [onDelete] - Optional callback for bulk delete action (destructive)
 * @property {() => void} [onEnable] - Optional callback for bulk enable action
 * @property {() => void} [onDisable] - Optional callback for bulk disable action
 * @property {() => void} onClear - Callback to clear all selections (required)
 * @property {string} [className] - Additional CSS classes for customization
 */
interface BulkSelectionBarProps {
  selectedCount: number;
  onDelete?: () => void;
  onEnable?: () => void;
  onDisable?: () => void;
  onClear: () => void;
  className?: string;
}

export function BulkSelectionBar({
  selectedCount,
  onDelete,
  onEnable,
  onDisable,
  onClear,
  className,
}: BulkSelectionBarProps) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
        "bg-background border border-border rounded-lg shadow-2xl",
        "px-6 py-3 flex items-center gap-4 animate-in slide-in-from-bottom-5",
        className
      )}
      data-testid="bulk-selection-bar"
    >
      <div className="flex items-center gap-2">
        <span className="font-semibold text-sm">
          {selectedCount} {selectedCount === 1 ? "sensor" : "sensors"} selected
        </span>
      </div>

      <div className="h-6 w-px bg-border" />

      <div className="flex items-center gap-2">
        {onEnable && (
          <Button
            variant="outline"
            size="sm"
            onClick={onEnable}
            disabled={!onEnable}
            data-testid="button-enable-selected"
          >
            <Power className="h-4 w-4 mr-1" />
            Enable
          </Button>
        )}
        {onDisable && (
          <Button
            variant="outline"
            size="sm"
            onClick={onDisable}
            disabled={!onDisable}
            data-testid="button-disable-selected"
          >
            <PowerOff className="h-4 w-4 mr-1" />
            Disable
          </Button>
        )}
        {onDelete && (
          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
            disabled={!onDelete}
            data-testid="button-delete-selected"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onClear} data-testid="button-clear-selection">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
