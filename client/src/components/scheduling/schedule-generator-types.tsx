import { Badge } from "@/components/ui/badge";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";

export interface SimulatedAssignment {
  id: string;
  date: string;
  shiftId: string;
  crewId: string;
  crewName: string;
  vesselId: string;
  vesselName: string;
  start: string;
  end: string;
  role: string;
  whySelected: string;
  score: number;
  isNew: boolean;
  wouldCollide: boolean;
  collidesWithId?: string;
  status?: "ok" | "warning" | "blocked";
  warningReason?: string;
}

export interface SimulationResult {
  mode: "simulate";
  simulationId: string;
  stats: {
    duration_ms: number;
    proposed: number;
    unfilled: number;
    collisions: number;
    existingKept: number;
    reasons: Array<{ reason: string; count: number }>;
  };
  proposed: SimulatedAssignment[];
  unfilled: Array<{
    day: string;
    shiftId: string;
    vesselId?: string;
    vesselName?: string;
    need: number;
    reason: string;
    rejectedCrew?: Array<{ crewId: string; crewName: string; reason: string }>;
  }>;
  collisions: Array<{
    proposedCrewId: string;
    proposedCrewName: string;
    existingAssignmentId: string;
    date: string;
    reason: string;
  }>;
}

export interface ApplyResult {
  applied: number;
  skipped: number;
  runId: string;
}

export interface SchedulerRun {
  id: string;
  orgId: string;
  status: "pending" | "applied" | "cancelled" | "draft";
  fromDate: string;
  toDate: string;
  createdAt: string;
  appliedAt?: string;
  generatedByRunId?: string;
  stats?: {
    proposed: number;
    unfilled: number;
    collisions: number;
  };
}

export interface ScheduleGeneratorPanelProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function getAssignmentStatusBadge(assignment: SimulatedAssignment) {
  if (assignment.wouldCollide) {
    return (
      <Badge variant="destructive" className="text-xs">
        Blocked
      </Badge>
    );
  }
  if (assignment.status === "warning" || assignment.warningReason) {
    return (
      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
        Soft Warning
      </Badge>
    );
  }
  return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">OK</Badge>;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function getAvatarColor(name: string): string {
  const colors = [
    "bg-blue-600",
    "bg-green-600",
    "bg-purple-600",
    "bg-orange-600",
    "bg-pink-600",
    "bg-cyan-600",
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index] ?? "bg-slate-500";
}

export function getDeltaIcon(delta: number, metric: "proposed" | "unfilled" | "collisions") {
  if (delta === 0) {
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  }
  const isPositive = delta > 0;

  if (metric === "proposed") {
    if (isPositive) {
      return <ArrowUp className="h-3 w-3 text-green-400" />;
    }
    return <ArrowDown className="h-3 w-3 text-amber-400" />;
  }
  if (isPositive) {
    return <ArrowUp className="h-3 w-3 text-red-400" />;
  }
  return <ArrowDown className="h-3 w-3 text-green-400" />;
}
