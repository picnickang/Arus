import {
  AlertTriangle,
  PieChart,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ContextHelp } from "./ContextHelp";

interface FinanceModeKpiCardsProps {
  latestMonth: { totalCost: number } | null | undefined;
  monthlyChange: number;
  totalSavings: number;
  confidenceRange: {
    low: number;
    high: number;
    avgConfidence: number;
  };
  predictiveSavings: number;
  roiAnalysis: unknown;
  disputedCount: number;
  voidedCount: number;
  disputedAmount: number;
  voidedAmount: number;
  completedInsights: number;
  estimatedLLMCost: number;
  avgCostPerInsight: string | number;
  projectedDowntimeCost: number;
  estimatedFutureDowntime: number;
  openWorkOrdersCount: number;
  preventiveRatio: number;
  preventiveCost: number;
  reactiveCost: number;
  totalLaborCost: number;
  totalLaborHours: number;
  avgLaborCostPerHour: number;
  workOrdersWithLabor: number;
  pendingLaborHours: number;
  estimatedPendingLaborCost: number;
}

export function FinanceModeKpiCards({
  latestMonth,
  monthlyChange,
  totalSavings,
  confidenceRange,
  predictiveSavings,
  roiAnalysis,
  disputedCount,
  voidedCount,
  disputedAmount,
  voidedAmount,
  completedInsights,
  estimatedLLMCost,
  avgCostPerInsight,
  projectedDowntimeCost,
  estimatedFutureDowntime,
  openWorkOrdersCount,
  preventiveRatio,
  preventiveCost,
  reactiveCost,
  totalLaborCost,
  totalLaborHours,
  avgLaborCostPerHour,
  workOrdersWithLabor,
  pendingLaborHours,
  estimatedPendingLaborCost,
}: FinanceModeKpiCardsProps) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card data-testid="card-total-savings">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Total Savings</CardTitle>
              <ContextHelp
                title="Total Savings"
                description="Cumulative cost savings from predictive and preventive maintenance interventions vs. reactive repairs. Only validated claims are included. Range is based on average prediction confidence."
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600" data-testid="text-total-savings">
              ${(totalSavings / 1000).toFixed(0)}k
            </div>
            <div
              className="text-xs text-muted-foreground mt-1"
              data-testid="text-savings-confidence-range"
            >
              Range: ${(confidenceRange.low / 1000).toFixed(0)}k – $
              {(confidenceRange.high / 1000).toFixed(0)}k
              <span className="ml-1">
                ({(confidenceRange.avgConfidence * 100).toFixed(0)}% avg confidence)
              </span>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-monthly-spend">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Monthly Spend</CardTitle>
              <ContextHelp
                title="Monthly Maintenance Spend"
                description="Total maintenance costs for the most recent month including labor, parts, and downtime."
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-monthly-spend">
              ${latestMonth ? (latestMonth.totalCost / 1000).toFixed(0) : 0}k
            </div>
            {monthlyChange !== 0 && (
              <div
                className={`flex items-center gap-1 mt-1 text-sm ${monthlyChange > 0 ? "text-red-600" : "text-green-600"}`}
                data-testid="text-monthly-change"
              >
                {monthlyChange > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {Math.abs(monthlyChange).toFixed(1)}% vs last month
              </div>
            )}
          </CardContent>
        </Card>
        <Card data-testid="card-predictive-savings">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Predictive Savings</CardTitle>
              <ContextHelp
                title="Predictive Maintenance Savings"
                description="Savings from using ML predictions to prevent failures before they occur."
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600" data-testid="text-predictive-savings">
              ${(predictiveSavings / 1000).toFixed(0)}k
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-roi">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">ROI</CardTitle>
              <ContextHelp
                title="Return on Investment"
                description="Overall ROI from implementing predictive maintenance vs. traditional reactive maintenance."
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600" data-testid="text-roi">
              {(roiAnalysis as { overallRoi?: number } | undefined)?.overallRoi
                ? `${(roiAnalysis as { overallRoi: number }).overallRoi.toFixed(0)}%`
                : "N/A"}
            </div>
          </CardContent>
        </Card>
      </div>

      {(disputedCount > 0 || voidedCount > 0) && (
        <Card data-testid="card-savings-integrity">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Savings Claim Integrity
              </CardTitle>
              <ContextHelp
                title="Savings Integrity"
                description="Tracks disputed and voided savings claims. Only validated claims are included in totals. Disputed claims are under review; voided claims have been invalidated (e.g., cancelled work orders)."
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-sm text-muted-foreground">Disputed</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-amber-500 text-amber-600"
                    data-testid="badge-disputed-count"
                  >
                    {disputedCount}
                  </Badge>
                  <span className="text-sm font-medium" data-testid="text-disputed-amount">
                    ${(disputedAmount / 1000).toFixed(0)}k
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-sm text-muted-foreground">Voided</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-red-500 text-red-600"
                    data-testid="badge-voided-count"
                  >
                    {voidedCount}
                  </Badge>
                  <span className="text-sm font-medium" data-testid="text-voided-amount">
                    ${(voidedAmount / 1000).toFixed(0)}k
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-llm-cost">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4" />
              AI Insights Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Reports Generated</span>
                <span className="text-lg font-bold" data-testid="text-llm-reports">
                  {completedInsights}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Est. LLM Cost</span>
                <span className="text-sm font-medium text-blue-600" data-testid="text-llm-cost">
                  ${estimatedLLMCost.toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Avg ${avgCostPerInsight}/report</p>
            </div>
          </CardContent>
        </Card>
        <Card
          className={projectedDowntimeCost > 10000 ? "border-amber-500" : ""}
          data-testid="card-downtime-projections"
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Downtime Projections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Projected Cost</span>
                <span
                  className="text-lg font-bold text-amber-600"
                  data-testid="text-projected-cost"
                >
                  ${(projectedDowntimeCost / 1000).toFixed(0)}k
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Est. Hours</span>
                <span className="text-sm font-medium" data-testid="text-projected-hours">
                  {estimatedFutureDowntime.toFixed(0)}h
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                <span data-testid="text-open-orders">{openWorkOrdersCount}</span> open work orders
              </p>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-preventive-reactive">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Preventive vs Reactive
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Preventive Ratio</span>
                <span
                  className="text-lg font-bold text-green-600"
                  data-testid="text-preventive-ratio"
                >
                  {preventiveRatio.toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Preventive Cost</span>
                <span className="text-sm font-medium" data-testid="text-preventive-cost">
                  ${(preventiveCost / 1000).toFixed(0)}k
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Reactive Cost</span>
                <span className="text-sm font-medium" data-testid="text-reactive-cost">
                  ${(reactiveCost / 1000).toFixed(0)}k
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-labor-cost">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Labor Cost Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Labor Cost</span>
                <span
                  className="text-lg font-bold text-emerald-600"
                  data-testid="text-total-labor-cost"
                >
                  ${totalLaborCost > 0 ? (totalLaborCost / 1000).toFixed(1) : "0"}k
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Avg Rate/Hour</span>
                <span className="text-sm font-medium" data-testid="text-avg-labor-rate">
                  ${avgLaborCostPerHour.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Hours</span>
                <span className="text-sm font-medium" data-testid="text-total-labor-hours">
                  {totalLaborHours.toFixed(1)}h
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Pending Hours</span>
                <span className="text-sm font-medium" data-testid="text-pending-labor-hours">
                  {pendingLaborHours.toFixed(1)}h
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Est. Pending Cost</span>
                <span
                  className="text-sm font-medium text-amber-600"
                  data-testid="text-pending-labor-cost"
                >
                  $
                  {estimatedPendingLaborCost > 0
                    ? (estimatedPendingLaborCost / 1000).toFixed(1)
                    : "0"}
                  k
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                <span data-testid="text-work-orders-with-labor">{workOrdersWithLabor}</span> work
                orders with labor tracked
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
