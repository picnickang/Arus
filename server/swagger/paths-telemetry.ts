/**
 * OpenAPI Spec - Telemetry Endpoint Paths
 * 
 * Real-time telemetry data endpoints.
 */

export const telemetryPaths = {
  "/telemetry/latest": {
    get: {
      tags: ["Telemetry"],
      summary: "Get latest telemetry readings",
      description: "Returns the most recent telemetry data for all equipment",
      responses: {
        "200": {
          description: "Latest telemetry readings",
          content: {
            "application/json": {
              schema: {
                type: "array",
                items: { "$ref": "#/components/schemas/TelemetryReading" }
              }
            }
          }
        }
      }
    }
  },
  "/telemetry": {
    post: {
      tags: ["Telemetry"],
      summary: "Ingest telemetry data",
      description: "Submit telemetry readings from edge devices",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["equipmentId", "readings"],
              properties: {
                equipmentId: { type: "string" },
                readings: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      sensorType: { type: "string" },
                      value: { type: "number" },
                      timestamp: { type: "string", format: "date-time" }
                    }
                  }
                }
              }
            }
          }
        }
      },
      responses: {
        "201": { description: "Telemetry ingested successfully" },
        "429": { "$ref": "#/components/responses/RateLimited" }
      }
    }
  }
};
