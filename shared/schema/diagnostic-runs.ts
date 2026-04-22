import {
  pgTable,
  text,
  varchar,
  jsonb,
  index,
  uuidPrimaryKey,
  timestamps,
  tenantColumn,
} from "./base";
import { organizations } from "./core";
import { equipment } from "./equipment";

export const diagnosticRuns = pgTable(
  "diagnostic_runs",
  {
    ...uuidPrimaryKey(),
    ...timestamps(),
    ...tenantColumn(organizations),
    equipmentId: varchar("equipment_id")
      .notNull()
      .references(() => equipment.id),
    analysisType: varchar("analysis_type", { length: 100 }).notNull(),
    status: varchar("status", { length: 50 }).notNull().default("completed"),
    results: jsonb("results"),
    summary: text("summary"),
    triggeredBy: varchar("triggered_by", { length: 255 }),
  },
  (table) => [
    index("idx_diagnostic_runs_equipment").on(table.equipmentId),
    index("idx_diagnostic_runs_org").on(table.orgId),
  ]
);
