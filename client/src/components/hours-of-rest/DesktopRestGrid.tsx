import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { type DayRow, type ViewMode, type calculateDayCompliance } from "@/features/crew";

interface DesktopRestGridProps {
  displayRows: DayRow[];
  compliance: ReturnType<typeof calculateDayCompliance>;
  viewMode: ViewMode;
  weekOffset: number;
  selectedDay: number | null;
  setSelectedDay: React.Dispatch<React.SetStateAction<number | null>>;
  liveCheck: boolean;
  startDrag: (dIdx: number, h: number) => void;
  onDrag: (dIdx: number, h: number) => void;
}

const hours = Array.from({ length: 24 }, (_, i) => i);
const hourW = 24;
const cell = 18;
const hdrH = 26;

export function DesktopRestGrid({
  displayRows, compliance, viewMode, weekOffset,
  selectedDay, setSelectedDay, liveCheck, startDrag, onDrag,
}: DesktopRestGridProps) {
  return (
    <Card className="border-2 shadow-lg">
      <CardHeader className="bg-muted/50 border-b">
        <CardTitle className="text-xl font-semibold flex items-center gap-2"><Clock className="w-5 h-5" />Rest Hours Grid</CardTitle>
        <CardDescription>
          Click to toggle cells, drag to paint.{" "}
          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 bg-emerald-200 dark:bg-emerald-800 rounded border"></span> REST</span> •{" "}
          <span className="inline-flex items-center gap-1"><span className="w-3 h-3 bg-rose-200 dark:bg-rose-800 rounded border"></span> WORK</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="overflow-x-auto bg-background rounded-lg border shadow-inner" data-testid="rest-hours-grid">
          <div className="sticky top-0 z-10" style={{ display: "grid", gridTemplateColumns: `110px repeat(24, ${hourW}px) 75px 75px`, alignItems: "center" }}>
            <div className="bg-muted border-r px-3 py-2 font-medium">Date</div>
            {hours.map((h) => (
              <div key={h} className="bg-muted border-r text-center font-mono font-semibold transition-colors hover:bg-muted/80" style={{ height: hdrH + 6, lineHeight: `${hdrH + 6}px`, fontSize: 11 }}>
                {String(h).padStart(2, "0")}
              </div>
            ))}
            <div className="bg-muted border-r text-center font-medium px-2 py-2 text-xs">Rest/24h</div>
            <div className="bg-muted text-center font-medium px-2 py-2 text-xs">Min24h</div>
          </div>

          {displayRows.map((r, ri) => {
            const actualIndex = viewMode === "week" ? weekOffset * 7 + ri : ri;
            const c = compliance[actualIndex];
            const dayOK = c?.dayOK;
            return (
              <div
                key={r.date}
                role="button"
                tabIndex={0}
                className={`group hover:bg-muted/50 transition-colors ${selectedDay === actualIndex ? "bg-blue-50 dark:bg-blue-950" : ""}`}
                onClick={() => setSelectedDay(actualIndex)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedDay(actualIndex); } }}
                data-testid={`grid-row-${actualIndex}`}
              >
                <div style={{ display: "grid", gridTemplateColumns: `110px repeat(24, ${hourW}px) 75px 75px` }}>
                  <div className={`bg-muted/50 border-r px-3 py-2 flex items-center justify-center font-mono font-medium ${!dayOK && liveCheck ? "border-l-4 border-l-rose-500" : ""}`}>
                    <span className="text-xs">{r.date.slice(8, 10)}</span>
                  </div>
                  {hours.map((h) => {
                    const v = (r as Record<string, number | string>)[`h${h}`] || 0;
                    const isRest = v === 1;
                    const isNightHour = h >= 20 || h < 6;
                    return (
                      <div
                        key={h}
                        role="checkbox"
                        aria-checked={isRest}
                        aria-label={`Hour ${String(h).padStart(2, "0")}:00, ${isRest ? "Rest" : "Work"}${isNightHour ? " (Night)" : ""}`}
                        tabIndex={0}
                        onMouseDown={(e) => { e.preventDefault(); startDrag(actualIndex, h); }}
                        onMouseEnter={() => onDrag(actualIndex, h)}
                        onTouchStart={(e) => { e.preventDefault(); startDrag(actualIndex, h); }}
                        onTouchMove={(e) => {
                          const touch = e.touches[0];
                          const el = document.elementFromPoint(touch.clientX, touch.clientY);
                          const testId = el?.getAttribute("data-testid");
                          if (testId?.startsWith("grid-cell-")) {
                            const parts = testId.split("-");
                            onDrag(Number(parts[2]), Number(parts[3]));
                          }
                        }}
                        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); startDrag(actualIndex, h); } }}
                        className={`border-r border-b cursor-crosshair transition-all duration-150 hover:scale-105 hover:z-10 hover:shadow-md ${isRest ? "bg-emerald-100 dark:bg-emerald-900 hover:bg-emerald-200 dark:hover:bg-emerald-800" : "bg-rose-100 dark:bg-rose-900 hover:bg-rose-200 dark:hover:bg-rose-800"} ${isNightHour ? "ring-1 ring-inset ring-indigo-300 dark:ring-indigo-600" : ""}`}
                        style={{ width: hourW, height: cell + 2, position: "relative" }}
                        data-testid={`grid-cell-${actualIndex}-${h}`}
                        title={`${isRest ? "REST" : "WORK"} at ${String(h).padStart(2, "0")}:00${isNightHour ? " (Night)" : ""}`}
                      >
                        {isRest && <div className="absolute inset-0 flex items-center justify-center opacity-20"><div className="w-1 h-1 bg-emerald-600 dark:bg-emerald-400 rounded-full"></div></div>}
                      </div>
                    );
                  })}
                  <div className={`border-r border-b text-center flex items-center justify-center font-mono font-semibold ${c.restTotal >= 10 ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300" : "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300"}`} style={{ fontSize: 11 }} data-testid={`stat-rest-total-${actualIndex}`}>{c.restTotal}</div>
                  <div className={`border-b text-center flex items-center justify-center font-mono font-semibold ${c.minRest24 >= 10 ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300" : "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300"}`} style={{ fontSize: 11 }} data-testid={`stat-min24-${actualIndex}`}>{c.minRest24.toFixed(0)}</div>
                </div>
                <div className={`h-1 transition-all duration-300 ${dayOK ? "bg-gradient-to-r from-emerald-400 to-emerald-600 shadow-sm" : "bg-gradient-to-r from-rose-400 to-rose-600 shadow-sm"}`} style={{ marginBottom: 2 }} />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
