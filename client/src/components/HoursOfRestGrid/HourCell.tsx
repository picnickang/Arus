import React from "react";
import { CELL_H, HOUR_W } from "./constants";

interface HourCellProps {
  isRest: boolean;
  isNightHour: boolean;
  actualIndex: number;
  h: number;
  startDrag: (row: number, h: number) => void;
  onDrag: (row: number, h: number) => void;
}

export const HourCell = React.memo(function HourCell({
  isRest,
  isNightHour,
  actualIndex,
  h,
  startDrag,
  onDrag,
}: HourCellProps) {
  return (
    <div
      onMouseDown={(e) => {
        e.preventDefault();
        startDrag(actualIndex, h);
      }}
      onMouseEnter={() => onDrag(actualIndex, h)}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          startDrag(actualIndex, h);
        }
      }}
      tabIndex={0}
      role="checkbox"
      aria-checked={isRest}
      aria-label={`${isRest ? "Rest" : "Work"} at ${String(h).padStart(2, "0")}:00${isNightHour ? " (Night)" : ""}`}
      className={`border-r border-b border-slate-200 dark:border-slate-700 cursor-crosshair transition-all duration-150 hover:scale-105 hover:z-10 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:z-10 ${
        isRest
          ? "bg-emerald-100 dark:bg-emerald-900 hover:bg-emerald-200 dark:hover:bg-emerald-800"
          : "bg-rose-100 dark:bg-rose-900 hover:bg-rose-200 dark:hover:bg-rose-800"
      } ${isNightHour ? "ring-1 ring-inset ring-indigo-300 dark:ring-indigo-600" : ""}`}
      style={{ width: HOUR_W, height: CELL_H + 2, position: "relative" }}
      data-testid={`grid-cell-${actualIndex}-${h}`}
      title={`${isRest ? "REST" : "WORK"} at ${String(h).padStart(2, "0")}:00${isNightHour ? " (Night)" : ""}`}
    >
      {isRest && (
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          <div className="w-1 h-1 bg-emerald-600 dark:bg-emerald-400 rounded-full" />
        </div>
      )}
    </div>
  );
});
