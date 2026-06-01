/**
 * OpenAPI Spec - Miscellaneous Endpoint Paths
 *
 * Parts, ML, Analytics, Sync, Organizations, and Admin endpoints.
 */

export const partsPaths = {
  "/parts": {
    get: {
      tags: ["Parts"],
      summary: "List parts inventory",
      parameters: [
        { $ref: "#/components/parameters/pageParam" },
        { $ref: "#/components/parameters/limitParam" },
        { name: "category", in: "query", schema: { type: "string" } },
        { name: "lowStock", in: "query", schema: { type: "boolean" } },
      ],
      responses: {
        "200": {
          description: "Parts list",
          content: {
            "application/json": {
              schema: {
                type: "array",
                items: { $ref: "#/components/schemas/Part" },
              },
            },
          },
        },
      },
    },
  },
};

export const mlPaths = {
  "/ml/models": {
    get: {
      tags: ["ML Models"],
      summary: "List ML models",
      description: "Returns list of trained ML models",
      responses: {
        "200": {
          description: "ML models list",
          content: {
            "application/json": {
              schema: {
                type: "array",
                items: { $ref: "#/components/schemas/MlModel" },
              },
            },
          },
        },
      },
    },
  },
  "/ml/health": {
    get: {
      tags: ["ML Models"],
      summary: "Get ML service health",
      description: "Returns health status of ML inference service",
      responses: {
        "200": {
          description: "ML service health",
          content: { "application/json": { schema: { type: "object" } } },
        },
      },
    },
  },
};

export const analyticsPaths = {
  "/analytics/fleet": {
    get: {
      tags: ["Analytics"],
      summary: "Get fleet analytics",
      description: "Returns fleet-wide analytics and statistics",
      parameters: [
        { name: "startDate", in: "query", schema: { type: "string", format: "date" } },
        { name: "endDate", in: "query", schema: { type: "string", format: "date" } },
      ],
      responses: {
        "200": {
          description: "Fleet analytics",
          content: { "application/json": { schema: { type: "object" } } },
        },
      },
    },
  },
};

export const syncPaths = {
  "/sync/status": {
    get: {
      tags: ["Sync"],
      summary: "Get sync status",
      description: "Returns cloud/offline synchronization status",
      responses: {
        "200": {
          description: "Sync status",
          content: { "application/json": { schema: { type: "object" } } },
        },
      },
    },
  },
  "/sync/reconcile": {
    post: {
      tags: ["Sync"],
      summary: "Trigger data reconciliation",
      description: "Initiates data reconciliation between cloud and offline databases",
      responses: {
        "200": { description: "Reconciliation started" },
      },
    },
  },
};

export const organizationsPaths = {
  "/organizations": {
    get: {
      tags: ["Organizations"],
      summary: "List organizations",
      description: "Returns list of organizations (admin only)",
      security: [{ orgId: [], adminToken: [] }],
      responses: {
        "200": {
          description: "Organizations list",
          content: { "application/json": { schema: { type: "array" } } },
        },
      },
    },
  },
};

// The shared-password admin unlock (`POST /admin/auth/verify`) has been
// retired. Admins authenticate with a real account via `/portal/login`.
export const adminPaths = {};
