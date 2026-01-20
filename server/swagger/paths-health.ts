/**
 * OpenAPI Spec - Health Endpoint Paths
 * 
 * Health check and observability endpoints.
 */

export const healthPaths = {
  "/health": {
    get: {
      tags: ["Health"],
      summary: "Application health check",
      description: "Returns the health status of the application",
      security: [],
      responses: {
        "200": {
          description: "Application is healthy",
          content: {
            "application/json": {
              schema: { "$ref": "#/components/schemas/HealthResponse" }
            }
          }
        }
      }
    }
  },
  "/healthz": {
    get: {
      tags: ["Health"],
      summary: "Kubernetes liveness probe",
      description: "Simple liveness check for container orchestration",
      security: [],
      responses: {
        "200": { description: "Service is alive" }
      }
    }
  },
  "/readyz": {
    get: {
      tags: ["Health"],
      summary: "Kubernetes readiness probe",
      description: "Readiness check indicating if service can accept traffic",
      security: [],
      responses: {
        "200": { description: "Service is ready" },
        "503": { description: "Service is not ready" }
      }
    }
  },
  "/metrics": {
    get: {
      tags: ["Health"],
      summary: "Prometheus metrics",
      description: "Returns Prometheus-formatted metrics for monitoring",
      security: [],
      responses: {
        "200": {
          description: "Prometheus metrics",
          content: { "text/plain": { schema: { type: "string" } } }
        }
      }
    }
  }
};

export const dashboardPaths = {
  "/dashboard": {
    get: {
      tags: ["Dashboard"],
      summary: "Get dashboard data",
      description: "Returns aggregated dashboard data for the organization",
      responses: {
        "200": {
          description: "Dashboard data",
          content: {
            "application/json": {
              schema: { "$ref": "#/components/schemas/DashboardData" }
            }
          }
        }
      }
    }
  },
  "/fleet/overview": {
    get: {
      tags: ["Dashboard"],
      summary: "Get fleet overview",
      description: "Returns fleet-wide statistics and status",
      responses: {
        "200": {
          description: "Fleet overview data",
          content: { "application/json": { schema: { type: "object" } } }
        }
      }
    }
  }
};
