/**
 * Scheduled Reports - Database Schema
 */

import { pgTable, text, varchar, boolean, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const reportSchedules = pgTable("report_schedules", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  orgId: varchar("org_id", { length: 36 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  reportType: varchar("report_type", { length: 50 }).notNull(),
  frequency: varchar("frequency", { length: 20 }).notNull(),
  cronExpression: varchar("cron_expression", { length: 50 }).notNull(),
  timezone: varchar("timezone", { length: 50 }).notNull().default("UTC"),
  format: varchar("format", { length: 10 }).notNull().default("pdf"),
  recipients: jsonb("recipients").notNull().$type<string[]>(),
  vesselIds: jsonb("vessel_ids").$type<string[] | null>(),
  enabled: boolean("enabled").notNull().default(true),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  createdBy: varchar("created_by", { length: 36 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const generatedReports = pgTable("generated_reports", {
  id: varchar("id", { length: 36 })
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  scheduleId: varchar("schedule_id", { length: 36 }).notNull(),
  orgId: varchar("org_id", { length: 36 }).notNull(),
  reportType: varchar("report_type", { length: 50 }).notNull(),
  format: varchar("format", { length: 10 }).notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  filePath: varchar("file_path", { length: 500 }).notNull(),
  fileSize: integer("file_size").notNull().default(0),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  errorMessage: text("error_message"),
});

export const insertReportScheduleSchema = createInsertSchema(reportSchedules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastRunAt: true,
});

export const insertGeneratedReportSchema = createInsertSchema(generatedReports).omit({
  id: true,
});

export type ReportSchedule = typeof reportSchedules.$inferSelect;
export type InsertReportSchedule = z.infer<typeof insertReportScheduleSchema>;
export type GeneratedReportRecord = typeof generatedReports.$inferSelect;
export type InsertGeneratedReport = z.infer<typeof insertGeneratedReportSchema>;
