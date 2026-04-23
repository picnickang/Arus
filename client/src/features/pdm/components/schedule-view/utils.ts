import { addDays, endOfWeek, format, startOfWeek } from "date-fns";

export function getWeekDateRange(weekOffset: number = 0) {
  const today = new Date();
  const start = startOfWeek(addDays(today, weekOffset * 7), { weekStartsOn: 1 });
  const end = endOfWeek(addDays(today, weekOffset * 7), { weekStartsOn: 1 });
  return { start, end };
}

export function formatWeekLabel(weekOffset: number): string {
  if (weekOffset === 0) {
    return "This Week";
  }
  if (weekOffset === 1) {
    return "Next Week";
  }
  if (weekOffset === -1) {
    return "Last Week";
  }
  const { start, end } = getWeekDateRange(weekOffset);
  return `${format(start, "MMM d")} - ${format(end, "MMM d")}`;
}
