import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  WIDGET_LABELS,
  WIDGET_HIGH_IMPACT_QUESTIONS,
  TASK_SOURCE_LABELS,
  safeMinimalDashboardConfig,
  type RoleDashboardConfig,
  type WidgetKey,
  type TaskSourceKey,
} from "@shared/role-dashboard";
import { Ship, ListChecks, ChevronRight } from "lucide-react";

interface DashboardPayload {
  user: { id: string; name: string | null; role: string };
  role: string;
  config: RoleDashboardConfig;
  visibilityScope: string;
  vessels: Array<{ id: string; name: string }>;
  fleetWide: boolean;
  mustChangePassword: boolean;
}

interface TaskItem {
  id: string;
  source: TaskSourceKey;
  title: string;
  status: string | null;
  priority: string | null;
  vesselId: string | null;
  link: string;
}

const WIDGET_LINKS: Partial<Record<WidgetKey, string>> = {
  current_vessel: "/vessels",
  shift_status: "/crew-scheduling",
  safety_status: "/safety-bulletins",
  user_tasks: "/attention-inbox",
  active_alerts: "/alerts",
  safety_notices: "/safety-bulletins",
  upcoming_maintenance: "/maintenance",
};

function WidgetCard({
  widget,
  config,
  payload,
}: {
  widget: WidgetKey;
  config: RoleDashboardConfig;
  payload: DashboardPayload;
}) {
  const question =
    config.highImpactQuestions?.[widget] ?? WIDGET_HIGH_IMPACT_QUESTIONS[widget];
  const link = WIDGET_LINKS[widget] ?? "/";

  let body: React.ReactNode = null;
  if (widget === "current_vessel") {
    body = payload.fleetWide ? (
      <p className="text-sm font-medium">Fleet-wide access ({payload.vessels.length} vessels)</p>
    ) : (
      <p className="text-sm font-medium">
        {payload.vessels[0]?.name ?? "No vessel assigned"}
      </p>
    );
  }

  return (
    <Card data-testid={`widget-${widget}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Ship className="h-4 w-4 text-primary" />
          {WIDGET_LABELS[widget]}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{question}</p>
      </CardHeader>
      <CardContent>
        {body}
        <Link
          href={link}
          className="text-xs text-primary inline-flex items-center mt-2 hover:underline"
          data-testid={`link-widget-${widget}`}
        >
          Open <ChevronRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}

function TaskFeed({ enabled }: { enabled: boolean }) {
  const { data: tasks = [], isLoading } = useQuery<TaskItem[]>({
    queryKey: ["/api/me/tasks"],
    enabled,
    refetchInterval: 60000,
  });

  if (!enabled) return null;

  return (
    <Card data-testid="widget-user-tasks">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" />
          {WIDGET_LABELS['user_tasks']}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {WIDGET_HIGH_IMPACT_QUESTIONS['user_tasks']}
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-testid="text-no-tasks">
            Nothing needs your attention right now.
          </p>
        ) : (
          tasks.slice(0, 8).map((task) => (
            <Link
              key={`${task.source}-${task.id}`}
              href={task.link}
              className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted"
              data-testid={`task-${task.id}`}
            >
              <span className="truncate">{task.title}</span>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {TASK_SOURCE_LABELS[task.source] ?? task.source}
              </Badge>
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Config-driven User dashboard. Renders only the widgets enabled by the active
 * role config returned from `/api/me/dashboard`. On a config-fetch failure it
 * falls back to a safe minimal dashboard (no admin data).
 */
export function RoleDashboard() {
  const { data, isLoading, isError } = useQuery<DashboardPayload>({
    queryKey: ["/api/me/dashboard"],
    refetchInterval: 120000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  const config = isError || !data ? safeMinimalDashboardConfig() : data.config;
  const payload: DashboardPayload =
    data ??
    ({
      user: { id: "", name: null, role: "" },
      role: "",
      config,
      visibilityScope: config.visibilityScope,
      vessels: [],
      fleetWide: false,
      mustChangePassword: false,
    } as DashboardPayload);

  const widgets = config.widgets.filter((w) => w !== "user_tasks");
  const showTasks = config.widgets.includes("user_tasks");

  return (
    <div className="space-y-4" data-testid="role-dashboard">
      {isError && (
        <div
          className="rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-200"
          data-testid="text-dashboard-fallback"
        >
          Showing a limited safe dashboard — your role configuration could not be loaded.
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {widgets.map((widget) => (
          <WidgetCard key={widget} widget={widget} config={config} payload={payload} />
        ))}
      </div>
      <TaskFeed enabled={showTasks} />
    </div>
  );
}
