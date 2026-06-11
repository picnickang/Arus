import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, Clock, Loader2, Target, Wrench } from "lucide-react";
import { formatDecimal, formatPercent } from "@/lib/formatters";
import { riskLevelBgClass } from "@/lib/status-colors";

interface ComponentStatus {
  componentType: string;
  healthScore?: number | undefined;
  degradationMetric?: number | undefined;
  predictedFailureDays: number;
}

type OptimizationData = ReturnType<typeof import("@/features/maintenance").useOptimizationData>;

export function RulTab({ o }: { o: OptimizationData }) {
  if (o.equipmentLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-6">
      {o.rulQueries.map((query, index: number) => {
        const eq = o.equipment?.[index];
        const rulData = query.data;
        if (!eq || !rulData) {
          return null;
        }
        const riskColor = riskLevelBgClass(rulData.riskLevel);
        return (
          <Card key={eq.id} data-testid={`card-rul-${eq.id}`}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    {eq.name}
                  </CardTitle>
                  <CardDescription>
                    {eq.type} - {eq.location}
                  </CardDescription>
                </div>
                <Badge className={`${riskColor} text-white`} data-testid={`badge-risk-${eq.id}`}>
                  {rulData.riskLevel.toUpperCase()} RISK
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card className="p-4 bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Remaining Days</p>
                  </div>
                  <p className="text-2xl font-bold" data-testid={`text-remaining-days-${eq.id}`}>
                    {rulData.remainingDays}
                  </p>
                </Card>
                <Card className="p-4 bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Health Index</p>
                  </div>
                  <p className="text-2xl font-bold" data-testid={`text-health-index-${eq.id}`}>
                    {rulData.healthIndex}%
                  </p>
                </Card>
                <Card className="p-4 bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Failure Probability</p>
                  </div>
                  <p className="text-2xl font-bold" data-testid={`text-failure-prob-${eq.id}`}>
                    {formatPercent(rulData.failureProbability * 100)}
                  </p>
                </Card>
              </div>
              {rulData.componentStatus && rulData.componentStatus.length > 0 && (
                <div className="space-y-3 mb-6">
                  <h4 className="text-sm font-semibold">Component Analysis</h4>
                  {rulData.componentStatus.map((comp: ComponentStatus) => (
                    <div
                      key={comp.componentType}
                      className="flex items-center justify-between p-3 border rounded-lg"
                      data-testid={`component-${comp.componentType}-${eq.id}`}
                    >
                      <div className="flex-1">
                        <p className="font-medium capitalize">
                          {comp.componentType.replace("_", " ")}
                        </p>
                        <div className="flex gap-4 mt-1">
                          <p className="text-sm text-muted-foreground">
                            Health: {comp.healthScore ? formatPercent(comp.healthScore) : "N/A"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Degradation:{" "}
                            {comp.degradationMetric ? formatDecimal(comp.degradationMetric) : "N/A"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{comp.predictedFailureDays} days</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {rulData.recommendations && rulData.recommendations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    Recommendations
                  </h4>
                  <ul className="space-y-1" data-testid={`recommendations-${eq.id}`}>
                    {rulData.recommendations.map((rec: string, idx: number) => (
                      <li
                        key={`rec-${rec.slice(0, 30)}-${idx}`}
                        className="text-sm text-muted-foreground flex items-start gap-2"
                      >
                        <span className="text-primary mt-0.5">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
      {(!o.equipment || o.equipment.length === 0) && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No equipment available for RUL analysis</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
