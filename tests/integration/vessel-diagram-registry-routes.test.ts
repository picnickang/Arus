import express, { type RequestHandler } from "express";
import request from "supertest";
import { describe, expect, it, beforeEach } from "@jest/globals";
import { registerVesselDiagramRegistryRoutes } from "../../server/domains/vessel-diagram-registry/interfaces/routes";
import { VesselDiagramRegistryService } from "../../server/domains/vessel-diagram-registry/application/service";
import { InMemoryVesselDiagramRegistryStore } from "../../server/domains/vessel-diagram-registry/infrastructure/in-memory-store";
import { InMemoryVesselRegistryMediaStore } from "../../server/domains/vessel-diagram-registry/infrastructure/in-memory-media-store";

const ORG_ID = "org-test";
const VESSEL_ID = "vessel-test";
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
    service: new VesselDiagramRegistryService(
      new InMemoryVesselDiagramRegistryStore(),
      mediaStore
    ),
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

describe("vessel diagram registry routes", () => {
  let app: express.Express;

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
});
