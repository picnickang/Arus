/**
 * Vessel Service
 * Encapsulates vessel management logic including fleet overview, port calls, and drydock windows
 * Handles WebSocket broadcasting for real-time vessel updates
 */

import { dbVesselStorage } from "../../db/vessels/index.js";
import { getWebSocketServer } from "../../websocket-server";
import type { Vessel, InsertVessel, PortCall, InsertPortCall, DrydockWindow, InsertDrydockWindow } from "@shared/schema-runtime";

class VesselService {
  async getVessels(orgId?: string): Promise<Vessel[]> {
    return dbVesselStorage.getVessels(orgId);
  }
  async getVessel(id: string, orgId?: string): Promise<Vessel | undefined> {
    return dbVesselStorage.getVessel(id, orgId);
  }
  async getVesselByName(name: string, orgId: string): Promise<Vessel | undefined> {
    return dbVesselStorage.getVesselByName(name, orgId);
  }
  async createVessel(vesselData: InsertVessel): Promise<Vessel> {
    const newVessel = await dbVesselStorage.createVessel(vesselData);
    const wsServer = getWebSocketServer();
    wsServer?.broadcastVesselChange("create", newVessel);
    return newVessel;
  }
  async updateVessel(id: string, updates: Partial<InsertVessel>, orgId?: string): Promise<Vessel> {
    const updated = await dbVesselStorage.updateVessel(id, updates, orgId);
    const wsServer = getWebSocketServer();
    wsServer?.broadcastVesselChange("update", updated);
    return updated;
  }
  async deleteVessel(id: string, orgId?: string): Promise<void> {
    return dbVesselStorage.deleteVessel(id, orgId);
  }
  async getFleetOverview(orgId?: string) {
    return dbVesselStorage.getFleetOverview(orgId);
  }
  async getPortCalls(vesselId: string, orgId: string): Promise<PortCall[]> {
    return dbVesselStorage.getPortCalls(vesselId, orgId);
  }
  async createPortCall(portCallData: InsertPortCall): Promise<PortCall> {
    return dbVesselStorage.createPortCall(portCallData);
  }
  async updatePortCall(id: string, updates: Partial<InsertPortCall>, orgId: string): Promise<PortCall> {
    return dbVesselStorage.updatePortCall(id, updates, orgId);
  }
  async deletePortCall(id: string, orgId: string): Promise<void> {
    return dbVesselStorage.deletePortCall(id, orgId);
  }
  async getDrydockWindows(vesselId: string, orgId: string): Promise<DrydockWindow[]> {
    return dbVesselStorage.getDrydockWindows(vesselId, orgId);
  }
  async createDrydockWindow(windowData: InsertDrydockWindow): Promise<DrydockWindow> {
    return dbVesselStorage.createDrydockWindow(windowData);
  }
  async updateDrydockWindow(id: string, updates: Partial<InsertDrydockWindow>, orgId: string): Promise<DrydockWindow> {
    return dbVesselStorage.updateDrydockWindow(id, updates, orgId);
  }
  async deleteDrydockWindow(id: string, orgId: string): Promise<void> {
    return dbVesselStorage.deleteDrydockWindow(id, orgId);
  }
}

export const vesselService = new VesselService();
