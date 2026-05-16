import type { OperatorRole } from "../../domain/types.js";
import type { RoleInformationNeedCatalogPort, RoleInformationSignalPort } from "../domain/ports.js";
import type { RoleInformationNeedSummary } from "../domain/types.js";
import { prioritizeInformationNeed, sortInformationNeeds } from "../domain/prioritization.js";

const ROLE_LABELS: Record<OperatorRole, string> = {
  chief_engineer: "Chief Engineer",
  second_engineer: "Second Engineer",
  deck_officer: "Deck Officer",
  technician: "Technician",
  fleet_manager: "Fleet Manager",
  superintendent: "Superintendent",
  system_admin: "System Admin",
};

const PRIMARY_QUESTIONS: Record<OperatorRole, string> = {
  chief_engineer: "What machinery, maintenance, parts, or closeout item needs my action today?",
  second_engineer: "What equipment readings, assigned jobs, or defects need inspection during this watch?",
  deck_officer: "What must be logged, handed over, or escalated before the next watch?",
  technician: "What exactly should I fix, verify, photograph, or close out next?",
  fleet_manager: "Which vessel, asset, or backlog item creates the highest business risk?",
  superintendent: "Where do I need to intervene to protect uptime, compliance, and maintenance quality?",
  system_admin: "Is the system healthy enough for operators to trust the data and workflow?",
};

function buildHeadline(role: OperatorRole, urgentCount: number, total: number): string {
  const label = ROLE_LABELS[role];
  if (urgentCount > 0) {
    return `${label}: ${urgentCount} high-priority information need(s) require action out of ${total}.`;
  }
  return `${label}: ${total} role-specific information need(s) are available; no critical UX risk is currently visible.`;
}

function uniqueTrustChecklist(needs: RoleInformationNeedSummary["needs"]): string[] {
  return [...new Set(needs.flatMap((need) => need.trustEvidence))].slice(0, 10);
}

export class RoleInformationNeedsService {
  constructor(
    private readonly catalogPort: RoleInformationNeedCatalogPort,
    private readonly signalPort: RoleInformationSignalPort
  ) {}

  listRoles(): OperatorRole[] {
    return this.catalogPort.listRoles();
  }

  async buildSummary(orgId: string, role: OperatorRole): Promise<RoleInformationNeedSummary> {
    const [definitions, signals] = await Promise.all([
      Promise.resolve(this.catalogPort.listForRole(role)),
      this.signalPort.getSnapshot(orgId),
    ]);
    const needs = sortInformationNeeds(definitions.map((definition) => prioritizeInformationNeed(definition, signals)));
    const urgentCount = needs.filter((need) => need.priority === "urgent" || need.priority === "critical").length;

    return {
      generatedAt: new Date().toISOString(),
      orgId,
      role,
      roleLabel: ROLE_LABELS[role],
      headline: buildHeadline(role, urgentCount, needs.length),
      primaryQuestion: PRIMARY_QUESTIONS[role],
      topNeeds: needs.slice(0, 5),
      needs,
      trustChecklist: uniqueTrustChecklist(needs),
      uxGuidance: {
        clarity: "Show the role's primary question, evidence, urgency, owner, and one next action before secondary details.",
        speed: "Keep the first action one tap away and avoid making users wait for a full dashboard before triage.",
        simplicity: "Group information by operational job-to-be-done, not by internal database or module names.",
        trust: "Pair every recommendation with source health, freshness, confidence, auditability, and evidence.",
        retention: "Make daily use rewarding by turning risks into work, handover, closeout proof, and outcome learning.",
      },
    };
  }
}
