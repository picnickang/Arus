import { describe, expect, it } from "@jest/globals";
import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { RoleInformationNeedsService } from "../../server/domains/workflow/operator-experience/information-needs/application/role-information-needs.service";
import { createRoleInformationNeedsRouter } from "../../server/domains/workflow/operator-experience/information-needs/interfaces/routes";
import { StaticRoleInformationCatalogAdapter } from "../../server/domains/workflow/operator-experience/information-needs/infrastructure/static-role-information-catalog.adapter";
import type { OperatorExperienceSignalSnapshot } from "../../server/domains/workflow/operator-experience/domain/types";
import type { RoleInformationSignalPort } from "../../server/domains/workflow/operator-experience/information-needs/domain/ports";

class FakeSignalPort implements RoleInformationSignalPort {
  async getSnapshot(_orgId: string): Promise<OperatorExperienceSignalSnapshot> {
    return {
      attentionItems: 7,
      criticalItems: 1,
      blockedItems: 2,
      waitingOnParts: 1,
      readyForCloseout: 1,
      handoverNotes: 2,
      offlinePending: 3,
      conflicts: 1,
      pdmRisks: 2,
      dataQualityWarnings: 1,
      lastSyncAt: null,
      sourceHealth: { workOrders: "ok", alerts: "ok", equipment: "ok", inventory: "failed" },
    };
  }
}

function buildApp(options: { withOrg?: boolean } = { withOrg: true }) {
  const app = express();
  const service = new RoleInformationNeedsService(
    new StaticRoleInformationCatalogAdapter(),
    new FakeSignalPort()
  );
  app.use(express.json());
  if (options.withOrg !== false) {
    app.use((req: Request & { orgId?: string }, _res: Response, next: NextFunction) => {
      req.orgId = "org-test";
      next();
    });
  }
  app.use("/api/operator-experience/information-needs", createRoleInformationNeedsRouter(service));
  return app;
}

describe("operator information needs API routes", () => {
  it("returns role information needs for a valid role", async () => {
    const response = await request(buildApp())
      .get("/api/operator-experience/information-needs?role=chief_engineer")
      .expect(200);

    expect(response.body).toMatchObject({
      orgId: "org-test",
      role: "chief_engineer",
      roleLabel: "Chief Engineer",
    });
    expect(response.body.topNeeds.length).toBeGreaterThan(0);
    expect(response.body.topNeeds[0]).toHaveProperty("recommendedCta");
    expect(response.body.trustChecklist).toContain("sensor trend");
  });

  it("lists the supported roles", async () => {
    const response = await request(buildApp())
      .get("/api/operator-experience/information-needs/roles")
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining(["chief_engineer", "deck_officer", "system_admin"])
    );
  });

  it("rejects invalid roles", async () => {
    await request(buildApp())
      .get("/api/operator-experience/information-needs?role=invalid_role")
      .expect(400);
  });

  it("requires org context", async () => {
    await request(buildApp({ withOrg: false }))
      .get("/api/operator-experience/information-needs?role=chief_engineer")
      .expect(401);
  });
});
