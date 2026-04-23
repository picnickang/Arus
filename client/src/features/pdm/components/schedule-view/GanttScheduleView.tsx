import { addDays, differenceInDays, format, isWithinInterval, parseISO } from "date-fns";
import { Calendar, Ship } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { PdmScheduledTask } from "@/features/pdm";
import { SEVERITY_COLORS } from "./constants";

export function GanttScheduleView({
  tasks,
  vessels,
  dateRange,
  onSelectTask,
  isLoading,
}: {
  tasks: PdmScheduledTask[];
  vessels: Array<{ id: string; name: string }>;
  dateRange: { start: string | Date; end: string | Date };
  onSelectTask: (task: PdmScheduledTask) => void;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const startDate =
    typeof dateRange.start === "string" ? parseISO(dateRange.start) : dateRange.start;
  const endDate = typeof dateRange.end === "string" ? parseISO(dateRange.end) : dateRange.end;
  const totalDays = differenceInDays(endDate, startDate) + 1;
  const dates = Array.from({ length: totalDays }, (_, i) => addDays(startDate, i));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const vesselIds = new Set(tasks.map((t) => t.vesselId));
  const displayVessels = vessels.filter((v) => vesselIds.has(v.id));

  if (displayVessels.length === 0 && tasks.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Maintenance Schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="w-full">
          <div className="min-w-[800px]">
            <div className="flex border-b">
              <div className="w-36 flex-shrink-0 p-2 font-medium text-sm border-r bg-muted">
                Vessel
              </div>
              <div className="flex flex-1">
                {dates.map((date, idx) => {
                  const isToday = date.getTime() === today.getTime();
                  return (
                    <div
                      key={idx}
                      className={`flex-1 min-w-[60px] p-1 text-center text-xs border-r ${isToday ? "bg-primary/10 font-medium" : ""}`}
                    >
                      <div className="text-muted-foreground">{format(date, "EEE")}</div>
                      <div className={isToday ? "text-primary" : ""}>{format(date, "d MMM")}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {displayVessels.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No vessels with scheduled tasks
              </div>
            ) : (
              displayVessels.map((vessel) => {
                const vesselTasks = tasks.filter((t) => t.vesselId === vessel.id);

                const tasksByDate = new Map<string, PdmScheduledTask[]>();
                vesselTasks.forEach((task) => {
                  const taskDate = task.scheduledDate
                    ? typeof task.scheduledDate === "string"
                      ? parseISO(task.scheduledDate)
                      : task.scheduledDate
                    : typeof task.schedulingWindow.preferredDate === "string"
                      ? parseISO(task.schedulingWindow.preferredDate)
                      : task.schedulingWindow.preferredDate;
                  const dateKey = format(taskDate, "yyyy-MM-dd");
                  const existing = tasksByDate.get(dateKey) || [];
                  existing.push(task);
                  tasksByDate.set(dateKey, existing);
                });

                const maxTasksPerDay = Math.max(
                  1,
                  ...Array.from(tasksByDate.values()).map((t) => t.length)
                );
                const TASK_BAR_HEIGHT = 28;
                const TASK_BAR_GAP = 4;
                const ROW_PADDING = 8;
                const rowHeight = Math.max(
                  56,
                  maxTasksPerDay * TASK_BAR_HEIGHT +
                    (maxTasksPerDay - 1) * TASK_BAR_GAP +
                    ROW_PADDING
                );

                return (
                  <div
                    key={vessel.id}
                    className="flex border-b last:border-b-0"
                    style={{ minHeight: `${rowHeight}px` }}
                  >
                    <div className="w-36 flex-shrink-0 p-2 border-r bg-muted/50 flex items-center gap-2">
                      <Ship className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm truncate">{vessel.name}</span>
                    </div>
                    <div className="flex flex-1 relative">
                      {dates.map((date, idx) => {
                        const isToday = date.getTime() === today.getTime();
                        return (
                          <div
                            key={idx}
                            className={`flex-1 min-w-[60px] border-r relative ${isToday ? "bg-primary/5" : ""}`}
                          />
                        );
                      })}

                      {vesselTasks.map((task) => {
                        const taskDate = task.scheduledDate
                          ? typeof task.scheduledDate === "string"
                            ? parseISO(task.scheduledDate)
                            : task.scheduledDate
                          : typeof task.schedulingWindow.preferredDate === "string"
                            ? parseISO(task.schedulingWindow.preferredDate)
                            : task.schedulingWindow.preferredDate;

                        if (!isWithinInterval(taskDate, { start: startDate, end: endDate })) {
                          return null;
                        }

                        const dateKey = format(taskDate, "yyyy-MM-dd");
                        const tasksOnDate = tasksByDate.get(dateKey) || [];
                        const taskIndex = tasksOnDate.findIndex((t) => t.id === task.id);
                        const topOffset =
                          ROW_PADDING / 2 + taskIndex * (TASK_BAR_HEIGHT + TASK_BAR_GAP);

                        const dayOffset = differenceInDays(taskDate, startDate);
                        const leftPct = (dayOffset / totalDays) * 100;
                        const widthPct = Math.max(8, (1 / totalDays) * 100);

                        return (
                          <button
                            key={task.id}
                            onClick={() => onSelectTask(task)}
                            className={`absolute ${SEVERITY_COLORS[task.severity]} text-white text-xs rounded-md px-2 py-0.5 truncate hover-elevate active-elevate-2 cursor-pointer z-10`}
                            style={{
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                              top: `${topOffset}px`,
                              height: `${TASK_BAR_HEIGHT}px`,
                              minWidth: "50px",
                              maxWidth: "150px",
                            }}
                            data-testid={`task-chip-${task.id}`}
                          >
                            <div className="font-medium truncate leading-tight">
                              {task.failureMode}
                            </div>
                            <div className="opacity-80 truncate text-[10px] leading-tight">
                              {task.estimatedDowntimeHours}h
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
