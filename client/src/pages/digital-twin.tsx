import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { IntelligenceLayout } from "@/components/intelligence/IntelligenceLayout";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useEquipmentName, useEquipmentVesselName } from "@/hooks/use-equipment-lookup";
import {
  Loader2,
  Box,
  Activity,
  BarChart3,
  FlaskConical,
  Clock,
  RefreshCw,
  Heart,
  Gauge,
  Timer,
  ArrowUp,
  ArrowDown,
  Play,
  Plus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useTwins,
  useTemplates,
  useCreateTemplate,
  useCreateTwin,
  useLatestTwinState,
  useComputeTwinState,
  useTwinResiduals,
  useResidualRankings,
  useComputeResiduals,
  useTwinScenarios,
  useRunScenario,
  useTwinTimeline,
} from "@/features/digital-twin/hooks/useTwinApi";
import {
  useTwinFreshness,
  useRefreshTwin,
  useRefreshAllTwins,
  type TwinFreshnessInfo,
} from "@/features/digital-twin/hooks/useTwinFreshness";

function severityColor(severity: string) {
  switch (severity) {
    case "critical":
      return "destructive";
    case "warning":
      return "secondary";
    default:
      return "outline";
  }
}

function healthColor(score: number | null | undefined) {
  if (score == null) {return "text-muted-foreground";}
  if (score >= 80) {return "text-green-600";}
  if (score >= 60) {return "text-yellow-600";}
  return "text-red-600";
}

function OverviewTab() {
  const { data: twins, isLoading: twinsLoading } = useTwins();
  const { data: templates, isLoading: templatesLoading } = useTemplates();
  const { data: freshnessData, isLoading: freshnessLoading } = useTwinFreshness();
  const refreshTwin = useRefreshTwin();
  const refreshAll = useRefreshAllTwins();
  const createTemplate = useCreateTemplate();
  const createTwin = useCreateTwin();
  const { toast } = useToast();

  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateType, setTemplateType] = useState("engine");
  const [showCreateTwin, setShowCreateTwin] = useState(false);
  const [twinName, setTwinName] = useState("");
  const [twinEquipmentId, setTwinEquipmentId] = useState("");
  const [twinTemplateId, setTwinTemplateId] = useState("");

  const freshnessMap = new Map<string, TwinFreshnessInfo>();
  if (freshnessData) {
    for (const f of freshnessData) {
      freshnessMap.set(f.twinId, f);
    }
  }

  const handleRefreshTwin = async (twinId: string) => {
    try {
      await refreshTwin.mutateAsync(twinId);
      toast({ title: "Twin refreshed successfully" });
    } catch {
      toast({ title: "Failed to refresh twin", variant: "destructive" });
    }
  };

  const handleRefreshAll = async () => {
    try {
      await refreshAll.mutateAsync();
      toast({ title: "All twins refreshed" });
    } catch {
      toast({ title: "Failed to refresh twins", variant: "destructive" });
    }
  };

  const handleCreateTemplate = async () => {
    if (!templateName || !templateType) {return;}
    try {
      await createTemplate.mutateAsync({
        name: templateName,
        equipmentType: templateType,
        expectedBehavior: {
          temperature: { intercept: 60, loadFactor: 0.3, ambientTempFactor: 0.1 },
          vibration: { nominalValue: 2.5 },
          pressure: { nominalValue: 4.2 },
        },
        operatingEnvelope: {
          temperature: { min: 40, max: 120 },
          vibration: { min: 0, max: 10 },
          pressure: { min: 2, max: 8 },
        },
        sensorMappings: {
          temperature: ["exhaust_temp", "coolant_temp"],
          vibration: ["vibration", "acceleration"],
          pressure: ["oil_pressure", "fuel_pressure"],
        },
      });
      toast({ title: "Template created" });
      setTemplateName("");
      setShowCreateTemplate(false);
    } catch {
      toast({ title: "Failed to create template", variant: "destructive" });
    }
  };

  const handleCreateTwin = async () => {
    if (!twinName || !twinEquipmentId || !twinTemplateId) {return;}
    try {
      await createTwin.mutateAsync({
        name: twinName,
        equipmentId: twinEquipmentId,
        templateId: twinTemplateId,
        status: "active",
      });
      toast({ title: "Twin created" });
      setTwinName("");
      setTwinEquipmentId("");
      setShowCreateTwin(false);
    } catch {
      toast({ title: "Failed to create twin", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Templates</h3>
          <p className="text-sm text-muted-foreground">
            Reusable twin blueprints per equipment type
          </p>
        </div>
        <Button
          data-testid="button-show-create-template"
          variant="outline"
          size="sm"
          onClick={() => setShowCreateTemplate(!showCreateTemplate)}
        >
          <Plus className="w-4 h-4 mr-1" /> New Template
        </Button>
      </div>

      {showCreateTemplate && (
        <Card data-testid="card-create-template">
          <CardContent className="pt-4 space-y-3">
            <div className="flex gap-3">
              <input
                data-testid="input-template-name"
                type="text"
                placeholder="Template name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="flex h-10 w-60 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <input
                data-testid="input-template-type"
                type="text"
                placeholder="Equipment type (e.g. engine)"
                value={templateType}
                onChange={(e) => setTemplateType(e.target.value)}
                className="flex h-10 w-60 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <Button
                data-testid="button-create-template"
                onClick={handleCreateTemplate}
                disabled={createTemplate.isPending || !templateName}
              >
                {createTemplate.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                )}
                Create
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {templatesLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : templates?.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t: any) => (
            <Card key={t.id} data-testid={`card-template-${t.id}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t.name}</CardTitle>
                <CardDescription>{t.equipmentType}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{t.description || `${t.equipmentType || "General"} template`}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="text-no-templates">
          No templates yet. Create one to get started.
        </p>
      )}

      <div className="border-t pt-6 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">Asset Twins</h3>
          <p className="text-sm text-muted-foreground">
            Digital twin instances linked to equipment
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            data-testid="button-refresh-all-twins"
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            disabled={refreshAll.isPending}
          >
            {refreshAll.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-1" />
            )}
            Refresh All
          </Button>
          <Button
            data-testid="button-show-create-twin"
            variant="outline"
            size="sm"
            onClick={() => setShowCreateTwin(!showCreateTwin)}
          >
            <Plus className="w-4 h-4 mr-1" /> New Twin
          </Button>
        </div>
      </div>

      {showCreateTwin && (
        <Card data-testid="card-create-twin">
          <CardContent className="pt-4 space-y-3">
            <div className="flex gap-3 flex-wrap">
              <input
                data-testid="input-twin-name"
                type="text"
                placeholder="Twin name"
                value={twinName}
                onChange={(e) => setTwinName(e.target.value)}
                className="flex h-10 w-48 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <input
                data-testid="input-twin-equipment-id"
                type="text"
                placeholder="Equipment ID"
                value={twinEquipmentId}
                onChange={(e) => setTwinEquipmentId(e.target.value)}
                className="flex h-10 w-48 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <select
                data-testid="select-twin-template"
                value={twinTemplateId}
                onChange={(e) => setTwinTemplateId(e.target.value)}
                className="flex h-10 w-48 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select template...</option>
                {templates?.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <Button
                data-testid="button-create-twin"
                onClick={handleCreateTwin}
                disabled={
                  createTwin.isPending ||
                  !twinName ||
                  !twinEquipmentId ||
                  !twinTemplateId
                }
              >
                {createTwin.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                )}
                Create
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {twinsLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : twins?.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {twins.map((tw: any) => (
            <TwinOverviewCard
              key={tw.id}
              twin={tw}
              freshness={freshnessMap.get(tw.id)}
              onRefresh={handleRefreshTwin}
              isRefreshing={refreshTwin.isPending}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground" data-testid="text-no-twins">
          No asset twins created yet.
        </p>
      )}
    </div>
  );
}

function formatTimeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) {return "Never";}
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) {return "Just now";}
  if (mins < 60) {return `${mins}m ago`;}
  const hours = Math.floor(mins / 60);
  if (hours < 24) {return `${hours}h ago`;}
  return `${Math.floor(hours / 24)}d ago`;
}

function TwinOverviewCard({
  twin,
  freshness,
  onRefresh,
  isRefreshing,
}: {
  twin: any;
  freshness?: TwinFreshnessInfo;
  onRefresh: (twinId: string) => void;
  isRefreshing: boolean;
}) {
  const { data: state } = useLatestTwinState(twin.id);
  const isStale = freshness?.isStale ?? true;
  const lastUpdated = freshness?.lastStateUpdate;
  const lastResidual = freshness?.lastResidualUpdate;
  const equipmentName = useEquipmentName(twin.equipmentId || "");
  const vesselName = useEquipmentVesselName(twin.equipmentId || "");

  return (
    <Card data-testid={`card-twin-${twin.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-1">
          <CardTitle className="text-base">{twin.name}</CardTitle>
          <div className="flex items-center gap-1 flex-wrap">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help">
                    <Badge
                      variant={isStale ? "destructive" : "default"}
                      data-testid={`badge-freshness-${twin.id}`}
                    >
                      {isStale ? "Stale" : "Fresh"}
                    </Badge>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {isStale
                    ? "State data is more than 24h old — click Refresh to update"
                    : "State data is up to date"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Badge
              variant={twin.status === "active" ? "default" : "secondary"}
              data-testid={`badge-twin-status-${twin.id}`}
            >
              {twin.status}
            </Badge>
          </div>
        </div>
        <CardDescription>
          {equipmentName}{vesselName ? ` — ${vesselName}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {state && !state.error ? (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <Heart className={`w-4 h-4 mx-auto mb-1 ${healthColor(state.healthScore)}`} />
              <p className={`text-lg font-bold ${healthColor(state.healthScore)}`} data-testid={`text-health-${twin.id}`}>
                {state.healthScore?.toFixed(0) ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground">Health</p>
            </div>
            <div>
              <Gauge className="w-4 h-4 mx-auto mb-1 text-blue-600" />
              <p className="text-lg font-bold text-blue-600" data-testid={`text-efficiency-${twin.id}`}>
                {state.efficiencyScore?.toFixed(0) ?? "—"}%
              </p>
              <p className="text-xs text-muted-foreground">Efficiency</p>
            </div>
            <div>
              <Timer className="w-4 h-4 mx-auto mb-1 text-purple-600" />
              <p className="text-lg font-bold text-purple-600" data-testid={`text-rul-${twin.id}`}>
                {state.remainingUsefulLifeHours?.toFixed(0) ?? "—"}h
              </p>
              <p className="text-xs text-muted-foreground">RUL</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No state computed yet</p>
        )}

        <div className="border-t pt-2 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              State: {formatTimeAgo(lastUpdated)}
            </span>
            <span data-testid={`text-last-updated-${twin.id}`}>
              {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <BarChart3 className="w-3 h-3" />
              Residual: {formatTimeAgo(lastResidual)}
            </span>
            <span data-testid={`text-last-residual-${twin.id}`}>
              {lastResidual ? new Date(lastResidual).toLocaleTimeString() : "—"}
            </span>
          </div>
        </div>

        <Button
          data-testid={`button-refresh-twin-${twin.id}`}
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => onRefresh(twin.id)}
          disabled={isRefreshing}
        >
          {isRefreshing ? (
            <Loader2 className="w-4 h-4 animate-spin mr-1" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-1" />
          )}
          Refresh
        </Button>
      </CardContent>
    </Card>
  );
}

function StateTab() {
  const [twinId, setTwinId] = useState("");
  const { data: state, isLoading, error } = useLatestTwinState(twinId);
  const computeMutation = useComputeTwinState();
  const { toast } = useToast();

  const handleCompute = async () => {
    if (!twinId) {return;}
    try {
      await computeMutation.mutateAsync(twinId);
      toast({ title: "State computed successfully" });
    } catch (e: any) {
      toast({ title: e.message || "Failed to compute state", variant: "destructive" });
    }
  };

  const observed = state?.observedValues as Record<string, number> | undefined;
  const expected = state?.expectedValues as Record<string, number> | undefined;
  const allSensors = observed && expected
    ? Array.from(new Set([...Object.keys(observed), ...Object.keys(expected)]))
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          data-testid="input-twin-id-state"
          type="text"
          placeholder="Enter twin ID"
          value={twinId}
          onChange={(e) => setTwinId(e.target.value)}
          className="flex h-10 w-72 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <Button
          data-testid="button-compute-state"
          onClick={handleCompute}
          disabled={!twinId || computeMutation.isPending}
        >
          {computeMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Compute State
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}

      {state && !state.error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card data-testid="card-health-score">
              <CardContent className="pt-4 text-center">
                <Heart className={`w-8 h-8 mx-auto mb-2 ${healthColor(state.healthScore)}`} />
                <p className={`text-3xl font-bold ${healthColor(state.healthScore)}`}>
                  {state.healthScore?.toFixed(1) ?? "—"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">Health Score</p>
              </CardContent>
            </Card>
            <Card data-testid="card-efficiency-score">
              <CardContent className="pt-4 text-center">
                <Gauge className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                <p className="text-3xl font-bold text-blue-600">
                  {state.efficiencyScore?.toFixed(1) ?? "—"}%
                </p>
                <p className="text-sm text-muted-foreground mt-1">Efficiency Score</p>
              </CardContent>
            </Card>
            <Card data-testid="card-rul">
              <CardContent className="pt-4 text-center">
                <Timer className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                <p className="text-3xl font-bold text-purple-600">
                  {state.remainingUsefulLifeHours?.toFixed(0) ?? "—"}h
                </p>
                <p className="text-sm text-muted-foreground mt-1">Remaining Useful Life</p>
              </CardContent>
            </Card>
          </div>

          {allSensors.length > 0 && (
            <Card data-testid="card-metrics-table">
              <CardHeader>
                <CardTitle className="text-base">Expected vs Observed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 font-medium">Sensor</th>
                        <th className="pb-2 font-medium text-right">Expected</th>
                        <th className="pb-2 font-medium text-right">Observed</th>
                        <th className="pb-2 font-medium text-right">Deviation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allSensors.map((sensor) => {
                        const obs = observed?.[sensor];
                        const exp = expected?.[sensor];
                        const dev =
                          obs != null && exp != null
                            ? ((obs - exp) / (exp || 1)) * 100
                            : null;
                        return (
                          <tr key={sensor} className="border-b" data-testid={`row-metric-${sensor}`}>
                            <td className="py-2 capitalize">{sensor.replace(/_/g, " ")}</td>
                            <td className="py-2 text-right font-mono">
                              {exp?.toFixed(2) ?? "—"}
                            </td>
                            <td className="py-2 text-right font-mono">
                              {obs?.toFixed(2) ?? "—"}
                            </td>
                            <td className="py-2 text-right">
                              {dev != null ? (
                                <span
                                  className={
                                    Math.abs(dev) > 10
                                      ? "text-red-600"
                                      : Math.abs(dev) > 5
                                        ? "text-yellow-600"
                                        : "text-green-600"
                                  }
                                >
                                  {dev > 0 ? (
                                    <ArrowUp className="w-3 h-3 inline mr-1" />
                                  ) : dev < 0 ? (
                                    <ArrowDown className="w-3 h-3 inline mr-1" />
                                  ) : null}
                                  {dev.toFixed(1)}%
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {error && !isLoading && (
        <p className="text-sm text-muted-foreground" data-testid="text-no-state">
          No state data. Click "Compute State" to generate.
        </p>
      )}
    </div>
  );
}

function ResidualsTab() {
  const [twinId, setTwinId] = useState("");
  const { data: residuals, isLoading } = useTwinResiduals(twinId);
  const { data: rankings, isLoading: rankingsLoading } = useResidualRankings();
  const computeMutation = useComputeResiduals();
  const { toast } = useToast();

  const handleCompute = async () => {
    if (!twinId) {return;}
    try {
      await computeMutation.mutateAsync(twinId);
      toast({ title: "Residuals computed" });
    } catch (e: any) {
      toast({ title: e.message || "Failed", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          data-testid="input-twin-id-residuals"
          type="text"
          placeholder="Enter twin ID"
          value={twinId}
          onChange={(e) => setTwinId(e.target.value)}
          className="flex h-10 w-72 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <Button
          data-testid="button-compute-residuals"
          onClick={handleCompute}
          disabled={!twinId || computeMutation.isPending}
        >
          {computeMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <BarChart3 className="w-4 h-4 mr-2" />
          )}
          Compute Residuals
        </Button>
      </div>

      {twinId && isLoading && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}

      {residuals?.length > 0 && (
        <Card data-testid="card-residuals-table">
          <CardHeader>
            <CardTitle className="text-base">Residuals for Twin</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium">Sensor</th>
                    <th className="pb-2 font-medium text-right">Observed</th>
                    <th className="pb-2 font-medium text-right">Expected</th>
                    <th className="pb-2 font-medium text-right">Residual</th>
                    <th className="pb-2 font-medium text-right">Z-Score</th>
                    <th className="pb-2 font-medium">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {residuals.map((r: any, i: number) => (
                    <tr key={r.id || i} className="border-b" data-testid={`row-residual-${i}`}>
                      <td className="py-2 capitalize">
                        {r.sensorType?.replace(/_/g, " ")}
                      </td>
                      <td className="py-2 text-right font-mono">
                        {r.observed?.toFixed(2)}
                      </td>
                      <td className="py-2 text-right font-mono">
                        {r.expected?.toFixed(2)}
                      </td>
                      <td className="py-2 text-right font-mono">
                        {r.residual?.toFixed(2)}
                      </td>
                      <td className="py-2 text-right font-mono">
                        {r.zScore?.toFixed(2)}
                      </td>
                      <td className="py-2">
                        <Badge variant={severityColor(r.severity)} data-testid={`badge-severity-${i}`}>
                          {r.severity}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="border-t pt-4">
        <h3 className="text-lg font-semibold mb-3">Residual Rankings (All Twins)</h3>
        {rankingsLoading ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : rankings?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rankings.map((r: any, i: number) => (
              <Card key={i} data-testid={`card-ranking-${i}`}>
                <CardContent className="pt-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium capitalize">
                        {r.sensorType?.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Twin: {r.twinId?.slice(0, 8)}...
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm">
                        Avg Z: {r.avgZScore?.toFixed(2)}
                      </p>
                      <Badge variant={severityColor(r.severity)}>
                        {r.severity}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground" data-testid="text-no-rankings">
            No rankings available yet.
          </p>
        )}
      </div>
    </div>
  );
}

function ScenariosTab() {
  const [twinId, setTwinId] = useState("");
  const [scenarioName, setScenarioName] = useState("");
  const [loadPercent, setLoadPercent] = useState(85);
  const [tempOffset, setTempOffset] = useState(0);
  const [maintDelay, setMaintDelay] = useState(0);
  const { data: scenarios, isLoading } = useTwinScenarios(twinId);
  const runMutation = useRunScenario();
  const { toast } = useToast();

  const handleRun = async () => {
    if (!twinId || !scenarioName) {return;}
    try {
      await runMutation.mutateAsync({
        twinId,
        name: scenarioName,
        parameters: {
          loadPercent,
          temperatureOffset: tempOffset,
          maintenanceDelayDays: maintDelay,
        },
      });
      toast({ title: "Scenario completed" });
    } catch (e: any) {
      toast({ title: e.message || "Failed", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <Card data-testid="card-scenario-form">
        <CardHeader>
          <CardTitle className="text-base">What-If Scenario</CardTitle>
          <CardDescription>
            Simulate the impact of changed conditions on twin health
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <input
              data-testid="input-twin-id-scenario"
              type="text"
              placeholder="Twin ID"
              value={twinId}
              onChange={(e) => setTwinId(e.target.value)}
              className="flex h-10 w-60 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <input
              data-testid="input-scenario-name"
              type="text"
              placeholder="Scenario name"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              className="flex h-10 w-48 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">
                Load (%):{" "}
                <span className="font-mono" data-testid="text-load-value">{loadPercent}</span>
              </label>
              <input
                data-testid="input-load-percent"
                type="range"
                min={0}
                max={120}
                value={loadPercent}
                onChange={(e) => setLoadPercent(Number(e.target.value))}
                className="w-full mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                Temp Offset (°C):{" "}
                <span className="font-mono" data-testid="text-temp-value">{tempOffset}</span>
              </label>
              <input
                data-testid="input-temp-offset"
                type="range"
                min={-50}
                max={50}
                value={tempOffset}
                onChange={(e) => setTempOffset(Number(e.target.value))}
                className="w-full mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">
                Maintenance Delay (days):{" "}
                <span className="font-mono" data-testid="text-delay-value">{maintDelay}</span>
              </label>
              <input
                data-testid="input-maint-delay"
                type="range"
                min={0}
                max={365}
                value={maintDelay}
                onChange={(e) => setMaintDelay(Number(e.target.value))}
                className="w-full mt-1"
              />
            </div>
          </div>

          <Button
            data-testid="button-run-scenario"
            onClick={handleRun}
            disabled={!twinId || !scenarioName || runMutation.isPending}
          >
            {runMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Run Scenario
          </Button>
        </CardContent>
      </Card>

      {twinId && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Scenario History</h3>
          {isLoading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : scenarios?.length > 0 ? (
            <div className="space-y-3">
              {scenarios.map((s: any) => {
                const results = s.results as Record<string, any> | null;
                return (
                  <Card key={s.id} data-testid={`card-scenario-${s.id}`}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(s.createdAt).toLocaleString()}
                          </p>
                        </div>
                        {results && (
                          <div className="text-right space-y-1">
                            {results.riskLevel && (
                              <Badge
                                variant={
                                  results.riskLevel === "critical"
                                    ? "destructive"
                                    : results.riskLevel === "high"
                                      ? "destructive"
                                      : "secondary"
                                }
                                data-testid={`badge-risk-${s.id}`}
                              >
                                {results.riskLevel}
                              </Badge>
                            )}
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              {results.projectedHealth != null && (
                                <p>Health: {results.projectedHealth?.toFixed(1)}</p>
                              )}
                              {results.projectedRUL != null && (
                                <p>RUL: {results.projectedRUL?.toFixed(0)}h</p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      {results?.summary && (
                        <p className="text-sm mt-2 text-muted-foreground">
                          {results.summary}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground" data-testid="text-no-scenarios">
              No scenarios run yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ReplayTab() {
  const [twinId, setTwinId] = useState("");
  const [hours, setHours] = useState(24);

  const startTime = twinId
    ? new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
    : undefined;
  const endTime = twinId ? new Date().toISOString() : undefined;

  const { data: timeline, isLoading } = useTwinTimeline(twinId, startTime, endTime);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          data-testid="input-twin-id-replay"
          type="text"
          placeholder="Enter twin ID"
          value={twinId}
          onChange={(e) => setTwinId(e.target.value)}
          className="flex h-10 w-72 rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <select
          data-testid="select-replay-window"
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value={1}>Last 1 hour</option>
          <option value={6}>Last 6 hours</option>
          <option value={24}>Last 24 hours</option>
          <option value={72}>Last 3 days</option>
          <option value={168}>Last 7 days</option>
        </select>
      </div>

      {isLoading && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}

      {timeline?.length > 0 ? (
        <Card data-testid="card-timeline">
          <CardHeader>
            <CardTitle className="text-base">
              Event Timeline ({timeline.length} events)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {timeline.map((evt: any, i: number) => (
                <div
                  key={evt.id || i}
                  className="flex items-start gap-3 border-l-2 pl-4 pb-3"
                  style={{
                    borderColor:
                      evt.eventType === "anomaly" || evt.type === "telemetry_anomaly"
                        ? "#ef4444"
                        : evt.eventType === "state_change"
                          ? "#3b82f6"
                          : "#d1d5db",
                  }}
                  data-testid={`event-${i}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {evt.eventType || evt.type || "event"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(evt.timestamp).toLocaleString()}
                      </span>
                      {evt.source && (
                        <span className="text-xs text-muted-foreground">
                          via {evt.source}
                        </span>
                      )}
                    </div>
                    {evt.payload && (
                      <pre className="text-xs mt-1 text-muted-foreground overflow-hidden text-ellipsis">
                        {typeof evt.payload === "string"
                          ? evt.payload
                          : JSON.stringify(evt.payload, null, 2).slice(0, 200)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : twinId && !isLoading ? (
        <p className="text-sm text-muted-foreground" data-testid="text-no-events">
          No events found in the selected time range.
        </p>
      ) : null}
    </div>
  );
}

export default function DigitalTwinPage() {
  return (
    <IntelligenceLayout>
      <div className="p-4 md:p-6 space-y-6">
      <p className="text-xs text-slate-500">
        Asset-level digital twins for predictive maintenance
      </p>

      <Tabs defaultValue="overview">
        <TabsList className="flex w-full overflow-x-auto" data-testid="tabs-digital-twin">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Box className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="state" data-testid="tab-state">
            <Activity className="w-4 h-4 mr-2" />
            State
          </TabsTrigger>
          <TabsTrigger value="residuals" data-testid="tab-residuals">
            <BarChart3 className="w-4 h-4 mr-2" />
            Residuals
          </TabsTrigger>
          <TabsTrigger value="scenarios" data-testid="tab-scenarios">
            <FlaskConical className="w-4 h-4 mr-2" />
            Scenarios
          </TabsTrigger>
          <TabsTrigger value="replay" data-testid="tab-replay">
            <Clock className="w-4 h-4 mr-2" />
            Replay
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab />
        </TabsContent>
        <TabsContent value="state" className="mt-4">
          <StateTab />
        </TabsContent>
        <TabsContent value="residuals" className="mt-4">
          <ResidualsTab />
        </TabsContent>
        <TabsContent value="scenarios" className="mt-4">
          <ScenariosTab />
        </TabsContent>
        <TabsContent value="replay" className="mt-4">
          <ReplayTab />
        </TabsContent>
      </Tabs>
      </div>
    </IntelligenceLayout>
  );
}
