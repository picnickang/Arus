/**
 * OpenAPI Spec - Info, Servers, and Tags
 *
 * Core OpenAPI configuration and metadata.
 */

export const specInfo = {
  openapi: "3.0.3",
  info: {
    title: "ARUS Marine API",
    description: `
# ARUS Marine Predictive Maintenance API

API for marine equipment monitoring, predictive maintenance, and fleet management.

## Authentication

All API endpoints require the \`x-org-id\` header for multi-tenant isolation:

\`\`\`
x-org-id: your-organization-id
\`\`\`

Admin endpoints additionally require the \`x-admin-token\` header.

## Rate Limiting

- General API: 100 requests/minute
- Write operations: 30 requests/minute
- Telemetry ingestion: 1000 requests/minute
- Critical operations: 10 requests/minute

## Response Codes

- \`200\` - Success
- \`201\` - Created
- \`400\` - Bad Request (validation error)
- \`401\` - Unauthorized (missing/invalid org-id)
- \`403\` - Forbidden (cross-tenant access)
- \`404\` - Not Found
- \`429\` - Rate Limited
- \`500\` - Server Error
    `,
    version: "1.0",
    contact: {
      name: "ARUS Support",
      email: "support@arus.marine",
    },
    license: {
      name: "Proprietary",
      url: "https://arus.marine/license",
    },
  },
  servers: [
    {
      url: "/api",
      description: "Current server",
    },
  ],
  tags: [
    { name: "Health", description: "System health and readiness endpoints" },
    { name: "Dashboard", description: "Dashboard and overview data" },
    { name: "Equipment", description: "Marine equipment management" },
    { name: "Vessels", description: "Vessel fleet management" },
    { name: "Telemetry", description: "Real-time telemetry data" },
    { name: "PdM", description: "Predictive maintenance scores and analysis" },
    { name: "Work Orders", description: "Maintenance work order management" },
    { name: "Parts", description: "Parts and inventory management" },
    { name: "ML Models", description: "Machine learning model management" },
    { name: "Organizations", description: "Organization and user management" },
    { name: "Sync", description: "Cloud/offline synchronization" },
    { name: "Analytics", description: "Analytics and reporting" },
    { name: "Admin", description: "Administrative operations (requires admin token)" },
  ],
};
