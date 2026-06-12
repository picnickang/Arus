import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Brain, ChevronDown, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ExplainabilityVisualization } from "@/components/ml/ExplainabilityVisualization";

interface PerformanceExplainabilitySectionProps {
  expanded: boolean;
  onToggle: () => void;
}

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

export function PerformanceExplainabilitySection({
  expanded,
  onToggle,
}: PerformanceExplainabilitySectionProps) {
  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4" />
                ML Explainability (SHAP)
              </CardTitle>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
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
  );
}

function ExplainabilitySection() {
  const [selectedPredictionId, setSelectedPredictionId] = useState<number | null>(null);
  const [filterEquipment, setFilterEquipment] = useState<string>("all");

  const { data: predictions, isLoading: predictionsLoading } = useQuery<RealtimePrediction[]>({
    queryKey: [
      "/api/ml/realtime-predictions",
      { equipmentId: filterEquipment === "all" ? undefined : filterEquipment },
    ],
  });

  const { data: explanation, isLoading: explanationLoading } = useQuery({
    queryKey: selectedPredictionId
      ? [`/api/ml/explainability/predictions/${selectedPredictionId}`, { type: "real_time" }]
      : [],
    enabled: !!selectedPredictionId,
  });

  const equipmentOptions = predictions
    ? Array.from(new Set(predictions.map((p) => p.equipmentId)))
    : [];
  const filteredPredictions = predictions?.filter(
    (p) => filterEquipment === "all" || p.equipmentId === filterEquipment
  );

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.85) {
      return <Badge className="bg-green-500">Very Confident</Badge>;
    }
    if (confidence >= 0.7) {
      return <Badge className="bg-blue-500">Confident</Badge>;
    }
    if (confidence >= 0.5) {
      return <Badge className="bg-yellow-500">Moderate</Badge>;
    }
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
                <SelectItem key={eq} value={eq}>
                  {eq}
                </SelectItem>
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
                <span className="font-medium text-sm">
                  {pred.equipmentName || pred.equipmentId}
                </span>
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
              <ExplainabilityVisualization
                data={explanation as Parameters<typeof ExplainabilityVisualization>[0]["data"]}
              />
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
