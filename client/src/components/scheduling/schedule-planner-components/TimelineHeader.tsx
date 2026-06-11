import { format, isToday } from "date-fns";

import { cn } from "@/lib/utils";

export function TimelineHeader({ days, isMobile = false }: { days: Date[]; isMobile?: boolean }) {
  return (
    <div className="flex border-b sticky top-0 z-20 bg-background">
      <div
        className={cn(
          "shrink-0 border-r bg-background p-2 md:p-3 font-medium text-xs md:text-sm sticky left-0 z-30",
          isMobile ? "w-28" : "w-48"
        )}
      >
        Vessels
      </div>
      <div className="flex-1 flex">
        {days.map((day, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 p-1 md:p-2 text-center border-r",
              isMobile ? "min-w-[32px]" : "min-w-[40px]",
              isToday(day) && "bg-primary/5"
            )}
          >
            <div className="text-[10px] md:text-xs font-medium">
              {format(day, isMobile ? "E" : "EEE")}
            </div>
            <div
              className={cn(
                "text-[10px] md:text-xs",
                isToday(day) ? "text-primary font-semibold" : "text-muted-foreground"
              )}
            >
              {format(day, isMobile ? "d" : "MMM d")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
