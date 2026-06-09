import express, { type RequestHandler } from "express";
import request from "supertest";
import { describe, expect, it, beforeAll, beforeEach, jest } from "@jest/globals";
import type { registerVesselDiagramRegistryRoutes as registerVesselDiagramRegistryRoutesType } from "../../server/domains/vessel-diagram-registry/interfaces/routes";
import { VesselDiagramRegistryService } from "../../server/domains/vessel-diagram-registry/application/service";
import { InMemoryVesselDiagramRegistryStore } from "../../server/domains/vessel-diagram-registry/infrastructure/in-memory-store";
import { InMemoryVesselRegistryMediaStore } from "../../server/domains/vessel-diagram-registry/infrastructure/in-memory-media-store";

jest.unstable_mockModule(
  "../../server/domains/vessel-diagram-registry/infrastructure/postgres-store",
  () => ({
    postgresVesselDiagramRegistryStore: {},
  })
);

jest.unstable_mockModule("../../server/lib/permissions/middleware.js", () => ({
  requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

let registerVesselDiagramRegistryRoutes: typeof registerVesselDiagramRegistryRoutesType;

const ORG_ID = "org-test";
const VESSEL_ID = "vessel-test";
const OTHER_VESSEL_ID = "vessel-other";
const limit: RequestHandler = (_req, _res, next) => next();
const auth: RequestHandler = (req, _res, next) => {
  req.user = {
    id: "user-test",
    email: "ops@example.com",
    role: "admin",
    isActive: true,
    orgId: ORG_ID,
  };
  req.orgId = ORG_ID;
  next();
};

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==",
  "base64"
);

function buildApp() {
  const app = express();
  const mediaStore = new InMemoryVesselRegistryMediaStore();
  app.use(express.json({ limit: "20mb" }));
  registerVesselDiagramRegistryRoutes(app, {
    generalApiRateLimit: limit,
    writeOperationRateLimit: limit,
    storageQuota: limit,
    requireOrgId: auth,
    permissionMode: "skip",
    mediaStore,
    service: new VesselDiagramRegistryService(new InMemoryVesselDiagramRegistryStore(), mediaStore),
  });
  return { app, mediaStore };
}

function sampleSection() {
  return {
    sectionKey: "main_engine_room",
    sectionNo: 1,
    name: "Main Engine Room",
    color: "#45a858",
    polygonNormalized: [
      { x: 0.33, y: 0.64 },
      { x: 0.58, y: 0.64 },
      { x: 0.58, y: 0.85 },
      { x: 0.33, y: 0.85 },
    ],
    labelNormalized: { x: 0.45, y: 0.76 },
    thumbnailFallback: "manual -> crop_from_diagram -> generated_placeholder -> section_icon",
    equipment: [
      {
        equipmentName: "Main Engine 1",
        assetCode: "ME-01",
        system: "Propulsion",
      },
    ],
  };
}

async function createDiagram(app: express.Express, title = "General arrangement") {
  return request(app)
    .post(`/api/vessel-intelligence/${VESSEL_ID}/diagrams`)
    .send({
      diagramType: "side_elevation",
      title,
    })
    .expect(201);
}

function svgUploadBody(overrides: Record<string, unknown> = {}) {
  return {
    originalFileName: "general-arrangement.svg",
    mimeType: "image/svg+xml",
    contentBase64: Buffer.from(`<svg viewBox="0 0 895 420"><path d="M0 0h10v10z"/></svg>`).toString(
      "base64"
    ),
    ...overrides,
  };
}

describe("vessel diagram registry routes", () => {
  let app: express.Express;

  beforeAll(async () => {
    ({ registerVesselDiagramRegistryRoutes } = await import(
      "../../server/domains/vessel-diagram-registry/interfaces/routes"
    ));
  });

  beforeEach(() => {
    ({ app } = buildApp());
  });

  it("supports diagram, version, section-map, publish, assignment, and summary CRUD flows", async () => {
    const diagram = await request(app)
      .post(`/api/vessel-intelligence/${VESSEL_ID}/diagrams`)
      .send({
        diagramType: "side_elevation",
        title: "General arrangement",
      })
      .expect(201);

    const upload = await request(app)
      .post(`/api/vessel-intelligence/${VESSEL_ID}/diagrams/${diagram.body.id}/versions/upload`)
      .send({
        originalFileName: "general-arrangement.svg",
        mimeType: "image/svg+xml",
        contentBase64: Buffer.from(
          `<svg viewBox="0 0 895 420"><path d="M0 0h10v10z"/></svg>`
        ).toString("base64"),
      })
      .expect(201);

    expect(upload.body.objectKey).toBeUndefined();
    expect(upload.body.mediaUrl).toBe(
      `/api/vessel-intelligence/${VESSEL_ID}/diagrams/${diagram.body.id}/versions/${upload.body.id}/media`
    );

    await request(app)
      .get(
        `/api/vessel-intelligence/${VESSEL_ID}/diagrams/${diagram.body.id}/versions/${upload.body.id}/media`
      )
      .expect(200)
      .expect("Content-Type", /image\/svg\+xml/);

    await request(app)
      .post(
        `/api/vessel-intelligence/${VESSEL_ID}/diagrams/${diagram.body.id}/versions/${upload.body.id}/set-active`
      )
      .send()
      .expect(200)
      .expect((res) => {
        expect(res.body.objectKey).toBeUndefined();
        expect(res.body.mediaUrl).toBe(upload.body.mediaUrl);
      });

    const map = await request(app)
      .post(`/api/vessel-intelligence/${VESSEL_ID}/section-maps`)
      .send({
        name: "Published side elevation",
        diagramId: diagram.body.id,
        diagramVersionId: upload.body.id,
        sections: [sampleSection()],
      })
      .expect(201);

    await request(app)
      .post(`/api/vessel-intelligence/${VESSEL_ID}/section-maps/${map.body.id}/validate`)
      .send()
      .expect(200)
      .expect((res) => {
        expect(res.body.summary.blockers).toBe(0);
      });

    const published = await request(app)
      .post(`/api/vessel-intelligence/${VESSEL_ID}/section-maps/${map.body.id}/publish`)
      .send()
      .expect(200);

    const sectionId = published.body.sections[0].id;
    await request(app)
      .post(
        `/api/vessel-intelligence/${VESSEL_ID}/section-maps/${published.body.id}/sections/${sectionId}/equipment`
      )
      .send({
        equipmentName: "Sea Water Pump 1",
        assetCode: "SWP-01",
        system: "Cooling",
      })
      .expect(201);

    const thumbnail = await request(app)
      .post(`/api/vessel-intelligence/${VESSEL_ID}/sections/${sectionId}/thumbnail/upload`)
      .send({
        originalFileName: "section.png",
        mimeType: "image/png",
        contentBase64: PNG_1X1.toString("base64"),
      })
      .expect(201);

    expect(thumbnail.body.objectKey).toBeUndefined();
    expect(thumbnail.body.mediaUrl).toBe(
      `/api/vessel-intelligence/${VESSEL_ID}/sections/${sectionId}/thumbnail`
    );

    await request(app)
      .get(`/api/vessel-intelligence/${VESSEL_ID}/sections/${sectionId}/thumbnail`)
      .expect(200)
      .expect("Content-Type", /image\/png/);

    await request(app)
      .get(`/api/vessel-intelligence/${VESSEL_ID}/summary`)
      .expect(200)
      .expect((res) => {
        expect(res.body.activeDiagram.id).toBe(diagram.body.id);
        expect(res.body.activeSectionMap.id).toBe(published.body.id);
        expect(res.body.diagrams).toHaveLength(1);
      });
  });

  it("rejects unsafe SVG uploads before creating a version", async () => {
    const diagram = await request(app)
      .post(`/api/vessel-intelligence/${VESSEL_ID}/diagrams`)
      .send({
        diagramType: "side_elevation",
        title: "Unsafe SVG",
      })
      .expect(201);

    await request(app)
      .post(`/api/vessel-intelligence/${VESSEL_ID}/diagrams/${diagram.body.id}/versions/upload`)
      .send({
        originalFileName: "unsafe.svg",
        mimeType: "image/svg+xml",
        contentBase64: Buffer.from(`<svg><script>alert(1)</script></svg>`).toString("base64"),
      })
      .expect(400);

    await request(app)
      .get(`/api/vessel-intelligence/${VESSEL_ID}/diagrams/${diagram.body.id}/versions`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveLength(0);
      });
  });

  it("rejects spoofed raster uploads before persisting media", async () => {
    const diagram = await request(app)
      .post(`/api/vessel-intelligence/${VESSEL_ID}/diagrams`)
      .send({
        diagramType: "side_elevation",
        title: "Spoofed raster",
      })
      .expect(201);

    await request(app)
      .post(`/api/vessel-intelligence/${VESSEL_ID}/diagrams/${diagram.body.id}/versions/upload`)
      .send({
        originalFileName: "not-a-png.png",
        mimeType: "image/png",
        contentBase64: Buffer.from("<svg></svg>").toString("base64"),
      })
      .expect(400);

    await request(app)
      .get(`/api/vessel-intelligence/${VESSEL_ID}/diagrams/${diagram.body.id}/versions`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveLength(0);
      });
  });

  it("creates draft maps for all four replacement behaviors", async () => {
    const diagram = await createDiagram(app, "Replacement behavior diagram");
    const baseVersion = await request(app)
      .post(`/api/vessel-intelligence/${VESSEL_ID}/diagrams/${diagram.body.id}/versions/upload`)
      .send(svgUploadBody())
      .expect(201);

    const activeMap = await request(app)
      .post(`/api/vessel-intelligence/${VESSEL_ID}/section-maps`)
      .send({
        name: "Existing map",
        diagramId: diagram.body.id,
        diagramVersionId: baseVersion.body.id,
        sections: [sampleSection()],
      })
      .expect(201);

    const keepExisting = await request(app)
      .post(`/api/vessel-intelligence/${VESSEL_ID}/diagrams/${diagram.body.id}/versions/upload`)
      .send(svgUploadBody({ replacementBehavior: "keep_existing" }))
      .expect(201);

    expect(keepExisting.body.version.status).toBe("draft");
    expect(keepExisting.body.draftMap.sourceMapId).toBe(activeMap.body.id);
    expect(keepExisting.body.draftMap.sections).toHaveLength(1);
    expect(keepExisting.body.warnings[0]).toContain("draft overlay");

    const startBlank = await request(app)
      .post(`/api/vessel-intelligence/${VESSEL_ID}/diagrams/${diagram.body.id}/versions/upload`)
      .send(svgUploadBody({ replacementBehavior: "start_blank" }))
      .expect(201);

    expect(startBlank.body.draftMap.sections).toHaveLength(0);

    const copyVessel = await request(app)
      .post(`/api/vessel-intelligence/${VESSEL_ID}/diagrams/${diagram.body.id}/versions/upload`)
      .send(
        svgUploadBody({
          replacementBehavior: "copy_vessel",
          sourceVesselId: VESSEL_ID,
          sourceMapId: activeMap.body.id,
        })
      )
      .expect(201);

    expect(copyVessel.body.draftMap.sourceMapId).toBe(activeMap.body.id);
    expect(copyVessel.body.draftMap.sections[0].equipment).toHaveLength(0);
    expect(copyVessel.body.warnings[0]).toContain("Equipment assignments");

    await request(app)
      .get("/api/vessel-intelligence/section-map-templates")
      .expect(200)
      .expect((res) => {
        expect(res.body.map((template: { id: string }) => template.id)).toEqual(
          expect.arrayContaining([
            "osv_workboat",
            "ahts",
            "psv",
            "tugboat",
            "pilot_vessel",
            "crew_boat",
            "custom_blank",
          ])
        );
      });

    const copyTemplate = await request(app)
      .post(`/api/vessel-intelligence/${VESSEL_ID}/diagrams/${diagram.body.id}/versions/upload`)
      .send(svgUploadBody({ replacementBehavior: "copy_template", templateId: "tugboat" }))
      .expect(201);

    expect(copyTemplate.body.draftMap.sections.length).toBeGreaterThan(0);
    expect(copyTemplate.body.draftMap.sections[0].sectionKey).toContain("tug");
  });

  it("publishes, archives, restores, and fetches active diagram versions", async () => {
    const diagram = await createDiagram(app, "Version lifecycle diagram");
    const upload = await request(app)
      .post(`/api/vessel-intelligence/${VESSEL_ID}/diagrams/${diagram.body.id}/versions/upload`)
      .send(svgUploadBody())
      .expect(201);

    await request(app)
      .post(
        `/api/vessel-intelligence/${VESSEL_ID}/diagrams/${diagram.body.id}/versions/${upload.body.id}/publish`
      )
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe("active");
      });

    await request(app)
      .get(`/api/vessel-intelligence/${VESSEL_ID}/diagrams/${diagram.body.id}/versions/active`)
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe(upload.body.id);
      });

    await request(app)
      .post(
        `/api/vessel-intelligence/${VESSEL_ID}/diagrams/${diagram.body.id}/versions/${upload.body.id}/archive`
      )
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe("archived");
      });

    await request(app)
      .post(
        `/api/vessel-intelligence/${VESSEL_ID}/diagrams/${diagram.body.id}/versions/${upload.body.id}/restore-draft`
      )
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe("draft");
      });
  });

  it("supports section map edit, validation, export, assignment, and thumbnail alias flows", async () => {
    const diagram = await createDiagram(app, "Editable map diagram");
    const upload = await request(app)
      .post(`/api/vessel-intelligence/${VESSEL_ID}/diagrams/${diagram.body.id}/versions/upload`)
      .send(svgUploadBody())
      .expect(201);
    const map = await request(app)
      .post(`/api/vessel-intelligence/${VESSEL_ID}/section-maps`)
      .send({
        name: "Editable map",
        diagramId: diagram.body.id,
        diagramVersionId: upload.body.id,
        imageTransform: { scaleX: 1.1, scaleY: 0.92, offsetX: 0.03, offsetY: -0.02 },
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.imageTransform).toEqual({
          scaleX: 1.1,
          scaleY: 0.92,
          offsetX: 0.03,
          offsetY: -0.02,
        });
      });

    await request(app)
      .patch(`/api/vessel-intelligence/${VESSEL_ID}/section-maps/${map.body.id}`)
      .send({ imageTransform: { scaleX: 1.2, scaleY: 0.85, offsetX: -0.04, offsetY: 0.05 } })
      .expect(200)
      .expect((res) => {
        expect(res.body.imageTransform).toEqual({
          scaleX: 1.2,
          scaleY: 0.85,
          offsetX: -0.04,
          offsetY: 0.05,
        });
      });

    const section = await request(app)
      .post(`/api/vessel-intelligence/${VESSEL_ID}/section-maps/${map.body.id}/sections`)
      .send(sampleSection())
      .expect(201);

    await request(app)
      .patch(
        `/api/vessel-intelligence/${VESSEL_ID}/section-maps/${map.body.id}/sections/${section.body.id}`
      )
      .send({ name: "Updated Engine Room", color: "#38bdf8" })
      .expect(200)
      .expect((res) => {
        expect(res.body.name).toBe("Updated Engine Room");
      });

    await request(app)
      .put(
        `/api/vessel-intelligence/${VESSEL_ID}/section-maps/${map.body.id}/sections/${section.body.id}/polygon`
      )
      .send({
        polygonNormalized: [
          { x: 0.1, y: 0.1 },
          { x: 0.4, y: 0.1 },
          { x: 0.4, y: 0.3 },
          { x: 0.1, y: 0.3 },
        ],
        labelNormalized: { x: 0.25, y: 0.2 },
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.polygonNormalized).toHaveLength(4);
      });

    const assignment = await request(app)
      .post(
        `/api/vessel-intelligence/${VESSEL_ID}/section-maps/${map.body.id}/sections/${section.body.id}/equipment`
      )
      .send({ equipmentName: "Updated Pump", assetCode: "P-01" })
      .expect(201);

    await request(app)
      .get(
        `/api/vessel-intelligence/${VESSEL_ID}/section-maps/${map.body.id}/equipment-assignments`
      )
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual(
          expect.arrayContaining([expect.objectContaining({ equipmentName: "Updated Pump" })])
        );
      });

    await request(app)
      .patch(
        `/api/vessel-intelligence/${VESSEL_ID}/section-maps/${map.body.id}/sections/${section.body.id}/equipment/${assignment.body.id}`
      )
      .send({ system: "Bilge" })
      .expect(200)
      .expect((res) => {
        expect(res.body.system).toBe("Bilge");
      });

    await request(app)
      .post(`/api/vessel-intelligence/${VESSEL_ID}/sections/${section.body.id}/thumbnail`)
      .send({
        originalFileName: "section.png",
        mimeType: "image/png",
        contentBase64: PNG_1X1.toString("base64"),
      })
      .expect(201);

    await request(app)
      .delete(`/api/vessel-intelligence/${VESSEL_ID}/sections/${section.body.id}/thumbnail`)
      .expect(204);

    await request(app)
      .post(`/api/vessel-intelligence/${VESSEL_ID}/equipment/equipment-1/thumbnail`)
      .send({
        originalFileName: "equipment.png",
        mimeType: "image/png",
        contentBase64: PNG_1X1.toString("base64"),
      })
      .expect(201);

    await request(app)
      .delete(`/api/vessel-intelligence/${VESSEL_ID}/equipment/equipment-1/thumbnail`)
      .expect(204);

    await request(app)
      .post(`/api/vessel-intelligence/${VESSEL_ID}/section-maps/${map.body.id}/validate`)
      .expect(200)
      .expect((res) => {
        expect(res.body.summary.blockers).toBe(0);
      });

    await request(app)
      .get(`/api/vessel-intelligence/${VESSEL_ID}/section-maps/${map.body.id}/export`)
      .expect(200)
      .expect((res) => {
        expect(res.body.id).toBe(map.body.id);
      });

    await request(app)
      .delete(
        `/api/vessel-intelligence/${VESSEL_ID}/section-maps/${map.body.id}/sections/${section.body.id}/equipment/${assignment.body.id}`
      )
      .expect(204);

    await request(app)
      .delete(
        `/api/vessel-intelligence/${VESSEL_ID}/section-maps/${map.body.id}/sections/${section.body.id}/polygon`
      )
      .expect(200);

    await request(app)
      .delete(
        `/api/vessel-intelligence/${VESSEL_ID}/section-maps/${map.body.id}/sections/${section.body.id}`
      )
      .expect(204);

    await request(app)
      .delete(`/api/vessel-intelligence/${VESSEL_ID}/section-maps/${map.body.id}`)
      .expect(204);
  });

  it("blocks cross-vessel registry access", async () => {
    const diagram = await createDiagram(app, "Tenant isolation diagram");
    await request(app)
      .get(`/api/vessel-intelligence/${OTHER_VESSEL_ID}/diagrams/${diagram.body.id}`)
      .expect(404);

    await request(app)
      .post(
        `/api/vessel-intelligence/${OTHER_VESSEL_ID}/diagrams/${diagram.body.id}/versions/upload`
      )
      .send(svgUploadBody())
      .expect(404);
  });
});
