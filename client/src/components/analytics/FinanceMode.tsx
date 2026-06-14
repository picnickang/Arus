import { TrendingDown, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExportButton } from "@/components/ui/export-button";
import { ScenarioBanner } from "./ScenarioBanner";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { formatDate } from "@/lib/formatters";
import { useFinanceModeData } from "@/features/analytics";
import { useQuery } from "@tanstack/react-query";
import { FinanceModeKpiCards } from "./FinanceModeKpiCards";
import { type SavingsRecord, SavingsClaimsSection } from "./FinanceModeSavingsClaims";

export function FinanceMode() {
  const {
    latestMonth,
    monthlyChange,
    totalSavings,
    predictiveSavings,
    completedInsights,
    estimatedLLMCost,
    avgCostPerInsight,
    openWorkOrders,
    estimatedFutureDowntime,
    projectedDowntimeCost,
    preventiveCost,
    reactiveCost,
    preventiveRatio,
    totalLaborCost,
    totalLaborHours,
    avgLaborCostPerHour,
    workOrdersWithLabor,
    pendingLaborHours,
    estimatedPendingLaborCost,
    roiAnalysis,
    costBreakdownData,
    roiTrendData,
    costTrendsData,
    exportPDFSections,
    exportCostTrendsData,
    COLORS,
    disputedCount,
    voidedCount,
    disputedAmount,
    voidedAmount,
    confidenceRange,
  } = useFinanceModeData();

  const { data: savingsRecords = [] } = useQuery<SavingsRecord[]>({
    queryKey: ["/api/cost-savings"],
    refetchInterval: 60000,
    staleTime: 30000,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Finance Mode</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Cost intelligence, ROI tracking, and financial optimization
          </p>
        </div>
        <ExportButton
          data={exportCostTrendsData}
          filename="finance-report"
          formats={["csv", "pdf"]}
          pdfSections={exportPDFSections}
          csvOptions={{
            columns: ["month", "totalCost", "labor", "parts", "downtime"],
            headers: {
              month: "Month",
              totalCost: "Total Cost",
              labor: "Labor",
              parts: "Parts",
              downtime: "Downtime",
            },
          }}
          pdfOptions={{
            title: "Finance Report",
            subtitle: `Generated on ${formatDate(new Date())}`,
          }}
          variant="outline"
          size="default"
          data-testid="button-export-finance"
        />
      </div>

      <ScenarioBanner
        type="info"
        title="Finance Mode - Cost Intelligence & ROI"
        description="Track maintenance costs, analyze spending trends, measure ROI from predictive maintenance, and identify cost optimization opportunities. Use this view for budget planning and financial reporting."
      />

      <FinanceModeKpiCards
        latestMonth={latestMonth}
        monthlyChange={monthlyChange}
        totalSavings={totalSavings}
        confidenceRange={confidenceRange}
        predictiveSavings={predictiveSavings}
        roiAnalysis={roiAnalysis}
        disputedCount={disputedCount}
        voidedCount={voidedCount}
        disputedAmount={disputedAmount}
        voidedAmount={voidedAmount}
        completedInsights={completedInsights}
        estimatedLLMCost={estimatedLLMCost}
        avgCostPerInsight={avgCostPerInsight}
        projectedDowntimeCost={projectedDowntimeCost}
        estimatedFutureDowntime={estimatedFutureDowntime}
        openWorkOrdersCount={openWorkOrders.length}
        preventiveRatio={preventiveRatio}
        preventiveCost={preventiveCost}
        reactiveCost={reactiveCost}
        totalLaborCost={totalLaborCost}
        totalLaborHours={totalLaborHours}
        avgLaborCostPerHour={avgLaborCostPerHour}
        workOrdersWithLabor={workOrdersWithLabor}
        pendingLaborHours={pendingLaborHours}
        estimatedPendingLaborCost={estimatedPendingLaborCost}
      />

      {roiTrendData.length > 0 && (
        <Card data-testid="card-roi-trend">
          <CardHeader>
            <CardTitle>ROI Trend Analysis</CardTitle>
            <p className="text-sm text-muted-foreground">6-month return on investment trend</p>
          </CardHeader>
          <CardContent>
            <div data-testid="chart-roi-trend">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={roiTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="roi" fill="#8b5cf6" name="ROI %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-cost-trends">
        <CardHeader>
          <CardTitle>Cost Trends</CardTitle>
          <p className="text-sm text-muted-foreground">Monthly maintenance costs breakdown</p>
        </CardHeader>
        <CardContent>
          {costTrendsData.length > 0 ? (
            <div data-testid="chart-cost-trends">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={costTrendsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="totalCost"
                    stroke="#3b82f6"
                    name="Total Cost"
                    strokeWidth={2}
                  />
                  <Line type="monotone" dataKey="labor" stroke="#10b981" name="Labor" />
                  <Line type="monotone" dataKey="parts" stroke="#f59e0b" name="Parts" />
                  <Line type="monotone" dataKey="downtime" stroke="#ef4444" name="Downtime" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p
              className="text-sm text-muted-foreground text-center py-8"
              data-testid="text-no-cost-data"
            >
              No cost trend data available
            </p>
          )}
        </CardContent>
      </Card>

      <CollapsibleSection
        title="Cost Breakdown by Type"
        summary={`${costBreakdownData.length} cost categories tracked`}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {costBreakdownData.length > 0 && (
            <ResponsiveContainer width="100%" height={250}>
              <RechartsPieChart>
                <Pie
                  data={costBreakdownData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: $${(entry.value / 1000).toFixed(0)}k`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {costBreakdownData.map((entry) => (
                    <Cell
                      key={`cell-${entry.name}`}
                      fill={COLORS[costBreakdownData.indexOf(entry) % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </RechartsPieChart>
            </ResponsiveContainer>
          )}
          <div className="space-y-2">
            {costBreakdownData.map((item: { name: string; value: number }) => (
              <div
                key={item.name}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded"
                    style={{
                      backgroundColor: COLORS[costBreakdownData.indexOf(item) % COLORS.length],
                    }}
                  />
                  <span className="font-medium capitalize">{item.name}</span>
                </div>
                <span className="font-bold">${(item.value / 1000).toFixed(1)}k</span>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Cost Optimization Opportunities"
        summary="Data-driven recommendations to reduce maintenance costs"
      >
        <div className="space-y-3">
          {preventiveRatio < 40 && (
            <div className="p-4 border rounded-lg bg-blue-500/5">
              <div className="flex items-start gap-3">
                <Target className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm">Shift to Preventive Maintenance</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your preventive ratio is {preventiveRatio.toFixed(0)}%. Increasing to 60% could
                    save ${((reactiveCost * 0.3) / 1000).toFixed(0)}k/year by preventing costly
                    failures
                  </p>
                </div>
              </div>
            </div>
          )}
          {projectedDowntimeCost > 10000 && (
            <div className="p-4 border rounded-lg bg-amber-500/5">
              <div className="flex items-start gap-3">
                <TrendingDown className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm">Reduce Projected Downtime</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    ${(projectedDowntimeCost / 1000).toFixed(0)}k in downtime costs projected. Act
                    on {openWorkOrders.length} open work orders earlier to reduce impact
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

      <SavingsClaimsSection savingsRecords={savingsRecords} />
    </div>
  );
}
