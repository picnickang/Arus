import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { getConfidenceLabel } from "@/lib/severity";
import { cn } from "@/lib/utils";

interface ConfidenceBadgeProps {
  confidence: number;
  showPercentage?: boolean;
  className?: string;
}

export function ConfidenceBadge({
  confidence,
  showPercentage = true,
  className,
}: ConfidenceBadgeProps) {
  const clamped = Math.max(0, Math.min(1, confidence));
  const { label, variant, description } = getConfidenceLabel(clamped);
  const pct = Math.round(clamped * 100);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold gap-1 cursor-default transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              variant === "default" && "border-transparent bg-primary text-primary-foreground",
              variant === "secondary" &&
                "border-transparent bg-secondary text-secondary-foreground",
              variant === "outline" && "text-foreground",
              variant === "destructive" &&
                "border-transparent bg-destructive text-destructive-foreground",
              className
            )}
            data-testid="confidence-badge"
            aria-label={`Confidence: ${label} ${pct}%`}
          >
            {label}
            {showPercentage && <span className="opacity-75">({pct}%)</span>}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="text-sm font-medium mb-1">AI Confidence: {pct}%</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
