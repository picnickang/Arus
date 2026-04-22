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
  "/pdm/health": {
    get: {
      tags: ["PdM"],
      summary: "Get PdM health summary",
      description: "Returns predictive maintenance health overview",
      responses: {
        "200": {
          description: "PdM health summary",
          content: { "application/json": { schema: { type: "object" } } },
        },
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
