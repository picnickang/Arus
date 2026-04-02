/**
 * PR Status Pipeline
 *
 * UX FIX #1: Visual pipeline strip showing the full lifecycle of a
 * purchase request without navigating between 4 pages.
 *
 * Steps: Draft → Sent → Quote Received → PO Issued → Shipped → Received → Fulfilled
 *
 * Each step is tappable and shows the relevant data/timestamp.
 *
 * Usage:
 *   <PRStatusPipeline
 *     prId="pr-123"
 *     status="sent"
 *     events={events}
 *     linkedPO={linkedPO}
 *   />
 */

import { cn } from "@/lib/utils";
import { Check, Clock, Circle, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDistanceToNow } from "date-fns";

interface PipelineEvent {
  eventType: string;
  createdAt: string | Date;
  userId?: string;
  details?: Record<string, unknown>;
}

interface LinkedPO {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount?: number;
  expectedDate?: string | Date | null;
}

interface PRStatusPipelineProps {
  status: string;
  events?: PipelineEvent[];
  linkedPO?: LinkedPO | null;
  sentAt?: string | Date | null;
  closedAt?: string | Date | null;
  className?: string;
}

const PIPELINE_STEPS = [
  { key: "draft", label: "Draft", description: "Request created" },
  { key: "sent", label: "Sent", description: "Sent to supplier" },
  { key: "po_issued", label: "PO Issued", description: "Purchase order created" },
  { key: "received", label: "Received", description: "Items received" },
  { key: "fulfilled", label: "Fulfilled", description: "Items fulfilled to work order" },
  { key: "closed", label: "Closed", description: "Request completed" },
] as const;

type StepKey = typeof PIPELINE_STEPS[number]["key"];

function getStepStatus(
  stepKey: StepKey,
  prStatus: string,
  linkedPO?: LinkedPO | null
): "completed" | "current" | "upcoming" {
  const statusMap: Record<string, number> = {
    draft: 0,
    sent: 1,
    po_issued: 2,
    received: 3,
    fulfilled: 4,
    closed: 5,
  };

  // Map PR status to pipeline position
  let currentPosition = statusMap[prStatus] ?? 0;

  // If there's a linked PO, advance based on PO status
  if (linkedPO) {
    const poStatusMap: Record<string, number> = {
      draft: 2,
      sent: 2,
      acknowledged: 2,
      shipped: 2,
      received: 3,
    };
    const poPosition = poStatusMap[linkedPO.status] ?? 2;
    currentPosition = Math.max(currentPosition, poPosition);
  }

  // Check for fulfillment
  if (prStatus === "fulfilled" || prStatus === "closed") {
    currentPosition = Math.max(currentPosition, statusMap[prStatus]);
  }

  const stepPosition = statusMap[stepKey] ?? 0;

  if (stepPosition < currentPosition) return "completed";
  if (stepPosition === currentPosition) return "current";
  return "upcoming";
}

function getEventTimestamp(
  stepKey: StepKey,
  events?: PipelineEvent[],
  sentAt?: string | Date | null,
  closedAt?: string | Date | null
): Date | null {
  if (!events) return null;

  const eventTypeMap: Record<string, string[]> = {
    draft: ["created"],
    sent: ["sent", "submitted"],
    po_issued: ["po_created", "po_linked"],
    received: ["items_received", "received"],
    fulfilled: ["fulfilled", "items_fulfilled"],
    closed: ["closed", "completed"],
  };

  const matchingTypes = eventTypeMap[stepKey] ?? [];
  const event = events.find((e) => matchingTypes.includes(e.eventType));

  if (event) return new Date(event.createdAt);

  // Fallback to dedicated timestamp fields
  if (stepKey === "sent" && sentAt) return new Date(sentAt);
  if (stepKey === "closed" && closedAt) return new Date(closedAt);

  return null;
}

export function PRStatusPipeline({
  status,
  events,
  linkedPO,
  sentAt,
  closedAt,
  className,
}: PRStatusPipelineProps) {
  return (
    <div className={cn("w-full", className)} data-testid="pr-status-pipeline">
      {/* Desktop: horizontal pipeline */}
      <div className="hidden md:flex items-center gap-0">
        {PIPELINE_STEPS.map((step, index) => {
          const stepStatus = getStepStatus(step.key, status, linkedPO);
          const timestamp = getEventTimestamp(step.key, events, sentAt, closedAt);

          return (
            <div key={step.key} className="flex items-center flex-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "flex flex-col items-center gap-1 flex-1 cursor-default",
                        stepStatus === "upcoming" && "opacity-40"
                      )}
                    >
                      {/* Step icon */}
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                          stepStatus === "completed" && "bg-green-500 text-white",
                          stepStatus === "current" && "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background",
                          stepStatus === "upcoming" && "bg-muted text-muted-foreground border border-border"
                        )}
                      >
                        {stepStatus === "completed" ? (
                          <Check className="h-4 w-4" />
                        ) : stepStatus === "current" ? (
                          <Clock className="h-4 w-4" />
                        ) : (
                          <Circle className="h-3 w-3" />
                        )}
                      </div>

                      {/* Label */}
                      <span
                        className={cn(
                          "text-[10px] font-medium text-center leading-tight",
                          stepStatus === "current" && "text-primary",
                          stepStatus === "completed" && "text-green-600 dark:text-green-400",
                          stepStatus === "upcoming" && "text-muted-foreground"
                        )}
                      >
                        {step.label}
                      </span>

                      {/* Timestamp */}
                      {timestamp && (
                        <span className="text-[9px] text-muted-foreground">
                          {formatDistanceToNow(timestamp, { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    <p className="font-medium">{step.label}</p>
                    <p className="text-muted-foreground">{step.description}</p>
                    {timestamp && (
                      <p className="mt-1">{timestamp.toLocaleString()}</p>
                    )}
                    {step.key === "po_issued" && linkedPO && (
                      <div className="mt-1 pt-1 border-t">
                        <p>PO: {linkedPO.orderNumber}</p>
                        <p>Status: {linkedPO.status}</p>
                        {linkedPO.totalAmount != null && (
                          <p>Amount: ${linkedPO.totalAmount.toFixed(2)}</p>
                        )}
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Connector line */}
              {index < PIPELINE_STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 flex-1 min-w-[16px] mx-1",
                    stepStatus === "completed"
                      ? "bg-green-500"
                      : "bg-border"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: vertical compact pipeline */}
      <div className="md:hidden flex items-center gap-1 overflow-x-auto pb-1">
        {PIPELINE_STEPS.map((step, index) => {
          const stepStatus = getStepStatus(step.key, status, linkedPO);

          return (
            <div key={step.key} className="flex items-center flex-shrink-0">
              <Badge
                variant={
                  stepStatus === "completed"
                    ? "default"
                    : stepStatus === "current"
                    ? "default"
                    : "outline"
                }
                className={cn(
                  "text-[10px] px-2 py-0.5 whitespace-nowrap",
                  stepStatus === "completed" && "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30",
                  stepStatus === "current" && "bg-primary/20 text-primary border-primary/30",
                  stepStatus === "upcoming" && "opacity-40"
                )}
              >
                {stepStatus === "completed" && <Check className="h-3 w-3 mr-0.5" />}
                {step.label}
              </Badge>
              {index < PIPELINE_STEPS.length - 1 && (
                <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0 mx-0.5" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PRStatusPipeline;
