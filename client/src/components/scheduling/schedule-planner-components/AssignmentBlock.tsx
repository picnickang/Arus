import { useState, useRef, useEffect } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { Sparkles, Move } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  type ScheduleAssignment,
  type FatigueRiskLevel,
} from "@/features/crew/hooks/useSchedulePlannerData";
import { cn } from "@/lib/utils";
import { getRoleColor, DRAG_THRESHOLD_PX, MOBILE_LONG_PRESS_MS } from "../schedule-planner-utils";
import { FatigueRiskBadge } from "../schedule-planner-tabs";

import type { DragCompliancePreview } from "./types";

export function AssignmentBlock({
  assignment,
  startOffset,
  duration,
  totalDays,
  onClick,
  hardViolations,
  softViolations,
  fatigueRisk,
  isMobile = false,
  onPointerDragStart,
  isDragging = false,
  dragCompliancePreview,
  isLongPressActive = false,
}: {
  assignment: ScheduleAssignment;
  startOffset: number;
  duration: number;
  totalDays: number;
  onClick: () => void;
  hardViolations: number;
  softViolations: number;
  fatigueRisk?: FatigueRiskLevel | undefined;
  isMobile?: boolean | undefined;
  onPointerDragStart?:
    | ((e: React.PointerEvent, assignment: ScheduleAssignment) => void)
    | undefined;
  isDragging?: boolean | undefined;
  dragCompliancePreview?: DragCompliancePreview | null | undefined;
  isLongPressActive?: boolean | undefined;
}) {
  const leftPercent = (startOffset / totalDays) * 100;
  const widthPercent = (duration / totalDays) * 100;
  const roleColor = getRoleColor(assignment.role);
  const isDraft = assignment.status === "draft";
  const isGeneratedDraft =
    isDraft && (assignment.source === "generator" || !!assignment.generatedByRunId);
  const [showMobileTooltip, setShowMobileTooltip] = useState(false);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pointerDownRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasDragStartedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isDragging) {
      return;
    }

    pointerDownRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    hasDragStartedRef.current = false;

    if (isMobile) {
      longPressTimerRef.current = setTimeout(() => {
        if (pointerDownRef.current && !hasDragStartedRef.current) {
          hasDragStartedRef.current = true;
          pointerDownRef.current = null;
          onPointerDragStart?.(e, assignment);
        }
      }, MOBILE_LONG_PRESS_MS);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointerDownRef.current || hasDragStartedRef.current || isDragging) {
      return;
    }

    const deltaX = Math.abs(e.clientX - pointerDownRef.current.x);
    const deltaY = Math.abs(e.clientY - pointerDownRef.current.y);
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (isMobile) {
      if (distance > DRAG_THRESHOLD_PX) {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
        }
        pointerDownRef.current = null;
      }
    } else {
      if (distance > DRAG_THRESHOLD_PX && !hasDragStartedRef.current) {
        hasDragStartedRef.current = true;
        pointerDownRef.current = null;
        onPointerDragStart?.(e, assignment);
      }
    }
  };

  const handlePointerUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }

    const wasClick = pointerDownRef.current && !hasDragStartedRef.current;
    const elapsed = pointerDownRef.current ? Date.now() - pointerDownRef.current.time : 0;

    pointerDownRef.current = null;

    if (wasClick && elapsed < 300) {
      if (isMobile) {
        setShowMobileTooltip(!showMobileTooltip);
        if (tooltipTimeoutRef.current) {
          clearTimeout(tooltipTimeoutRef.current);
        }
        tooltipTimeoutRef.current = setTimeout(() => setShowMobileTooltip(false), 3000);
      }
      onClick();
    }
  };

  const handlePointerCancel = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    pointerDownRef.current = null;
    hasDragStartedRef.current = false;
  };

  const hasViolations = hardViolations > 0 || softViolations > 0;
  const hasHardViolations = hardViolations > 0;

  const blockContent = (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className={cn(
        "absolute top-1 rounded-md flex items-center gap-1 text-white text-xs font-medium shadow-sm hover-elevate active-elevate-2 transition-all cursor-grab overflow-hidden select-none touch-none",
        roleColor,
        isDraft && !isGeneratedDraft && "opacity-80 border-2 border-dashed border-white/50",
        isGeneratedDraft && "opacity-90 border-2 border-dashed border-amber-300",
        isMobile ? "h-12 px-1.5" : "h-10 px-2",
        isDragging && "opacity-50 cursor-grabbing ring-2 ring-white/50",
        isLongPressActive && "ring-2 ring-white animate-pulse",
        hasHardViolations &&
          "hover:ring-2 hover:ring-red-500 hover:ring-offset-1 hover:ring-offset-background",
        hasViolations &&
          !hasHardViolations &&
          "hover:ring-2 hover:ring-amber-400 hover:ring-offset-1 hover:ring-offset-background"
      )}
      style={{
        left: `${leftPercent}%`,
        width: `calc(${widthPercent}% - 4px)`,
        minWidth: isMobile ? "48px" : "60px",
      }}
      data-testid={`assignment-block-${assignment.id}`}
      data-assignment-id={assignment.id}
    >
      {!isMobile && <Move className="h-3 w-3 shrink-0 opacity-60" />}
      {fatigueRisk && <FatigueRiskBadge riskLevel={fatigueRisk} compact />}
      {isGeneratedDraft && <Sparkles className="h-3 w-3 shrink-0 text-amber-300" />}
      <span className="truncate flex-1 text-left">{assignment.crewName}</span>
      {dragCompliancePreview && !dragCompliancePreview.isLoading && (
        <span
          className={cn(
            "w-2 h-2 rounded-full shrink-0",
            dragCompliancePreview.canAssign ? "bg-green-400" : "bg-red-400"
          )}
        />
      )}
      {(hardViolations > 0 || softViolations > 0) && !dragCompliancePreview && (
        <div className="flex items-center gap-0.5 shrink-0">
          {hardViolations > 0 && (
            <span
              className={cn(
                "flex items-center justify-center rounded-full bg-red-600",
                isMobile ? "w-5 h-5 text-[11px]" : "w-4 h-4 text-[10px]"
              )}
            >
              {hardViolations}
            </span>
          )}
          {softViolations > 0 && (
            <span
              className={cn(
                "flex items-center justify-center rounded-full bg-amber-500",
                isMobile ? "w-5 h-5 text-[11px]" : "w-4 h-4 text-[10px]"
              )}
            >
              {softViolations}
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <div className="relative">
        {blockContent}
        {showMobileTooltip && (
          <div
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-popover text-popover-foreground border rounded-md shadow-lg p-2 z-50 min-w-[160px]"
            style={{ left: `${leftPercent + widthPercent / 2}%` }}
          >
            <p className="font-medium text-sm">{assignment.crewName}</p>
            <p className="text-xs text-muted-foreground">{assignment.role}</p>
            <p className="text-xs mt-1">
              {format(parseISO(assignment.startDate), "MMM d")} -{" "}
              {format(parseISO(assignment.endDate), "MMM d")}
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{blockContent}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-medium">{assignment.crewName}</p>
          <p className="text-xs text-muted-foreground">{assignment.role}</p>
          <p className="text-xs">
            {format(parseISO(assignment.startDate), "MMM d")} -{" "}
            {format(parseISO(assignment.endDate), "MMM d")}
          </p>
          {fatigueRisk && (
            <div className="flex items-center gap-1 pt-1 border-t">
              <span className="text-xs text-muted-foreground">Fatigue:</span>
              <FatigueRiskBadge riskLevel={fatigueRisk} />
            </div>
          )}
          {(hardViolations > 0 || softViolations > 0) && (
            <div className="flex gap-2 pt-1 border-t">
              {hardViolations > 0 && (
                <span className="text-xs text-red-500">{hardViolations} hard constraint(s)</span>
              )}
              {softViolations > 0 && (
                <span className="text-xs text-amber-500">{softViolations} soft warning(s)</span>
              )}
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
