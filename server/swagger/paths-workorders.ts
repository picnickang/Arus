/**
 * OpenAPI Spec - Work Orders Endpoint Paths
 *
 * Maintenance work order management endpoints.
 */

export const workOrdersPaths = {
  "/work-orders": {
    get: {
      tags: ["Work Orders"],
      summary: "List work orders",
      description: "Returns paginated list of work orders",
      parameters: [
        { $ref: "#/components/parameters/pageParam" },
        { $ref: "#/components/parameters/limitParam" },
        { name: "status", in: "query", schema: { type: "string" } },
        { name: "priority", in: "query", schema: { type: "string" } },
        { name: "vesselId", in: "query", schema: { type: "string" } },
      ],
      responses: {
        "200": {
          description: "List of work orders",
          content: {
            "application/json": {
              schema: {
                type: "array",
                items: { $ref: "#/components/schemas/WorkOrder" },
              },
            },
          },
        },
      },
    },
    post: {
      tags: ["Work Orders"],
      summary: "Create work order",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["vesselId", "title"],
              properties: {
                vesselId: { type: "string" },
                equipmentId: { type: "string" },
                title: { type: "string" },
                description: { type: "string" },
                priority: { type: "string" },
                maintenanceType: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "Work order created",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/WorkOrder" },
            },
          },
        },
      },
    },
  },
  "/work-orders/{id}": {
    get: {
      tags: ["Work Orders"],
      summary: "Get work order by ID",
      parameters: [{ $ref: "#/components/parameters/idParam" }],
      responses: {
        "200": {
          description: "Work order details",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/WorkOrder" },
            },
          },
        },
      },
    },
    patch: {
      tags: ["Work Orders"],
      summary: "Update work order",
      parameters: [{ $ref: "#/components/parameters/idParam" }],
      requestBody: {
        content: {
          "application/json": {
            schema: { type: "object" },
          },
        },
      },
      responses: {
        "200": { description: "Work order updated" },
      },
    },
  },
};
