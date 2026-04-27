import type { WorkflowAction } from "./types";

export const roleWorkflowGuidance: Record<string, WorkflowAction[]> = {
  chief_engineer: [
    {
      id: "review-critical-equipment",
      label: "Review equipment risk",
      description: "Start with high-risk equipment, then convert confirmed risk into work orders.",
      href: "/attention-inbox?filter=equipment",
      severity: "warning",
    },
    {
      id: "clear-parts-blockers",
      label: "Clear parts blockers",
      description: "Resolve missing parts before dispatching technicians or vendors.",
      href: "/attention-inbox?queue=blocked",
      severity: "critical",
    },
    {
      id: "complete-engine-log",
      label: "Complete engine handover",
      description: "Use log exceptions to create findings or maintenance actions.",
      href: "/logs/engine",
      severity: "info",
    },
  ],
  deck_officer: [
    {
      id: "complete-watch-log",
      label: "Complete watch log",
      description: "Record deck activity, exceptions, and required handover notes.",
      href: "/logs/deck",
      severity: "info",
    },
    {
      id: "review-findings",
      label: "Review deck findings",
      description: "Classify open findings and escalate safety/compliance issues.",
      href: "/findings",
      severity: "warning",
    },
    {
      id: "check-compliance",
      label: "Check compliance items",
      description: "Confirm required log and certificate items before handover.",
      href: "/logs/compliance",
      severity: "warning",
    },
  ],
  fleet_manager: [
    {
      id: "review-readiness",
      label: "Review vessel readiness",
      description: "Check overdue maintenance, certificate risk, blocked jobs, and open findings.",
      href: "/attention-inbox",
      severity: "critical",
    },
    {
      id: "approve-priorities",
      label: "Approve daily priorities",
      description: "Assign owners or defer items with a reason before the daily briefing.",
      href: "/briefing",
      severity: "warning",
    },
    {
      id: "review-governance",
      label: "Review governance",
      description: "Confirm audit, compliance, and report exceptions are under control.",
      href: "/governance-dashboard",
      severity: "info",
    },
  ],
  system_admin: [
    {
      id: "system-health",
      label: "Check system health",
      description: "Review sync, sensors, diagnostics, and configuration warnings.",
      href: "/diagnostics",
      severity: "warning",
    },
    {
      id: "admin-settings",
      label: "Review configuration",
      description: "Keep users, sensors, storage, and notification settings aligned.",
      href: "/system",
      severity: "info",
    },
    {
      id: "sensor-health",
      label: "Review sensors",
      description: "Confirm telemetry quality before relying on analytics or PdM scores.",
      href: "/sensors",
      severity: "info",
    },
  ],
  default: [
    {
      id: "open-attention-inbox",
      label: "Open Attention Inbox",
      description: "Work from the highest-risk item instead of browsing modules.",
      href: "/attention-inbox",
      severity: "critical",
    },
    {
      id: "create-work-order",
      label: "Create work order",
      description: "Capture corrective action with equipment, owner, due date, and evidence.",
      href: "/work-orders?action=create",
      severity: "info",
    },
    {
      id: "prepare-handover",
      label: "Prepare handover",
      description: "Review open issues, blockers, and completed work before shift change.",
      href: "/attention-inbox?view=handover",
      severity: "warning",
    },
  ],
};

export function getRoleWorkflowGuidance(roleId: string | null): WorkflowAction[] {
  if (!roleId) {
    return roleWorkflowGuidance.default;
  }
  return roleWorkflowGuidance[roleId] ?? roleWorkflowGuidance.default;
}
