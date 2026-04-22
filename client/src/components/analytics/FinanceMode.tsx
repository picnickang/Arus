import { useState } from "react";
import { TrendingUp, TrendingDown, PieChart, Target, Users, ShieldCheck, AlertTriangle, XCircle, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ExportButton } from "@/components/ui/export-button";
import { ScenarioBanner } from "./ScenarioBanner";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { ContextHelp } from "./ContextHelp";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart as RechartsPieChart, Pie, Cell, BarChart, Bar } from "recharts";
import { formatDate } from "@/lib/formatters";
import { useFinanceModeData } from "@/features/analytics";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface SavingsRecord {
  id: string;
  workOrderId: string | null;
  equipmentId: string;
  maintenanceType: string;
  totalSavings: number;
  validationStatus: string;
  validationReason: string | null;
  validationChangedBy: string | null;
  validationChangedAt: string | null;
  calculatedAt: string;
}

function ValidationStatusBadge({ status }: { status: string }) {
  if (status === "valid") {return <Badge variant="outline" className="border-green-500 text-green-600" data-testid={`badge-status-${status}`}><CheckCircle className="h-3 w-3 mr-1" />Valid</Badge>;}
  if (status === "disputed") {return <Badge variant="outline" className="border-amber-500 text-amber-600" data-testid={`badge-status-${status}`}><AlertTriangle className="h-3 w-3 mr-1" />Disputed</Badge>;}
  if (status === "voided") {return <Badge variant="outline" className="border-red-500 text-red-600" data-testid={`badge-status-${status}`}><XCircle className="h-3 w-3 mr-1" />Voided</Badge>;}
  return <Badge variant="outline">{status}</Badge>;
}

function SavingsClaimActions({ savingsId, currentStatus }: { savingsId: string; currentStatus: string }) {
  const [showForm, setShowForm] = useState<"disputed" | "voided" | null>(null);
  const [reason, setReason] = useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async ({ status, reason }: { status: string; reason: string }) => {
      return apiRequest("PATCH", `/api/cost-savings/${savingsId}/validation`, { validationStatus: status, reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-savings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-savings/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cost-savings/trend"] });
      toast({ title: "Validation status updated", description: `Savings claim has been ${showForm === "disputed" ? "disputed" : "voided"}.` });
      setShowForm(null);
      setReason("");
    },
    onError: () => {
      toast({ title: "Failed to update", description: "Could not update the validation status.", variant: "destructive" });
    },
  });

  if (currentStatus === "voided") {return null;}

  return (
    <div className="flex flex-col gap-2">
      {!showForm && (
        <div className="flex gap-2">
          {currentStatus === "valid" && (
            <>
              <Button size="sm" variant="outline" className="text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950" onClick={() => setShowForm("disputed")} data-testid={`button-dispute-${savingsId}`}>Dispute</Button>
              <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950" onClick={() => setShowForm("voided")} data-testid={`button-void-${savingsId}`}>Void</Button>
            </>
          )}
          {currentStatus === "disputed" && (
            <>
              <Button size="sm" variant="outline" className="text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-950" onClick={() => { setShowForm("disputed"); setReason(""); }} data-testid={`button-revalidate-${savingsId}`}>Re-validate</Button>
              <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950" onClick={() => setShowForm("voided")} data-testid={`button-void-${savingsId}`}>Void</Button>
            </>
          )}
        </div>
      )}
      {showForm && (
        <div className="space-y-2 p-3 border rounded-lg bg-muted/50">
          <p className="text-sm font-medium">{showForm === "disputed" ? (currentStatus === "disputed" ? "Re-validate this claim" : "Dispute this savings claim") : "Void this savings claim"}</p>
          <Textarea placeholder="Enter reason..." value={reason} onChange={(e) => setReason(e.target.value)} className="text-sm" data-testid={`input-reason-${savingsId}`} />
          <div className="flex gap-2">
            <Button size="sm" disabled={!reason.trim() || mutation.isPending} onClick={() => mutation.mutate({ status: currentStatus === "disputed" && showForm === "disputed" ? "valid" : showForm, reason })} data-testid={`button-confirm-${savingsId}`}>
              {mutation.isPending ? "Updating..." : "Confirm"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowForm(null); setReason(""); }} data-testid={`button-cancel-${savingsId}`}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function FinanceMode() {
  const { latestMonth, monthlyChange, totalSavings, predictiveSavings, completedInsights, estimatedLLMCost, avgCostPerInsight, openWorkOrders, estimatedFutureDowntime, projectedDowntimeCost, preventiveCost, reactiveCost, preventiveRatio, totalLaborCost, totalLaborHours, avgLaborCostPerHour, workOrdersWithLabor, pendingLaborHours, estimatedPendingLaborCost, roiAnalysis, costBreakdownData, roiTrendData, costTrendsData, exportPDFSections, exportCostTrendsData, COLORS, disputedCount, voidedCount, disputedAmount, voidedAmount, confidenceRange } = useFinanceModeData();

  const { data: savingsRecords = [] } = useQuery<SavingsRecord[]>({ queryKey: ["/api/cost-savings"], refetchInterval: 60000, staleTime: 30000 });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Finance Mode</h2>
          <p className="text-sm text-muted-foreground mt-1">Cost intelligence, ROI tracking, and financial optimization</p>
        </div>
        <ExportButton data={exportCostTrendsData} filename="finance-report" formats={["csv", "pdf"]} pdfSections={exportPDFSections} csvOptions={{ columns: ["month", "totalCost", "labor", "parts", "downtime"], headers: { month: "Month", totalCost: "Total Cost", labor: "Labor", parts: "Parts", downtime: "Downtime" } }} pdfOptions={{ title: "Finance Report", subtitle: `Generated on ${formatDate(new Date())}` }} variant="outline" size="default" data-testid="button-export-finance" />
      </div>

      <ScenarioBanner type="info" title="Finance Mode - Cost Intelligence & ROI" description="Track maintenance costs, analyze spending trends, measure ROI from predictive maintenance, and identify cost optimization opportunities. Use this view for budget planning and financial reporting." />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card data-testid="card-total-savings">
          <CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-medium">Total Savings</CardTitle><ContextHelp title="Total Savings" description="Cumulative cost savings from predictive and preventive maintenance interventions vs. reactive repairs. Only validated claims are included. Range is based on average prediction confidence." /></div></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600" data-testid="text-total-savings">${(totalSavings / 1000).toFixed(0)}k</div>
            <div className="text-xs text-muted-foreground mt-1" data-testid="text-savings-confidence-range">
              Range: ${(confidenceRange.low / 1000).toFixed(0)}k – ${(confidenceRange.high / 1000).toFixed(0)}k
              <span className="ml-1">({(confidenceRange.avgConfidence * 100).toFixed(0)}% avg confidence)</span>
            </div>
          </CardContent>
        </Card>
        <Card data-testid="card-monthly-spend">
          <CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-medium">Monthly Spend</CardTitle><ContextHelp title="Monthly Maintenance Spend" description="Total maintenance costs for the most recent month including labor, parts, and downtime." /></div></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-monthly-spend">${latestMonth ? (latestMonth.totalCost / 1000).toFixed(0) : 0}k</div>
            {monthlyChange !== 0 && <div className={`flex items-center gap-1 mt-1 text-sm ${monthlyChange > 0 ? "text-red-600" : "text-green-600"}`} data-testid="text-monthly-change">{monthlyChange > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{Math.abs(monthlyChange).toFixed(1)}% vs last month</div>}
          </CardContent>
        </Card>
        <Card data-testid="card-predictive-savings">
          <CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-medium">Predictive Savings</CardTitle><ContextHelp title="Predictive Maintenance Savings" description="Savings from using ML predictions to prevent failures before they occur." /></div></CardHeader>
          <CardContent><div className="text-3xl font-bold text-blue-600" data-testid="text-predictive-savings">${(predictiveSavings / 1000).toFixed(0)}k</div></CardContent>
        </Card>
        <Card data-testid="card-roi">
          <CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-sm font-medium">ROI</CardTitle><ContextHelp title="Return on Investment" description="Overall ROI from implementing predictive maintenance vs. traditional reactive maintenance." /></div></CardHeader>
          <CardContent><div className="text-3xl font-bold text-purple-600" data-testid="text-roi">{roiAnalysis?.overallRoi ? `${roiAnalysis.overallRoi.toFixed(0)}%` : "N/A"}</div></CardContent>
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
              <ContextHelp title="Savings Integrity" description="Tracks disputed and voided savings claims. Only validated claims are included in totals. Disputed claims are under review; voided claims have been invalidated (e.g., cancelled work orders)." />
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
                  <Badge variant="outline" className="border-amber-500 text-amber-600" data-testid="badge-disputed-count">{disputedCount}</Badge>
                  <span className="text-sm font-medium" data-testid="text-disputed-amount">${(disputedAmount / 1000).toFixed(0)}k</span>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-sm text-muted-foreground">Voided</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-red-500 text-red-600" data-testid="badge-voided-count">{voidedCount}</Badge>
                  <span className="text-sm font-medium" data-testid="text-voided-amount">${(voidedAmount / 1000).toFixed(0)}k</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-llm-cost">
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Target className="h-4 w-4" />AI Insights Cost</CardTitle></CardHeader>
          <CardContent><div className="space-y-2"><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Reports Generated</span><span className="text-lg font-bold" data-testid="text-llm-reports">{completedInsights}</span></div><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Est. LLM Cost</span><span className="text-sm font-medium text-blue-600" data-testid="text-llm-cost">${estimatedLLMCost.toFixed(2)}</span></div><p className="text-xs text-muted-foreground mt-2">Avg ${avgCostPerInsight}/report</p></div></CardContent>
        </Card>
        <Card className={projectedDowntimeCost > 10000 ? "border-amber-500" : ""} data-testid="card-downtime-projections">
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><TrendingDown className="h-4 w-4" />Downtime Projections</CardTitle></CardHeader>
          <CardContent><div className="space-y-2"><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Projected Cost</span><span className="text-lg font-bold text-amber-600" data-testid="text-projected-cost">${(projectedDowntimeCost / 1000).toFixed(0)}k</span></div><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Est. Hours</span><span className="text-sm font-medium" data-testid="text-projected-hours">{estimatedFutureDowntime.toFixed(0)}h</span></div><p className="text-xs text-muted-foreground mt-2"><span data-testid="text-open-orders">{openWorkOrders.length}</span> open work orders</p></div></CardContent>
        </Card>
        <Card data-testid="card-preventive-reactive">
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><PieChart className="h-4 w-4" />Preventive vs Reactive</CardTitle></CardHeader>
          <CardContent><div className="space-y-2"><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Preventive Ratio</span><span className="text-lg font-bold text-green-600" data-testid="text-preventive-ratio">{preventiveRatio.toFixed(0)}%</span></div><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Preventive Cost</span><span className="text-sm font-medium" data-testid="text-preventive-cost">${(preventiveCost / 1000).toFixed(0)}k</span></div><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Reactive Cost</span><span className="text-sm font-medium" data-testid="text-reactive-cost">${(reactiveCost / 1000).toFixed(0)}k</span></div></div></CardContent>
        </Card>
        <Card data-testid="card-labor-cost">
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" />Labor Cost Analytics</CardTitle></CardHeader>
          <CardContent><div className="space-y-2"><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Total Labor Cost</span><span className="text-lg font-bold text-emerald-600" data-testid="text-total-labor-cost">${totalLaborCost > 0 ? (totalLaborCost / 1000).toFixed(1) : "0"}k</span></div><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Avg Rate/Hour</span><span className="text-sm font-medium" data-testid="text-avg-labor-rate">${avgLaborCostPerHour.toFixed(2)}</span></div><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Total Hours</span><span className="text-sm font-medium" data-testid="text-total-labor-hours">{totalLaborHours.toFixed(1)}h</span></div><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Pending Hours</span><span className="text-sm font-medium" data-testid="text-pending-labor-hours">{pendingLaborHours.toFixed(1)}h</span></div><div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Est. Pending Cost</span><span className="text-sm font-medium text-amber-600" data-testid="text-pending-labor-cost">${estimatedPendingLaborCost > 0 ? (estimatedPendingLaborCost / 1000).toFixed(1) : "0"}k</span></div><p className="text-xs text-muted-foreground mt-2"><span data-testid="text-work-orders-with-labor">{workOrdersWithLabor}</span> work orders with labor tracked</p></div></CardContent>
        </Card>
      </div>

      {roiTrendData.length > 0 && (
        <Card data-testid="card-roi-trend">
          <CardHeader><CardTitle>ROI Trend Analysis</CardTitle><p className="text-sm text-muted-foreground">6-month return on investment trend</p></CardHeader>
          <CardContent><div data-testid="chart-roi-trend"><ResponsiveContainer width="100%" height={250}><BarChart data={roiTrendData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend /><Bar dataKey="roi" fill="#8b5cf6" name="ROI %" /></BarChart></ResponsiveContainer></div></CardContent>
        </Card>
      )}

      <Card data-testid="card-cost-trends">
        <CardHeader><CardTitle>Cost Trends</CardTitle><p className="text-sm text-muted-foreground">Monthly maintenance costs breakdown</p></CardHeader>
        <CardContent>
          {costTrendsData.length > 0 ? (
            <div data-testid="chart-cost-trends"><ResponsiveContainer width="100%" height={300}><LineChart data={costTrendsData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="totalCost" stroke="#3b82f6" name="Total Cost" strokeWidth={2} /><Line type="monotone" dataKey="labor" stroke="#10b981" name="Labor" /><Line type="monotone" dataKey="parts" stroke="#f59e0b" name="Parts" /><Line type="monotone" dataKey="downtime" stroke="#ef4444" name="Downtime" /></LineChart></ResponsiveContainer></div>
          ) : <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-cost-data">No cost trend data available</p>}
        </CardContent>
      </Card>

      <CollapsibleSection title="Cost Breakdown by Type" summary={`${costBreakdownData.length} cost categories tracked`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {costBreakdownData.length > 0 && <ResponsiveContainer width="100%" height={250}><RechartsPieChart><Pie data={costBreakdownData} cx="50%" cy="50%" labelLine={false} label={(entry) => `${entry.name}: $${(entry.value / 1000).toFixed(0)}k`} outerRadius={80} fill="#8884d8" dataKey="value">{costBreakdownData.map((entry) => <Cell key={`cell-${entry.name}`} fill={COLORS[costBreakdownData.indexOf(entry) % COLORS.length]} />)}</Pie><Tooltip /></RechartsPieChart></ResponsiveContainer>}
          <div className="space-y-2">{costBreakdownData.map((item: { name: string; value: number }) => <div key={item.name} className="flex items-center justify-between p-3 border rounded-lg"><div className="flex items-center gap-3"><div className="w-4 h-4 rounded" style={{ backgroundColor: COLORS[costBreakdownData.indexOf(item) % COLORS.length] }} /><span className="font-medium capitalize">{item.name}</span></div><span className="font-bold">${(item.value / 1000).toFixed(1)}k</span></div>)}</div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Cost Optimization Opportunities" summary="Data-driven recommendations to reduce maintenance costs">
        <div className="space-y-3">
          {preventiveRatio < 40 && <div className="p-4 border rounded-lg bg-blue-500/5"><div className="flex items-start gap-3"><Target className="h-5 w-5 text-blue-600 mt-0.5" /><div><h4 className="font-semibold text-sm">Shift to Preventive Maintenance</h4><p className="text-sm text-muted-foreground mt-1">Your preventive ratio is {preventiveRatio.toFixed(0)}%. Increasing to 60% could save ${((reactiveCost * 0.3) / 1000).toFixed(0)}k/year by preventing costly failures</p></div></div></div>}
          {projectedDowntimeCost > 10000 && <div className="p-4 border rounded-lg bg-amber-500/5"><div className="flex items-start gap-3"><TrendingDown className="h-5 w-5 text-amber-600 mt-0.5" /><div><h4 className="font-semibold text-sm">Reduce Projected Downtime</h4><p className="text-sm text-muted-foreground mt-1">${(projectedDowntimeCost / 1000).toFixed(0)}k in downtime costs projected. Act on {openWorkOrders.length} open work orders earlier to reduce impact</p></div></div></div>}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Savings Claims" summary={`${savingsRecords.length} savings records`}>
        {savingsRecords.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-savings-claims">No savings claims recorded yet</p>
        ) : (
          <div className="space-y-3" data-testid="savings-claims-list">
            {savingsRecords.map((record) => (
              <div key={record.id} className="p-4 border rounded-lg" data-testid={`savings-claim-${record.id}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm" data-testid={`text-savings-amount-${record.id}`}>${((record.totalSavings ?? 0) / 1000).toFixed(1)}k savings</span>
                      <ValidationStatusBadge status={record.validationStatus ?? "valid"} />
                      <Badge variant="secondary" className="text-xs">{record.maintenanceType}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-x-3">
                      {record.workOrderId && <span>WO: {record.workOrderId.slice(0, 8)}...</span>}
                      <span>Equipment: {record.equipmentId?.slice(0, 8)}...</span>
                      {record.calculatedAt && <span>{formatDate(new Date(record.calculatedAt))}</span>}
                    </div>
                    {record.validationReason && (
                      <p className="text-xs text-muted-foreground italic mt-1" data-testid={`text-validation-reason-${record.id}`}>Reason: {record.validationReason}</p>
                    )}
                    {record.validationChangedBy && record.validationChangedAt && (
                      <p className="text-xs text-muted-foreground">Changed by {record.validationChangedBy} on {formatDate(new Date(record.validationChangedAt))}</p>
                    )}
                  </div>
                  <SavingsClaimActions savingsId={record.id} currentStatus={record.validationStatus ?? "valid"} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}
