import { describe, expect, it } from "@jest/globals";
import { OperatorExperienceService } from "../../server/domains/workflow/operator-experience/application/operator-experience.service";
import { StaticOperatorRoleProfileAdapter } from "../../server/domains/workflow/operator-experience/infrastructure/static-role-profile.adapter";
import type {
  OperatorExperienceEvent,
  OperatorExperienceSignalSnapshot,
  RecordedOperatorExperienceEvent,
} from "../../server/domains/workflow/operator-experience/domain/types";
import type {
  OperatorExperienceEventPort,
  OperatorExperienceSignalsPort,
} from "../../server/domains/workflow/operator-experience/domain/ports";

class FakeSignalsPort implements OperatorExperienceSignalsPort {
  constructor(private readonly snapshot: OperatorExperienceSignalSnapshot) {}

  async getSnapshot(_orgId: string): Promise<OperatorExperienceSignalSnapshot> {
    return this.snapshot;
  }
}

class MemoryEventPort implements OperatorExperienceEventPort {
  readonly records: RecordedOperatorExperienceEvent[] = [];

  async record(orgId: string, event: OperatorExperienceEvent): Promise<RecordedOperatorExperienceEvent> {
    const record: RecordedOperatorExperienceEvent = {
      ...event,
      id: `event-${this.records.length + 1}`,
      orgId,
      occurredAt: event.occurredAt ?? "2026-01-01T00:00:00.000Z",
    };
    this.records.push(record);
    return record;
  }

  async listRecent(orgId: string, limit: number): Promise<RecordedOperatorExperienceEvent[]> {
    return this.records.filter((record) => record.orgId === orgId).slice(-limit).reverse();
  }
}

function snapshot(overrides: Partial<OperatorExperienceSignalSnapshot> = {}): OperatorExperienceSignalSnapshot {
  return {
    attentionItems: 9,
    criticalItems: 2,
    blockedItems: 3,
    waitingOnParts: 2,
    readyForCloseout: 1,
    handoverNotes: 2,
    offlinePending: 4,
    conflicts: 1,
    pdmRisks: 3,
    dataQualityWarnings: 1,
    lastSyncAt: null,
    sourceHealth: {
      workOrders: "ok",
      alerts: "ok",
      equipment: "ok",
      inventory: "failed",
    },
    ...overrides,
  };
}

function serviceFor(signals: OperatorExperienceSignalSnapshot) {
  return new OperatorExperienceService(
    new FakeSignalsPort(signals),
    new StaticOperatorRoleProfileAdapter(),
    new MemoryEventPort()
  );
}

describe("operator experience hexagonal service", () => {
  it("builds a role-specific command brief from workflow signals", async () => {
    const service = serviceFor(snapshot());

    const brief = await service.buildBrief("org-test", {
      role: "chief_engineer",
      currentPath: "/operations",
      deviceClass: "tablet",
      connectionState: "online",
    });

    expect(brief.orgId).toBe("org-test");
    expect(brief.role.label).toBe("Chief Engineer");
    expect(brief.executiveSummary).toContain("9 attention item");
    expect(brief.nextActions[0]?.href).toBe("/attention-inbox");
    expect(brief.nextActions.some((action) => action.id === "resolve-blockers")).toBe(true);
    expect(brief.nextActions.some((action) => action.id === "offline-conflicts")).toBe(true);
    expect(brief.pillarScores).toHaveLength(6);
    expect(brief.frictionPoints.map((point) => point.id)).toContain("blocked-work");
    expect(brief.trustSignals.map((signal) => signal.id)).toContain("source-health");
    expect(brief.solutionMap.learnFromOutcome).toMatch(/PdM calibration/i);
    expect(brief.userQuestionsAnswered).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ question: "Who is the user?" }),
        expect.objectContaining({ question: "What information builds trust?" }),
      ])
    );
  });

  it("changes the primary action for technicians and deck officers", async () => {
    const service = serviceFor(snapshot({ criticalItems: 0, blockedItems: 0, conflicts: 0 }));

    const technician = await service.buildBrief("org-test", { role: "technician" });
    const deck = await service.buildBrief("org-test", { role: "deck_officer" });

    expect(technician.nextActions[0]).toMatchObject({ id: "scan-equipment", href: "/equipment-scan" });
    expect(deck.nextActions[0]).toMatchObject({ id: "prepare-handover", href: "/attention-inbox?view=handover" });
  });

  it("records and lists operator experience events through the event port", async () => {
    const events = new MemoryEventPort();
    const service = new OperatorExperienceService(
      new FakeSignalsPort(snapshot({ attentionItems: 0, criticalItems: 0, conflicts: 0 })),
      new StaticOperatorRoleProfileAdapter(),
      events
    );

    const saved = await service.recordEvent("org-test", {
      eventType: "cta_click",
      role: "chief_engineer",
      path: "/operator-experience",
      label: "Open Attention Inbox",
    });
    const recent = await service.listRecentEvents("org-test", 5);

    expect(saved.id).toBe("event-1");
    expect(recent).toHaveLength(1);
    expect(recent[0]).toMatchObject({ label: "Open Attention Inbox", orgId: "org-test" });
  });
});
