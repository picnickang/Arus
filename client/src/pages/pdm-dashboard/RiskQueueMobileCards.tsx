import { CheckCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { RiskQueueItem } from "@/features/pdm";
import { SeverityBadge, StatusBadge, EvidenceChipBadge } from "./_shared";

export function RiskQueueMobileCards({
  items,
  onSelectItem,
  isLoading,
}: {
  items: RiskQueueItem[];
  onSelectItem: (item: RiskQueueItem) => void;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <CheckCircle className="h-8 w-8 mb-2" />
        <p className="text-sm">No items in this queue</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[400px] overflow-y-auto">
      {items.map((item) => (
        <div
          key={item.id}
          className="p-3 border rounded-lg hover-elevate cursor-pointer"
          onClick={() => onSelectItem(item)}
          data-testid={`risk-item-${item.id}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <SeverityBadge severity={item.severity} />
                <span className="text-xs text-muted-foreground">{item.vesselName}</span>
              </div>
              <p className="font-medium text-sm truncate">{item.equipmentName}</p>
              <p className="text-xs text-muted-foreground truncate">{item.failureMode}</p>
              {item.evidenceChips && item.evidenceChips.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {item.evidenceChips.slice(0, 2).map((chip, idx) => (
                    <EvidenceChipBadge key={idx} chip={chip} />
                  ))}
                </div>
              )}
            </div>
            <div className="text-right shrink-0">
              {item.rulEstimateDays !== null && (
                <div>
                  <p
                    className={`text-sm font-semibold ${item.rulEstimateDays < 7 ? "text-red-500" : ""}`}
                  >
                    {item.rulEstimateDays < 7 ? "< " : ""}
                    {item.rulEstimateDays}d
                  </p>
                  {item.rulConfidenceInterval && (
                    <p className="text-xs text-muted-foreground">
                      {item.rulConfidenceInterval.lowDays}-{item.rulConfidenceInterval.highDays}d
                    </p>
                  )}
                </div>
              )}
              <StatusBadge status={item.status} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
