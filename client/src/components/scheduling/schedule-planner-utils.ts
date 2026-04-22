import { useState, useEffect } from "react";
import type { ScheduleAssignment } from "@/features/crew/hooks/useSchedulePlannerData";

export interface DragState {
  assignmentId: string;
  originalStartDate: string;
  originalEndDate: string;
  crewId: string;
  crewName: string;
  vesselId: string;
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return isMobile;
}

export const ROLE_COLORS: Record<string, string> = {
  Master: "bg-blue-500",
  "Chief Engineer": "bg-purple-500",
  "First Mate": "bg-sky-500",
  Engineer: "bg-violet-500",
  "Deck Cadet": "bg-teal-500",
  Cook: "bg-orange-500",
  Steward: "bg-pink-500",
  default: "bg-slate-500",
};

export function getRoleColor(role: string): string {
  return ROLE_COLORS[role] || ROLE_COLORS.default;
}

export function getStatusBadge(status: ScheduleAssignment["status"]) {
  switch (status) {
    case "draft":
      return { label: "Draft", variant: "secondary" as const };
    case "confirmed":
      return { label: "Confirmed", variant: "default" as const };
    case "published":
      return { label: "Published", variant: "default" as const };
    default:
      return { label: status, variant: "outline" as const };
  }
}

export const DRAG_THRESHOLD_PX = 8;
export const MOBILE_LONG_PRESS_MS = 400;

export type AssignmentFilter = "all" | "published" | "drafts" | "generated";
