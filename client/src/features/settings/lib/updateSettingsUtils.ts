import { z } from "zod";

export const updateSettingsSchema = z.object({
  autoUpdateEnabled: z.boolean().default(false),
  autoUpdateCriticalOnly: z.boolean().default(true),
  updateChannel: z.enum(["alpha", "beta", "stable"]).default("stable"),
  checkInterval: z.number().min(3600).max(604800).default(21600),
  maintenanceWindowStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  maintenanceWindowEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  maintenanceWindowTimezone: z.string().default("UTC"),
  deferUpdatesUntilPort: z.boolean().default(false),
  maxDownloadBandwidthKbps: z.number().min(0).max(100000).optional(),
  requireManualApproval: z.boolean().default(false),
  notifyOnUpdateAvailable: z.boolean().default(true),
  notifyOnUpdateApplied: z.boolean().default(true),
  githubOwner: z.string().min(1).max(100).optional(),
  githubRepo: z.string().min(1).max(100).optional(),
});

export type UpdateSettingsForm = z.infer<typeof updateSettingsSchema>;

export interface DeviceHistoryEntry {
  previousVersion: string;
  version: string;
  appliedAt: string;
  success: boolean;
  errorMessage?: string | null;
}
