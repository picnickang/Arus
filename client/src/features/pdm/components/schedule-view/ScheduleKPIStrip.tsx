import { AlertTriangle, Calendar, CheckCircle2, Clock } from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { ScheduleKpis } from "@/features/pdm";

interface ScheduleKPIStripProps {
  kpis: ScheduleKpis | undefined;
  isLoading: boolean;
  onScheduledClick?: (() => void) | undefined;
  onUnassignedClick?: (() => void) | undefined;
}

export function ScheduleKPIStrip({
  kpis,
  isLoading,
  onScheduledClick,
  onUnassignedClick,
}: ScheduleKPIStripProps) {
  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 w-44 flex-shrink-0" />
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Scheduled This Week",
      value: kpis?.tasksScheduledThisWeek ?? 0,
      subtitle: kpis?.scheduledDateRange ?? "",
      icon: Calendar,
      color: "bg-blue-600 dark:bg-blue-700",
      onClick: onScheduledClick,
      testId: "kpi-scheduled",
    },
    {
      title: "Unassigned High-Risk",
      value: kpis?.unassignedHighRiskCount ?? 0,
      subtitle: kpis?.unassignedUrgency ?? "",
      icon: AlertTriangle,
      color: "bg-red-600 dark:bg-red-700",
      onClick: onUnassignedClick,
      testId: "kpi-unassigned",
    },
    {
      title: "Expected Downtime",
      value: `${kpis?.expectedDowntimeForecastHours ?? 0} hrs`,
      subtitle: `$${((kpis?.expectedDowntimeForecastCost ?? 0) / 1000).toFixed(0)}k ${kpis?.forecastPeriod ?? ""}`,
      icon: Clock,
      color: "bg-yellow-500 dark:bg-yellow-600",
      testId: "kpi-downtime",
    },
    {
      title: "Avoided Downtime",
      value: `${kpis?.avoidedDowntimeHours ?? 0} hrs`,
      subtitle: `$${((kpis?.avoidedDowntimeCost ?? 0) / 1000).toFixed(0)}k ${kpis?.avoidedPeriod ?? ""}`,
      icon: CheckCircle2,
      color: "bg-green-600 dark:bg-green-700",
      testId: "kpi-avoided",
    },
  ];

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-3 pb-2">
        {cards.map((card, idx) => (
          <button
            key={idx}
            onClick={card.onClick}
            disabled={!card.onClick}
            className={`${card.color} text-white rounded-lg p-3 min-w-[170px] flex-shrink-0 text-left ${card.onClick ? "cursor-pointer hover-elevate active-elevate-2" : ""}`}
            data-testid={card.testId}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs opacity-90">{card.title}</p>
              <card.icon className="h-4 w-4 opacity-75" />
            </div>
            <p className="text-2xl font-bold mt-1">{card.value}</p>
            <p className="text-xs opacity-80 truncate">{card.subtitle}</p>
          </button>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
