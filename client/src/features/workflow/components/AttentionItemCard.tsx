import { AlertTriangle, ArrowRight, CheckCircle2, Info } from "lucide-react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AttentionItem, WorkflowSeverity } from "../types";

const severityLabel: Record<WorkflowSeverity, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "Info",
  success: "Resolved",
};

const severityClasses: Record<WorkflowSeverity, string> = {
  critical: "border-destructive/50",
  warning: "border-yellow-500/50",
  info: "border-primary/30",
  success: "border-emerald-500/40",
};

const severityIcons = {
  critical: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle2,
} as const;

export function AttentionItemCard({ item }: { item: AttentionItem }) {
  const [, setLocation] = useLocation();
  const Icon = severityIcons[item.severity];

  return (
    <Card className={cn("overflow-hidden", severityClasses[item.severity])}>
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={item.severity === "critical" ? "destructive" : "outline"}>
                <Icon className="mr-1 h-3 w-3" />
                {severityLabel[item.severity]}
              </Badge>
              <span className="text-xs text-muted-foreground">{item.source}</span>
            </div>
            <h3 className="mt-2 text-base font-semibold">{item.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{item.whyItMatters}</p>

            <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Next action</div>
                <div className="font-medium">{item.recommendedAction}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Owner</div>
                <div>{item.owner}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Due</div>
                <div>{item.due}</div>
              </div>
            </div>
            {item.lastResolution && (
              <div className="mt-3 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                Last blocker update: {item.lastResolution.status}
                {item.lastResolution.eta ? ` • ETA ` : ""}
                {item.lastResolution.owner ? ` • Owner ` : ""}
              </div>
            )}
          </div>

          <Button onClick={() => setLocation(item.href)} className="shrink-0">
            Open
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
