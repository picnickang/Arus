import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ThumbsUp, ThumbsDown, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface FeedbackNudgeProps {
  predictionId: number;
  equipmentName?: string;
  workOrderId?: number;
  onDismiss?: () => void;
  className?: string;
}

type Vote = "accurate" | "inaccurate";

export function FeedbackNudge({
  predictionId,
  equipmentName,
  workOrderId,
  onDismiss,
  className,
}: FeedbackNudgeProps) {
  const { toast } = useToast();
  const [vote, setVote] = useState<Vote | null>(null);
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const feedbackMutation = useMutation({
    mutationFn: (data: {
      predictionId: number;
      vote: Vote;
      comment?: string;
      workOrderId?: number;
    }) => apiRequest("POST", "/api/analytics/prediction-feedback", data),
    onSuccess: () => {
      toast({
        title: "Feedback submitted",
        description: "Your input helps improve future predictions.",
      });
      setDismissed(true);
      onDismiss?.();
    },
    onError: () => {
      toast({
        title: "Failed to submit feedback",
        description: "Please try again later.",
        variant: "destructive",
      });
    },
  });

  function handleVote(selectedVote: Vote) {
    setVote(selectedVote);
    if (selectedVote === "inaccurate") {
      setShowComment(true);
    } else {
      feedbackMutation.mutate({
        predictionId,
        vote: selectedVote,
        workOrderId,
      });
    }
  }

  function handleSubmitWithComment() {
    if (!vote) return;
    feedbackMutation.mutate({
      predictionId,
      vote,
      comment: comment.trim() || undefined,
      workOrderId,
    });
  }

  function handleDismiss() {
    setDismissed(true);
    onDismiss?.();
  }

  if (dismissed) return null;

  return (
    <Card
      className={cn("border-dashed", className)}
      data-testid="feedback-nudge"
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" data-testid="feedback-nudge-title">
              Was the prediction accurate?
            </p>
            {equipmentName && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                For {equipmentName}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 shrink-0"
            onClick={handleDismiss}
            aria-label="Dismiss feedback prompt"
            data-testid="feedback-nudge-dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {!showComment ? (
          <div className="flex items-center gap-2 mt-3" data-testid="feedback-nudge-buttons">
            <Button
              variant={vote === "accurate" ? "default" : "outline"}
              size="sm"
              onClick={() => handleVote("accurate")}
              disabled={feedbackMutation.isPending}
              data-testid="feedback-nudge-thumbs-up"
            >
              {feedbackMutation.isPending && vote === "accurate" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <ThumbsUp className="h-4 w-4 mr-1" />
              )}
              Yes
            </Button>
            <Button
              variant={vote === "inaccurate" ? "default" : "outline"}
              size="sm"
              onClick={() => handleVote("inaccurate")}
              disabled={feedbackMutation.isPending}
              data-testid="feedback-nudge-thumbs-down"
            >
              <ThumbsDown className="h-4 w-4 mr-1" />
              No
            </Button>
          </div>
        ) : (
          <div className="mt-3 space-y-2" data-testid="feedback-nudge-comment-section">
            <Textarea
              placeholder="What actually happened? (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[60px] text-sm resize-none"
              data-testid="feedback-nudge-comment"
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleSubmitWithComment}
                disabled={feedbackMutation.isPending}
                data-testid="feedback-nudge-submit"
              >
                {feedbackMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : null}
                Submit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowComment(false);
                  setVote(null);
                }}
                disabled={feedbackMutation.isPending}
                data-testid="feedback-nudge-cancel"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
