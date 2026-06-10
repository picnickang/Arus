/**
 * Insights Tab
 *
 * Vessel intelligence, feedback loop, and prediction feedback.
 */

import { apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Brain,
  Loader2,
  ChevronDown,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { useFeedbackLoopData } from "@/features/analytics";

export default function InsightsTab() {
  const [expandedSections, setExpandedSections] = useState({
    vesselIntelligence: true,
    feedbackLoop: true,
    predictionFeedback: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="space-y-6">
      <Collapsible
        open={expandedSections.vesselIntelligence}
        onOpenChange={() => toggleSection("vesselIntelligence")}
      >
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  Vessel Intelligence
                </CardTitle>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${expandedSections.vesselIntelligence ? "rotate-180" : ""}`}
                />
              </div>
              <CardDescription>AI-powered pattern analysis for each vessel</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <VesselIntelligenceSection />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible
        open={expandedSections.feedbackLoop}
        onOpenChange={() => toggleSection("feedbackLoop")}
      >
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Feedback Loop Intelligence
                </CardTitle>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${expandedSections.feedbackLoop ? "rotate-180" : ""}`}
                />
              </div>
              <CardDescription>How operator feedback improves AI accuracy</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <FeedbackLoopSection />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <Collapsible
        open={expandedSections.predictionFeedback}
        onOpenChange={() => toggleSection("predictionFeedback")}
      >
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Prediction Feedback
                </CardTitle>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${expandedSections.predictionFeedback ? "rotate-180" : ""}`}
                />
              </div>
              <CardDescription>Operator ratings and corrections for predictions</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <PredictionFeedbackSection />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}

interface VesselIntelligenceInsight {
  severity: string;
  title: string;
  description: string;
}

interface VesselIntelligencePattern {
  description: string;
}

interface VesselIntelligenceData {
  healthScore?: number;
  activeAlerts?: number;
  totalPredictions?: number;
  riskLevel?: string;
  insights?: VesselIntelligenceInsight[];
  patterns?: VesselIntelligencePattern[];
}

function VesselIntelligenceSection() {
  const [selectedVessel, setSelectedVessel] = useState<string>("");
  const [vesselIntelligence, setVesselIntelligence] = useState<VesselIntelligenceData | null>(
    null
  );
  const [isLoadingIntelligence, setIsLoadingIntelligence] = useState(false);

  const { data: vessels = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ["/api/vessels"],
  });

  const loadVesselIntelligence = async () => {
    if (!selectedVessel) {
      return;
    }
    setIsLoadingIntelligence(true);
    try {
      const data = await apiRequest("GET", `/api/analytics/vessel-intelligence/${selectedVessel}`);
      setVesselIntelligence(data as Parameters<typeof setVesselIntelligence>[0]);
    } catch {
      console.error("Failed to load vessel intelligence");
    } finally {
      setIsLoadingIntelligence(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "text-red-500";
      case "high":
        return "text-orange-500";
      case "medium":
        return "text-yellow-500";
      default:
        return "text-blue-500";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="min-w-[200px] space-y-1">
          <Label className="text-xs font-medium">Select Vessel</Label>
          <Select value={selectedVessel} onValueChange={setSelectedVessel}>
            <SelectTrigger data-testid="select-vessel-intelligence">
              <SelectValue placeholder="Select vessel" />
            </SelectTrigger>
            <SelectContent>
              {vessels.map((vessel) => (
                <SelectItem key={vessel.id} value={vessel.id}>
                  {vessel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={loadVesselIntelligence}
          disabled={isLoadingIntelligence || !selectedVessel}
          data-testid="button-load-intelligence"
        >
          {isLoadingIntelligence ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Brain className="mr-2 h-4 w-4" />
              Analyze Vessel
            </>
          )}
        </Button>
      </div>

      {!vesselIntelligence ? (
        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
          <Brain className="h-12 w-12 mb-4 opacity-50" />
          <p>Select a vessel and click "Analyze Vessel" to see AI insights</p>
        </div>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-4 pr-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Health Score</p>
                  <p className="text-2xl font-bold">{vesselIntelligence.healthScore || 0}%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Active Alerts</p>
                  <p className="text-2xl font-bold">{vesselIntelligence.activeAlerts || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Predictions</p>
                  <p className="text-2xl font-bold">{vesselIntelligence.totalPredictions || 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">Risk Level</p>
                  <Badge className={getSeverityColor(vesselIntelligence.riskLevel || "low")}>
                    {vesselIntelligence.riskLevel || "low"}
                  </Badge>
                </CardContent>
              </Card>
            </div>

            {vesselIntelligence.insights && vesselIntelligence.insights.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">AI Insights</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {vesselIntelligence.insights.map((insight, idx: number) => (
                    <div key={idx} className="p-3 border rounded-lg">
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className={getSeverityColor(insight.severity)}>
                          {insight.severity}
                        </Badge>
                        <div>
                          <p className="font-medium text-sm">{insight.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {insight.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {vesselIntelligence.patterns && vesselIntelligence.patterns.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Detected Patterns</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {vesselIntelligence.patterns.map((pattern, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                      <span>{pattern.description}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function FeedbackLoopSection() {
  const {
    retrainingQueue,
    queueLoading,
    modelImprovements,
    improvementsLoading,
    correctionPatterns,
    patternsLoading,
    highPriorityCount,
    hasHighPriorityRetraining,
    getPriorityBadge,
    getImprovementBadge,
  } = useFeedbackLoopData();

  return (
    <div className="space-y-4">
      <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertTitle className="text-blue-900 dark:text-blue-100">How This Works</AlertTitle>
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          When operators rate predictions or report inaccuracies, the system automatically queues
          models for retraining.
        </AlertDescription>
      </Alert>

      {hasHighPriorityRetraining && (
        <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-amber-900 dark:text-amber-100">
            High Priority Retraining Needed
          </AlertTitle>
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <strong>
              {highPriorityCount} model{highPriorityCount > 1 ? "s are" : " is"}
            </strong>{" "}
            waiting for high-priority retraining.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Pending Retraining
              <InfoTooltip content="Models waiting to be retrained based on operator feedback." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {queueLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-3xl font-bold">{retrainingQueue?.totalPending ?? 0}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Models Tracked
            </CardTitle>
          </CardHeader>
          <CardContent>
            {improvementsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-3xl font-bold">{modelImprovements?.length ?? 0}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Inaccurate Predictions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {patternsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-3xl font-bold">{correctionPatterns?.inaccuracyCount ?? 0}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {retrainingQueue?.queue && retrainingQueue.queue.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Retraining Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {retrainingQueue.queue.slice(0, 5).map((item, idx) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.modelName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.triggerType.replaceAll("_", " ")}</Badge>
                      </TableCell>
                      <TableCell>{getPriorityBadge(item.priority)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {modelImprovements && modelImprovements.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Model Improvement Tracking</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead className="text-right">Accuracy</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modelImprovements.slice(0, 5).map((model) => (
                    <TableRow key={model.modelId}>
                      <TableCell className="font-medium">{model.modelName}</TableCell>
                      <TableCell>
                        <Badge>{model.currentVersion}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {model.currentAccuracy === null
                          ? "—"
                          : `${(model.currentAccuracy * 100).toFixed(1)}%`}
                      </TableCell>
                      <TableCell>{getImprovementBadge(model.improvementStatus)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PredictionFeedbackSection() {
  interface FeedbackSummary {
    feedbackType: string;
    feedbackStatus: string;
    count: number;
    avgRating: number | null;
  }

  interface PredictionFeedbackItem {
    feedback: {
      id: number;
      predictionId: number;
      predictionType: string;
      equipmentId: string;
      userId: string;
      feedbackType: string;
      rating: number | null;
      isAccurate: boolean | null;
      comments: string | null;
      feedbackStatus: string;
      createdAt: Date;
    };
    equipmentName: string | null;
  }

  const { data: summary, isLoading: summaryLoading } = useQuery<FeedbackSummary[]>({
    queryKey: ["/api/analytics/prediction-feedback/summary"],
  });

  const { data: feedback, isLoading: feedbackLoading } = useQuery<PredictionFeedbackItem[]>({
    queryKey: ["/api/analytics/prediction-feedback"],
  });

  const totalFeedback = summary?.reduce((acc, item) => acc + item.count, 0) || 0;
  const pendingReview = summary?.find((s) => s.feedbackStatus === "pending")?.count || 0;
  const approved = summary?.find((s) => s.feedbackStatus === "approved")?.count || 0;

  const getFeedbackTypeBadge = (type: string) => {
    switch (type) {
      case "correction":
        return <Badge className="bg-blue-500">Correction</Badge>;
      case "rating":
        return <Badge className="bg-purple-500">Rating</Badge>;
      case "flag":
        return <Badge variant="destructive">Flagged</Badge>;
      default:
        return <Badge variant="secondary">{type}</Badge>;
    }
  };

  if (summaryLoading || feedbackLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Total Feedback</span>
            </div>
            <p className="text-2xl font-bold">{totalFeedback}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Pending Review</span>
            </div>
            <p className="text-2xl font-bold">{pendingReview}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Approved</span>
            </div>
            <p className="text-2xl font-bold">{approved}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-1">
              <ThumbsUp className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Accurate</span>
            </div>
            <p className="text-2xl font-bold">
              {feedback?.filter((f) => f.feedback.isAccurate === true).length || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {feedback && feedback.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Recent Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Equipment</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Accurate</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feedback.slice(0, 10).map((item) => (
                    <TableRow key={item.feedback.id}>
                      <TableCell className="font-medium">
                        {item.equipmentName || item.feedback.equipmentId}
                      </TableCell>
                      <TableCell>{getFeedbackTypeBadge(item.feedback.feedbackType)}</TableCell>
                      <TableCell>
                        {item.feedback.isAccurate === true ? (
                          <ThumbsUp className="h-4 w-4 text-green-500" />
                        ) : item.feedback.isAccurate === false ? (
                          <ThumbsDown className="h-4 w-4 text-red-500" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.feedback.feedbackStatus === "approved" ? "default" : "secondary"
                          }
                        >
                          {item.feedback.feedbackStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(item.feedback.createdAt), {
                          addSuffix: true,
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>No prediction feedback submitted yet</p>
        </div>
      )}
    </div>
  );
}
