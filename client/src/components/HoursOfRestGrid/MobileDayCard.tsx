import React from "react";
import { Badge } from "@/components/ui/badge";
import { chunks } from "@/features/crew";
import { HOURS, hourValue, parseLocalDate } from "./constants";
import type { ComplianceRow } from "./types";

interface MobileDayCardProps {
  r: Record<string, number | string> & { date: string };
  ri: number;
  c: ComplianceRow | undefined;
  isDragging: boolean;
  startDrag: (row: number, h: number) => void;
  onDrag: (row: number, h: number) => void;
}

export const MobileDayCard = React.memo(function MobileDayCard({
  r,
  ri,
  c,
  isDragging,
  startDrag,
  onDrag,
}: MobileDayCardProps) {
  if (!c) {
    return null;
  }

  const restChunks = chunks(r);
  const displayDate = parseLocalDate(r.date).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="font-semibold text-lg">{displayDate}</h4>
          <p className="text-xs text-muted-foreground">{r.date}</p>
        </div>
        <Badge variant={c.dayOK ? "default" : "destructive"} className="ml-2">
          {c.dayOK ? "✓ Compliant" : "✗ Violation"}
        </Badge>
      </div>
      <div className="relative h-12 bg-slate-100 dark:bg-slate-800 rounded-lg mb-3 overflow-hidden">
        {restChunks.map(([start, end]) => {
          const isRest = hourValue(r, start) === 1;
          return (
            <div
              key={`chunk-${start}-${end}`}
              className={`absolute h-full ${isRest ? "bg-emerald-400" : "bg-rose-400"}`}
              style={{ left: `${(start / 24) * 100}%`, width: `${((end - start) / 24) * 100}%` }}
              title={`${isRest ? "REST" : "WORK"} ${start}:00–${end}:00`}
            />
          );
        })}
        <div className="absolute inset-0 grid grid-cols-24">
          {HOURS.map((h) => (
            <button
              key={h}
              onMouseDown={() => startDrag(ri, h)}
              onMouseEnter={() => isDragging && onDrag(ri, h)}
              className="border-l border-slate-300 dark:border-slate-600 first:border-l-0 hover:bg-white/20 transition-colors"
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="text-center p-2 bg-slate-50 dark:bg-slate-800 rounded">
          <p className="text-muted-foreground">Rest Total</p>
          <p
            className={`font-semibold ${c.restTotal >= 10 ? "text-emerald-600" : "text-rose-600"}`}
          >
            {c.restTotal}h
          </p>
        </div>
        <div className="text-center p-2 bg-slate-50 dark:bg-slate-800 rounded">
          <p className="text-muted-foreground">Min 24h</p>
          <p
            className={`font-semibold ${c.minRest24 >= 10 ? "text-emerald-600" : "text-rose-600"}`}
          >
            {c.minRest24.toFixed(0)}h
          </p>
        </div>
        <div className="text-center p-2 bg-slate-50 dark:bg-slate-800 rounded">
          <p className="text-muted-foreground">Blocks</p>
          <p className={`font-semibold ${c.splitOK ? "text-emerald-600" : "text-rose-600"}`}>
            {restChunks.filter(([a]) => hourValue(r, a) === 1).length}
          </p>
        </div>
      </div>
    </div>
  );
});
