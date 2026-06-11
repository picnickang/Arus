import { memo, useMemo } from "react";

import { Ship } from "lucide-react";
import { format, isToday, isSameDay } from "date-fns";
import {
  type ScheduleAssignment,
  type FatigueResult,
} from "@/features/crew/hooks/useSchedulePlannerData";
import { cn } from "@/lib/utils";
import { getRoleColor, type DragState } from "../schedule-planner-utils";

import type { DragCompliancePreview } from "./types";

import { AssignmentBlock } from "./AssignmentBlock";

interface VesselRowProps {
  vessel: { id: string; name: string; type?: string | undefined };
  assignments: ScheduleAssignment[];
  timelineDays: Date[];
  calculateBlockPosition: (a: ScheduleAssignment) => { startOffset: number; duration: number };
  getConstraintSummary: (a: ScheduleAssignment) => { hard: number; soft: number };
  getCrewFatigue: (crewId: string) => FatigueResult | undefined;
  onAssignmentClick: (id: string) => void;
  onEmptyCellClick: (vesselId: string, vesselName: string, date: Date) => void;
  isMobile?: boolean | undefined;
  onPointerDragStart?:
    | ((e: React.PointerEvent, assignment: ScheduleAssignment) => void)
    | undefined;
  dragState?: DragState | null | undefined;
  dragCompliancePreview?: DragCompliancePreview | null | undefined;
  dragTargetVesselId?: string | null | undefined;
  dragTargetDate?: Date | null | undefined;
}

function VesselRowImpl({
  vessel,
  assignments,
  timelineDays,
  calculateBlockPosition,
  getConstraintSummary,
  getCrewFatigue,
  onAssignmentClick,
  onEmptyCellClick,
  isMobile = false,
  onPointerDragStart,
  dragState,
  dragCompliancePreview,
  dragTargetVesselId,
  dragTargetDate,
}: VesselRowProps) {
  const totalDays = timelineDays.length;
  const uniqueRoles = useMemo(() => {
    const roles = new Set(assignments.map((a) => a.role));
    return Array.from(roles);
  }, [assignments]);

  const assignmentsByRole = useMemo(() => {
    const map: Record<string, ScheduleAssignment[]> = {};
    for (const role of uniqueRoles) {
      map[role] = assignments.filter((a) => a.role === role);
    }
    return map;
  }, [assignments, uniqueRoles]);

  const isRowHighlighted = dragState && dragTargetVesselId === vessel.id;

  return (
    <div
      className={cn("border-b transition-colors", isRowHighlighted && "bg-primary/5")}
      data-testid={`vessel-row-${vessel.id}`}
    >
      <div className="flex">
        <div
          className={cn(
            "shrink-0 border-r bg-muted/30 p-2 md:p-3 sticky left-0 z-10",
            isMobile ? "w-28" : "w-48"
          )}
        >
          <div className="flex items-center gap-2">
            <Ship className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-xs md:text-sm truncate">{vessel.name}</p>
              {vessel.type && !isMobile && (
                <p className="text-xs text-muted-foreground">{vessel.type}</p>
              )}
            </div>
          </div>
          {!isMobile && (
            <div className="mt-2 space-y-1">
              {uniqueRoles.slice(0, 3).map((role) => (
                <div key={role} className="flex items-center gap-1.5">
                  <div className={cn("w-2 h-2 rounded-full", getRoleColor(role))} />
                  <span className="text-xs text-muted-foreground truncate">{role}</span>
                </div>
              ))}
              {uniqueRoles.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{uniqueRoles.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>
        <div className={cn("flex-1 relative", isMobile ? "min-h-[80px]" : "min-h-[100px]")}>
          <div className="absolute inset-0 flex">
            {timelineDays.map((day, i) => {
              const isCellTarget =
                dragState &&
                dragTargetVesselId === vessel.id &&
                dragTargetDate &&
                isSameDay(day, dragTargetDate);

              return (
                <div
                  key={i}
                  onClick={() => !dragState && onEmptyCellClick(vessel.id, vessel.name, day)}
                  className={cn(
                    "flex-1 border-r hover-elevate transition-colors cursor-pointer",
                    isMobile ? "min-w-[32px]" : "min-w-[40px]",
                    isToday(day) && "bg-primary/5",
                    isCellTarget && "bg-primary/20 ring-2 ring-inset ring-primary/50"
                  )}
                  data-testid={`cell-${vessel.id}-${format(day, "yyyy-MM-dd")}`}
                  aria-label={`Add assignment on ${format(day, "MMM d")} for ${vessel.name}`}
                />
              );
            })}
          </div>
          <div className="relative p-1 space-y-1 pointer-events-none">
            {Object.entries(assignmentsByRole).map(([role, roleAssignments], rowIndex) => (
              <div
                key={role}
                className={cn("relative", isMobile ? "h-14" : "h-12")}
                style={{ marginTop: rowIndex > 0 ? "2px" : 0 }}
              >
                {roleAssignments.map((assignment) => {
                  const pos = calculateBlockPosition(assignment);
                  const summary = getConstraintSummary(assignment);
                  const fatigue = getCrewFatigue(assignment.crewId);
                  const isBeingDragged = dragState?.assignmentId === assignment.id;
                  return (
                    <div key={assignment.id} className="pointer-events-auto">
                      <AssignmentBlock
                        assignment={assignment}
                        startOffset={pos.startOffset}
                        duration={pos.duration}
                        totalDays={totalDays}
                        onClick={() => onAssignmentClick(assignment.id)}
                        hardViolations={summary.hard}
                        softViolations={summary.soft}
                        {...(fatigue?.riskLevel !== undefined && {
                          fatigueRisk: fatigue.riskLevel,
                        })}
                        isMobile={isMobile}
                        onPointerDragStart={onPointerDragStart}
                        isDragging={isBeingDragged}
                        dragCompliancePreview={isBeingDragged ? dragCompliancePreview : null}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
            {assignments.length === 0 && (
              <div
                className={cn(
                  "flex items-center justify-center text-xs text-muted-foreground pointer-events-none",
                  isMobile ? "h-14" : "h-12"
                )}
              >
                Tap a date to add assignment
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// A row only depends on drag state when it is the drag source (its assignment
// is being moved) or the current drop target (highlight + cell rings).
function isInvolvedInDrag(props: VesselRowProps): boolean {
  if (!props.dragState) {
    return false;
  }
  return (
    props.dragTargetVesselId === props.vessel.id || props.dragState.vesselId === props.vessel.id
  );
}

function vesselRowPropsEqual(prev: VesselRowProps, next: VesselRowProps): boolean {
  if (
    prev.vessel !== next.vessel ||
    prev.assignments !== next.assignments ||
    prev.timelineDays !== next.timelineDays ||
    prev.calculateBlockPosition !== next.calculateBlockPosition ||
    prev.getConstraintSummary !== next.getConstraintSummary ||
    prev.getCrewFatigue !== next.getCrewFatigue ||
    prev.onAssignmentClick !== next.onAssignmentClick ||
    prev.onEmptyCellClick !== next.onEmptyCellClick ||
    prev.isMobile !== next.isMobile ||
    prev.onPointerDragStart !== next.onPointerDragStart
  ) {
    return false;
  }
  // Drag start/end must reach every row: the cell click guards close over
  // dragState, and a stale null/non-null flip there changes click behavior.
  const prevDragActive = Boolean(prev.dragState);
  const nextDragActive = Boolean(next.dragState);
  if (prevDragActive !== nextDragActive) {
    return false;
  }
  if (!nextDragActive) {
    return true;
  }
  // Mid-drag (dragState identity churns every pointer move): only re-render
  // rows entering, leaving, or participating in the drag.
  return !isInvolvedInDrag(prev) && !isInvolvedInDrag(next);
}

export const VesselRow = memo(VesselRowImpl, vesselRowPropsEqual);
