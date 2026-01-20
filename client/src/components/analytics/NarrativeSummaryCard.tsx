import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { AlertCircle, CheckCircle, Info, TrendingUp, AlertTriangle, Sparkles } from "lucide-react";

interface NarrativeSummaryCardProps {
  vesselId: string;
  vesselName: string;
  chartType: "power_stw" | "load_distribution" | "fuel_consumption" | "efficiency";
  currentMetrics: {
    avgPower?: number;
    avgSpeed?: number;
    avgLoad?: number;
    avgFuelRate?: number;
    efficiency?: number;
  };
  baseline?: {
    value: number;
    percentageDiff: number;
  };
  fleetAverage?: {
    value: number;
    percentageDiff: number;
  };
  operatingMode?: string;
  periodDays?: number;
}

interface NarrativeSummary {
  headline: string;
  analysis: string;
  context: string[];
  recommendations: string[];
  severity: "good" | "normal" | "attention" | "critical";
  confidence: number;
}

export function NarrativeSummaryCard({
  vesselId,
  vesselName,
  chartType,
  currentMetrics,
  baseline,
  fleetAverage,
  operatingMode,
  periodDays = 30,
}: NarrativeSummaryCardProps) {
  const {
    data: summary,
    isLoading,
    error,
  } = useQuery<NarrativeSummary>({
    queryKey: ["/api/analytics/narrative-summary", vesselId, chartType, periodDays],
    queryFn: async () => {
      return apiRequest("POST", "/api/analytics/narrative-summary", {
        body: JSON.stringify({
          vesselId,
          vesselName,
          chartType,
          currentMetrics,
          baseline,
          fleetAverage,
          operatingMode,
          periodDays,
        }),
      });
    },
    refetchInterval: 300000,
    staleTime: 120000,
    enabled: !!vesselId && !!chartType,
  });

  if (isLoading) {
    return (
      <Card
        className="bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-gray-950"
        data-testid="card-narrative-loading"
      >
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <CardTitle className="text-lg">AI Performance Insights</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-6 w-full" data-testid="skeleton-headline" />
          <Skeleton className="h-4 w-3/4" data-testid="skeleton-analysis" />
          <Skeleton className="h-4 w-full" data-testid="skeleton-context" />
        </CardContent>
      </Card>
    );
  }

  if (error || !summary) {
    return (
      <Card className="border-amber-200 dark:border-amber-800" data-testid="card-narrative-error">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-lg">Performance Summary</CardTitle>
          </div>
          <CardDescription data-testid="text-error-description">
            AI insights temporarily unavailable
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const getSeverityIcon = () => {
    switch (summary.severity) {
      case "good":
        return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />;
      case "attention":
        return <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />;
      case "critical":
        return <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />;
      default:
        return <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
    }
  };

  const getSeverityColor = (): string => {
    switch (summary.severity) {
      case "good":
        return "from-green-50 to-white dark:from-green-950/20 dark:to-gray-950 border-green-200 dark:border-green-800";
      case "attention":
        return "from-amber-50 to-white dark:from-amber-950/20 dark:to-gray-950 border-amber-200 dark:border-amber-800";
      case "critical":
        return "from-red-50 to-white dark:from-red-950/20 dark:to-gray-950 border-red-200 dark:border-red-800";
      default:
        return "from-blue-50 to-white dark:from-blue-950/20 dark:to-gray-950 border-blue-200 dark:border-blue-800";
    }
  };

  const confidencePercent = Math.round(summary.confidence * 100);

  return (
    <Card className={`bg-gradient-to-br ${getSeverityColor()}`} data-testid="card-narrative">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span data-testid={`icon-severity-${summary.severity}`}>{getSeverityIcon()}</span>
            <div>
              <CardTitle className="text-lg" data-testid="text-headline">
                {summary.headline}
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Sparkles className="h-3 w-3" />
                AI Analysis
                {confidencePercent < 70 && (
                  <Badge variant="outline" className="text-xs" data-testid="badge-confidence">
                    {confidencePercent}% confidence
                  </Badge>
                )}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary.analysis && (
          <div className="text-sm text-gray-700 dark:text-gray-300" data-testid="text-analysis">
            {summary.analysis}
          </div>
        )}

        {summary.context && summary.context.length > 0 && (
          <div className="space-y-2" data-testid="container-context">
            <h4
              className="text-sm font-semibold text-gray-900 dark:text-gray-100"
              data-testid="heading-context"
            >
              Context
            </h4>
            <ul className="space-y-1">
              {summary.context.map((item, index) => (
                <li
                  key={`context-${item.slice(0, 30)}-${index}`}
                  className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2"
                  data-testid={`item-context-${index}`}
                >
                  <span className="text-blue-500 mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {summary.recommendations && summary.recommendations.length > 0 && (
          <div className="space-y-2" data-testid="container-recommendations">
            <h4
              className="text-sm font-semibold text-gray-900 dark:text-gray-100"
              data-testid="heading-recommendations"
            >
              Recommendations
            </h4>
            <ul className="space-y-1">
              {summary.recommendations.map((rec, index) => (
                <li
                  key={`rec-${rec.slice(0, 30)}-${index}`}
                  className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2"
                  data-testid={`item-recommendation-${index}`}
                >
                  <span className="text-blue-500 mt-0.5">→</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
