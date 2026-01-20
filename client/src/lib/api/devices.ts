import { apiRequest } from "../queryClient";
import type {
  Device,
  InsertDevice,
  EdgeHeartbeat,
  InsertHeartbeat,
  PdmScoreLog,
  InsertPdmScore,
  DeviceWithStatus,
} from "@shared/schema";

export async function fetchDevices(): Promise<DeviceWithStatus[]> {
  return apiRequest("GET", "/api/devices");
}

export async function fetchDevice(id: string): Promise<Device> {
  return apiRequest("GET", `/api/devices/${id}`);
}

export async function createDevice(device: InsertDevice): Promise<Device> {
  return apiRequest("POST", "/api/devices", device);
}

export async function updateDevice(id: string, device: Partial<InsertDevice>): Promise<Device> {
  return apiRequest("PUT", `/api/devices/${id}`, device);
}

export async function fetchHeartbeats(): Promise<EdgeHeartbeat[]> {
  return apiRequest("GET", "/api/edge/heartbeats");
}

export async function createHeartbeat(heartbeat: InsertHeartbeat): Promise<EdgeHeartbeat> {
  return apiRequest("POST", "/api/edge/heartbeat", heartbeat);
}

export async function fetchPdmScores(equipmentId?: string): Promise<PdmScoreLog[]> {
  const url = equipmentId ? `/api/pdm/scores?equipmentId=${equipmentId}` : "/api/pdm/scores";
  return apiRequest("GET", url);
}

export async function fetchLatestPdmScore(equipmentId: string): Promise<PdmScoreLog> {
  return apiRequest("GET", `/api/pdm/scores/${equipmentId}/latest`);
}

export async function createPdmScore(score: InsertPdmScore): Promise<PdmScoreLog> {
  return apiRequest("POST", "/api/pdm/scores", score);
}
