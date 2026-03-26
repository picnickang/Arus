import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { type DayRow, chunks, type calculateDayCompliance } from "@/features/crew";

interface MobileRestViewProps {
  displayRows: DayRow[];
  compliance: ReturnType<typeof calculateDayCompliance>;
  isDragging: boolean;
  startDrag: (dIdx: number, h: number) => void;
  onDrag: (dIdx: number, h: number) => void;
}

const hours = Array.from({ length: 24 }, (_, i) => i);

export function MobileRestView({ displayRows, compliance, startDrag, onDrag }: MobileRestViewProps) {
  return (
    <Card className="border-2 shadow-lg">
      <CardHeader className="bg-muted/50 border-b">
        <CardTitle className="text-xl font-semibold">Day-by-Day View</CardTitle>
        <CardDescription>Optimized for mobile devices - tap time blocks to edit</CardDescription>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        {displayRows.map((r, ri) => {
          const c = compliance[ri];
          const restChunks = chunks(r);
          return (
            <div key={r.date} className="p-4 bg-background rounded-lg border" data-testid={`mobile-day-card-${ri}`}>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-lg">{new Date(r.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</h4>
                  <p className="text-xs text-muted-foreground">{r.date}</p>
                </div>
                <Badge variant={c.dayOK ? "default" : "destructive"} className="ml-2" data-testid={`badge-compliance-mobile-${ri}`}>{c.dayOK ? <><CheckCircle2 className="h-3 w-3 mr-1" />Compliant</> : "Violation"}</Badge>
              </div>
              <div className="relative h-12 bg-muted rounded-lg mb-3 overflow-hidden">
                {restChunks.map(([start, end]) => {
                  const isRest = (r as Record<string, number | string>)[`h${start}`] === 1;
                  const width = ((end - start) / 24) * 100;
                  const left = (start / 24) * 100;
                  return <div key={`chunk-${start}-${end}`} className={`absolute h-full ${isRest ? "bg-emerald-400" : "bg-rose-400"}`} style={{ left: `${left}%`, width: `${width}%` }} title={`${isRest ? "REST" : "WORK"} ${start}:00-${end}:00`} />;
                })}
                <div className="absolute inset-0 grid grid-cols-24">
                  {hours.map((h) => (
                    <button
                      key={h}
                      data-testid={`mobile-cell-${ri}-${h}`}
                      onMouseDown={() => startDrag(ri, h)}
                      onMouseEnter={() => onDrag(ri, h)}
                      onTouchStart={(e) => { e.preventDefault(); startDrag(ri, h); }}
                      onTouchMove={(e) => {
                        const touch = e.touches[0];
                        const el = document.elementFromPoint(touch.clientX, touch.clientY);
                        const tid = el?.getAttribute("data-testid");
                        if (tid?.startsWith("mobile-cell-")) {
                          const parts = tid.split("-");
                          onDrag(Number(parts[2]), Number(parts[3]));
                        }
                      }}
                      className="border-l border-border first:border-l-0 hover:bg-muted-foreground/20 transition-colors"
                    />
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="text-center p-2 bg-muted rounded" data-testid={`stat-rest-total-mobile-${ri}`}><p className="text-muted-foreground">Rest Total</p><p className={`font-semibold ${c.restTotal >= 10 ? "text-emerald-600" : "text-rose-600"}`}>{c.restTotal}h</p></div>
                <div className="text-center p-2 bg-muted rounded" data-testid={`stat-min24-mobile-${ri}`}><p className="text-muted-foreground">Min 24h</p><p className={`font-semibold ${c.minRest24 >= 10 ? "text-emerald-600" : "text-rose-600"}`}>{c.minRest24.toFixed(0)}h</p></div>
                <div className="text-center p-2 bg-muted rounded" data-testid={`stat-blocks-mobile-${ri}`}><p className="text-muted-foreground">Blocks</p><p className={`font-semibold ${c.splitOK ? "text-emerald-600" : "text-rose-600"}`}>{restChunks.filter(([a]) => (r as Record<string, number | string>)[`h${a}`] === 1).length}</p></div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
