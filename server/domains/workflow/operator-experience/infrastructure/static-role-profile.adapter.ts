import type { OperatorRole, RoleExperienceProfile } from "../domain/types.js";
import type { OperatorRoleProfilePort } from "../domain/ports.js";

const PROFILES: Record<OperatorRole, RoleExperienceProfile> = {
  chief_engineer: {
    role: "chief_engineer",
    label: "Chief Engineer",
    primaryGoal: "Keep critical machinery safe, available, and ready for the next watch.",
    dailyQuestions: [
      "What machinery needs attention right now?",
      "Which work is blocked or overdue?",
      "Can I trust the PdM recommendation?",
      "What must be handed over before watch change?",
    ],
    successDefinition: "Critical risk is converted into owned work with evidence, parts, and closeout feedback.",
    preferredPrimaryAction: "Open Attention Inbox",
  },
  second_engineer: {
    role: "second_engineer",
    label: "Second Engineer",
    primaryGoal: "Execute and verify machinery work with clear priorities and proof.",
    dailyQuestions: [
      "Which jobs are assigned or due today?",
      "What parts or approvals are blocking work?",
      "What evidence is needed to close the job?",
    ],
    successDefinition: "Assigned work moves from open to verified closeout without losing proof.",
    preferredPrimaryAction: "Review Due Today",
  },
  deck_officer: {
    role: "deck_officer",
    label: "Deck Officer",
    primaryGoal: "Maintain deck log, safety, route, compliance, and watch handover continuity.",
    dailyQuestions: [
      "What safety/compliance issues affect the watch?",
      "What needs handover?",
      "Are log entries complete and explainable?",
    ],
    successDefinition: "The next watch inherits clear risks, logs, and unresolved actions.",
    preferredPrimaryAction: "Prepare Handover",
  },
  technician: {
    role: "technician",
    label: "Technician",
    primaryGoal: "Find equipment quickly, complete assigned work, and capture evidence.",
    dailyQuestions: [
      "What job should I do next?",
      "Where is the equipment?",
      "What checklist or evidence is required?",
    ],
    successDefinition: "The technician can scan equipment, perform the work, and close it with proof.",
    preferredPrimaryAction: "Scan Equipment",
  },
  fleet_manager: {
    role: "fleet_manager",
    label: "Fleet Manager",
    primaryGoal: "Understand fleet risk, cost, downtime exposure, and compliance impact.",
    dailyQuestions: [
      "Which vessel has the highest operational risk?",
      "What downtime or cost exposure is growing?",
      "Which recommendations need management action?",
    ],
    successDefinition: "Fleet risk is visible, comparable, and tied to action and business impact.",
    preferredPrimaryAction: "Review Fleet Risk",
  },
  superintendent: {
    role: "superintendent",
    label: "Superintendent",
    primaryGoal: "Resolve escalations, blocked work, and compliance issues across vessels.",
    dailyQuestions: [
      "What requires shore-side escalation?",
      "Which blockers need vendor or procurement action?",
      "What must be verified before departure or audit?",
    ],
    successDefinition: "Escalated work has owner, ETA, and documented resolution path.",
    preferredPrimaryAction: "Review Blockers",
  },
  system_admin: {
    role: "system_admin",
    label: "System Admin",
    primaryGoal: "Keep telemetry, sync, integrations, auth, and auditability healthy.",
    dailyQuestions: [
      "Are sensors and integrations healthy?",
      "Are there sync conflicts?",
      "Are audit and access controls working?",
    ],
    successDefinition: "The operational system is trusted because data, sync, and access controls are healthy.",
    preferredPrimaryAction: "Review System Health",
  },
};

export class StaticOperatorRoleProfileAdapter implements OperatorRoleProfilePort {
  getProfile(role: OperatorRole): RoleExperienceProfile {
    return PROFILES[role] ?? PROFILES.chief_engineer;
  }

  listProfiles(): RoleExperienceProfile[] {
    return Object.values(PROFILES);
  }
}
