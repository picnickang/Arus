import { z } from "zod";
import type { RiskQueueItem } from "./domain/types";

export const dashboardFiltersSchema = z.object({
  vesselId: z.string().optional(),
  equipmentType: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
});

export type DashboardFilters = z.infer<typeof dashboardFiltersSchema>;

export const scheduleFiltersSchema = z.object({
  vesselIds: z.string().optional(),
  equipmentTypes: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  maxTasksPerVesselPerDay: z.coerce.number().min(1).max(10).optional(),
  autoPopulate: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v !== "false"),
});

export function filterRiskQueue(
  items: RiskQueueItem[],
  filters: DashboardFilters
): RiskQueueItem[] {
  return items.filter((item) => {
    if (filters.vesselId && item.vesselId !== filters.vesselId) {
      return false;
    }
    if (filters.equipmentType && item.equipmentType !== filters.equipmentType) {
      return false;
    }
    if (filters.dateFrom) {
      const detectedDate = new Date(item.detectedAt);
      if (detectedDate < new Date(filters.dateFrom)) {
        return false;
      }
    }
    if (filters.dateTo) {
      const detectedDate = new Date(item.detectedAt);
      if (detectedDate > new Date(filters.dateTo)) {
        return false;
      }
    }
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const matchesName = item.equipmentName.toLowerCase().includes(searchLower);
      const matchesVessel = item.vesselName.toLowerCase().includes(searchLower);
      const matchesFailureMode = item.failureMode.toLowerCase().includes(searchLower);
      if (!matchesName && !matchesVessel && !matchesFailureMode) {
        return false;
      }
    }
    return true;
  });
}

export function formatCsvRow(values: (string | number | null | undefined)[]): string {
  return values
    .map((v) => {
      if (v === null || v === undefined) {
        return "";
      }
      const str = String(v);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    })
    .join(",");
}
