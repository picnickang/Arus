import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle, HelpCircle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface PredictionFeedback {
  outcome: "confirmed" | "partial" | "false_alarm";
  notes?: string;
  predictionId?: string | number | null;
}

interface PredictionFeedbackFormProps {
  workOrderId: string;
  predictionId?: string | number | null;
  onChange: (feedback: PredictionFeedback | undefined) => void;
  className?: string;
}

const OUTCOMES = [
  {
    value: "confirmed" as const,
    label: "Yes, confirmed",
    description: "The predicted condition was found during inspection/repair",
    icon: CheckCircle,
    color: "text-green-600 dark:text-green-400",
    border: "border-green-500/30 bg-green-500/5",
  },
  {
    value: "partial" as const,
    label: "Partially",
    description: "Early signs of the condition were present",
    icon: HelpCircle,
    color: "text-yellow-600 dark:text-yellow-400",
    border: "border-yellow-500/30 bg-yellow-500/5",
  },
  {
    value: "false_alarm" as const,
    label: "No, false alarm",
    description: "No evidence of the predicted condition — will flag savings for review",
    icon: AlertTriangle,
    color: "text-red-600 dark:text-red-400",
    border: "border-red-500/30 bg-red-500/5",
  },
];

export function PredictionFeedbackForm({
  workOrderId,
  predictionId,
  onChange,
  className = "",
}: PredictionFeedbackFormProps) {
  const [selected, setSelected] = useState<PredictionFeedback["outcome"] | null>(null);
  const [notes, setNotes] = useState("");

  const { data: predictiveCheck } = useQuery<{ isPredictive: boolean }>({
    queryKey: ["/api/work-orders", workOrderId, "is-predictive"],
    enabled: !predictionId && !!workOrderId,
  });

  const isPredictive = !!predictionId || predictiveCheck?.isPredictive;

  if (!isPredictive) {
    return null;
  }

  const handleSelect = (outcome: PredictionFeedback["outcome"]) => {
    setSelected(outcome);
    onChange({
      outcome,
      notes: notes || undefined,
      predictionId,
    });
  };

  const handleNotesChange = (value: string) => {
    setNotes(value);
    if (selected) {
      onChange({
        outcome: selected,
        notes: value || undefined,
        predictionId,
      });
    }
  };

  return (
    <div className={`space-y-3 ${className}`} data-testid="prediction-feedback-form">
      <div className="flex items-center gap-2">
        <Label className="text-sm font-semibold">Was the predicted failure confirmed?</Label>
        <Badge variant="outline" className="text-[9px]">
          Required for predictive WOs
        </Badge>
      </div>

      <div className="space-y-2">
        {OUTCOMES.map((option) => {
          const Icon = option.icon;
          const isSelected = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`w-full text-left p-3 rounded-lg border transition-all ${
                isSelected
                  ? `${option.border} ring-1 ring-primary/30`
                  : "border-border hover:bg-accent/30"
              }`}
              data-testid={`feedback-option-${option.value}`}
            >
              <div className="flex items-start gap-3">
                <Icon
                  className={`h-5 w-5 mt-0.5 shrink-0 ${isSelected ? option.color : "text-muted-foreground"}`}
                />
                <div>
                  <div
                    className={`text-sm font-medium ${isSelected ? option.color : "text-foreground"}`}
                  >
                    {option.label}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{option.description}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selected === "false_alarm" && (
        <div
          className="p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400"
          data-testid="false-alarm-warning"
        >
          This will flag the associated savings claim for review. The PdM team will be notified to
          investigate model accuracy for this equipment.
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
        <Textarea
          value={notes}
          onChange={(e) => handleNotesChange(e.target.value)}
          placeholder="Describe what was found during inspection..."
          rows={2}
          className="text-sm"
          data-testid="feedback-notes"
        />
      </div>
    </div>
  );
}
