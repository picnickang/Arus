/**
 * Virtualized model-lineage table for the governance dashboard.
 *
 * Lineage grows unbounded with training history (docs/ui-assessment.md §6),
 * so the body is windowed with @tanstack/react-virtual following the hybrid
 * pattern of VirtualizedInventoryTable: a non-scrolling header table over an
 * absolutely-positioned, fixed-row-height virtual body. Cells, testids, and
 * the comparison highlight reproduce the previous inline table verbatim.
 */

import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, GitBranch } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { formatNumber } from "@/lib/formatters";
import { FAMILY_COLORS, STAGE_COLORS, type LineageRecord } from "@/features/settings";

const ROW_HEIGHT = 48;

const COLUMNS = [
  { key: "modelId", label: "Model ID", width: 140 },
  { key: "family", label: "Family", width: 110 },
  { key: "profile", label: "Profile", width: 140 },
  { key: "version", label: "Version", width: 90 },
  { key: "stage", label: "Stage", width: 120 },
  { key: "predictions", label: "Predictions", width: 110 },
  { key: "created", label: "Created", width: 150 },
  { key: "actions", label: "", width: 100 },
] as const;

interface VirtualizedLineageTableProps {
  records: LineageRecord[];
  comparisonModel: LineageRecord | null;
  onViewDetails: (record: LineageRecord) => void;
  onToggleComparison: (record: LineageRecord) => void;
  maxHeight?: number | undefined;
}

export function VirtualizedLineageTable({
  records,
  comparisonModel,
  onViewDetails,
  onToggleComparison,
  maxHeight = 500,
}: VirtualizedLineageTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: records.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  return (
    <div
      className="border rounded-lg overflow-x-auto flex flex-col"
      data-testid="virtualized-lineage-table"
    >
      <div className="bg-muted/50 flex-none">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((column) => (
                <TableHead key={column.key} style={{ width: column.width, minWidth: column.width }}>
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        </Table>
      </div>
      <div
        ref={parentRef}
        className="overflow-auto flex-1"
        style={{ maxHeight }}
        data-testid="lineage-scroll-container"
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: "100%",
            position: "relative",
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const record = records[virtualRow.index];
            if (!record) {
              return null;
            }
            return (
              <div
                key={record.modelId}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="flex items-center border-b hover:bg-muted/50 transition-colors"
                data-testid={`row-model-${record.modelId}`}
              >
                <div
                  className="font-mono text-xs px-4 truncate"
                  style={{ width: 140, minWidth: 140 }}
                >
                  {record.modelId.substring(0, 12)}...
                </div>
                <div className="px-4" style={{ width: 110, minWidth: 110 }}>
                  <Badge className={FAMILY_COLORS[record.family]}>
                    {record.family.toUpperCase()}
                  </Badge>
                </div>
                <div className="px-4 truncate" style={{ width: 140, minWidth: 140 }}>
                  {record.profile}
                </div>
                <div className="px-4" style={{ width: 90, minWidth: 90 }}>
                  v{record.version}
                </div>
                <div className="px-4" style={{ width: 120, minWidth: 120 }}>
                  <Badge className={STAGE_COLORS[record.promotion.stage]}>
                    {record.promotion.stage}
                  </Badge>
                </div>
                <div className="px-4" style={{ width: 110, minWidth: 110 }}>
                  {formatNumber(record.predictionCount)}
                </div>
                <div
                  className="px-4 text-muted-foreground text-sm truncate"
                  style={{ width: 150, minWidth: 150 }}
                >
                  {formatDistanceToNow(parseISO(record.createdAt), { addSuffix: true })}
                </div>
                <div className="px-4" style={{ width: 100, minWidth: 100 }}>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewDetails(record)}
                      data-testid={`button-view-model-${record.modelId}`}
                      title="View Details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleComparison(record)}
                      className={comparisonModel?.modelId === record.modelId ? "bg-primary/10" : ""}
                      data-testid={`button-compare-model-${record.modelId}`}
                      title={comparisonModel?.modelId === record.modelId ? "Deselect" : "Compare"}
                    >
                      <GitBranch className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
