import { apiRequest } from "../queryClient";
import type { SystemSettings, InsertSettings } from "@shared/schema";

export async function fetchSettings(): Promise<SystemSettings> {
  return apiRequest("GET", "/api/settings");
}

export async function updateSettings(settings: Partial<InsertSettings>): Promise<SystemSettings> {
  return apiRequest("PUT", "/api/settings", settings);
}
