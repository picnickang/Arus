import { describe, expect, it } from "@jest/globals";
import { RoleInformationNeedsService } from "../../server/domains/workflow/operator-experience/information-needs/application/role-information-needs.service";
import { StaticRoleInformationCatalogAdapter } from "../../server/domains/workflow/operator-experience/information-needs/infrastructure/static-role-information-catalog.adapter";
import type { OperatorExperienceSignalSnapshot } from "../../server/domains/workflow/operator-experience/domain/types";
import type { RoleInformationSignalPort } from "../../server/domains/workflow/operator-experience/information-needs/domain/ports";

class FakeSignalPort implements RoleInformationSignalPort {
  constructor(private readonly snapshot: OperatorExperienceSignalSnapshot) {}

  async getSnapshot(_orgId: string): Promise<OperatorExperienceSignalSnapshot> {
    return this.snapshot;
  }
}

function snapshot(overrides: Partial<OperatorExperienceSignalSnapshot> = {}): OperatorExperienceSignalSnapshot {
  return {
    attentionItems: 8,
    criticalItems: 2,
    blockedItems: 1,
    waitingOnParts: 1,
    readyForCloseout: 1,
    handoverNotes: 0,
    offlinePending: 0,
    conflicts: 0,
    pdmRisks: 3,
    dataQualityWarnings: 1,
    lastSyncAt: "2026-05-15T12:00:00.000Z",
    sourceHealth: { workOrders: "ok", alerts: "ok", equipment: "ok", inventory: "ok" },
    ...overrides,
  };
}

function serviceFor(signals: OperatorExperienceSignalSnapshot) {
  return new RoleInformationNeedsService(
    new StaticRoleInformationCatalogAdapter(),
    new FakeSignalPort(signals)
  );
}

describe("role information needs service", () => {
  it("builds chief engineer information needs from active operational signals", async () => {
    const service = serviceFor(snapshot());

    const summary = await service.buildSummary("org-test", "chief_engineer");

    expect(summary.orgId).toBe("org-test");
    expect(summary.roleLabel).toBe("Chief Engineer");
    expect(summary.primaryQuestion).toMatch(/machinery/i);
    expect(summary.topNeeds[0]).toMatchObject({
      id: "chief-critical-machinery",
      status: "critical",
      priority: "critical",
    });
    expect(summary.trustChecklist).toEqual(expect.arrayContaining(["sensor trend", "model confidence"]));
    expect(summary.uxGuidance.trust).toMatch(/source health/i);
  });

  it("prioritizes offline conflicts for system admins", async () => {
    const service = serviceFor(snapshot({ conflicts: 2, offlinePending: 6 }));

    const summary = await service.buildSummary("org-test", "system_admin");

    expect(summary.topNeeds[0]).toMatchObject({
      id: "admin-system-trust",
      priority: "critical",
      status: "critical",
    });
    expect(summary.topNeeds[0]?.recommendedCta).toMatch(/Act now/i);
  });

  it("keeps routine needs visible without pretending there is a critical issue", async () => {
    const service = serviceFor(
      snapshot({
        attentionItems: 0,
        criticalItems: 0,
        blockedItems: 0,
        waitingOnParts: 0,
        readyForCloseout: 0,
        pdmRisks: 0,
        dataQualityWarnings: 0,
      })
    );

    const summary = await service.buildSummary("org-test", "technician");

    expect(summary.topNeeds[0]?.status).toBe("healthy");
    expect(summary.headline).toMatch(/no critical UX risk/i);
  });
});
