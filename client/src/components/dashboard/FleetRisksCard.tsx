import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ArrowRight, Clock, Ship, Wrench } from "lucide-react";
import { Link } from "wouter";

interface EquipmentHealth {
  id: string;
  name: string;
  type: string;
  vesselName?: string;
  healthScore: number;
  rul: number | null;
  pFail30d?: number;
  status: "healthy" | "warning" | "critical" | "unknown";
}

interface FleetRisksCardProps {
  limit?: number;
  showVessel?: boolean;
  className?: string;
  "data-testid"?: string;
  prefetchedHealthData?: EquipmentHealth[] | null;
}

const STATUS_VARIANTS: Record<string, "destructive" | "default" | "secondary" | "outline"> = {
  critical: "destructive",
  warning: "default",
  healthy: "secondary",
  unknown: "outline",
};

const STATUS_COLORS: Record<string, string> = {
  critical: "bg-red-500",
  warning: "bg-yellow-500",
  healthy: "bg-green-500",
  unknown: "bg-gray-400",
};

export const FleetRisksCard = memo(function FleetRisksCard({
  limit = 5,
  showVessel = true,
  className = "",
  "data-testid": testId = "card-fleet-risks",
  prefetchedHealthData,
}: FleetRisksCardProps) {
  const { data: healthData, isLoading, error } = useQuery<EquipmentHealth[]>({
    queryKey: ["/api/equipment/health"],
    staleTime: 120000,
    refetchInterval: 120000,
    initialData: prefetchedHealthData ?? undefined,
  });

  if (isLoading && !healthData) {
    return (
      <Card className={className} data-testid={testId}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Top Fleet Risks
          </CardTitle>
          <CardDescription>Loading equipment health data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(limit)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !healthData || !Array.isArray(healthData)) {
    return (
      <Card className={className} data-testid={testId}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Top Fleet Risks
          </CardTitle>
          <CardDescription>Unable to load risk data</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Could not retrieve equipment health data. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  const sortedRisks = [...healthData]
    .filter((eq) => eq.healthScore !== undefined)
    .sort((a, b) => {
      const healthRiskA = 100 - (a.healthScore ?? 100);
      const pFailRiskA = (a.pFail30d ?? 0) * 100;
      const rulRiskA = a.rul !== null && a.rul < 90 ? Math.max(0, 90 - a.rul) : 0;
      const riskA = healthRiskA * 0.4 + pFailRiskA * 0.4 + rulRiskA * 0.2;

      const healthRiskB = 100 - (b.healthScore ?? 100);
      const pFailRiskB = (b.pFail30d ?? 0) * 100;
      const rulRiskB = b.rul !== null && b.rul < 90 ? Math.max(0, 90 - b.rul) : 0;
      const riskB = healthRiskB * 0.4 + pFailRiskB * 0.4 + rulRiskB * 0.2;

      return riskB - riskA;
    })
    .slice(0, limit);

  const criticalCount = healthData.filter((eq) => eq.status === "critical").length;
  const warningCount = healthData.filter((eq) => eq.status === "warning").length;

  return (
    <Card className={className} data-testid={testId}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Top {limit} Fleet Risks
          </CardTitle>
          <div className="flex gap-2">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {criticalCount} Critical
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="default" className="text-xs">
                {warningCount} Warning
              </Badge>
            )}
          </div>
        </div>
        <CardDescription>
          Equipment requiring immediate attention based on health, failure probability, and RUL
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {sortedRisks.length === 0 ? (
          <div className="py-8 text-center">
            <Ship className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
            <p className="text-muted-foreground">All equipment operating within safe parameters</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedRisks.map((equipment, index) => (
              <Link
                key={equipment.id}
                href={`/pdm/equipment/${equipment.id}`}
                className="block hover:bg-muted/50 rounded-lg p-3 -m-3 transition-colors"
                data-testid={`link-risk-${equipment.id}`}
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 relative">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${STATUS_COLORS[equipment.status]}`}
                    >
                      {index + 1}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{equipment.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{equipment.type}</span>
                          {showVessel && equipment.vesselName && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Ship className="h-3 w-3" />
                                {equipment.vesselName}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <Badge variant={STATUS_VARIANTS[equipment.status]} className="text-xs flex-shrink-0">
                        {equipment.status.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Health</span>
                        <span className="font-medium">{equipment.healthScore}%</span>
                      </div>
                      <Progress
                        value={equipment.healthScore}
                        className="h-1.5"
                        data-testid={`progress-health-${equipment.id}`}
                      />
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-xs">
                      {equipment.rul !== null && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          RUL: {equipment.rul} days
                        </span>
                      )}
                      {equipment.pFail30d !== undefined && equipment.pFail30d > 0 && (
                        <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                          <Wrench className="h-3 w-3" />
                          {(equipment.pFail30d * 100).toFixed(0)}% failure risk
                        </span>
                      )}
                    </div>
                  </div>

                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
