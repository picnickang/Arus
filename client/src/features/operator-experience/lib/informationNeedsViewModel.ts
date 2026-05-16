import type { InformationNeedPriority, InformationNeedStatus, UxBusinessGoal } from "../types";

export function priorityVariant(priority: InformationNeedPriority): "default" | "secondary" | "destructive" | "outline" {
  if (priority === "critical") return "destructive";
  if (priority === "urgent") return "secondary";
  if (priority === "important") return "outline";
  return "default";
}

export function statusVariant(status: InformationNeedStatus): "default" | "secondary" | "destructive" | "outline" {
  if (status === "critical") return "destructive";
  if (status === "needs_attention") return "secondary";
  if (status === "watch") return "outline";
  return "default";
}

export function businessGoalLabel(goal: UxBusinessGoal): string {
  return goal.charAt(0).toUpperCase() + goal.slice(1);
}
