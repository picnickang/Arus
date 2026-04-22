import { apiRequest } from "../queryClient";
import type { SystemSettings, InsertSettings } from "@shared/schema";

export interface DashboardMetrics {
  fleetHealthScore?: number;
  openWorkOrders?: number;
  riskAlerts?: number;
  [key: string]: unknown;
}

export async function fetchSettings(): Promise<SystemSettings> {
  return apiRequest("GET", "/api/settings");
}

export async function updateSettings(settings: Partial<InsertSettings>): Promise<SystemSettings> {
  return apiRequest("PUT", "/api/settings", settings);
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  return apiRequest("GET", "/api/dashboard");
}

export interface DashboardSummary {
  metrics: DashboardMetrics;
  vessels: Array<{ id: string; name: string; imo?: string; vesselType?: string }>;
  devices: Array<{ id: string; name: string; status?: string; vesselId?: string }>;
  equipmentHealth: Array<{ id: string; name?: string; healthIndex: number; status?: string }>;
  workOrders: Array<{
    id: string;
    title?: string;
    priority?: string | number;
    status?: string;
    equipmentId?: string;
  }>;
  equipment: Array<{ id: string; name: string; type?: string; vesselId?: string }>;
  timestamp: string;
}

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  return apiRequest("GET", "/api/dashboard/summary");
}

export async function fetchDtcDashboardStats(): Promise<{
  totalActiveDtcs: number;
  criticalDtcs: number;
  equipmentWithDtcs: number;
  dtcTriggeredWorkOrders: number;
}> {
  return apiRequest("GET", "/api/dtc/dashboard-stats");
}
