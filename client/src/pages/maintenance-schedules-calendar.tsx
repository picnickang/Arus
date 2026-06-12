import { useState } from "react";
import { addDays, eachDayOfInterval, endOfWeek, format, isSameDay, startOfWeek } from "date-fns";
import type { MaintenanceSchedule } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPriorityColor } from "@/features/maintenance";

interface CalendarViewProps {
  schedules: MaintenanceSchedule[];
  onScheduleClick: (schedule: MaintenanceSchedule) => void;
  getEquipmentName: (id: string) => string;
}

export function CalendarView({ schedules, onScheduleClick, getEquipmentName }: CalendarViewProps) {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
  const getSchedulesForDay = (day: Date) =>
    schedules.filter((schedule) => isSameDay(new Date(schedule.scheduledDate), day));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl">Weekly Schedule</CardTitle>
            <CardDescription className="mt-1">
              {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeek(addDays(currentWeek, -7))}
              data-testid="button-prev-week"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeek(new Date())}
              data-testid="button-current-week"
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentWeek(addDays(currentWeek, 7))}
              data-testid="button-next-week"
            >
              Next
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day) => {
            const isToday = isSameDay(day, new Date());
            const daySchedules = getSchedulesForDay(day);
            return (
              <div
                key={format(day, "yyyy-MM-dd")}
                className={`rounded-lg border ${isToday ? "border-primary/50 bg-primary/5" : "border-border"} overflow-hidden`}
              >
                <div
                  className={`p-2 text-center border-b ${isToday ? "bg-primary/10 border-primary/30" : "bg-muted/30"}`}
                >
                  <div className="text-xs font-medium text-muted-foreground">
                    {format(day, "EEE")}
                  </div>
                  <div className={`text-lg font-bold ${isToday ? "text-primary" : ""}`}>
                    {format(day, "d")}
                  </div>
                </div>
                <div className="p-1 space-y-1 min-h-[120px]">
                  {daySchedules.map((schedule) => (
                    <button
                      key={schedule.id}
                      onClick={() => onScheduleClick(schedule)}
                      className={`w-full p-1.5 rounded border text-left text-xs hover:opacity-80 transition-opacity ${getPriorityColor(schedule.priority)}`}
                      data-testid={`schedule-item-${schedule.id}`}
                    >
                      <div className="font-medium truncate">
                        {getEquipmentName(schedule.equipmentId)}
                      </div>
                      <div className="text-xs opacity-75 mt-0.5">
                        {format(new Date(schedule.scheduledDate), "h:mm a")}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
