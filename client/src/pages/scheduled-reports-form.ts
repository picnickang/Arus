import { z } from "zod";

// Matches the previous `new Date(x).toLocaleString()` rendering exactly
// (browser locale, all-numeric date + time).
export const RUN_DATE_FORMAT = {
  locale: "auto",
  month: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  fallback: "Never",
} as const;

export const REPORT_TYPES = [
  { id: "fleet_health", name: "Fleet Health Summary" },
  { id: "maintenance_due", name: "Maintenance Due Report" },
  { id: "inventory_status", name: "Inventory Status Report" },
  { id: "crew_compliance", name: "Crew Compliance Report" },
  { id: "cost_summary", name: "Cost Summary Report" },
] as const;

export const FREQUENCIES = [
  { id: "daily", name: "Daily", cron: "0 8 * * *" },
  { id: "weekly", name: "Weekly", cron: "0 8 * * 1" },
  { id: "monthly", name: "Monthly", cron: "0 8 1 * *" },
] as const;

export const FORMATS = [
  { id: "pdf", name: "PDF" },
  { id: "csv", name: "CSV" },
  { id: "json", name: "JSON" },
] as const;

export const createScheduleFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  reportType: z.enum([
    "fleet_health",
    "maintenance_due",
    "inventory_status",
    "crew_compliance",
    "cost_summary",
  ]),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  format: z.enum(["pdf", "csv", "json"]),
  recipients: z.string().min(1, "At least one recipient is required"),
  enabled: z.boolean(),
});

export type CreateScheduleForm = z.infer<typeof createScheduleFormSchema>;
