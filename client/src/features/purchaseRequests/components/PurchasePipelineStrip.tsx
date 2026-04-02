import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Check,
  Clock,
  Circle,
  ChevronRight,
  FileText,
  Send,
  Receipt,
  ClipboardList,
  Truck,
  PackageCheck,
  CheckCircle2,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow, format } from "date-fns";
import { usePurchasePipeline } from "../hooks/usePurchasePipeline";
import type { PipelineStage } from "../hooks/usePurchasePipeline";

interface PurchasePipelineStripProps {
  prId: string;
  className?: string;
}

const STAGE_ICONS: Record<string, typeof FileText> = {
  request_created: FileText,
  sent_to_supplier: Send,
  quote_received: Receipt,
  po_issued: ClipboardList,
  shipped: Truck,
  received: PackageCheck,
  fulfilled: CheckCircle2,
};

function StageIcon({
  stageKey,
  status,
}: {
  stageKey: string;
  status: PipelineStage["status"];
}) {
  if (status === "completed") return <Check className="h-4 w-4" />;
  if (status === "current") return <Clock className="h-4 w-4" />;
  const Icon = STAGE_ICONS[stageKey] || Circle;
  return <Icon className="h-3.5 w-3.5" />;
}

function formatDetails(details: Record<string, unknown> | null): string[] {
  if (!details) return [];
  const lines: string[] = [];
  for (const [key, value] of Object.entries(details)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "object") continue;
    const label = key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
    lines.push(`${label}: ${String(value)}`);
  }
  return lines;
}

function StageDetailContent({ stage }: { stage: PipelineStage }) {
  const detailLines = formatDetails(stage.details);
  return (
    <div className="text-xs max-w-[240px]">
      <p className="font-semibold">{stage.label}</p>
      <p className="text-muted-foreground">{stage.description}</p>
      {stage.timestamp && (
        <p className="mt-1">
          {format(new Date(stage.timestamp), "MMM d, yyyy HH:mm")}
        </p>
      )}
      {(stage.actorName || stage.actor) && (
        <p className="text-muted-foreground">By: {stage.actorName || stage.actor}</p>
      )}
      {detailLines.length > 0 && (
        <div className="mt-1.5 pt-1.5 border-t border-border space-y-0.5">
          {detailLines.map((line) => (
            <p key={line} className="text-muted-foreground">{line}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function DesktopPipeline({ stages }: { stages: PipelineStage[] }) {
  return (
    <div className="hidden md:flex items-start gap-0 w-full">
      {stages.map((stage, index) => (
        <div key={stage.key} className="flex items-start flex-1 min-w-0">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex flex-col items-center gap-1.5 flex-1 min-w-0 cursor-default transition-opacity",
                    stage.status === "upcoming" && "opacity-40"
                  )}
                  data-testid={`pipeline-step-${stage.key}`}
                >
                  <div
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0",
                      stage.status === "completed" &&
                        "bg-green-500 text-white",
                      stage.status === "current" &&
                        "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background",
                      stage.status === "upcoming" &&
                        "bg-muted text-muted-foreground border border-border"
                    )}
                  >
                    <StageIcon stageKey={stage.key} status={stage.status} />
                  </div>

                  <span
                    className={cn(
                      "text-[10px] font-medium text-center leading-tight w-full px-0.5",
                      stage.status === "current" && "text-primary",
                      stage.status === "completed" &&
                        "text-green-600 dark:text-green-400",
                      stage.status === "upcoming" && "text-muted-foreground"
                    )}
                  >
                    {stage.label}
                  </span>

                  {stage.timestamp && (
                    <span className="text-[9px] text-muted-foreground truncate w-full text-center px-1">
                      {formatDistanceToNow(new Date(stage.timestamp), {
                        addSuffix: true,
                      })}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="p-3">
                <StageDetailContent stage={stage} />
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {index < stages.length - 1 && (
            <div
              className={cn(
                "h-0.5 flex-1 min-w-[12px] mt-[18px] mx-0.5",
                stage.status === "completed" ? "bg-green-500" : "bg-border"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function MobilePipeline({ stages }: { stages: PipelineStage[] }) {
  const [openStage, setOpenStage] = useState<string | null>(null);

  return (
    <div className="md:hidden flex items-center gap-1 overflow-x-auto pb-1">
      {stages.map((stage, index) => (
        <div key={stage.key} className="flex items-center flex-shrink-0">
          <Popover open={openStage === stage.key} onOpenChange={(open) => setOpenStage(open ? stage.key : null)}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="focus:outline-none"
                data-testid={`pipeline-step-${stage.key}`}
              >
                <Badge
                  variant={stage.status === "upcoming" ? "outline" : "default"}
                  className={cn(
                    "text-[10px] px-2 py-0.5 whitespace-nowrap cursor-pointer",
                    stage.status === "completed" &&
                      "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30",
                    stage.status === "current" &&
                      "bg-primary/20 text-primary border-primary/30",
                    stage.status === "upcoming" && "opacity-40"
                  )}
                >
                  {stage.status === "completed" && (
                    <Check className="h-3 w-3 mr-0.5" />
                  )}
                  {stage.label}
                </Badge>
              </button>
            </PopoverTrigger>
            <PopoverContent side="bottom" className="p-3 w-auto">
              <StageDetailContent stage={stage} />
            </PopoverContent>
          </Popover>
          {index < stages.length - 1 && (
            <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0 mx-0.5" />
          )}
        </div>
      ))}
    </div>
  );
}

function PipelineSkeleton() {
  return (
    <div className="flex items-center gap-2" data-testid="pipeline-loading">
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex items-center flex-1">
          <div className="flex flex-col items-center gap-1 flex-1">
            <Skeleton className="w-9 h-9 rounded-full" />
            <Skeleton className="h-3 w-14" />
          </div>
          {i < 6 && <Skeleton className="h-0.5 flex-1 min-w-[12px]" />}
        </div>
      ))}
    </div>
  );
}

export function PurchasePipelineStrip({
  prId,
  className,
}: PurchasePipelineStripProps) {
  const { data: pipeline, isLoading, error } = usePurchasePipeline(prId);

  if (isLoading) {
    return (
      <div className={cn("w-full", className)}>
        <PipelineSkeleton />
      </div>
    );
  }

  if (error || !pipeline) {
    return null;
  }

  return (
    <div className={cn("w-full", className)} data-testid="purchase-pipeline-strip">
      <DesktopPipeline stages={pipeline.stages} />
      <MobilePipeline stages={pipeline.stages} />
    </div>
  );
}
