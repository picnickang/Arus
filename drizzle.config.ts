import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: [
    "./shared/schema.ts",
    "./shared/schema/core.ts",
    "./shared/schema/sync.ts",
    "./shared/schema/vessels.ts",
    "./shared/schema/equipment.ts",
    "./shared/schema/work-orders.ts",
    "./shared/schema/alerts.ts",
    "./shared/schema/maintenance.ts",
    "./shared/schema/telemetry.ts",
    "./shared/schema/sensors.ts",
    "./shared/schema/inventory.ts",
    "./shared/schema/crew.ts",
    "./shared/schema/compliance.ts",
    "./shared/schema/ml-analytics-core.ts",
    "./shared/schema/ml-analytics-advanced.ts",
    "./shared/schema/iot-edge.ts",
    "./shared/schema/knowledge-base.ts",
    "./shared/schema/rag.ts",
    "./shared/schema/insights.ts",
    "./shared/schema/optimizer.ts",
    "./shared/schema/permissions.ts",
    "./shared/schema/email-templates.ts",
    "./shared/schema/logbooks.ts",
    "./shared/schema/admin.ts",
    "./shared/schema/costs.ts",
    "./shared/schema/dtc.ts",
    "./shared/schema/scheduling-settings.ts",
    "./shared/schema/purchasing.ts",
    "./shared/schema/stormgeo.ts",
    "./shared/schema/pdm-feature-store.ts",
  ],
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
