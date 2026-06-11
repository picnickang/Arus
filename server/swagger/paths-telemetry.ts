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
                items: { $ref: "#/components/schemas/TelemetryReading" },
              },
            },
          },
        },
      },
    },
  },
  "/telemetry/baseline/{equipmentId}": {
    get: {
      tags: ["Telemetry"],
      summary: "Per-sensor operating baseline for an equipment",
      description:
        "Median ± 2σ envelope per sensor over a trailing window, computed " +
        "directly on equipment_telemetry. Rendered by MultiSensorChart as the " +
        "expected-operating band behind live series — deviation from the band " +
        "is the PdM signal.",
      parameters: [
        { name: "equipmentId", in: "path", required: true, schema: { type: "string" } },
        {
          name: "days",
          in: "query",
          required: false,
          schema: { type: "integer", default: 30, minimum: 1, maximum: 365 },
        },
      ],
      responses: {
        "200": {
          description: "Baseline stats per sensor type",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  equipmentId: { type: "string" },
                  days: { type: "integer" },
                  baselines: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        sensorType: { type: "string" },
                        p50: { type: "number" },
                        avg: { type: "number" },
                        stddev: { type: "number" },
                        min: { type: "number" },
                        max: { type: "number" },
                        sampleCount: { type: "integer" },
                        bandLow: { type: "number", description: "p50 - 2σ" },
                        bandHigh: { type: "number", description: "p50 + 2σ" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  "/telemetry/history/{equipmentId}/{sensorType}": {
    get: {
      tags: ["Telemetry"],
      summary: "Time-windowed history for one equipment sensor",
      description:
        "Readings within the trailing window (?hours, default 24). Responses " +
        "above 1,000 points are stride-decimated evenly across the window, " +
        "always retaining the newest reading.",
      parameters: [
        { name: "equipmentId", in: "path", required: true, schema: { type: "string" } },
        { name: "sensorType", in: "path", required: true, schema: { type: "string" } },
        {
          name: "hours",
          in: "query",
          required: false,
          schema: { type: "integer", default: 24, minimum: 1 },
        },
      ],
      responses: {
        "200": {
          description: "Telemetry readings in ascending timestamp order",
          content: {
            "application/json": {
              schema: {
                type: "array",
                items: { $ref: "#/components/schemas/TelemetryReading" },
              },
            },
          },
        },
      },
    },
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
                      timestamp: { type: "string", format: "date-time" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      responses: {
        "201": { description: "Telemetry ingested successfully" },
        "429": { $ref: "#/components/responses/RateLimited" },
      },
    },
  },
};
