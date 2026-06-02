/**
 * Assigned Tasks — user-portal page (Phase 2 navigation).
 *
 * Read-only list of the signed-in user's assigned work, sourced from
 * the caller's own `/api/me/tasks` endpoint (work orders, maintenance
 * schedules, alerts, and user-portal items the server already scopes to
 * the user). This page is intentionally non-hub-gated so a normal user
 * can reach it; the data is real (no placeholders) and items are shown
 * as read-only cards — we do not surface deep-link buttons into
 * admin-gated detail pages a normal user cannot open.
 */

import { useQuery } from "@tanstack/react-query";
import { ListChecks, Loader2, AlertTriangle, Inbox } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SwitchPortalButton } from "@/components/navigation/SwitchPortalButton";

interface MeTaskItem {
  id: string;
  source: string;
  title: string;
  status: string | null;
  priority: string | null;
  vesselId: string | null;
  link: string;
}

const SOURCE_LABELS: Record<string, string> = {
  work_orders: "Work order",
  maintenance_schedules: "Maintenance",
  alerts: "Alert",
  user_portal: "Task",
};

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? "Task";
}

function priorityTone(priority: string | null): "default" | "secondary" | "destructive" | "outline" {
  switch ((priority ?? "").toLowerCase()) {
    case "critical":
    case "high":
      return "destructive";
    case "medium":
      return "default";
    default:
      return "secondary";
  }
}

export default function MyTasksPage() {
  const { data, isLoading, isError } = useQuery<MeTaskItem[]>({
    queryKey: ["/api/me/tasks"],
    refetchInterval: 120000,
  });

  const tasks = data ?? [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl" data-testid="page-my-tasks">
      <div className="flex justify-end mb-3">
        <SwitchPortalButton />
      </div>
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ListChecks className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Assigned Tasks</CardTitle>
          <CardDescription>Work and items currently assigned to you.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div
              className="flex items-center justify-center gap-2 py-10 text-muted-foreground"
              data-testid="loading-my-tasks"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading your tasks…</span>
            </div>
          )}

          {!isLoading && isError && (
            <div
              className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              role="alert"
              data-testid="error-my-tasks"
            >
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>Could not load your tasks right now. Please try again shortly.</span>
            </div>
          )}

          {!isLoading && !isError && tasks.length === 0 && (
            <div
              className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-6"
              data-testid="empty-my-tasks"
            >
              <Inbox className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div>
                <div className="text-sm font-medium">No tasks assigned</div>
                <div className="text-xs text-muted-foreground">
                  You&rsquo;re all caught up. New assignments will appear here.
                </div>
              </div>
            </div>
          )}

          {!isLoading && !isError && tasks.length > 0 && (
            <ul className="space-y-2" data-testid="list-my-tasks">
              {tasks.map((task) => (
                <li
                  key={`${task.source}-${task.id}`}
                  className="rounded-md border bg-card p-3"
                  data-testid={`task-item-${task.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate" data-testid={`text-task-title-${task.id}`}>
                        {task.title}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {sourceLabel(task.source)}
                        {task.status ? ` · ${task.status}` : ""}
                      </div>
                    </div>
                    {task.priority && (
                      <Badge
                        variant={priorityTone(task.priority)}
                        className="capitalize flex-shrink-0"
                        data-testid={`badge-task-priority-${task.id}`}
                      >
                        {task.priority}
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
