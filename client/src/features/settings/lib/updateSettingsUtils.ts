import { z } from "zod";

export const updateSettingsSchema = z.object({
  autoUpdateEnabled: z.boolean().default(false),
  autoUpdateCriticalOnly: z.boolean().default(true),
  updateChannel: z.enum(["alpha", "beta", "stable"]).default("stable"),
  checkInterval: z.number().min(3600).max(604800).default(21600),
  maintenanceWindowStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  maintenanceWindowEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
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

export interface DeviceHistory {
  deviceId: string;
  deviceType: string;
  currentVersion: string;
  updateHistory: DeviceHistoryEntry[];
}

export interface GitHubConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentOwner?: string;
  currentRepo?: string;
  onSave: (owner: string, repo: string, token?: string) => Promise<void>;
}

export interface DeviceHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceId: string;
  deviceName?: string;
}

export function createDefaultUpdateSettings(): UpdateSettingsForm {
  return {
    autoUpdateEnabled: false,
    autoUpdateCriticalOnly: true,
    updateChannel: "stable",
    checkInterval: 21600,
    maintenanceWindowStart: undefined,
    maintenanceWindowEnd: undefined,
    maintenanceWindowTimezone: "UTC",
    deferUpdatesUntilPort: false,
    maxDownloadBandwidthKbps: undefined,
    requireManualApproval: false,
    notifyOnUpdateAvailable: true,
    notifyOnUpdateApplied: true,
    githubOwner: undefined,
    githubRepo: undefined,
  };
}

export function formatCheckInterval(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  if (hours < 24) {return `${hours} hour${hours !== 1 ? "s" : ""}`;}
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? "s" : ""}`;
}

export const UPDATE_CHANNELS = [
  { value: "stable", label: "Stable", description: "Production-ready releases" },
  { value: "beta", label: "Beta", description: "Pre-release testing" },
  { value: "alpha", label: "Alpha", description: "Early development builds" },
] as const;

export const CHECK_INTERVALS = [
  { value: 3600, label: "1 Hour" },
  { value: 7200, label: "2 Hours" },
  { value: 14400, label: "4 Hours" },
  { value: 21600, label: "6 Hours" },
  { value: 43200, label: "12 Hours" },
  { value: 86400, label: "1 Day" },
  { value: 604800, label: "1 Week" },
] as const;

export const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const;

export function getDeviceStatusColor(status: string): string {
  switch (status) {
    case "up_to_date":
      return "bg-green-500";
    case "update_available":
      return "bg-yellow-500";
    case "updating":
      return "bg-blue-500";
    case "error":
      return "bg-red-500";
    default:
      return "bg-gray-500";
  }
}

export function getDeviceStatusLabel(status: string): string {
  switch (status) {
    case "up_to_date":
      return "Up to Date";
    case "update_available":
      return "Update Available";
    case "updating":
      return "Updating";
    case "error":
      return "Error";
    default:
      return "Unknown";
  }
}

export function formatLastSeen(date: string | null): string {
  if (!date) {return "Never";}
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) {return "Just now";}
  if (diffMins < 60) {return `${diffMins}m ago`;}
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {return `${diffHours}h ago`;}
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function getDeviceIcon(deviceType: string): "ship" | "laptop" | "globe" {
  switch (deviceType) {
    case "vessel":
      return "ship";
    case "desktop":
      return "laptop";
    default:
      return "globe";
  }
}
