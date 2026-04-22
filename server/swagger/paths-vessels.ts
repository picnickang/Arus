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
