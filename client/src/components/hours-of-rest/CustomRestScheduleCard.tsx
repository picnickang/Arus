import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, Copy, AlertTriangle } from "lucide-react";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { MONTHS, type HoursOfRestMeta } from "@/features/crew";

interface CustomRestScheduleCardProps {
  meta: HoursOfRestMeta;
  customRestStart: string;
  setCustomRestStart: React.Dispatch<React.SetStateAction<string>>;
  customRestEnd: string;
  setCustomRestEnd: React.Dispatch<React.SetStateAction<string>>;
  monthsToCopy: string[];
  setMonthsToCopy: React.Dispatch<React.SetStateAction<string[]>>;
  monthsToRemove: string[];
  setMonthsToRemove: React.Dispatch<React.SetStateAction<string[]>>;
  applyCustomRestToAllDays: () => void;
  copyMonthToYear: () => Promise<void>;
  removeMonths: () => Promise<void>;
}

export function CustomRestScheduleCard({
  meta, customRestStart, setCustomRestStart, customRestEnd, setCustomRestEnd,
  monthsToCopy, setMonthsToCopy, monthsToRemove, setMonthsToRemove,
  applyCustomRestToAllDays, copyMonthToYear, removeMonths,
}: CustomRestScheduleCardProps) {
  return (
    <CollapsibleSection
      title="Custom Rest Schedule"
      description="Define rest periods and apply to days, months, or entire year"
      icon={<Clock className="w-5 h-5" />}
    >
      <div className="space-y-4">
        <div className="space-y-3">
          <Label className="text-sm font-medium">Rest Period Time Range</Label>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">From:</Label>
              <Input type="time" value={customRestStart} onChange={(e) => setCustomRestStart(e.target.value)} className="w-32" data-testid="input-rest-start-time" />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">To:</Label>
              <Input type="time" value={customRestEnd} onChange={(e) => setCustomRestEnd(e.target.value)} className="w-32" data-testid="input-rest-end-time" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Example: 20:00 to 06:00 for night rest</p>
        </div>

        <div className="pt-3 border-t">
          <Label className="text-sm font-medium mb-2 block">Apply to Current Month</Label>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={applyCustomRestToAllDays} className="bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900" data-testid="button-apply-rest-all-days">
              <Copy className="w-3 h-3 mr-1" />Copy to All Days of {meta.month}
            </Button>
          </div>
        </div>

        <div className="pt-3 border-t">
          <Label className="text-sm font-medium mb-2 block">Copy Month to Entire Year</Label>
          <div className="space-y-3">
            <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-800 dark:text-amber-200 mb-2">This will copy the current month's schedule ({meta.month} {meta.year}) to all selected months of the year</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {MONTHS.map((month) => (
                  <label key={month.label} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={monthsToCopy.includes(month.label)} onChange={(e) => { if (e.target.checked) { setMonthsToCopy([...monthsToCopy, month.label]); } else { setMonthsToCopy(monthsToCopy.filter((m) => m !== month.label)); } }} className="rounded" data-testid={`checkbox-copy-${month.label.toLowerCase()}`} />
                    <span>{month.label.slice(0, 3)}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="default" onClick={copyMonthToYear} disabled={monthsToCopy.length === 0} className="bg-green-600 hover:bg-green-700 text-white" data-testid="button-copy-month-to-year"><Copy className="w-3 h-3 mr-1" />Copy to {monthsToCopy.length} Selected Month(s)</Button>
              <Button size="sm" variant="outline" onClick={() => setMonthsToCopy(MONTHS.map((m) => m.label))} data-testid="button-select-all-months-copy">Select All</Button>
              <Button size="sm" variant="outline" onClick={() => setMonthsToCopy([])} data-testid="button-clear-months-copy">Clear</Button>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t">
          <Label className="text-sm font-medium mb-2 block">Clear Month Data</Label>
          <div className="space-y-3">
            <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-xs text-red-800 dark:text-red-200 mb-2">Select months to clear their rest schedule data</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {MONTHS.map((month) => (
                  <label key={month.label} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={monthsToRemove.includes(month.label)} onChange={(e) => { if (e.target.checked) { setMonthsToRemove([...monthsToRemove, month.label]); } else { setMonthsToRemove(monthsToRemove.filter((m) => m !== month.label)); } }} className="rounded" data-testid={`checkbox-remove-${month.label.toLowerCase()}`} />
                    <span>{month.label.slice(0, 3)}</span>
                  </label>
                ))}
              </div>
            </div>
            <Button size="sm" variant="destructive" onClick={removeMonths} disabled={monthsToRemove.length === 0} data-testid="button-remove-months"><AlertTriangle className="w-3 h-3 mr-1" />Clear {monthsToRemove.length} Selected Month(s)</Button>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
