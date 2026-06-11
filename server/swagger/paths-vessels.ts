/**
 * OpenAPI Spec - Vessels Endpoint Paths
 *
 * Vessel fleet management endpoints.
 */

export const vesselsPaths = {
  "/vessels": {
    get: {
      tags: ["Vessels"],
      summary: "List all vessels",
      description: "Returns list of vessels for the organization",
      parameters: [
        { $ref: "#/components/parameters/pageParam" },
        { $ref: "#/components/parameters/limitParam" },
      ],
      responses: {
        "200": {
          description: "List of vessels",
          content: {
            "application/json": {
              schema: {
                type: "array",
                items: { $ref: "#/components/schemas/Vessel" },
              },
            },
          },
        },
      },
    },
    post: {
      tags: ["Vessels"],
      summary: "Create new vessel",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["name"],
              properties: {
                name: { type: "string" },
                imo: { type: "string" },
                type: { type: "string" },
                flag: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Vessel created",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Vessel" },
            },
          },
        },
      },
    },
  },
  "/vessels/{id}/power-stw-analysis": {
    get: {
      tags: ["Vessels"],
      summary: "Power vs speed-through-water baseline analysis",
      description:
        "Actual propulsion power (from rpm/torque/stw readings sharing timestamps) " +
        "against the cubic propeller-law reference curve; hull-efficiency deviation " +
        "is the actual-vs-baseline gap. Rendered by PowerSTWChart on the " +
        "vessel-intelligence performance view. Defaults to the trailing 30 days.",
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
        {
          name: "startDate",
          in: "query",
          required: false,
          schema: { type: "string", format: "date-time" },
        },
        {
          name: "endDate",
          in: "query",
          required: false,
          schema: { type: "string", format: "date-time" },
        },
      ],
      responses: {
        "200": {
          description: "Actual and baseline power curves",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  actual: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: { x: { type: "number" }, y: { type: "number" } },
                    },
                  },
                  baseline: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: { x: { type: "number" }, y: { type: "number" } },
                    },
                  },
                  metadata: { type: "object" },
                },
              },
            },
          },
        },
        "404": { description: "Vessel not found" },
      },
    },
  },
  "/vessels/{id}": {
    get: {
      tags: ["Vessels"],
      summary: "Get vessel by ID",
      parameters: [{ $ref: "#/components/parameters/idParam" }],
      responses: {
        "200": {
          description: "Vessel details",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/Vessel" },
            },
          },
        },
      },
    },
  },
};
