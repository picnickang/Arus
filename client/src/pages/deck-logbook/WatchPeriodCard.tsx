import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WatchData } from "./types";

export function WatchPeriodCard({
  period,
  watch,
  isLocked,
  updateWatchAssignment,
}: {
  period: string;
  watch: WatchData;
  isLocked: boolean;
  updateWatchAssignment: (period: string, field: string, value: string) => void;
}) {
  return (
    <div className="border rounded-lg p-4">
      <h4 className="font-semibold mb-3">{period}</h4>
      <div className="space-y-2">
        <div>
          <Label className="text-xs">Officer of the Watch</Label>
          <Input
            value={watch.officerName || ""}
            onChange={(e) => updateWatchAssignment(period, "officerName", e.target.value)}
            placeholder="Name"
            className="h-8"
            disabled={isLocked}
            data-testid={`input-watch-officer-${period}`}
          />
        </div>
        <div>
          <Label className="text-xs">Helmsman</Label>
          <Input
            value={watch.helmName || ""}
            onChange={(e) => updateWatchAssignment(period, "helmName", e.target.value)}
            placeholder="Name"
            className="h-8"
            disabled={isLocked}
            data-testid={`input-watch-helm-${period}`}
          />
        </div>
        <div>
          <Label className="text-xs">Lookout</Label>
          <Input
            value={watch.lookoutName || ""}
            onChange={(e) => updateWatchAssignment(period, "lookoutName", e.target.value)}
            placeholder="Name"
            className="h-8"
            disabled={isLocked}
            data-testid={`input-watch-lookout-${period}`}
          />
        </div>
      </div>
    </div>
  );
}
