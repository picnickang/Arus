import { describe, expect, it } from "@jest/globals";
import express, { type Request, type Response, type NextFunction } from "express";
import request from "supertest";
import { OperatorExperienceService } from "../../server/domains/workflow/operator-experience/application/operator-experience.service";
import { createOperatorExperienceRouter } from "../../server/domains/workflow/operator-experience/interfaces/routes";
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
  async getSnapshot(_orgId: string): Promise<OperatorExperienceSignalSnapshot> {
    return {
      attentionItems: 5,
      criticalItems: 1,
      blockedItems: 2,
      waitingOnParts: 1,
      readyForCloseout: 1,
      handoverNotes: 1,
      offlinePending: 0,
      conflicts: 0,
      pdmRisks: 2,
      dataQualityWarnings: 0,
      lastSyncAt: null,
      sourceHealth: { workOrders: "ok", alerts: "ok", equipment: "ok", inventory: "ok" },
    };
  }
}

class MemoryEventPort implements OperatorExperienceEventPort {
  readonly records: RecordedOperatorExperienceEvent[] = [];
  async record(orgId: string, event: OperatorExperienceEvent): Promise<RecordedOperatorExperienceEvent> {
    const record = {
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

function buildApp() {
  const app = express();
  const events = new MemoryEventPort();
  const service = new OperatorExperienceService(
    new FakeSignalsPort(),
    new StaticOperatorRoleProfileAdapter(),
    events
  );
  app.use(express.json());
  app.use((req: Request & { orgId?: string }, _res: Response, next: NextFunction) => {
    req.orgId = "org-test";
    next();
  });
  app.use("/api/operator-experience", createOperatorExperienceRouter(service));
  return app;
}

describe("operator experience API routes", () => {
  it("returns a role-specific experience brief", async () => {
    const app = buildApp();

    const response = await request(app)
      .get("/api/operator-experience/brief?role=chief_engineer&currentPath=/operations")
      .expect(200);

    expect(response.body).toMatchObject({
      orgId: "org-test",
      role: { role: "chief_engineer", label: "Chief Engineer" },
      signals: { attentionItems: 5, criticalItems: 1 },
    });
    expect(response.body.nextActions.length).toBeGreaterThan(0);
    expect(response.body.pillarScores).toHaveLength(6);
  });

  it("rejects invalid roles", async () => {
    const app = buildApp();

    await request(app)
      .get("/api/operator-experience/brief?role=invalid_role")
      .expect(400);
  });

  it("records and lists UX events", async () => {
    const app = buildApp();

    const saved = await request(app)
      .post("/api/operator-experience/events")
      .send({ eventType: "cta_click", role: "chief_engineer", path: "/operator-experience", label: "Open Attention Inbox" })
      .expect(201);

    expect(saved.body).toMatchObject({ id: "event-1", orgId: "org-test", label: "Open Attention Inbox" });

    const list = await request(app).get("/api/operator-experience/events").expect(200);
    expect(list.body).toHaveLength(1);
  });
});
