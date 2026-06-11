import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Brain,
  Loader2,
  AlertCircle,
  Activity,
  GitBranch,
  Clock,
  Database,
  RefreshCw,
  FileCheck,
  Filter,
  Eye,
  Link,
  Hash,
  Cpu,
  Calendar,
  User,
  Layers,
} from "lucide-react";
import { PageHeader } from "@/components/navigation";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import {
  useGovernanceData,
  type LineageRecord,
  FAMILY_COLORS,
  STAGE_COLORS,
  EVENT_TYPE_CONFIG,
} from "@/features/settings";
import { formatNumber } from "@/lib/formatters";

export default function GovernanceDashboard() {
  const {
    activeTab,
    setActiveTab,
    selectedModel,
    detailDrawerOpen,
    setDetailDrawerOpen,
    comparisonModel,
    lineageFilters,
    provenanceFilters,
    updateLineageFilter,
    updateProvenanceFilter,
    lineageRecords,
    provenanceEvents,
    isLoadingLineage,
    isLoadingProvenance,
    stats,
    verifyChainMutation,
    handleViewModelDetails,
    handleRefresh,
    handleToggleComparison,
    handleClearComparison,
  } = useGovernanceData();

  return (
    <div className="min-h-screen">
      <PageHeader title="Governance Dashboard" />
      <div className="container mx-auto py-6 px-4 space-y-6">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button variant="outline" onClick={handleRefresh} data-testid="button-refresh-governance">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Models
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-models">
                {stats.totalModels}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.productionModels} in production
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Predictions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-predictions">
                {formatNumber(stats.totalPredictions)}
              </div>
              <p className="text-xs text-muted-foreground">Across all models</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Model Families
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-xs">
                  LSTM: {stats.familyCounts.lstm}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  XGB: {stats.familyCounts.xgboost}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  RF: {stats.familyCounts.rf}
                </Badge>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Chain Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="sm"
                onClick={() => verifyChainMutation.mutate()}
                disabled={verifyChainMutation.isPending}
                data-testid="button-verify-chain"
              >
                {verifyChainMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileCheck className="h-4 w-4 mr-2" />
                )}
                Verify Integrity
              </Button>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="lineage" data-testid="tab-lineage">
              <GitBranch className="h-4 w-4 mr-2" />
              Model Lineage
            </TabsTrigger>
            <TabsTrigger value="provenance" data-testid="tab-provenance">
              <Clock className="h-4 w-4 mr-2" />
              Audit Log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lineage" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle>Model Lineage Records</CardTitle>
                    <CardDescription>
                      Track model versions, training provenance, and deployment stages
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Select
                      value={lineageFilters.family}
                      onValueChange={(v) => updateLineageFilter("family", v)}
                    >
                      <SelectTrigger className="w-[130px]" data-testid="select-family-filter">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Family" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Families</SelectItem>
                        <SelectItem value="lstm">LSTM</SelectItem>
                        <SelectItem value="xgboost">XGBoost</SelectItem>
                        <SelectItem value="rf">Random Forest</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={lineageFilters.stage}
                      onValueChange={(v) => updateLineageFilter("stage", v)}
                    >
                      <SelectTrigger className="w-[140px]" data-testid="select-stage-filter">
                        <Layers className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Stage" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Stages</SelectItem>
                        <SelectItem value="dev">Development</SelectItem>
                        <SelectItem value="staging">Staging</SelectItem>
                        <SelectItem value="production">Production</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <Input
                        type="date"
                        value={lineageFilters.fromDate}
                        onChange={(e) => updateLineageFilter("fromDate", e.target.value)}
                        className="w-[140px]"
                        data-testid="input-lineage-from-date"
                        placeholder="From"
                      />
                      <span className="text-muted-foreground">to</span>
                      <Input
                        type="date"
                        value={lineageFilters.toDate}
                        onChange={(e) => updateLineageFilter("toDate", e.target.value)}
                        className="w-[140px]"
                        data-testid="input-lineage-to-date"
                        placeholder="To"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingLineage ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : lineageRecords.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Models Found</AlertTitle>
                    <AlertDescription>
                      No ML models have been trained yet. Train a model to see lineage records here.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Model ID</TableHead>
                          <TableHead>Family</TableHead>
                          <TableHead>Profile</TableHead>
                          <TableHead>Version</TableHead>
                          <TableHead>Stage</TableHead>
                          <TableHead>Predictions</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {lineageRecords.map((record) => (
                          <TableRow
                            key={record.modelId}
                            data-testid={`row-model-${record.modelId}`}
                          >
                            <TableCell className="font-mono text-xs">
                              {record.modelId.substring(0, 12)}...
                            </TableCell>
                            <TableCell>
                              <Badge className={FAMILY_COLORS[record.family]}>
                                {record.family.toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell>{record.profile}</TableCell>
                            <TableCell>v{record.version}</TableCell>
                            <TableCell>
                              <Badge className={STAGE_COLORS[record.promotion.stage]}>
                                {record.promotion.stage}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatNumber(record.predictionCount)}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {formatDistanceToNow(parseISO(record.createdAt), { addSuffix: true })}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewModelDetails(record)}
                                  data-testid={`button-view-model-${record.modelId}`}
                                  title="View Details"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleToggleComparison(record)}
                                  className={
                                    comparisonModel?.modelId === record.modelId
                                      ? "bg-primary/10"
                                      : ""
                                  }
                                  data-testid={`button-compare-model-${record.modelId}`}
                                  title={
                                    comparisonModel?.modelId === record.modelId
                                      ? "Deselect"
                                      : "Compare"
                                  }
                                >
                                  <GitBranch className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="provenance" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <CardTitle>Provenance Events</CardTitle>
                    <CardDescription>
                      Cryptographically verified audit trail of all ML operations
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Select
                      value={provenanceFilters.type}
                      onValueChange={(v) => updateProvenanceFilter("type", v)}
                    >
                      <SelectTrigger className="w-[140px]" data-testid="select-event-type-filter">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Event Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Events</SelectItem>
                        <SelectItem value="prediction">Predictions</SelectItem>
                        <SelectItem value="alert">Alerts</SelectItem>
                        <SelectItem value="anomaly">Anomalies</SelectItem>
                        <SelectItem value="work_order">Work Orders</SelectItem>
                        <SelectItem value="training">Training</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="modelId" className="sr-only">
                        Model ID
                      </Label>
                      <Input
                        id="modelId"
                        placeholder="Filter by Model ID"
                        value={provenanceFilters.modelId}
                        onChange={(e) => updateProvenanceFilter("modelId", e.target.value)}
                        className="w-[200px]"
                        data-testid="input-model-filter"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <Input
                        type="date"
                        value={provenanceFilters.fromDate}
                        onChange={(e) => updateProvenanceFilter("fromDate", e.target.value)}
                        className="w-[140px]"
                        data-testid="input-provenance-from-date"
                      />
                      <span className="text-muted-foreground">to</span>
                      <Input
                        type="date"
                        value={provenanceFilters.toDate}
                        onChange={(e) => updateProvenanceFilter("toDate", e.target.value)}
                        className="w-[140px]"
                        data-testid="input-provenance-to-date"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingProvenance ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : provenanceEvents.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Events Found</AlertTitle>
                    <AlertDescription>
                      No provenance events recorded yet. Events are created automatically when
                      predictions, alerts, or training operations occur.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <ScrollArea className="h-[500px]">
                    <div className="space-y-4">
                      {provenanceEvents.map((event, index) => {
                        const config =
                          EVENT_TYPE_CONFIG[event.type] || EVENT_TYPE_CONFIG["prediction"];
                        if (!config) {
                          return null;
                        }
                        const Icon = config.icon;
                        return (
                          <div
                            key={`${event.ts}-${index}`}
                            className="flex gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                            data-testid={`row-event-${index}`}
                          >
                            <div className={`mt-1 ${config.color}`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">
                                  {config.label}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {format(parseISO(event.ts), "PPpp")}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                {event.modelId && (
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <Brain className="h-3 w-3" />
                                    <span className="truncate font-mono text-xs">
                                      {event.modelId.substring(0, 12)}
                                    </span>
                                  </div>
                                )}
                                {event.equipmentId && (
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <Database className="h-3 w-3" />
                                    <span className="truncate font-mono text-xs">
                                      {event.equipmentId.substring(0, 12)}
                                    </span>
                                  </div>
                                )}
                                {event.anomalyScore !== undefined && (
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <Activity className="h-3 w-3" />
                                    <span>Score: {(event.anomalyScore * 100).toFixed(1)}%</span>
                                  </div>
                                )}
                                {event.engine && (
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <Cpu className="h-3 w-3" />
                                    <span>{event.engine.toUpperCase()}</span>
                                  </div>
                                )}
                              </div>
                              {event.hash && (
                                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground font-mono">
                                  <Hash className="h-3 w-3" />
                                  <span className="truncate">{event.hash.substring(0, 16)}...</span>
                                  {event.prevHash && (
                                    <>
                                      <Link className="h-3 w-3 ml-2" />
                                      <span className="truncate">
                                        {event.prevHash.substring(0, 16)}...
                                      </span>
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Sheet open={detailDrawerOpen} onOpenChange={setDetailDrawerOpen}>
          <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                {comparisonModel && selectedModel?.modelId !== comparisonModel.modelId
                  ? "Model Comparison"
                  : "Model Details"}
              </SheetTitle>
              <SheetDescription>
                {comparisonModel && selectedModel?.modelId !== comparisonModel.modelId
                  ? "Side-by-side comparison of selected models"
                  : "Full lineage and metadata for the selected model"}
              </SheetDescription>
            </SheetHeader>
            {selectedModel &&
            comparisonModel &&
            selectedModel.modelId !== comparisonModel.modelId ? (
              <ModelComparisonView
                modelA={selectedModel}
                modelB={comparisonModel}
                onClear={handleClearComparison}
              />
            ) : (
              selectedModel && <ModelDetailsView model={selectedModel} />
            )}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}

function ModelComparisonView({
  modelA,
  modelB,
  onClear,
}: {
  modelA: LineageRecord;
  modelB: LineageRecord;
  onClear: () => void;
}) {
  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">Model A</div>
          <div className="font-mono text-sm truncate">{modelA.modelId.substring(0, 16)}...</div>
          <Badge className={`${FAMILY_COLORS[modelA.family]} mt-2`}>
            {modelA.family.toUpperCase()}
          </Badge>
        </div>
        <div className="p-3 bg-muted/50 rounded-lg">
          <div className="text-xs text-muted-foreground mb-1">Model B</div>
          <div className="font-mono text-sm truncate">{modelB.modelId.substring(0, 16)}...</div>
          <Badge className={`${FAMILY_COLORS[modelB.family]} mt-2`}>
            {modelB.family.toUpperCase()}
          </Badge>
        </div>
      </div>
      <Separator />
      <div>
        <Label className="text-sm font-medium">Metrics Comparison</Label>
        <div className="mt-2 space-y-2">
          {Object.keys({ ...modelA.metrics, ...modelB.metrics }).map((key) => {
            const valA = modelA.metrics[key] ?? 0;
            const valB = modelB.metrics[key] ?? 0;
            const diff = typeof valA === "number" && typeof valB === "number" ? valA - valB : 0;
            return (
              <div key={key} className="flex items-center justify-between p-2 bg-muted rounded">
                <span className="text-sm capitalize">{key.replaceAll("_", " ")}</span>
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-mono">
                    {typeof valA === "number" ? valA.toFixed(4) : valA}
                  </span>
                  <span className="text-muted-foreground">vs</span>
                  <span className="font-mono">
                    {typeof valB === "number" ? valB.toFixed(4) : valB}
                  </span>
                  {diff !== 0 && (
                    <Badge variant={diff > 0 ? "default" : "destructive"} className="ml-2">
                      {diff > 0 ? "+" : ""}
                      {diff.toFixed(4)}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <Separator />
      <div>
        <Label className="text-sm font-medium">Stage Comparison</Label>
        <div className="mt-2 grid grid-cols-2 gap-4">
          <div className="p-3 bg-muted rounded text-center">
            <Badge className={STAGE_COLORS[modelA.promotion.stage]}>{modelA.promotion.stage}</Badge>
            <div className="text-xs text-muted-foreground mt-2">
              {formatNumber(modelA.predictionCount)} predictions
            </div>
          </div>
          <div className="p-3 bg-muted rounded text-center">
            <Badge className={STAGE_COLORS[modelB.promotion.stage]}>{modelB.promotion.stage}</Badge>
            <div className="text-xs text-muted-foreground mt-2">
              {formatNumber(modelB.predictionCount)} predictions
            </div>
          </div>
        </div>
      </div>
      <Separator />
      <div>
        <Label className="text-sm font-medium">Training Date Comparison</Label>
        <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
          <div className="p-2 bg-muted rounded">
            <Calendar className="h-4 w-4 inline mr-2 text-muted-foreground" />
            {format(parseISO(modelA.createdAt), "PPP")}
          </div>
          <div className="p-2 bg-muted rounded">
            <Calendar className="h-4 w-4 inline mr-2 text-muted-foreground" />
            {format(parseISO(modelB.createdAt), "PPP")}
          </div>
        </div>
      </div>
      <div className="mt-4">
        <Button variant="outline" size="sm" onClick={onClear} data-testid="button-clear-comparison">
          Clear Comparison
        </Button>
      </div>
    </div>
  );
}

function ModelDetailsView({ model }: { model: LineageRecord }) {
  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs text-muted-foreground">Model ID</Label>
          <p className="font-mono text-sm">{model.modelId}</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Version</Label>
          <p className="font-semibold">v{model.version}</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Family</Label>
          <Badge className={FAMILY_COLORS[model.family]}>{model.family.toUpperCase()}</Badge>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Stage</Label>
          <Badge className={STAGE_COLORS[model.promotion.stage]}>{model.promotion.stage}</Badge>
        </div>
      </div>
      <Separator />
      <div>
        <Label className="text-sm font-medium">Training Info</Label>
        <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            <span>{model.trainedBy}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{format(parseISO(model.createdAt), "PPP")}</span>
          </div>
        </div>
      </div>
      <Separator />
      <div>
        <Label className="text-sm font-medium">Performance Metrics</Label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {Object.entries(model.metrics).map(([key, value]) => (
            <div key={key} className="flex justify-between p-2 bg-muted rounded">
              <span className="text-sm capitalize">{key.replaceAll("_", " ")}</span>
              <span className="font-mono text-sm">
                {typeof value === "number" ? value.toFixed(4) : value}
              </span>
            </div>
          ))}
        </div>
      </div>
      <Separator />
      <div>
        <Label className="text-sm font-medium">Hyperparameters</Label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {Object.entries(model.hyperparams).map(([key, value]) => (
            <div key={key} className="flex justify-between p-2 bg-muted rounded text-sm">
              <span className="capitalize">{key.replaceAll("_", " ")}</span>
              <span className="font-mono">{String(value)}</span>
            </div>
          ))}
        </div>
      </div>
      <Separator />
      <div>
        <Label className="text-sm font-medium">Dataset Mix</Label>
        <div className="mt-2 space-y-2">
          {model.datasetMix.map((ds, i) => (
            <div key={i} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-muted-foreground" />
                <span>{ds.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{(ds.weight * 100).toFixed(0)}%</span>
                {ds.rowCount && (
                  <span className="text-xs text-muted-foreground">
                    ({formatNumber(ds.rowCount)} rows)
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Separator />
      <div>
        <Label className="text-sm font-medium">Artifacts</Label>
        <div className="mt-2 space-y-2 text-sm">
          <div className="p-2 bg-muted rounded">
            <div className="text-muted-foreground text-xs">Checkpoint</div>
            <div className="font-mono truncate">{model.artifacts.checkpointPath}</div>
            <div className="font-mono text-xs text-muted-foreground mt-1 truncate">
              SHA-256: {model.artifacts.checkpointHash}
            </div>
          </div>
          {model.artifacts.thresholdsPath && (
            <div className="p-2 bg-muted rounded">
              <div className="text-muted-foreground text-xs">Thresholds</div>
              <div className="font-mono truncate">{model.artifacts.thresholdsPath}</div>
              {model.artifacts.thresholdsHash && (
                <div className="font-mono text-xs text-muted-foreground mt-1 truncate">
                  SHA-256: {model.artifacts.thresholdsHash}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <Separator />
      <div>
        <Label className="text-sm font-medium">Statistics</Label>
        <div className="mt-2 grid grid-cols-2 gap-4">
          <div className="p-3 bg-muted rounded text-center">
            <div className="text-2xl font-bold">{formatNumber(model.predictionCount)}</div>
            <div className="text-xs text-muted-foreground">Total Predictions</div>
          </div>
          {model.promotion.promotedAt && (
            <div className="p-3 bg-muted rounded text-center">
              <div className="text-sm font-medium">
                {formatDistanceToNow(parseISO(model.promotion.promotedAt), { addSuffix: true })}
              </div>
              <div className="text-xs text-muted-foreground">Last Promoted</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
