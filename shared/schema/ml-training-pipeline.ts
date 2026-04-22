import {
  sql,
  pgTable,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  createInsertSchema,
  z,
} from "./base";
import { organizations } from "./core";
import { modelVersions } from "./ml-analytics-core";

export const trainingDatasets = pgTable(
  "training_datasets",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    sourceType: varchar("source_type", { length: 50 }).notNull(),
    sourceConfig: jsonb("source_config"),
    featureColumns: jsonb("feature_columns"),
    labelColumn: varchar("label_column", { length: 100 }),
    targetType: varchar("target_type", { length: 50 }),
    timeRangeStart: timestamp("time_range_start", { withTimezone: true }),
    timeRangeEnd: timestamp("time_range_end", { withTimezone: true }),
    rowCount: integer("row_count"),
    splitConfig: jsonb("split_config"),
    schemaVersion: integer("schema_version").default(1),
    status: varchar("status", { length: 50 }).notNull().default("draft"),
    createdBy: varchar("created_by", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgStatusIdx: index("idx_training_datasets_org_status").on(table.orgId, table.status),
    orgCreatedIdx: index("idx_training_datasets_org_created").on(table.orgId, table.createdAt),
  })
);

export const modelArtifacts = pgTable(
  "model_artifacts",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    modelVersionId: varchar("model_version_id").references(() => modelVersions.id, {
      onDelete: "cascade",
    }),
    artifactType: varchar("artifact_type", { length: 50 }).notNull(),
    storageUri: varchar("storage_uri", { length: 1000 }).notNull(),
    checksum: varchar("checksum", { length: 128 }),
    framework: varchar("framework", { length: 50 }),
    format: varchar("format", { length: 50 }),
    sizeBytes: integer("size_bytes"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgIdx: index("idx_model_artifacts_org").on(table.orgId),
    modelVersionIdx: index("idx_model_artifacts_version").on(table.modelVersionId),
  })
);

export const trainingRuns = pgTable(
  "training_runs",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    orgId: varchar("org_id")
      .notNull()
      .references(() => organizations.id),
    datasetId: varchar("dataset_id")
      .notNull()
      .references(() => trainingDatasets.id),
    modelVersionId: varchar("model_version_id").references(() => modelVersions.id),
    artifactId: varchar("artifact_id").references(() => modelArtifacts.id),
    status: varchar("status", { length: 50 }).notNull().default("pending"),
    config: jsonb("config"),
    hyperparameters: jsonb("hyperparameters"),
    metrics: jsonb("metrics"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    initiatedBy: varchar("initiated_by", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orgStatusIdx: index("idx_training_runs_org_status").on(table.orgId, table.status),
    datasetIdx: index("idx_training_runs_dataset").on(table.datasetId),
    modelVersionIdx: index("idx_training_runs_version").on(table.modelVersionId),
  })
);

export const insertTrainingDatasetSchema = createInsertSchema(trainingDatasets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertModelArtifactSchema = createInsertSchema(modelArtifacts).omit({
  id: true,
  createdAt: true,
});
export const insertTrainingRunSchema = createInsertSchema(trainingRuns).omit({
  id: true,
  createdAt: true,
});

export type TrainingDataset = typeof trainingDatasets.$inferSelect;
export type InsertTrainingDataset = z.infer<typeof insertTrainingDatasetSchema>;
export type ModelArtifact = typeof modelArtifacts.$inferSelect;
export type InsertModelArtifact = z.infer<typeof insertModelArtifactSchema>;
export type TrainingRun = typeof trainingRuns.$inferSelect;
export type InsertTrainingRun = z.infer<typeof insertTrainingRunSchema>;
