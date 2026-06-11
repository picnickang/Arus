import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { ExperiencePillarScore } from "../types";

function variant(
  severity: ExperiencePillarScore["severity"]
): "default" | "secondary" | "destructive" | "outline" {
  if (severity === "critical") {
    return "destructive";
  }
  if (severity === "risk") {
    return "secondary";
  }
  if (severity === "watch") {
    return "outline";
  }
  return "default";
}

export function ExperienceScoreCard({ score }: { score: ExperiencePillarScore }) {
  const Icon = score.severity === "good" ? CheckCircle2 : AlertTriangle;
  return (
    <Card data-testid={`experience-score-${score.pillar}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            <div className="font-medium">{score.label}</div>
          </div>
          <Badge variant={variant(score.severity)}>{score.score}</Badge>
        </div>
        <Progress value={score.score} />
        <p className="text-sm text-muted-foreground">{score.reason}</p>
        <p className="text-xs font-medium">Fix: {score.recommendedImprovement}</p>
      </CardContent>
    </Card>
  );
}
