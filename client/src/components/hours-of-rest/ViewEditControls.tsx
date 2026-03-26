import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Calendar, ListChecks, Smartphone, Undo, Redo, ChevronLeft, ChevronRight } from "lucide-react";
import { type DayRow, type ViewMode } from "@/features/crew";

interface ViewEditControlsProps {
  viewMode: ViewMode;
  setViewMode: React.Dispatch<React.SetStateAction<ViewMode>>;
  weekOffset: number;
  setWeekOffset: React.Dispatch<React.SetStateAction<number>>;
  rows: DayRow[];
  historyIndex: number;
  historyLength: number;
  liveCheck: boolean;
  setLiveCheck: React.Dispatch<React.SetStateAction<boolean>>;
  undo: () => void;
  redo: () => void;
}

export function ViewEditControls({
  viewMode, setViewMode, weekOffset, setWeekOffset, rows,
  historyIndex, historyLength, liveCheck, setLiveCheck, undo, redo,
}: ViewEditControlsProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle>View & Edit Controls</CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border rounded-md p-1">
              <Button variant={viewMode === "month" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("month")} data-testid="button-view-month"><Calendar className="w-4 h-4 mr-1" />Month</Button>
              <Button variant={viewMode === "week" ? "default" : "ghost"} size="sm" onClick={() => { setViewMode("week"); setWeekOffset(0); }} data-testid="button-view-week"><ListChecks className="w-4 h-4 mr-1" />Week</Button>
              <Button variant={viewMode === "mobile" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("mobile")} data-testid="button-view-mobile"><Smartphone className="w-4 h-4 mr-1" />Mobile</Button>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={undo} disabled={historyIndex <= 0} title={historyIndex > 0 ? `Undo (${historyIndex} step${historyIndex !== 1 ? "s" : ""} available) — Ctrl+Z` : "Nothing to undo"} data-testid="button-undo"><Undo className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" onClick={redo} disabled={historyIndex >= historyLength - 1} title={historyIndex < historyLength - 1 ? `Redo (${historyLength - 1 - historyIndex} step${historyLength - 1 - historyIndex !== 1 ? "s" : ""} available) — Ctrl+Y` : "Nothing to redo"} data-testid="button-redo"><Redo className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {viewMode === "week" && (
          <div className="flex items-center justify-between mb-4 p-3 bg-muted rounded-lg">
            <Button variant="outline" size="sm" onClick={() => setWeekOffset(Math.max(0, weekOffset - 1))} disabled={weekOffset === 0} data-testid="button-prev-week"><ChevronLeft className="w-4 h-4" />Previous Week</Button>
            <span className="font-medium" data-testid="text-week-indicator">Week {weekOffset + 1} of {Math.ceil(rows.length / 7)}</span>
            <Button variant="outline" size="sm" onClick={() => setWeekOffset(Math.min(Math.floor(rows.length / 7), weekOffset + 1))} disabled={weekOffset >= Math.floor(rows.length / 7)} data-testid="button-next-week">Next Week<ChevronRight className="w-4 h-4" /></Button>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch id="live-check" checked={liveCheck} onCheckedChange={setLiveCheck} data-testid="switch-live-check" />
            <Label htmlFor="live-check" className="text-sm">Live compliance check</Label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
