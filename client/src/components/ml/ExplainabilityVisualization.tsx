import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { InfoTooltip } from "@/components/ui/info-tooltip";

interface Feature {
  name: string;
  shapValue: number;
  featureValue: number;
  contribution: number;
  direction: "increase" | "decrease";
}

interface ExplainabilityData {
  predictionId: number;
  predictionType: string;
  equipmentId: string;
  equipmentName: string;
  modelId: string;
  modelType: string;
  baseValue: number;
  prediction: number;
  topFeatures: Feature[];
  allFeatures: Feature[];
  computationTimeMs: number;
  createdAt: Date;
}

interface Props {
  data: ExplainabilityData;
}

// Convert model type to plain language
function getModelTypeName(modelType: string): string {
  const mapping: Record<string, string> = {
    lstm: "Pattern Detection AI",
    random_forest: "Health Classification AI",
    hybrid: "Combined AI Model",
    gru: "Fast Pattern Detection AI",
  };
  return mapping[modelType.toLowerCase()] || modelType;
}

// Get user-friendly prediction interpretation
function getPredictionInterpretation(
  prediction: number,
  modelType: string
): {
  label: string;
  color: string;
  description: string;
} {
  if (modelType.toLowerCase().includes("lstm") || modelType.toLowerCase().includes("gru")) {
    const days = Math.round(prediction);
    if (days <= 7) {
      return {
        label: "Urgent Attention Needed",
        color: "bg-red-500",
        description: `Equipment may fail within ${days} days. Schedule maintenance immediately.`,
      };
    }
    if (days <= 30) {
      return {
        label: "Maintenance Recommended",
        color: "bg-yellow-500",
        description: `Equipment predicted to fail in ${days} days. Plan maintenance soon.`,
      };
    }
    return {
      label: "Healthy",
      color: "bg-green-500",
      description: `Equipment in good condition. Expected to run for ${days}+ days.`,
    };
  }
  if (prediction > 0.7) {
    return {
      label: "Critical Health Risk",
      color: "bg-red-500",
      description: "Equipment showing signs of serious degradation.",
    };
  }
  if (prediction > 0.4) {
    return {
      label: "Moderate Health Risk",
      color: "bg-yellow-500",
      description: "Equipment showing some wear. Monitor closely.",
    };
  }
  return {
    label: "Good Health",
    color: "bg-green-500",
    description: "Equipment operating normally.",
  };
}

// Waterfall Chart Component
function WaterfallChart({
  features,
  baseValue,
  prediction,
}: {
  features: Feature[];
  baseValue: number;
  prediction: number;
}) {
  // Calculate max absolute contribution for scaling
  const maxContribution = Math.max(...features.map((f) => Math.abs(f.shapValue)));

  return (
    <div className="space-y-2" data-testid="waterfall-chart">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-medium">Why Did the AI Predict This?</h3>
        <InfoTooltip content="This chart shows which sensor readings and patterns influenced the prediction. Red bars pushed the risk higher, blue bars lowered it." />
      </div>

      {/* Base value indicator */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <div className="w-24">Starting Point:</div>
        <div className="font-medium">{baseValue.toFixed(2)}</div>
        <span className="text-xs">(average equipment risk)</span>
      </div>

      {/* Feature contributions */}
      <div className="space-y-1">
        {features.map((feature, index) => {
          const barWidth = (Math.abs(feature.shapValue) / maxContribution) * 100;
          const isPositive = feature.shapValue > 0;

          return (
            <div
              key={`feature-${feature.name}`}
              className="flex items-center gap-2"
              data-testid={`feature-contribution-${index}`}
            >
              <div className="w-40 text-sm truncate" title={feature.name}>
                {feature.name}
              </div>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 h-6 bg-muted rounded relative overflow-hidden">
                  <div
                    className={`h-full ${isPositive ? "bg-red-500" : "bg-blue-500"} transition-all`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <div className="w-20 text-right text-sm font-medium flex items-center gap-1">
                  {isPositive ? (
                    <TrendingUp className="w-3 h-3 text-red-500" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-blue-500" />
                  )}
                  <span className={isPositive ? "text-red-500" : "text-blue-500"}>
                    {feature.shapValue > 0 ? "+" : ""}
                    {feature.shapValue.toFixed(3)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Final prediction */}
      <div className="flex items-center gap-2 text-sm font-medium border-t pt-2 mt-2">
        <div className="w-40">AI Prediction:</div>
        <div className="font-bold text-lg">{prediction.toFixed(2)}</div>
      </div>
    </div>
  );
}

// Feature Importance Bar Chart
function FeatureImportanceBar({ features }: { features: Feature[] }) {
  // Sort by absolute contribution
  const sortedFeatures = [...features].sort((a, b) => b.contribution - a.contribution);
  const maxContribution = sortedFeatures[0]?.contribution || 1;

  return (
    <div className="space-y-2" data-testid="feature-importance-bar">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-medium">Most Important Factors</h3>
        <InfoTooltip content="These sensor readings and patterns had the biggest influence on the AI's prediction, regardless of direction." />
      </div>

      {sortedFeatures.slice(0, 8).map((feature, index) => {
        const barWidth = (feature.contribution / maxContribution) * 100;

        return (
          <div
            key={`importance-${feature.name}`}
            className="space-y-1"
            data-testid={`importance-bar-${index}`}
          >
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium truncate max-w-[200px]" title={feature.name}>
                {feature.name}
              </span>
              <span className="text-muted-foreground text-xs">
                {((feature.contribution / maxContribution) * 100).toFixed(0)}% influence
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all"
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Plain Language Explanation
function PlainLanguageExplanation({ data }: { data: ExplainabilityData }) {
  const interpretation = getPredictionInterpretation(data.prediction, data.modelType);
  const topIncreasing = data.topFeatures.filter((f) => f.direction === "increase").slice(0, 3);
  const topDecreasing = data.topFeatures.filter((f) => f.direction === "decrease").slice(0, 3);

  return (
    <div className="space-y-4" data-testid="plain-language-explanation">
      <div>
        <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          What This Means for Your Equipment
        </h3>
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <Badge className={interpretation.color} data-testid="prediction-badge">
              {interpretation.label}
            </Badge>
            <p className="text-sm text-muted-foreground" data-testid="prediction-description">
              {interpretation.description}
            </p>
          </div>
        </Card>
      </div>

      {topIncreasing.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2 text-red-600 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Risk Factors (What Increased the Risk)
          </h3>
          <ul className="space-y-2">
            {topIncreasing.map((feature, index) => (
              <li
                key={`risk-${feature.name}`}
                className="text-sm pl-4 border-l-2 border-red-300"
                data-testid={`risk-factor-${index}`}
              >
                <span className="font-medium">{feature.name}</span> showed abnormal patterns
                <span className="text-muted-foreground ml-1">
                  (current value: {feature.featureValue.toFixed(2)})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {topDecreasing.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2 text-blue-600 flex items-center gap-2">
            <TrendingDown className="w-4 h-4" />
            Positive Signs (What Lowered the Risk)
          </h3>
          <ul className="space-y-2">
            {topDecreasing.map((feature, index) => (
              <li
                key={`positive-${feature.name}`}
                className="text-sm pl-4 border-l-2 border-blue-300"
                data-testid={`positive-sign-${index}`}
              >
                <span className="font-medium">{feature.name}</span> is performing well
                <span className="text-muted-foreground ml-1">
                  (current value: {feature.featureValue.toFixed(2)})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="text-xs text-muted-foreground border-t pt-2">
        <p>
          <strong>Model Used:</strong> {getModelTypeName(data.modelType)}
        </p>
        <p>
          <strong>Analysis Time:</strong> {data.computationTimeMs}ms
        </p>
      </div>
    </div>
  );
}

// Main Explainability Visualization Component
export function ExplainabilityVisualization({ data }: Props) {
  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      data-testid="explainability-visualization"
    >
      {/* Plain Language Explanation - Most Important */}
      <Card className="p-6 lg:col-span-2">
        <PlainLanguageExplanation data={data} />
      </Card>

      {/* Waterfall Chart */}
      <Card className="p-6">
        <WaterfallChart
          features={data.topFeatures}
          baseValue={data.baseValue}
          prediction={data.prediction}
        />
      </Card>

      {/* Feature Importance */}
      <Card className="p-6">
        <FeatureImportanceBar features={data.topFeatures} />
      </Card>
    </div>
  );
}
