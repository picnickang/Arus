import { Activity, BarChart3, AlertCircle, Settings, PlayCircle, Database, TrendingUp, Waves } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { type AnalysisResult, usePdmPackData } from "@/features/maintenance";
import { formatDate } from "@/lib/formatters";
import { IntelligenceLayout } from "@/components/intelligence/IntelligenceLayout";
import { useEquipmentLookup } from "@/hooks/use-equipment-lookup";

const AnalysisResultsCard = ({ result, title, isLoading }: { result: AnalysisResult | null; title: string; isLoading: boolean }) => {
  if (isLoading) {return <Card><CardHeader><CardTitle>{title} Results</CardTitle></CardHeader><CardContent><div className="flex items-center justify-center py-8"><div className="text-muted-foreground">Analyzing...</div></div></CardContent></Card>;}
  if (!result) {return <Card><CardHeader><CardTitle>{title} Results</CardTitle></CardHeader><CardContent><div className="text-center py-8"><p className="text-muted-foreground">Run analysis to see results</p></div></CardContent></Card>;}
  return (
    <Card><CardHeader><CardTitle className="flex items-center gap-2">{title} Results<Badge variant={result.severity === "high" ? "destructive" : result.severity === "warn" ? "secondary" : "outline"} className={result.severity === "high" ? "" : result.severity === "warn" ? "" : "border-green-500 text-green-500"}>{result.severity.toUpperCase()}</Badge></CardTitle></CardHeader><CardContent><div className="space-y-4">
      <div><Label className="text-sm font-medium">Highest Deviation</Label><p className="text-2xl font-bold mt-1" data-testid={`worst-z-${title.toLowerCase().replace(" ", "-")}`}>{Number.isFinite(result.worstZ) ? result.worstZ.toFixed(2) : "—"}</p></div>
      <div><Label className="text-sm font-medium">Feature Scores</Label><div className="space-y-2 mt-2">{Object.entries(result.scores).map(([feature, score]) => <div key={feature} className="flex justify-between items-center p-2 border rounded"><span className="text-sm font-mono">{feature}</span><div className="text-right"><div className="text-sm font-medium">Z: {Number.isFinite(score) ? score.toFixed(2) : "—"}</div><div className="text-xs text-muted-foreground">Value: {Number.isFinite(result.features[feature]) ? result.features[feature].toFixed(4) : "—"}</div></div></div>)}</div></div>
      {result.explanation && <div><Label className="text-sm font-medium">Analysis Details</Label><div className="mt-2 p-3 bg-muted rounded text-xs font-mono max-h-96 overflow-auto"><pre>{JSON.stringify(result.explanation, null, 2).slice(0, 4000)}</pre>{JSON.stringify(result.explanation).length > 4000 && <p className="text-yellow-500 mt-2">... (truncated, showing first 4000 chars)</p>}</div></div>}
    </div></CardContent></Card>
  );
};

function RecentAlertsPanel({ recentAlerts, getSeverityBadgeColor }: { recentAlerts: any[]; getSeverityBadgeColor: (s: string) => string }) {
  const { resolve } = useEquipmentLookup();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />Recent Alerts
          <InfoTooltip content="Deviation score shows how unusual a reading is. Values above 2 indicate the measurement is significantly different from normal and may signal a problem." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {recentAlerts.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No recent alerts</p>
          ) : (
            recentAlerts.map((alert) => {
              const resolved = resolve(alert.assetId);
              return (
                <div key={alert.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={getSeverityBadgeColor(alert.severity) as "default" | "secondary" | "destructive" | "outline"} className="text-xs">{alert.severity.toUpperCase()}</Badge>
                      <span className="font-medium text-sm">{resolved.name}{resolved.vessel ? ` — ${resolved.vessel}` : ""}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{alert.feature}: {alert.value.toFixed(2)} (Deviation: {alert.scoreZ.toFixed(1)})</p>
                    <p className="text-xs text-muted-foreground">{formatDate(alert.at)}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PdmPack() {
  const p = usePdmPackData();

  if (p.alertsLoading || p.healthLoading) {return <IntelligenceLayout><div className="flex items-center justify-center min-h-screen"><div className="text-muted-foreground">Loading diagnostics...</div></div></IntelligenceLayout>;}
  if (p.alerts === undefined) {return <IntelligenceLayout><div className="flex items-center justify-center min-h-screen"><div className="text-red-500">Failed to load PdM alerts. Please check your connection.</div></div></IntelligenceLayout>;}

  return (
    <IntelligenceLayout>
      <div className="min-h-screen">
      <div className="space-y-6">
        <div className="flex items-center justify-end px-6 py-2"><Badge variant={p.serviceStatus ? "outline" : "destructive"} className={p.serviceStatus ? "border-green-500 text-green-500" : ""} data-testid="service-status">{p.serviceStatus ? "Monitoring Active" : "Monitoring Issue"}</Badge></div>

      <div className="p-4 md:p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-muted-foreground text-sm">Monitoring Status</p><p className="text-2xl font-bold text-foreground mt-1" data-testid="metric-service-status">{p.serviceStatus ? "Active" : "Offline"}</p></div><div className={`${p.serviceStatus ? "bg-green-500/20" : "bg-red-500/20"} p-3 rounded-lg`}><Activity className={p.serviceStatus ? "text-green-500" : "text-red-500"} size={20} /></div></div></CardContent></Card>
          <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-muted-foreground text-sm">Critical Alerts (24h)</p><p className="text-2xl font-bold text-red-500 mt-1" data-testid="metric-critical-alerts">{p.criticalCount}</p></div><div className="bg-red-500/20 p-3 rounded-lg"><AlertCircle className="text-red-500" size={20} /></div></div></CardContent></Card>
          <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-muted-foreground text-sm">Warning Alerts (24h)</p><p className="text-2xl font-bold text-yellow-500 mt-1" data-testid="metric-warning-alerts">{p.warningCount}</p></div><div className="bg-yellow-500/20 p-3 rounded-lg"><TrendingUp className="text-yellow-500" size={20} /></div></div></CardContent></Card>
          <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-muted-foreground text-sm">Total Alerts (24h)</p><p className="text-2xl font-bold text-foreground mt-1" data-testid="metric-total-alerts">{p.recentAlerts.length}</p></div><div className="bg-blue-500/20 p-3 rounded-lg"><BarChart3 className="text-blue-500" size={20} /></div></div></CardContent></Card>
        </div>

        <Tabs value={p.activeTab} onValueChange={p.setActiveTab} className="space-y-6">
          <TabsList className="inline-flex w-full overflow-x-auto">
            <TabsTrigger value="overview" data-testid="tab-overview" className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[60px] sm:min-w-[80px] transition-all"><Database className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Overview</span><span className="sm:hidden">Over</span></TabsTrigger>
            <TabsTrigger value="bearing-analysis" data-testid="tab-bearing-analysis" className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[60px] sm:min-w-[80px] transition-all"><Waves className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Bearing Analysis</span><span className="sm:hidden">Bearing</span></TabsTrigger>
            <TabsTrigger value="pump-analysis" data-testid="tab-pump-analysis" className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[60px] sm:min-w-[80px] transition-all"><Settings className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Pump Analysis</span><span className="sm:hidden">Pump</span></TabsTrigger>
            <TabsTrigger value="baselines" data-testid="tab-baselines" className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[60px] sm:min-w-[80px] transition-all"><TrendingUp className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Baselines</span><span className="sm:hidden">Base</span></TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <RecentAlertsPanel recentAlerts={p.recentAlerts} getSeverityBadgeColor={p.getSeverityBadgeColor} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card><CardHeader><CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5" />Monitoring Configuration</CardTitle></CardHeader><CardContent><div className="space-y-4"><div><Label className="text-sm font-medium">Engine Version</Label><p className="text-sm text-muted-foreground mt-1">Diagnostic Engine v1</p></div><div><Label className="text-sm font-medium">Monitored Parameters</Label><div className="flex flex-wrap gap-2 mt-2">{p.healthData?.features?.map((feature: string) => <Badge key={feature} variant="outline" className="text-xs">{feature.replaceAll('_', " ")}</Badge>)}</div></div><div><Label className="text-sm font-medium">Last Health Check</Label><p className="text-sm text-muted-foreground mt-1">{p.healthData?.timestamp ? formatDate(p.healthData.timestamp) : "Unknown"}</p></div></div></CardContent></Card>
            </div>
          </TabsContent>

          <TabsContent value="bearing-analysis" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card><CardHeader><CardTitle className="flex items-center gap-2"><Waves className="w-5 h-5" />Bearing Vibration Analysis<InfoTooltip content="Paste a series of vibration measurements (like numbers from a sensor). The system will check if the vibrations are normal or indicate potential bearing problems." /></CardTitle></CardHeader><CardContent>
                <Form {...p.bearingForm}><form onSubmit={p.bearingForm.handleSubmit((data) => p.bearingAnalysisMutation.mutate(data))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4"><FormField control={p.bearingForm.control} name="vesselName" render={({ field }) => <FormItem><FormLabel>Vessel Name</FormLabel><FormControl><Input {...field} placeholder="MV Green Belt" data-testid="input-vessel-name" /></FormControl><FormMessage /></FormItem>} /><FormField control={p.bearingForm.control} name="assetId" render={({ field }) => <FormItem><FormLabel>Asset ID</FormLabel><FormControl><Input {...field} placeholder="BEARING001" data-testid="input-asset-id" /></FormControl><FormMessage /></FormItem>} /></div>
                  <FormField control={p.bearingForm.control} name="series" render={({ field }) => <FormItem><FormLabel>Vibration Series (comma-separated)</FormLabel><FormControl><Textarea {...field} placeholder="0.1, 0.2, 0.15, 0.18, 0.22, 0.19, 0.21, 0.17, 0.16, 0.20" rows={4} data-testid="input-vibration-series" /></FormControl><FormMessage /></FormItem>} />
                  <div className="grid grid-cols-2 gap-4"><FormField control={p.bearingForm.control} name="sampleRateHz" render={({ field }) => <FormItem><FormLabel>Sample Rate (Hz)</FormLabel><FormControl><Input {...field} type="number" placeholder="1000" data-testid="input-sample-rate" /></FormControl><FormMessage /></FormItem>} /><FormField control={p.bearingForm.control} name="rpm" render={({ field }) => <FormItem><FormLabel>Shaft RPM (optional)</FormLabel><FormControl><Input {...field} type="number" placeholder="1800" data-testid="input-rpm" /></FormControl><FormMessage /></FormItem>} /></div>
                  <FormField control={p.bearingForm.control} name="autoBaseline" render={({ field }) => <FormItem className="flex items-center gap-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-auto-baseline" /></FormControl><FormLabel className="!mt-0">Auto-update baseline statistics</FormLabel></FormItem>} />
                  <Button type="submit" className="w-full" disabled={p.bearingAnalysisMutation.isPending} data-testid="button-analyze-bearing"><PlayCircle className="mr-2 h-4 w-4" />{p.bearingAnalysisMutation.isPending ? "Analyzing..." : "Run Bearing Analysis"}</Button>
                </form></Form>
              </CardContent></Card>
              <AnalysisResultsCard result={p.bearingAnalysisResult} title="Bearing" isLoading={p.bearingAnalysisMutation.isPending} />
            </div>
          </TabsContent>

          <TabsContent value="pump-analysis" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card><CardHeader><CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5" />Pump Process Analysis<InfoTooltip content="Enter flow, pressure, or electrical current readings from a pump. The system will detect if the pump is operating normally or showing signs of wear." /></CardTitle></CardHeader><CardContent>
                <Form {...p.pumpForm}><form onSubmit={p.pumpForm.handleSubmit((data) => p.pumpAnalysisMutation.mutate(data))} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4"><FormField control={p.pumpForm.control} name="vesselName" render={({ field }) => <FormItem><FormLabel>Vessel Name</FormLabel><FormControl><Input {...field} placeholder="MV Green Belt" data-testid="input-pump-vessel" /></FormControl><FormMessage /></FormItem>} /><FormField control={p.pumpForm.control} name="assetId" render={({ field }) => <FormItem><FormLabel>Asset ID</FormLabel><FormControl><Input {...field} placeholder="PUMP001" data-testid="input-pump-asset" /></FormControl><FormMessage /></FormItem>} /></div>
                  <FormField control={p.pumpForm.control} name="flow" render={({ field }) => <FormItem><FormLabel>Flow Readings (comma-separated)</FormLabel><FormControl><Textarea {...field} placeholder="100, 102, 98, 101, 99, 100, 103, 97, 100, 101" rows={2} data-testid="input-flow" /></FormControl><FormMessage /></FormItem>} />
                  <FormField control={p.pumpForm.control} name="pressure" render={({ field }) => <FormItem><FormLabel>Pressure Readings (comma-separated)</FormLabel><FormControl><Textarea {...field} placeholder="50, 51, 49, 50, 52, 48, 50, 51, 49, 50" rows={2} data-testid="input-pressure" /></FormControl><FormMessage /></FormItem>} />
                  <FormField control={p.pumpForm.control} name="current" render={({ field }) => <FormItem><FormLabel>Current Readings (comma-separated)</FormLabel><FormControl><Textarea {...field} placeholder="10, 10.2, 9.8, 10.1, 10, 9.9, 10.3, 10, 9.7, 10.1" rows={2} data-testid="input-current" /></FormControl><FormMessage /></FormItem>} />
                  <FormField control={p.pumpForm.control} name="autoBaseline" render={({ field }) => <FormItem className="flex items-center gap-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} data-testid="checkbox-pump-baseline" /></FormControl><FormLabel className="!mt-0">Auto-update baseline statistics</FormLabel></FormItem>} />
                  <Button type="submit" className="w-full" disabled={p.pumpAnalysisMutation.isPending} data-testid="button-analyze-pump"><PlayCircle className="mr-2 h-4 w-4" />{p.pumpAnalysisMutation.isPending ? "Analyzing..." : "Run Pump Analysis"}</Button>
                </form></Form>
              </CardContent></Card>
              <AnalysisResultsCard result={p.pumpAnalysisResult} title="Pump" isLoading={p.pumpAnalysisMutation.isPending} />
            </div>
          </TabsContent>

          <TabsContent value="baselines" className="space-y-6">
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><Database className="w-5 h-5" />Baseline Statistics<InfoTooltip content="These are the 'normal' values learned from past measurements. The system compares new readings against these baselines to detect problems." /></CardTitle></CardHeader><CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label htmlFor="baseline-vessel">Vessel</Label><Select value={p.selectedVessel} onValueChange={p.setSelectedVessel}><SelectTrigger data-testid="select-baseline-vessel"><SelectValue placeholder="Select vessel" /></SelectTrigger><SelectContent><SelectItem value="MV Green Belt">MV Green Belt</SelectItem><SelectItem value="MV Pacific Star">MV Pacific Star</SelectItem><SelectItem value="MV Ocean Explorer">MV Ocean Explorer</SelectItem></SelectContent></Select></div>
                  <div><Label htmlFor="baseline-asset">Asset ID</Label><Select value={p.selectedAsset} onValueChange={p.setSelectedAsset}><SelectTrigger data-testid="select-baseline-asset"><SelectValue placeholder="Select asset" /></SelectTrigger><SelectContent><SelectItem value="BEARING001">BEARING001</SelectItem><SelectItem value="BEARING002">BEARING002</SelectItem><SelectItem value="PUMP001">PUMP001</SelectItem><SelectItem value="PUMP002">PUMP002</SelectItem></SelectContent></Select></div>
                </div>
                {p.baselinesLoading ? <div className="text-center py-4"><p className="text-muted-foreground">Loading baseline data...</p></div> : p.baselines && p.baselines.length > 0 ? <div className="space-y-3 max-h-96 overflow-y-auto">{p.baselines.map((baseline) => <div key={baseline.id} className="p-4 border rounded-lg"><div className="grid grid-cols-1 md:grid-cols-4 gap-4"><div><Label className="text-xs font-medium text-muted-foreground">Feature</Label><p className="text-sm font-mono">{baseline.feature}</p></div><div><Label className="text-xs font-medium text-muted-foreground">Mean (μ)</Label><p className="text-sm font-mono">{baseline.mu.toFixed(4)}</p></div><div><Label className="text-xs font-medium text-muted-foreground">Std Dev (σ)</Label><p className="text-sm font-mono">{baseline.sigma.toFixed(4)}</p></div><div><Label className="text-xs font-medium text-muted-foreground">Samples (n)</Label><p className="text-sm font-mono">{baseline.n}</p></div></div><div className="mt-2 pt-2 border-t"><Label className="text-xs font-medium text-muted-foreground">Last Updated</Label><p className="text-xs text-muted-foreground">{formatDate(baseline.updatedAt)}</p></div></div>)}</div> : <div className="text-center py-8"><p className="text-muted-foreground">No baseline data found for {p.selectedVessel} - {p.selectedAsset}</p><p className="text-xs text-muted-foreground mt-2">Run analysis with auto-baseline enabled to establish baselines</p></div>}
              </div>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
      </div>
      </div>
    </IntelligenceLayout>
  );
}
