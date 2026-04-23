import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";


import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
} from "lucide-react";
import {
  type ScheduleAssignment,
  type FatigueResult,
} from "@/features/crew/hooks/useSchedulePlannerData";
import { cn } from "@/lib/utils";


import {
  FatigueRiskBadge,
} from "../schedule-planner-tabs";


export function ComplianceTab({
  fatigue,
}: {
  assignment: ScheduleAssignment;
  fatigue?: FatigueResult;
}) {
  const getComplianceStatus = () => {
    if (!fatigue) {
      return { status: "UNKNOWN", color: "text-muted-foreground", bg: "bg-muted" };
    }
    switch (fatigue.riskLevel) {
      case "critical":
        return {
          status: "NON-COMPLIANT",
          color: "text-red-600",
          bg: "bg-red-100 dark:bg-red-900/30",
        };
      case "high":
        return {
          status: "AT RISK",
          color: "text-orange-600",
          bg: "bg-orange-100 dark:bg-orange-900/30",
        };
      case "medium":
        return {
          status: "CAUTION",
          color: "text-yellow-600",
          bg: "bg-yellow-100 dark:bg-yellow-900/30",
        };
      case "low":
        return {
          status: "LEGAL",
          color: "text-green-600",
          bg: "bg-green-100 dark:bg-green-900/30",
        };
      default:
        return { status: "UNKNOWN", color: "text-muted-foreground", bg: "bg-muted" };
    }
  };

  const compliance = getComplianceStatus();

  return (
    <ScrollArea className="h-[calc(100vh-200px)]">
      <div className="p-4 space-y-4">
        <div className={cn("p-4 rounded-md", compliance.bg)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              <span className="font-medium">STCW Compliance Status</span>
            </div>
            <Badge className={cn("font-bold", compliance.color, compliance.bg)}>
              {compliance.status}
            </Badge>
          </div>
        </div>

        {fatigue ? (
          <>
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Fatigue Risk Level</span>
                  <FatigueRiskBadge riskLevel={fatigue.riskLevel} />
                </div>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Rest Hour Metrics (14-day lookback)
                  </p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Avg Rest/24h</p>
                      <p className="font-medium">
                        {fatigue.metrics.avgRestPer24h?.toFixed(1) || "N/A"}h{" "}
                        <span className="text-xs text-muted-foreground">(min: 10h)</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Avg Rest/7d</p>
                      <p className="font-medium">
                        {fatigue.metrics.avgRestPer7d?.toFixed(1) || "N/A"}h{" "}
                        <span className="text-xs text-muted-foreground">(max work: 77h)</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Sleep Debt (24h)</p>
                      <p
                        className={cn(
                          "font-medium",
                          fatigue.metrics.sleepDebt24h > 2 ? "text-red-500" : ""
                        )}
                      >
                        {fatigue.metrics.sleepDebt24h?.toFixed(1) || 0}h
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Sleep Debt (7d)</p>
                      <p
                        className={cn(
                          "font-medium",
                          fatigue.metrics.sleepDebt7d > 10 ? "text-red-500" : ""
                        )}
                      >
                        {fatigue.metrics.sleepDebt7d?.toFixed(1) || 0}h
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {fatigue.factors.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                    Contributing Factors
                  </p>
                  <ul className="space-y-1">
                    {fatigue.factors.map((factor, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        {factor}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {fatigue.recommendations.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                    Recommendations
                  </p>
                  <ul className="space-y-1">
                    {fatigue.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <div className="text-xs text-muted-foreground space-y-1">
              <p>Regulations Applied: MLC 2006, STCW 2010</p>
              <p>Requirements: Min 10h rest/24h, Max 77h work/7d</p>
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-muted-foreground">No rest hour data available</p>
              <p className="text-xs text-muted-foreground mt-1">
                Rest hours need to be recorded for compliance tracking
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}

