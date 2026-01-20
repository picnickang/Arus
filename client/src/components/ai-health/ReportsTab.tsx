/**
 * Reports Tab
 * 
 * AI-generated reports with multi-model support.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FileText, Zap, Loader2, Sparkles, ChevronDown, CheckCircle2, TrendingUp, AlertTriangle, BarChart3 } from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { ReportSummaryCards } from "@/components/ReportSummaryCards";
import { type ReportType, type AudienceType, type ModelType, useAiInsightsData } from "@/features/ml-ai";
import { formatNumber, formatDate } from "@/lib/formatters";

export default function ReportsTab() {
  const { 
    reportType, setReportType, 
    audience, setAudience, 
    selectedModel, setSelectedModel, 
    selectedVessel, setSelectedVessel, 
    generatedReport, 
    isGenerating, 
    openSections, setOpenSections,
    vessels, models, audiences, 
    generateReport 
  } = useAiInsightsData();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <CardTitle className="text-base">Generate AI Report</CardTitle>
            </div>
            <Badge variant="outline" className="text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              Multi-Model AI
            </Badge>
          </div>
          <CardDescription>Create comprehensive reports using AI analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px] space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1">
                Report Type
                <InfoTooltip content="Health: Equipment condition | Fleet: All vessels overview | Maintenance: Upcoming repairs | Compliance: Regulatory status" />
              </Label>
              <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
                <SelectTrigger className="h-9" data-testid="select-report-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="health">Health Report</SelectItem>
                  <SelectItem value="fleet">Fleet Summary</SelectItem>
                  <SelectItem value="maintenance">Maintenance Report</SelectItem>
                  <SelectItem value="compliance">Compliance Report</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[180px] space-y-1.5">
              <Label className="text-xs font-medium">Vessel</Label>
              <Select value={selectedVessel} onValueChange={setSelectedVessel}>
                <SelectTrigger className="h-9" data-testid="select-vessel">
                  <SelectValue placeholder="Select vessel" />
                </SelectTrigger>
                <SelectContent>
                  {vessels.filter((v) => v.id).map((vessel) => (
                    <SelectItem key={vessel.id} value={vessel.id}>{vessel.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[160px] space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1">
                Audience
                <InfoTooltip content="Executive: High-level summary | Technical: Engineering details | Maintenance: Action-focused | Compliance: Regulatory focus" />
              </Label>
              <Select value={audience} onValueChange={(v) => setAudience(v as AudienceType)}>
                <SelectTrigger className="h-9" data-testid="select-audience">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {audiences.map((aud) => (
                    <SelectItem key={aud.id} value={aud.id}>{aud.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[140px] space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1">
                AI Model
                <InfoTooltip content="GPT-4o: Balanced speed & quality | Claude: Detailed analysis | O1: Advanced reasoning" />
              </Label>
              <Select value={selectedModel} onValueChange={(v) => setSelectedModel(v as ModelType)}>
                <SelectTrigger className="h-9" data-testid="select-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.recommended && <Sparkles className="h-3 w-3 mr-1 inline text-yellow-500" />}
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={generateReport} disabled={isGenerating || (reportType !== "fleet" && !selectedVessel)} className="h-9" data-testid="button-generate-report">
              {isGenerating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</>
              ) : (
                <><Zap className="mr-2 h-4 w-4" />Generate</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">AI-Generated Report</CardTitle>
          <CardDescription className="text-xs">
            {generatedReport ? `Generated ${formatDate(generatedReport.timestamp)}` : "Configure and generate a report"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!generatedReport ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-16 w-16 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No report generated yet</p>
              <p className="text-sm text-muted-foreground mt-1">Configure parameters and click "Generate"</p>
            </div>
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="space-y-6 pr-4">
                <ReportSummaryCards content={generatedReport.content} reportType={generatedReport.reportType} audience={generatedReport.audience} />

                <Separator className="my-6" />
                <div className="text-sm text-muted-foreground text-center py-2">Expand sections below for detailed analysis</div>

                <Collapsible open={openSections.analysis} onOpenChange={(open) => setOpenSections((prev) => ({ ...prev, analysis: open }))}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-70 transition-opacity">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      AI Analysis
                    </h3>
                    <ChevronDown className={`h-4 w-4 transition-transform ${openSections.analysis ? "rotate-180" : ""}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="text-sm text-muted-foreground whitespace-pre-wrap">{generatedReport.content.analysis}</div>
                  </CollapsibleContent>
                </Collapsible>

                {generatedReport.content.scenarios && generatedReport.content.scenarios.length > 0 && (
                  <Collapsible open={openSections.scenarios} onOpenChange={(open) => setOpenSections((prev) => ({ ...prev, scenarios: open }))}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-70 transition-opacity mb-3">
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Scenario Analysis ({generatedReport.content.scenarios.length})
                        <InfoTooltip content="Possible future outcomes based on current equipment data and trends." />
                      </h3>
                      <ChevronDown className={`h-4 w-4 transition-transform ${openSections.scenarios ? "rotate-180" : ""}`} />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-4">
                        {generatedReport.content.scenarios.map((scenario, idx) => (
                          <Card key={`scenario-${idx}`} className="border-l-4" style={{ borderLeftColor: scenario.impact === "critical" ? "#ef4444" : scenario.impact === "high" ? "#f97316" : scenario.impact === "medium" ? "#eab308" : "#3b82f6" }}>
                            <CardContent className="pt-4">
                              <div className="flex items-start gap-2 mb-2">
                                <Badge variant="outline" className="text-xs">{scenario.impact.toUpperCase()}</Badge>
                                <Badge variant="secondary" className="text-xs">{Math.round(scenario.probability * 100)}% probability</Badge>
                              </div>
                              <p className="font-medium mb-2 text-sm">{scenario.scenario}</p>
                              {scenario.recommendations.length > 0 && (
                                <ul className="space-y-1 mt-2">
                                  {scenario.recommendations.map((rec, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                      <CheckCircle2 className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                                      <span className="text-xs text-muted-foreground">{rec}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {generatedReport.content.roi && (
                  <Collapsible open={openSections.roi} onOpenChange={(open) => setOpenSections((prev) => ({ ...prev, roi: open }))}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-70 transition-opacity mb-3">
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        ROI Analysis
                        <InfoTooltip content="Return on Investment: Expected cost savings from recommended actions." />
                      </h3>
                      <ChevronDown className={`h-4 w-4 transition-transform ${openSections.roi ? "rotate-180" : ""}`} />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="grid grid-cols-2 gap-4">
                        <Card>
                          <CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground mb-1">Estimated Savings</p>
                            <p className="text-xl font-bold text-green-600 dark:text-green-400">${formatNumber(generatedReport.content.roi.estimatedSavings)}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground mb-1">Investment Required</p>
                            <p className="text-xl font-bold">${formatNumber(generatedReport.content.roi.investmentRequired)}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground mb-1">Payback Period</p>
                            <p className="text-xl font-bold">{generatedReport.content.roi.paybackPeriod} months</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="pt-4">
                            <p className="text-xs text-muted-foreground mb-1">Risk Reduction</p>
                            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{Math.round(generatedReport.content.roi.riskReduction * 100)}%</p>
                          </CardContent>
                        </Card>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {generatedReport.content.citations && generatedReport.content.citations.length > 0 && (
                  <Collapsible open={openSections.citations} onOpenChange={(open) => setOpenSections((prev) => ({ ...prev, citations: open }))}>
                    <CollapsibleTrigger className="flex items-center justify-between w-full hover:opacity-70 transition-opacity mb-3">
                      <h3 className="font-semibold text-sm flex items-center gap-2">
                        Sources & Citations ({generatedReport.content.citations.length})
                        <InfoTooltip content="Data sources used to generate this report." />
                      </h3>
                      <ChevronDown className={`h-4 w-4 transition-transform ${openSections.citations ? "rotate-180" : ""}`} />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-2">
                        {generatedReport.content.citations.map((citation, idx) => (
                          <Card key={`citation-${idx}`}>
                            <CardContent className="pt-3 pb-3">
                              <div className="flex items-start gap-2">
                                <Badge variant="outline" className="text-xs">{Math.round(citation.relevance * 100)}%</Badge>
                                <div className="flex-1">
                                  <p className="font-medium text-xs mb-1">{citation.source}</p>
                                  <p className="text-xs text-muted-foreground">{citation.snippet}</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
