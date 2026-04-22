/**
 * OpenAPI Spec - Parameters and Responses
 *
 * Reusable parameters and response definitions.
 */

export const securitySchemes = {
  orgId: {
    type: "apiKey",
    in: "header",
    name: "x-org-id",
    description: "Organization ID for multi-tenant isolation",
  },
  adminToken: {
    type: "apiKey",
    in: "header",
    name: "x-admin-token",
    description: "Admin authentication token",
  },
};

export const parameters = {
  orgIdHeader: {
    name: "x-org-id",
    in: "header",
    required: true,
    schema: { type: "string" },
    description: "Organization ID for multi-tenant isolation",
  },
  pageParam: {
    name: "page",
    in: "query",
    schema: { type: "integer", default: 1, minimum: 1 },
    description: "Page number",
  },
  limitParam: {
    name: "limit",
    in: "query",
    schema: { type: "integer", default: 50, minimum: 1, maximum: 100 },
    description: "Items per page",
  },
  idParam: {
    name: "id",
    in: "path",
    required: true,
    schema: { type: "string", format: "uuid" },
    description: "Resource ID",
  },
};

export const responses = {
  BadRequest: {
    description: "Bad Request - validation error",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/Error" },
      },
    },
  },
  Unauthorized: {
    description: "Unauthorized - missing or invalid x-org-id",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/Error" },
      },
    },
  },
  Forbidden: {
    description: "Forbidden - cross-tenant access denied",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/Error" },
      },
    },
  },
  NotFound: {
    description: "Resource not found",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/Error" },
      },
    },
  },
  RateLimited: {
    description: "Too many requests - rate limited",
    content: {
      "application/json": {
        schema: { $ref: "#/components/schemas/Error" },
      },
    },
  },
};
