/**
 * ServiceOrderCalendar
 * Improvement #16: Calendar view of all scheduled service orders.
 *
 * Shows scheduledStartDate and scheduledEndDate as blocks on a monthly grid.
 * Color-coded by status. Clicking a block opens the SO detail.
 *
 * Usage:
 *   <ServiceOrderCalendar serviceOrders={orders} onSelect={(so) => navigate(`/service-orders/${so.id}`)} />
 */

import React from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ServiceOrderSummary {
  id:                   string;
  soNumber:             string;
  status:               string;
  scheduledStartDate:   string | Date | null;
  scheduledEndDate:     string | Date | null;
  serviceProviderName?: string;
  vesselName?:          string;
  equipmentName?:       string;
  estimatedDurationHours?: number;
}

interface ServiceOrderCalendarProps {
  serviceOrders: ServiceOrderSummary[];
  onSelect?:     (so: ServiceOrderSummary) => void;
  className?:    string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  draft:       { bg: "bg-slate-100 dark:bg-slate-800",   text: "text-slate-700 dark:text-slate-300",   border: "border-slate-300" },
  sent:        { bg: "bg-blue-100 dark:bg-blue-900",     text: "text-blue-700 dark:text-blue-300",     border: "border-blue-300" },
  confirmed:   { bg: "bg-violet-100 dark:bg-violet-900", text: "text-violet-700 dark:text-violet-300", border: "border-violet-300" },
  in_progress: { bg: "bg-amber-100 dark:bg-amber-900",   text: "text-amber-700 dark:text-amber-300",   border: "border-amber-300" },
  completed:   { bg: "bg-emerald-100 dark:bg-emerald-900",text:"text-emerald-700 dark:text-emerald-300",border: "border-emerald-300" },
  cancelled:   { bg: "bg-red-100 dark:bg-red-900",       text: "text-red-700 dark:text-red-300",       border: "border-red-300" },
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTH_LABELS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
] as const;

function toLocalMidnight(dateInput: string | Date | null): Date | null {
  if (!dateInput) {return null;}
  const d = typeof dateInput === "string" ? new Date(`${dateInput}T00:00:00`) : dateInput;
  return isNaN(d.getTime()) ? null : d;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

function isInRange(day: Date, start: Date | null, end: Date | null): boolean {
  if (!start) {return false;}
  const s = new Date(start); s.setHours(0,0,0,0);
  const e = end ? new Date(end) : new Date(start); e.setHours(23,59,59,999);
  const d = new Date(day); d.setHours(12,0,0,0);
  return d >= s && d <= e;
}

export function ServiceOrderCalendar({
  serviceOrders,
  onSelect,
  className,
}: ServiceOrderCalendarProps) {
  const today = new Date();
  const [viewYear,  setViewYear]  = React.useState(today.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(today.getMonth());

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else {setViewMonth((m) => m - 1);}
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else {setViewMonth((m) => m + 1);}
  };

  // Build calendar grid
  const firstDay   = new Date(viewYear, viewMonth, 1);
  const lastDay    = new Date(viewYear, viewMonth + 1, 0);
  const startPad   = firstDay.getDay(); // 0=Sun
  const totalCells = startPad + lastDay.getDate();
  const rows       = Math.ceil(totalCells / 7);

  const days: (Date | null)[] = Array.from({ length: rows * 7 }, (_, i) => {
    const dayNum = i - startPad + 1;
    if (dayNum < 1 || dayNum > lastDay.getDate()) {return null;}
    return new Date(viewYear, viewMonth, dayNum);
  });

  // Map SO to its color config
  function getSoColor(so: ServiceOrderSummary) {
    return STATUS_COLORS[so.status] ?? STATUS_COLORS.draft;
  }

  // Get SOs that span a given day
  function getSosForDay(day: Date): ServiceOrderSummary[] {
    return serviceOrders.filter((so) => {
      const start = toLocalMidnight(so.scheduledStartDate);
      const end   = toLocalMidnight(so.scheduledEndDate);
      return isInRange(day, start, end);
    });
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Service Order Calendar
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={prevMonth} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[140px] text-center">
              {MONTH_LABELS[viewMonth]} {viewYear}
            </span>
            <Button variant="outline" size="icon" onClick={nextMonth} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2 mt-2">
          {Object.entries(STATUS_COLORS).map(([status, colors]) => (
            <span key={status} className="flex items-center gap-1 text-xs">
              <span className={cn("inline-block w-3 h-3 rounded-sm border", colors.bg, colors.border)} />
              <span className="text-muted-foreground capitalize">{status.replace("_", " ")}</span>
            </span>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-2">
        {/* Day-of-week header */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_LABELS.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
          {days.map((day, idx) => {
            const isToday = day ? isSameDay(day, today) : false;
            const daysSOs = day ? getSosForDay(day) : [];

            return (
              <div
                key={idx}
                className={cn(
                  "bg-background min-h-[80px] p-1 text-xs",
                  !day && "bg-muted/30",
                  isToday && "ring-1 ring-inset ring-primary",
                )}
              >
                {day && (
                  <>
                    <span className={cn(
                      "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs mb-1",
                      isToday
                        ? "bg-primary text-primary-foreground font-bold"
                        : "text-foreground",
                    )}>
                      {day.getDate()}
                    </span>
                    <div className="space-y-0.5">
                      {daysSOs.slice(0, 3).map((so) => {
                        const colors = getSoColor(so);
                        return (
                          <TooltipProvider key={so.id}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => onSelect?.(so)}
                                  className={cn(
                                    "w-full text-left px-1 py-0.5 rounded text-[10px] truncate border",
                                    "hover:opacity-80 transition-opacity cursor-pointer",
                                    colors.bg, colors.text, colors.border,
                                  )}
                                >
                                  {so.soNumber}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs text-xs space-y-1">
                                <p className="font-semibold">{so.soNumber}</p>
                                {so.vesselName     && <p>Vessel: {so.vesselName}</p>}
                                {so.equipmentName  && <p>Equipment: {so.equipmentName}</p>}
                                {so.serviceProviderName && <p>Provider: {so.serviceProviderName}</p>}
                                <Badge variant="outline" className="capitalize text-[10px]">
                                  {so.status.replace("_", " ")}
                                </Badge>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })}
                      {daysSOs.length > 3 && (
                        <p className="text-[10px] text-muted-foreground pl-1">
                          +{daysSOs.length - 3} more
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
