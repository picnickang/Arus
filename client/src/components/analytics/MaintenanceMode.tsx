import { TrendingUp, Clock, Target, DollarSign, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScenarioBanner } from "./ScenarioBanner";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { ContextHelp } from "./ContextHelp";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { formatDistanceToNow } from "date-fns";
import { useMaintenanceModeData, type WorkOrderData, type PdmScoreData } from "@/features/analytics";
import { formatNumber } from "@/lib/formatters";

export function MaintenanceMode() {
  const {
    maintenanceRecords,
    openOrders,
    overdueOrders,
    highRiskEquipment,
    avgCompletionTimeHours,
    completionRate,
    completedOrders,
    preventiveSavings,
    totalFailures,
    totalPrevented,
    preventionRate,
    failureChartData,
    schedulingSuggestions,
    overdueWorkOrders,
    highRiskPdmScores,
    highReactiveCostEquipment,
  } = useMaintenanceModeData();

  return (
    <div className="space-y-6">
      <ScenarioBanner
        type="info"
        title="Maintenance Mode - Predictive & Preventive"
        description="Track work orders, monitor predictive maintenance scores, analyze failure patterns, and optimize maintenance schedules. Use this view to plan and execute maintenance strategies."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card data-testid="card-open-orders">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Open Work Orders</CardTitle>
              <ContextHelp
                title="Open Work Orders"
                description="Work orders that are currently in progress or pending. Track these to ensure timely completion."
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-open-orders">
              {openOrders}
            </div>
            {overdueOrders > 0 && (
              <Badge variant="destructive" className="mt-2" data-testid="badge-overdue-orders">
                {overdueOrders} overdue
              </Badge>
            )}
          </CardContent>
        </Card>
        <Card data-testid="card-high-risk">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">High Risk Equipment</CardTitle>
              <ContextHelp
                title="High Risk Equipment"
                description="Equipment with failure risk above 70%. Priority candidates for predictive maintenance interventions."
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600" data-testid="text-high-risk">
              {highRiskEquipment}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-maintenance-records">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Maintenance Records</CardTitle>
              <ContextHelp
                title="Maintenance Records"
                description="Historical maintenance activities tracked in the system. Used for trend analysis and compliance reporting."
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-records-count">
              {maintenanceRecords.length}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card data-testid="card-completion-analytics">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4" />
              Completion Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Completion Rate</span>
                <span className="text-lg font-bold" data-testid="text-completion-rate">
                  {completionRate.toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Avg Time to Complete</span>
                <span className="text-sm font-medium" data-testid="text-avg-completion-time">
                  {avgCompletionTimeHours > 24
                    ? `${(avgCompletionTimeHours / 24).toFixed(1)} days`
                    : `${avgCompletionTimeHours.toFixed(0)} hours`}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Completed Orders</span>
                <Badge
                  variant="default"
                  className="min-w-[3rem] justify-center"
                  data-testid="badge-completed-orders"
                >
                  {completedOrders.length}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-prevention-effectiveness">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Prevention Effectiveness
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Prevention Rate</span>
                <span
                  className="text-lg font-bold text-green-600"
                  data-testid="text-prevention-rate"
                >
                  {preventionRate.toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Failures Prevented</span>
                <Badge
                  variant="default"
                  className="min-w-[3rem] justify-center bg-green-600"
                  data-testid="badge-prevented"
                >
                  {totalPrevented}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Failures</span>
                <Badge
                  variant="outline"
                  className="min-w-[3rem] justify-center"
                  data-testid="badge-total-failures"
                >
                  {totalFailures}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
        {highReactiveCostEquipment.length > 0 && (
          <Card className="border-amber-500" data-testid="card-cost-optimization">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-amber-600">
                <DollarSign className="h-4 w-4" />
                Cost Optimization Opportunity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Under-Maintained Units</span>
                  <span
                    className="text-lg font-bold text-amber-600"
                    data-testid="text-undermaintained"
                  >
                    {highReactiveCostEquipment.length}
                  </span>
                </div>
                <p
                  className="text-xs text-muted-foreground"
                  data-testid="text-optimization-description"
                >
                  Equipment below 60% health - shift to preventive maintenance to reduce reactive
                  costs
                </p>
                <div className="mt-2">
                  <span className="text-xs font-medium" data-testid="text-est-savings">
                    Est. Savings: ${formatNumber(preventiveSavings)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        {schedulingSuggestions.length > 0 && (
          <Card className="border-blue-500" data-testid="card-scheduling-recommendations">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2 text-blue-600">
                <Calendar className="h-4 w-4" />
                Scheduling Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Equipment Needing Scheduling
                  </span>
                  <span
                    className="text-lg font-bold text-blue-600"
                    data-testid="text-scheduling-count"
                  >
                    {schedulingSuggestions.length}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Equipment in optimal maintenance window (50-90% risk)
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {overdueOrders > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-destructive" />
              <CardTitle>Overdue Work Orders</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdueWorkOrders.map((wo: WorkOrderData) => (
                <div
                  key={wo.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                  data-testid={`overdue-order-${wo.id}`}
                >
                  <div>
                    <p className="font-medium text-sm">{wo.reason || "Maintenance Required"}</p>
                    <p className="text-xs text-muted-foreground">
                      Created{" "}
                      {wo.createdAt
                        ? formatDistanceToNow(new Date(wo.createdAt), { addSuffix: true })
                        : "recently"}
                    </p>
                  </div>
                  <Badge variant="destructive">OVERDUE</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {schedulingSuggestions.length > 0 && (
        <CollapsibleSection
          title="Optimal Maintenance Windows"
          badge={`${schedulingSuggestions.length} recommended`}
          summary={`${schedulingSuggestions.length} equipment units in optimal maintenance window`}
        >
          <div className="space-y-2">
            {schedulingSuggestions.slice(0, 10).map((suggestion) => (
              <div
                key={suggestion.equipmentId}
                className="flex items-center justify-between p-3 border rounded-lg"
                data-testid={`scheduling-suggestion-${suggestion.equipmentId}`}
              >
                <div className="flex-1">
                  <p className="font-medium text-sm">{suggestion.equipmentName}</p>
                  <p className="text-xs text-muted-foreground">
                    Risk: {suggestion.failureRisk.toFixed(0)}% | Recommended window:{" "}
                    {suggestion.recommendedWindow}
                  </p>
                </div>
                <Badge
                  variant={
                    suggestion.priority === "High"
                      ? "destructive"
                      : suggestion.priority === "Medium"
                        ? "default"
                        : "secondary"
                  }
                >
                  {suggestion.priority}
                </Badge>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      <CollapsibleSection
        title="Predictive Maintenance - High Risk Equipment"
        badge={highRiskEquipment > 0 ? `${highRiskEquipment} items` : undefined}
        summary={`${highRiskEquipment} equipment items with failure risk >70%`}
      >
        {highRiskEquipment === 0 ? (
          <p className="text-sm text-muted-foreground">No high-risk equipment detected</p>
        ) : (
          <div className="space-y-2">
            {highRiskPdmScores.map((scoreRaw: PdmScoreData) => {
              const score = scoreRaw as PdmScoreData & { confidence?: number };
              return (
              <div
                key={score.equipmentId}
                className="flex items-center justify-between p-3 border rounded-lg"
                data-testid={`high-risk-equipment-${score.equipmentId}`}
              >
                <div className="flex-1">
                  <p className="font-medium text-sm">{score.equipmentName || score.equipmentId}</p>
                  <p className="text-xs text-muted-foreground">
                    Failure Risk: {score.failureRisk.toFixed(0)}% | Confidence:{" "}
                    {((score.confidence ?? 0) * 100).toFixed(0)}%
                  </p>
                </div>
                <Badge variant={score.failureRisk > 85 ? "destructive" : "default"}>
                  {score.failureRisk.toFixed(0)}% risk
                </Badge>
              </div>
              );
            })}
          </div>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Failure Pattern Analysis"
        summary="Historical failure trends and prevention metrics"
      >
        {failureChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={failureChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="failures" fill="#ef4444" name="Failures" />
              <Bar dataKey="prevented" fill="#10b981" name="Prevented" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-muted-foreground">No failure pattern data available</p>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="Recent Maintenance Activity"
        summary={`${maintenanceRecords.slice(0, 10).length} recent records`}
      >
        <div className="space-y-2">
          {maintenanceRecords.slice(0, 10).map((recordRaw) => {
            const record = recordRaw as typeof recordRaw & {
              equipmentName?: string;
              completedAt?: string | Date | null;
            };
            return (
            <div
              key={record.id || `${record.equipmentId}-${record.type}-${record.completedAt}`}
              className="flex items-center justify-between p-3 border rounded-lg text-sm"
            >
              <div>
                <p className="font-medium">{record.equipmentName || record.equipmentId}</p>
                <p className="text-xs text-muted-foreground">{record.type}</p>
              </div>
              <Badge variant="outline">
                {record.completedAt
                  ? formatDistanceToNow(new Date(record.completedAt), { addSuffix: true })
                  : "N/A"}
              </Badge>
            </div>
            );
          })}
        </div>
      </CollapsibleSection>
    </div>
  );
}
