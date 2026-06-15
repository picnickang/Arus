import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Brain, Loader2, TrendingUp } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

function getSeverityColor(severity: string) {
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
}

export function VesselIntelligenceSection() {
  const [selectedVessel, setSelectedVessel] = useState<string>("");
  const [vesselIntelligence, setVesselIntelligence] = useState<VesselIntelligenceData | null>(null);
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
      const data = await apiRequest<VesselIntelligenceData | null>(
        "GET",
        `/api/analytics/vessel-intelligence/${selectedVessel}`
      );
      setVesselIntelligence(data);
    } catch {
      console.error("Failed to load vessel intelligence");
    } finally {
      setIsLoadingIntelligence(false);
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
