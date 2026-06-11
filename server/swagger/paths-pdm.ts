/**
 * OpenAPI Spec - PdM (Predictive Maintenance) Endpoint Paths
 *
 * Predictive maintenance scores and alerts endpoints.
 */

export const pdmPaths = {
  "/pdm/scores": {
    get: {
      tags: ["PdM"],
      summary: "Get all PdM scores",
      description: "Returns predictive maintenance scores for all equipment",
      responses: {
        "200": {
          description: "PdM scores",
          content: {
            "application/json": {
              schema: {
                type: "array",
                items: { $ref: "#/components/schemas/PdmScore" },
              },
            },
          },
        },
      },
    },
  },
  "/pdm/health/{equipmentId}": {
    get: {
      tags: ["PdM"],
      summary: "Get per-equipment PdM health snapshot",
      description:
        "Health score, RUL, failure probability, and status for one equipment. " +
        "Backs the PdM equipment-detail page; degrades gracefully (status " +
        "'unknown', rul null, confidence 'low') when no ML score exists. " +
        "Implemented in server/domains/pdm-platform/health/routes.ts.",
      parameters: [
        {
          name: "equipmentId",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
      ],
      responses: {
        "200": {
          description: "PdM health snapshot (client contract: PdmHealthData)",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  equipmentId: { type: "string" },
                  healthScore: { type: "number" },
                  rul: {
                    type: "number",
                    nullable: true,
                    description: "Remaining useful life, days",
                  },
                  rulUncertainty: { type: "number", nullable: true },
                  status: {
                    type: "string",
                    enum: ["healthy", "warning", "critical", "unknown"],
                  },
                  pFail30d: { type: "number" },
                  aiSummary: { type: "string", nullable: true },
                  lastUpdated: { type: "string", format: "date-time" },
                  confidence: { type: "string", enum: ["high", "medium", "low"] },
                },
              },
            },
          },
        },
        "404": { description: "Equipment not found in the caller's org" },
      },
    },
  },
  "/pdm/alerts": {
    get: {
      tags: ["PdM"],
      summary: "Get PdM alerts",
      description: "Returns active predictive maintenance alerts",
      responses: {
        "200": {
          description: "PdM alerts",
          content: {
            "application/json": {
              schema: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string" },
                    equipmentId: { type: "string" },
                    severity: { type: "string" },
                    message: { type: "string" },
                    createdAt: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};
