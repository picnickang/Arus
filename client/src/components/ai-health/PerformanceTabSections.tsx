import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, ChevronDown, Ship, Waves } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { AccuracyBadge } from "./PerformanceTabSummary";
import type { ExpandedPerformanceSections, PerformanceTabModel } from "./PerformanceTabTypes";

interface PerformanceSectionsProps {
  m: PerformanceTabModel;
  expandedSections: ExpandedPerformanceSections;
  toggleSection: (section: keyof ExpandedPerformanceSections) => void;
}

export function PerformanceDiagnosticSections({
  m,
  expandedSections,
  toggleSection,
}: PerformanceSectionsProps) {
  return (
    <>
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
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${expandedSections.drift ? "rotate-180" : ""}`}
                  />
                </div>
                <CardDescription>
                  These models are getting less accurate and may need retraining
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-4 space-y-3">
                {m.modelDriftData
                  .filter((md) => md.severity !== "none")
                  .map((drift, idx) => (
                    <div
                      key={drift.modelId}
                      className={`p-3 border rounded-lg ${drift.severity === "severe" ? "bg-red-500/10 border-red-500" : drift.severity === "moderate" ? "bg-amber-500/10 border-amber-500" : "bg-blue-500/10 border-blue-500"}`}
                      data-testid={`drift-alert-${idx}`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{drift.modelName}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            Accuracy dropped from {(drift.baselineAccuracy * 100).toFixed(1)}% to{" "}
                            {(drift.recentAccuracy * 100).toFixed(1)}% (
                            {drift.driftPercent.toFixed(1)}% change)
                          </p>
                        </div>
                        <Badge
                          className={
                            drift.severity === "severe"
                              ? "bg-red-600"
                              : drift.severity === "moderate"
                                ? "bg-amber-600"
                                : "bg-blue-600"
                          }
                        >
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
        <Collapsible
          open={expandedSections.equipment}
          onOpenChange={() => toggleSection("equipment")}
        >
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-1">
                    Accuracy by Equipment Type
                    <InfoTooltip content="Compare how well the AI predicts failures for different equipment types." />
                  </CardTitle>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${expandedSections.equipment ? "rotate-180" : ""}`}
                  />
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
                          <TableCell>
                            <Badge variant="outline">{item.equipmentType}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{item.equipmentCount}</TableCell>
                          <TableCell className="text-right">{item.totalPredictions}</TableCell>
                          <TableCell className="text-right">
                            {item.avgAccuracy ? (
                              <AccuracyBadge accuracy={item.avgAccuracy} m={m} />
                            ) : (
                              <Badge variant="secondary">N/A</Badge>
                            )}
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
        <Collapsible
          open={expandedSections.features}
          onOpenChange={() => toggleSection("features")}
        >
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-1">
                    Which Sensors Matter Most
                    <InfoTooltip content="Feature Importance shows which sensor readings have the biggest impact on AI predictions." />
                  </CardTitle>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${expandedSections.features ? "rotate-180" : ""}`}
                  />
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
                                <div
                                  className="h-full bg-purple-500"
                                  style={{
                                    width: `${Math.min(100, feature.avgImportance * 100)}%`,
                                  }}
                                />
                              </div>
                              <span className="text-sm">{feature.avgImportance.toFixed(3)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {feature.count}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge
                              variant={
                                feature.trend === "increasing"
                                  ? "default"
                                  : feature.trend === "decreasing"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
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
    </>
  );
}

export function MarineAndValidationSections({
  m,
  expandedSections,
  toggleSection,
}: PerformanceSectionsProps) {
  return (
    <>
      <Collapsible open={expandedSections.marine} onOpenChange={() => toggleSection("marine")}>
        <Card className="border-blue-500">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer bg-blue-500/10">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Ship className="w-5 h-5 text-blue-600" />
                  Marine Equipment Intelligence
                </CardTitle>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${expandedSections.marine ? "rotate-180" : ""}`}
                />
              </div>
              <CardDescription>Insights specific to marine fleet operations</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-4 space-y-4">
              <Alert className="bg-cyan-50 dark:bg-cyan-950 border-cyan-200 dark:border-cyan-800">
                <Waves className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                <AlertTitle className="text-cyan-900 dark:text-cyan-100">
                  Weather-Aware Threshold Adjustments
                </AlertTitle>
                <AlertDescription className="text-cyan-800 dark:text-cyan-200">
                  <p className="mb-2">
                    ARUS automatically adjusts prediction thresholds based on sea conditions.
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>
                      <strong>30-40% fewer false alarms</strong> during rough weather
                    </li>
                    <li>Crew isn't distracted by non-critical alerts</li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 border rounded-lg bg-muted/30">
                  <h3 className="text-sm font-semibold mb-2">Oil Analysis Integration</h3>
                  <p className="text-xs text-muted-foreground">
                    When wear particles exceed thresholds, ARUS raises prediction priority for
                    related components.
                  </p>
                </div>
                <div className="p-3 border rounded-lg bg-muted/30">
                  <h3 className="text-sm font-semibold mb-2">STCW Hours of Rest Aware</h3>
                  <p className="text-xs text-muted-foreground">
                    Maintenance recommendations respect crew availability and STCW compliance.
                  </p>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible
        open={expandedSections.validations}
        onOpenChange={() => toggleSection("validations")}
      >
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Recent Validations</CardTitle>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${expandedSections.validations ? "rotate-180" : ""}`}
                />
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
                          <TableCell className="font-medium">
                            {item.equipmentName || item.validation.equipmentId}
                          </TableCell>
                          <TableCell className="text-sm">{item.modelName || "Unknown"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{item.validation.predictionType}</Badge>
                          </TableCell>
                          <TableCell>
                            <AccuracyBadge accuracy={item.validation.accuracyScore} m={m} />
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.validation.validatedAt
                              ? formatDistanceToNow(new Date(item.validation.validatedAt), {
                                  addSuffix: true,
                                })
                              : "Pending"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  No validation data available
                </p>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </>
  );
}
