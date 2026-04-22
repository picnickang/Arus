import { CheckCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAcknowledgeRisk, useCreateWorkOrderFromRisk } from "@/features/pdm";
import type { RiskQueueItem } from "@/features/pdm";
import { SeverityBadge, StatusBadge, MiniSparkline, EvidenceChipBadge } from "./_shared";

export function RiskQueueDesktopTable({
  items,
  onSelectItem,
  isLoading,
}: {
  items: RiskQueueItem[];
  onSelectItem: (item: RiskQueueItem) => void;
  isLoading: boolean;
}) {
  const acknowledgeMutation = useAcknowledgeRisk();
  const createWOMutation = useCreateWorkOrderFromRisk();

  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <CheckCircle className="h-10 w-10 mb-3" />
        <p className="text-sm font-medium">No items in this queue</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Severity</TableHead>
            <TableHead>Vessel / Asset</TableHead>
            <TableHead>Failure Mode</TableHead>
            <TableHead className="w-[100px]">RUL Estimate</TableHead>
            <TableHead>Recommended Action</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow
              key={item.id}
              className="cursor-pointer hover-elevate"
              onClick={() => onSelectItem(item)}
              data-testid={`risk-item-${item.id}`}
            >
              <TableCell>
                <SeverityBadge severity={item.severity} />
              </TableCell>
              <TableCell>
                <div>
                  <p className="font-medium text-sm">{item.vesselName}</p>
                  <p className="text-xs text-muted-foreground">{item.equipmentName}</p>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-sm">{item.failureMode}</span>
              </TableCell>
              <TableCell>
                {item.rulEstimateDays !== null ? (
                  <div className="flex flex-col">
                    <span
                      className={`font-semibold text-sm ${item.rulEstimateDays < 7 ? "text-red-500" : ""}`}
                    >
                      {item.rulEstimateDays < 7 ? "< " : ""}
                      {item.rulEstimateDays} days
                    </span>
                    {item.rulConfidenceInterval && (
                      <span className="text-xs text-muted-foreground">
                        {item.rulConfidenceInterval.lowDays}-{item.rulConfidenceInterval.highDays}d
                        range
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">N/A</span>
                )}
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground block">
                    {item.recommendedAction}
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.evidenceChips &&
                      item.evidenceChips.length > 0 &&
                      item.evidenceChips.map((chip, idx) => (
                        <EvidenceChipBadge key={idx} chip={chip} />
                      ))}
                    {item.trendData && item.trendData.length >= 2 && (
                      <MiniSparkline
                        data={item.trendData}
                        color={
                          item.severity === "critical"
                            ? "#ef4444"
                            : item.severity === "high"
                              ? "#f97316"
                              : "#3b82f6"
                        }
                      />
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={item.status} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {item.status !== "resolved" && (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          acknowledgeMutation.mutate(item.id);
                        }}
                        disabled={acknowledgeMutation.isPending}
                        data-testid={`ack-${item.id}`}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          createWOMutation.mutate(item.id);
                        }}
                        disabled={createWOMutation.isPending}
                        data-testid={`create-wo-${item.id}`}
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
