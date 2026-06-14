import { useLocation } from "wouter";
import { useOperationalWorkflow } from "@/features/workflow/useOperationalWorkflow";
import type { WorkflowSeverity } from "@/features/workflow/types";
import OpsStatusRail from "./OpsStatusRail";
import ActionCard from "./ActionCard";

/**
 * Maps the workflow attention severities onto the rail's high/medium/low scale.
 */
const RAIL_SEVERITY: Record<WorkflowSeverity, "high" | "medium" | "low"> = {
  critical: "high",
  warning: "medium",
  info: "low",
  success: "low",
};

/**
 * Wires the Persistent Ops Status Rail + Standardized ActionCard to the live
 * attention feed so critical operational information is always visible across
 * every hub route.
 *
 * Implements the always-visible HMI surface claimed in
 * docs/compliance/Maritime-HMI-Compliance.md (§1 SOLAS V/15 S-Mode, §2
 * IEC 62288). Mounted once in UniversalOpsShell.
 */
export function OpsStatusRailContainer() {
  const [, setLocation] = useLocation();
  const { attentionItems } = useOperationalWorkflow();

  const items = attentionItems ?? [];
  const risks = items
    .filter((item) => item.severity === "critical" || item.severity === "warning")
    .map((item) => ({
      id: item.id,
      label: item.title,
      severity: RAIL_SEVERITY[item.severity],
    }));

  const topCritical = items.find((item) => item.severity === "critical");

  const handleAction = (action: string) => {
    if (action === "review-outbox") {
      setLocation("/offline-outbox");
      return;
    }
    // Other actions (accept/snooze/handover/details/refresh) are surfaced as a
    // namespaced event so feature code can subscribe without coupling the shell
    // to specific routes.
    window.dispatchEvent(new CustomEvent("arus:ops-action", { detail: { action } }));
  };

  return (
    <div data-testid="ops-status-rail-container">
      <OpsStatusRail risks={risks} onAction={handleAction} />
      {topCritical && (
        <div className="px-4 pb-2 pt-2 md:px-6">
          <ActionCard
            title={topCritical.title}
            description={topCritical.recommendedAction}
            severity="high"
            source={topCritical.source}
            onAccept={() => handleAction("accept-risk")}
            onSnooze={() => handleAction("snooze-risk")}
            onDetails={() => handleAction("open-details")}
          />
        </div>
      )}
    </div>
  );
}

export default OpsStatusRailContainer;
