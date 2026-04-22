/**
 * Performance Tab
 * 
 * Model performance metrics, drift detection, equipment accuracy, 
 * feature importance, and SHAP explainability.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Activity, Target, TrendingUp, AlertTriangle, CheckCircle2, RefreshCw, Ship, Waves, ChevronDown, Brain, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { getFriendlyModelName } from "@/lib/ml-terminology";
import { useModelPerformanceData } from "@/features/ml-ai";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import { ExplainabilityVisualization } from "@/components/ml/ExplainabilityVisualization";

export default function PerformanceTab() {
  const m = useModelPerformanceData();
  const [expandedSections, setExpandedSections] = useState({
    drift: true,
    equipment: false,
    features: false,
    explainability: false,
    marine: false,
    validations: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const AccuracyBadge = ({ accuracy }: { accuracy: number | null }) => {
    const d = m.getAccuracyBadgeData(accuracy);
    if (d.isPending) {
      return <Badge variant="secondary" data-testid="badge-pending">Pending</Badge>;
    }
    return (
      <Badge className={d.className} data-testid={`badge-${d.label.toLowerCase().replace(" ", "-")}`} title={d.description}>
        {d.label} ({d.percent.toFixed(1)}%)
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-3 overflow-x-auto pb-2">
        <Card className="flex-1 min-w-[200px] p-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-500" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                Active AI Models
                <InfoTooltip content="Number of different AI models currently making predictions for your equipment." />
              </p>
              {m.summaryLoading ? <Skeleton className="h-7 w-16" /> : <p className="text-2xl font-bold" data-testid="stat-active-models">{m.overallMetrics?.totalModels || 0}</p>}
            </div>
          </div>
        </Card>
        <Card className="flex-1 min-w-[200px] p-4">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-500" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Total Predictions</p>
              {m.summaryLoading ? <Skeleton className="h-7 w-16" /> : <p className="text-2xl font-bold" data-testid="stat-total-predictions">{m.overallMetrics?.totalPredictions || 0}</p>}
            </div>
          </div>
        </Card>
        <Card className="flex-1 min-w-[200px] p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                Validated
                <InfoTooltip content="Predictions that have been checked against actual equipment failures to measure accuracy." />
              </p>
              {m.summaryLoading ? <Skeleton className="h-7 w-16" /> : (
                <p className="text-2xl font-bold" data-testid="stat-validated">
                  {m.overallMetrics?.totalValidated || 0}
                  <span className="text-sm text-muted-foreground ml-1">({m.validationRate.toFixed(0)}%)</span>
                </p>
              )}
            </div>
          </div>
        </Card>
        <Card className="flex-1 min-w-[200px] p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-orange-500" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                Avg Accuracy
                <InfoTooltip content="How often the AI predictions are correct. 90%+ is excellent, 80%+ is good." />
              </p>
              {m.summaryLoading ? <Skeleton className="h-7 w-16" /> : <p className="text-2xl font-bold" data-testid="stat-avg-accuracy">{m.overallAvgAccuracy.toFixed(1)}%</p>}
            </div>
          </div>
        </Card>
      </div>

      {m.criticalDrift.length > 0 && (
        <Alert variant="destructive" data-testid="alert-drift">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Model Accuracy Declining</AlertTitle>
          <AlertDescription>
            <strong>{m.criticalDrift.length} model{m.criticalDrift.length > 1 ? "s have" : " has"}</strong> accuracy drops of {Math.abs(m.criticalDrift[0].driftPercent).toFixed(1)}%+.
            <div className="mt-3 space-y-2">
              <div className="font-semibold">Recommended Actions:</div>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Schedule model retraining this week with recent data</li>
                <li>Review if new equipment or maintenance procedures were introduced</li>
              </ul>
              <Button size="sm" className="mt-2" data-testid="button-schedule-retraining">
                <RefreshCw className="h-3 w-3 mr-1" />Schedule Retraining
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base" data-testid="heading-model-summary">Model Performance Summary</CardTitle>
          <CardDescription>Accuracy metrics by model</CardDescription>
        </CardHeader>
        <CardContent>
          {m.summaryLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : m.summary && m.summary.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Predictions</TableHead>
                    <TableHead className="text-right">Validated</TableHead>
                    <TableHead className="text-right">Accuracy</TableHead>
                    <TableHead>Last Validation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {m.summary.map((model, index) => (
                    <TableRow key={model.modelId} data-testid={`row-model-${index}`}>
                      <TableCell className="font-medium">{model.modelName || model.modelId}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getFriendlyModelName(model.modelType)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{model.totalPredictions}</TableCell>
                      <TableCell className="text-right">{model.validatedPredictions}</TableCell>
                      <TableCell className="text-right">
                        <AccuracyBadge accuracy={model.avgAccuracy} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {model.lastValidation ? formatDistanceToNow(new Date(model.lastValidation), { addSuffix: true }) : "Never"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">No model performance data available</p>
          )}
        </CardContent>
      </Card>

      {m.modelDriftData.length > 0 && m.modelDriftData.some((md) => md.severity !== "none") && (
        <Collapsible open={expandedSections.drift} onOpenChange={() => toggleSection("drift")}>
          <Card className="border-amber-500">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer bg-amber-500/10">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    Accuracy Declining Over Time
                  </CardTitle>
                  <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.drift ? "rotate-180" : ""}`} />
                </div>
                <CardDescription>These models are getting less accurate and may need retraining</CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-4 space-y-3">
                {m.modelDriftData.filter((md) => md.severity !== "none").map((drift, idx) => (
                  <div
                    key={drift.modelId}
                    className={`p-3 border rounded-lg ${drift.severity === "severe" ? "bg-red-500/10 border-red-500" : drift.severity === "moderate" ? "bg-amber-500/10 border-amber-500" : "bg-blue-500/10 border-blue-500"}`}
                    data-testid={`drift-alert-${idx}`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold">{drift.modelName}</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Accuracy dropped from {(drift.baselineAccuracy * 100).toFixed(1)}% to {(drift.recentAccuracy * 100).toFixed(1)}% ({drift.driftPercent.toFixed(1)}% change)
                        </p>
                      </div>
                      <Badge className={drift.severity === "severe" ? "bg-red-600" : drift.severity === "moderate" ? "bg-amber-600" : "bg-blue-600"}>
                        {drift.severity}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {m.equipmentTypeAccuracy && m.equipmentTypeAccuracy.length > 0 && (
        <Collapsible open={expandedSections.equipment} onOpenChange={() => toggleSection("equipment")}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-1">
                    Accuracy by Equipment Type
                    <InfoTooltip content="Compare how well the AI predicts failures for different equipment types." />
                  </CardTitle>
                  <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.equipment ? "rotate-180" : ""}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Equipment Type</TableHead>
                        <TableHead className="text-right">Count</TableHead>
                        <TableHead className="text-right">Predictions</TableHead>
                        <TableHead className="text-right">Accuracy</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {m.equipmentTypeAccuracy.map((item, idx) => (
                        <TableRow key={item.equipmentType} data-testid={`row-eq-type-${idx}`}>
                          <TableCell><Badge variant="outline">{item.equipmentType}</Badge></TableCell>
                          <TableCell className="text-right">{item.equipmentCount}</TableCell>
                          <TableCell className="text-right">{item.totalPredictions}</TableCell>
                          <TableCell className="text-right">
                            {item.avgAccuracy ? <AccuracyBadge accuracy={item.avgAccuracy} /> : <Badge variant="secondary">N/A</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {m.featureTrends && m.featureTrends.length > 0 && (
        <Collapsible open={expandedSections.features} onOpenChange={() => toggleSection("features")}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-1">
                    Which Sensors Matter Most
                    <InfoTooltip content="Feature Importance shows which sensor readings have the biggest impact on AI predictions." />
                  </CardTitle>
                  <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.features ? "rotate-180" : ""}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Feature</TableHead>
                        <TableHead className="text-right">Importance</TableHead>
                        <TableHead className="text-right">Predictions</TableHead>
                        <TableHead className="text-right">Trend</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {m.featureTrends.map((feature, idx) => (
                        <TableRow key={feature.featureName} data-testid={`row-feature-${idx}`}>
                          <TableCell className="font-medium">{feature.featureName}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-purple-500" style={{ width: `${Math.min(100, feature.avgImportance * 100)}%` }} />
                              </div>
                              <span className="text-sm">{feature.avgImportance.toFixed(3)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{feature.count}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={feature.trend === "increasing" ? "default" : feature.trend === "decreasing" ? "secondary" : "outline"}>
                              {feature.trend}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      <Collapsible open={expandedSections.explainability} onOpenChange={() => toggleSection("explainability")}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  ML Explainability (SHAP)
                </CardTitle>
                <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.explainability ? "rotate-180" : ""}`} />
              </div>
              <CardDescription>Understand why the AI made specific predictions</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <ExplainabilitySection />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={expandedSections.marine} onOpenChange={() => toggleSection("marine")}>
        <Card className="border-blue-500">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer bg-blue-500/10">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Ship className="w-5 h-5 text-blue-600" />
                  Marine Equipment Intelligence
                </CardTitle>
                <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.marine ? "rotate-180" : ""}`} />
              </div>
              <CardDescription>Insights specific to marine fleet operations</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-4 space-y-4">
              <Alert className="bg-cyan-50 dark:bg-cyan-950 border-cyan-200 dark:border-cyan-800">
                <Waves className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                <AlertTitle className="text-cyan-900 dark:text-cyan-100">Weather-Aware Threshold Adjustments</AlertTitle>
                <AlertDescription className="text-cyan-800 dark:text-cyan-200">
                  <p className="mb-2">ARUS automatically adjusts prediction thresholds based on sea conditions.</p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li><strong>30-40% fewer false alarms</strong> during rough weather</li>
                    <li>Crew isn't distracted by non-critical alerts</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 border rounded-lg bg-muted/30">
                  <h3 className="text-sm font-semibold mb-2">Oil Analysis Integration</h3>
                  <p className="text-xs text-muted-foreground">When wear particles exceed thresholds, ARUS raises prediction priority for related components.</p>
                </div>
                <div className="p-3 border rounded-lg bg-muted/30">
                  <h3 className="text-sm font-semibold mb-2">STCW Hours of Rest Aware</h3>
                  <p className="text-xs text-muted-foreground">Maintenance recommendations respect crew availability and STCW compliance.</p>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible open={expandedSections.validations} onOpenChange={() => toggleSection("validations")}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Recent Validations</CardTitle>
                <ChevronDown className={`h-4 w-4 transition-transform ${expandedSections.validations ? "rotate-180" : ""}`} />
              </div>
              <CardDescription>Latest prediction validation results</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              {m.validationsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : m.validations && m.validations.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Equipment</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Accuracy</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {m.validations.slice(0, 10).map((item, index) => (
                        <TableRow key={item.validation.id} data-testid={`row-validation-${index}`}>
                          <TableCell className="font-medium">{item.equipmentName || item.validation.equipmentId}</TableCell>
                          <TableCell className="text-sm">{item.modelName || "Unknown"}</TableCell>
                          <TableCell><Badge variant="outline">{item.validation.predictionType}</Badge></TableCell>
                          <TableCell><AccuracyBadge accuracy={item.validation.accuracyScore} /></TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.validation.validatedAt ? formatDistanceToNow(new Date(item.validation.validatedAt), { addSuffix: true }) : "Pending"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">No validation data available</p>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}

function ExplainabilitySection() {
  const [selectedPredictionId, setSelectedPredictionId] = useState<number | null>(null);
  const [filterEquipment, setFilterEquipment] = useState<string>("all");

  interface RealtimePrediction {
    id: number;
    equipmentId: string;
    equipmentName: string;
    modelId: string;
    predictionType: string;
    predictionValue: number;
    confidence: number;
    predictionTimestamp: Date;
    hasExplanation: boolean;
    explanationId: number | null;
  }

  const { data: predictions, isLoading: predictionsLoading } = useQuery<RealtimePrediction[]>({
    queryKey: ["/api/ml/realtime-predictions", { equipmentId: filterEquipment === "all" ? undefined : filterEquipment }],
  });

  const { data: explanation, isLoading: explanationLoading } = useQuery({
    queryKey: selectedPredictionId ? [`/api/ml/explainability/predictions/${selectedPredictionId}`, { type: "real_time" }] : [],
    enabled: !!selectedPredictionId,
  });

  const equipmentOptions = predictions ? Array.from(new Set(predictions.map((p) => p.equipmentId))) : [];
  const filteredPredictions = predictions?.filter((p) => filterEquipment === "all" || p.equipmentId === filterEquipment);

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.85) {return <Badge className="bg-green-500">Very Confident</Badge>;}
    if (confidence >= 0.7) {return <Badge className="bg-blue-500">Confident</Badge>;}
    if (confidence >= 0.5) {return <Badge className="bg-yellow-500">Moderate</Badge>;}
    return <Badge variant="destructive">Low Confidence</Badge>;
  };

  if (predictionsLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  if (!predictions || predictions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>No predictions available for explainability analysis</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="min-w-[200px] space-y-1">
          <Label className="text-xs font-medium">Filter by Equipment</Label>
          <Select value={filterEquipment} onValueChange={setFilterEquipment}>
            <SelectTrigger data-testid="select-filter-equipment">
              <SelectValue placeholder="All equipment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Equipment</SelectItem>
              {equipmentOptions.map((eq) => (
                <SelectItem key={eq} value={eq}>{eq}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2 max-h-64 overflow-y-auto">
          <p className="text-sm font-medium">Select a prediction to explain:</p>
          {filteredPredictions?.slice(0, 10).map((pred) => (
            <div
              key={pred.id}
              className={`p-3 border rounded-lg cursor-pointer transition-colors ${selectedPredictionId === pred.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
              onClick={() => setSelectedPredictionId(pred.id)}
              data-testid={`prediction-item-${pred.id}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{pred.equipmentName || pred.equipmentId}</span>
                {getConfidenceBadge(pred.confidence)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{pred.predictionType}</p>
            </div>
          ))}
        </div>

        <div>
          {selectedPredictionId ? (
            explanationLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : explanation ? (
              <ExplainabilityVisualization explanation={explanation} />
            ) : (
              <div className="text-center py-8 text-muted-foreground border rounded-lg">
                <p>No explanation data available for this prediction</p>
              </div>
            )
          ) : (
            <div className="text-center py-8 text-muted-foreground border rounded-lg">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Select a prediction to see why the AI made that decision</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
