/**
 * Compliance Application Service
 *
 * Findings/rules use-cases over the IComplianceRepository port (constructor DI),
 * plus the per-vessel open-findings summary aggregation. Delegation uses
 * `Parameters<...>` so the service tracks the port signatures exactly without
 * re-transcribing the raw-row storage types.
 */

import type { IComplianceRepository } from "../domain/ports";
import type { VesselFindingsSummary } from "../domain/types";

export class ComplianceService {
  constructor(private readonly repo: IComplianceRepository) {}

  // ===== Findings =====
  getComplianceFindings(...args: Parameters<IComplianceRepository["getComplianceFindings"]>) {
    return this.repo.getComplianceFindings(...args);
  }
  getComplianceFindingById(
    ...args: Parameters<IComplianceRepository["getComplianceFindingById"]>
  ) {
    return this.repo.getComplianceFindingById(...args);
  }
  createComplianceFinding(...args: Parameters<IComplianceRepository["createComplianceFinding"]>) {
    return this.repo.createComplianceFinding(...args);
  }
  acknowledgeComplianceFinding(
    ...args: Parameters<IComplianceRepository["acknowledgeComplianceFinding"]>
  ) {
    return this.repo.acknowledgeComplianceFinding(...args);
  }
  resolveComplianceFinding(
    ...args: Parameters<IComplianceRepository["resolveComplianceFinding"]>
  ) {
    return this.repo.resolveComplianceFinding(...args);
  }
  suppressComplianceFinding(
    ...args: Parameters<IComplianceRepository["suppressComplianceFinding"]>
  ) {
    return this.repo.suppressComplianceFinding(...args);
  }
  deleteComplianceFinding(...args: Parameters<IComplianceRepository["deleteComplianceFinding"]>) {
    return this.repo.deleteComplianceFinding(...args);
  }

  // ===== Rules =====
  getComplianceRules(...args: Parameters<IComplianceRepository["getComplianceRules"]>) {
    return this.repo.getComplianceRules(...args);
  }
  getComplianceRuleById(...args: Parameters<IComplianceRepository["getComplianceRuleById"]>) {
    return this.repo.getComplianceRuleById(...args);
  }
  createComplianceRule(...args: Parameters<IComplianceRepository["createComplianceRule"]>) {
    return this.repo.createComplianceRule(...args);
  }
  updateComplianceRule(...args: Parameters<IComplianceRepository["updateComplianceRule"]>) {
    return this.repo.updateComplianceRule(...args);
  }
  deleteComplianceRule(...args: Parameters<IComplianceRepository["deleteComplianceRule"]>) {
    return this.repo.deleteComplianceRule(...args);
  }

  // ===== Derived: per-vessel open-findings summary =====
  async getVesselFindingsSummary(
    orgId: string,
    vesselId: string
  ): Promise<VesselFindingsSummary> {
    const findings = await this.repo.getComplianceFindings(orgId, {
      vesselId,
      status: "open",
    });

    return {
      vesselId,
      totalOpenFindings: findings.length,
      bySeverity: {
        critical: findings.filter((f) => f["severity"] === "critical").length,
        warning: findings.filter((f) => f["severity"] === "warning").length,
        info: findings.filter((f) => f["severity"] === "info").length,
      },
      bySource: {
        logbook_deck: findings.filter((f) => f["sourceType"] === "logbook_deck").length,
        logbook_engine: findings.filter((f) => f["sourceType"] === "logbook_engine").length,
        crew: findings.filter((f) => f["sourceType"] === "crew").length,
        maintenance: findings.filter((f) => f["sourceType"] === "maintenance").length,
        telemetry: findings.filter((f) => f["sourceType"] === "telemetry").length,
      },
      byCategory: {
        operational: findings.filter((f) => f["category"] === "operational").length,
        safety: findings.filter((f) => f["category"] === "safety").length,
        data_integrity: findings.filter((f) => f["category"] === "data_integrity").length,
        regulatory: findings.filter((f) => f["category"] === "regulatory").length,
      },
      recentFindings: findings.slice(0, 10),
    };
  }
}
