/**
 * OpenAPI Spec - Equipment Endpoint Paths
 * 
 * Equipment management and RUL prediction endpoints.
 */

export const equipmentPaths = {
  "/equipment": {
    get: {
      tags: ["Equipment"],
      summary: "List all equipment",
      description: "Returns paginated list of equipment for the organization",
      parameters: [
        { "$ref": "#/components/parameters/pageParam" },
        { "$ref": "#/components/parameters/limitParam" },
        { name: "vesselId", in: "query", schema: { type: "string" }, description: "Filter by vessel" },
        { name: "type", in: "query", schema: { type: "string" }, description: "Filter by equipment type" },
        { name: "status", in: "query", schema: { type: "string" }, description: "Filter by status" }
      ],
      responses: {
        "200": {
          description: "List of equipment",
          content: {
            "application/json": {
              schema: {
                type: "array",
                items: { "$ref": "#/components/schemas/Equipment" }
              }
            }
          }
        }
      }
    },
    post: {
      tags: ["Equipment"],
      summary: "Create new equipment",
      description: "Register new equipment in the system",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { "$ref": "#/components/schemas/EquipmentCreate" }
          }
        }
      },
      responses: {
        "201": {
          description: "Equipment created",
          content: {
            "application/json": {
              schema: { "$ref": "#/components/schemas/Equipment" }
            }
          }
        },
        "400": { "$ref": "#/components/responses/BadRequest" }
      }
    }
  },
  "/equipment/{id}": {
    get: {
      tags: ["Equipment"],
      summary: "Get equipment by ID",
      parameters: [{ "$ref": "#/components/parameters/idParam" }],
      responses: {
        "200": {
          description: "Equipment details",
          content: {
            "application/json": {
              schema: { "$ref": "#/components/schemas/Equipment" }
            }
          }
        },
        "404": { "$ref": "#/components/responses/NotFound" }
      }
    },
    put: {
      tags: ["Equipment"],
      summary: "Update equipment",
      parameters: [{ "$ref": "#/components/parameters/idParam" }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: { "$ref": "#/components/schemas/EquipmentCreate" }
          }
        }
      },
      responses: {
        "200": {
          description: "Equipment updated",
          content: {
            "application/json": {
              schema: { "$ref": "#/components/schemas/Equipment" }
            }
          }
        },
        "404": { "$ref": "#/components/responses/NotFound" }
      }
    },
    delete: {
      tags: ["Equipment"],
      summary: "Delete equipment",
      description: "Permanently delete equipment (requires critical operation rate limit)",
      parameters: [{ "$ref": "#/components/parameters/idParam" }],
      responses: {
        "204": { description: "Equipment deleted" },
        "404": { "$ref": "#/components/responses/NotFound" }
      }
    }
  },
  "/equipment/{id}/rul": {
    get: {
      tags: ["Equipment", "PdM"],
      summary: "Get equipment RUL prediction",
      description: "Returns ML-powered Remaining Useful Life prediction for equipment",
      parameters: [{ "$ref": "#/components/parameters/idParam" }],
      responses: {
        "200": {
          description: "RUL prediction",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  equipmentId: { type: "string" },
                  remainingUsefulLife: { type: "number", description: "RUL in days" },
                  confidence: { type: "number" },
                  factors: { type: "array", items: { type: "object" } }
                }
              }
            }
          }
        }
      }
    }
  },
  "/equipment/health": {
    get: {
      tags: ["Equipment"],
      summary: "Get equipment health summary",
      description: "Returns aggregated health statistics for all equipment",
      responses: {
        "200": {
          description: "Health summary",
          content: { "application/json": { schema: { type: "object" } } }
        }
      }
    }
  }
};
