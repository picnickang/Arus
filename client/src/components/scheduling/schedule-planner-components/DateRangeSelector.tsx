import { Button } from "@/components/ui/button";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { type DateRangePreset } from "@/features/crew/hooks/useSchedulePlannerData";

export function DateRangeSelector({
  preset,
  onPresetChange,
  onNavigate,
  onToday,
  startDate,
  endDate,
}: {
  preset: DateRangePreset;
  onPresetChange: (p: DateRangePreset) => void;
  onNavigate: (dir: "prev" | "next") => void;
  onToday: () => void;
  startDate: Date;
  endDate: Date;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center border rounded-md">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigate("prev")}
          data-testid="button-prev-range"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={onToday} data-testid="button-today">
          Today
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onNavigate("next")}
          data-testid="button-next-range"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center gap-1 border rounded-md">
        {(["2w", "1m", "3m"] as DateRangePreset[]).map((p) => (
          <Button
            key={p}
            variant={preset === p ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onPresetChange(p)}
            data-testid={`button-range-${p}`}
          >
            {p}
          </Button>
        ))}
      </div>
      <div className="text-sm font-medium" data-testid="text-date-range">
        {format(startDate, "MMM d")} - {format(endDate, "MMM d, yyyy")}
      </div>
    </div>
  );
}
