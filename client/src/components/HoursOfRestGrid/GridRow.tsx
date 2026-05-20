import React from "react";
import { GRID_COLS, HOURS, hourValue, isNight } from "./constants";
import { HourCell } from "./HourCell";
import type { ComplianceRow } from "./types";

interface GridRowProps {
  r: Record<string, number | string> & { date: string };
  actualIndex: number;
  c: ComplianceRow | undefined;
  isSelected: boolean;
  liveCheck: boolean;
  startDrag: (row: number, h: number) => void;
  onDrag: (row: number, h: number) => void;
  setSelectedDay: (i: number) => void;
}

export const GridRow = React.memo(function GridRow({
  r,
  actualIndex,
  c,
  isSelected,
  liveCheck,
  startDrag,
  onDrag,
  setSelectedDay,
}: GridRowProps) {
  if (!c) {
    return null;
  }

  const dayOK = c.dayOK;
  const restTotal = c.restTotal;
  const minRest24 = c.minRest24;

  const violationReasons = (): string[] => {
    const reasons: string[] = [];
    if (c.restTotal < 10) reasons.push(`Rest ${c.restTotal}h < 10h minimum`);
    if (c.minRest24 < 10) reasons.push(`24h window: ${c.minRest24.toFixed(1)}h < 10h`);
    if (!c.splitOK) reasons.push("Rest blocks: split rule violated");
    return reasons;
  };
  const barTitle = dayOK ? "Compliant" : (violationReasons().join(" · ") || "Violation");
  const dateTitle =
    !dayOK && liveCheck
      ? `⚠ ${
          (() => {
            const reasons: string[] = [];
            if (c.restTotal < 10) reasons.push(`Only ${c.restTotal}h rest`);
            if (c.minRest24 < 10) reasons.push(`24h window: ${c.minRest24.toFixed(1)}h`);
            if (!c.splitOK) reasons.push("Block split violated");
            return reasons.join(" · ") || "Violation";
          })()
        }`
      : undefined;

  return (
    <div
      role="button"
      tabIndex={0}
      className={`group hover:bg-slate-50 dark:hover:bg-slate-850 transition-colors ${
        isSelected ? "bg-blue-50 dark:bg-blue-950" : ""
      }`}
      onClick={() => setSelectedDay(actualIndex)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setSelectedDay(actualIndex);
        }
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: GRID_COLS }}>
        <div
          className={`bg-slate-50 dark:bg-slate-800 border-r border-slate-300 dark:border-slate-600 px-3 py-2 flex items-center justify-center font-mono font-medium ${
            !dayOK && liveCheck ? "border-l-4 border-l-rose-500" : ""
          }`}
          title={dateTitle}
        >
          <span className="text-xs">{r.date.slice(8, 10)}</span>
        </div>

        {HOURS.map((h) => (
          <HourCell
            key={h}
            h={h}
            isRest={hourValue(r, h) === 1}
            isNightHour={isNight(h)}
            actualIndex={actualIndex}
            startDrag={startDrag}
            onDrag={onDrag}
          />
        ))}

        <div
          className={`border-r border-b border-slate-200 dark:border-slate-700 text-center flex items-center justify-center font-mono font-semibold ${
            restTotal >= 10
              ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
          }`}
          style={{ fontSize: 11 }}
        >
          {restTotal}
        </div>
        <div
          className={`border-b border-slate-200 dark:border-slate-700 text-center flex items-center justify-center font-mono font-semibold ${
            minRest24 >= 10
              ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
          }`}
          style={{ fontSize: 11 }}
        >
          {minRest24.toFixed(0)}
        </div>
      </div>

      <div
        className={`h-1 transition-all duration-300 shadow-sm ${
          dayOK
            ? "bg-gradient-to-r from-emerald-400 to-emerald-600"
            : "bg-gradient-to-r from-rose-400 to-rose-600"
        }`}
        style={{ marginBottom: 2 }}
        title={barTitle}
      />
    </div>
  );
});
