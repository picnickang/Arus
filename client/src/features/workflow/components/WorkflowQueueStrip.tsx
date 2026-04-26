import { AlertTriangle, CheckCircle2, CircleDot, Clock, PackageSearch } from "lucide-react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { WorkflowQueue, WorkflowSeverity } from "../types";

const severityClasses: Record<WorkflowSeverity, string> = {
  critical: "border-destructive/40 bg-destructive/5",
  warning: "border-yellow-500/40 bg-yellow-500/5",
  info: "border-primary/30 bg-primary/5",
  success: "border-emerald-500/30 bg-emerald-500/5",
};

const severityIcon = {
  critical: AlertTriangle,
  warning: Clock,
  info: CircleDot,
  success: CheckCircle2,
} as const;

function iconForQueue(queue: WorkflowQueue) {
  if (queue.id === "waiting_parts") {
    return PackageSearch;
  }
  return severityIcon[queue.severity];
}

export function WorkflowQueueStrip({ queues }: { queues: WorkflowQueue[] }) {
  const [, setLocation] = useLocation();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
      {queues.map((queue) => {
        const Icon = iconForQueue(queue);
        return (
          <button
            key={`${queue.id}-${queue.label}`}
            type="button"
            onClick={() => setLocation(queue.href)}
            className="text-left"
            data-testid={`workflow-queue-${queue.id}`}
          >
            <Card className={cn("h-full transition-colors hover:border-primary", severityClasses[queue.severity])}>
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <Badge variant={queue.count > 0 ? "default" : "outline"}>{queue.count}</Badge>
                </div>
                <div className="mt-3 text-sm font-semibold">{queue.label}</div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{queue.description}</p>
              </CardContent>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
