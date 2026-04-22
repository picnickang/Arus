import { Brain, AlertTriangle, CheckCircle, ChevronRight, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function ModelHealthCard({
  health,
  isLoading,
}: {
  health?: {
    activeModelsCount: number;
    driftAlertsCount: number;
    lastTrainingDate: string | Date | null;
  };
  isLoading: boolean;
}) {
  if (isLoading || !health) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Model Health
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const lastTrained = health.lastTrainingDate
    ? new Date(health.lastTrainingDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Never";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Model Health
          </span>
          <CheckCircle className="h-4 w-4 text-green-500" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="text-sm">Models Active:</span>
          <span className="font-bold" data-testid="active-models">
            {health.activeModelsCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle
            className={`h-4 w-4 ${health.driftAlertsCount > 0 ? "text-red-500" : "text-green-500"}`}
          />
          <span className="text-sm">Drift Alerts:</span>
          <span className={`font-bold ${health.driftAlertsCount > 0 ? "text-red-500" : ""}`}>
            {health.driftAlertsCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">Last Training:</span>
          <span className="text-sm text-muted-foreground">{lastTrained}</span>
        </div>

        <Button variant="outline" size="sm" className="w-full mt-2">
          Model Dashboard <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}
