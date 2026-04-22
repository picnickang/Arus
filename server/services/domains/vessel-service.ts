/**
 * Vessel Service
 * Encapsulates vessel management logic including fleet overview, port calls, and drydock windows
 * Handles WebSocket broadcasting for real-time vessel updates
 */

import { dbVesselStorage } from "../../db/vessels/index.js";
import { getWebSocketServer } from "../../websocket-server";
import type { Vessel, InsertVessel, PortCall, InsertPortCall, DrydockWindow, InsertDrydockWindow } from "@shared/schema";

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
  async getVesselFleetOverview(orgId?: string): Promise<{ vessels: number; signalsMapped: number; signalsDiscovered: number; latestPerVessel: Array<{ vesselId: string; lastTs: string }>; dq7d: Record<string, number> }> {
    const v = await this.getVessels(orgId);
    return { vessels: v.length, signalsMapped: 0, signalsDiscovered: 0, latestPerVessel: v.map(x => ({ vesselId: x.id, lastTs: new Date().toISOString() })), dq7d: {} };
  }

  async exportVessel(vesselId: string, orgId: string): Promise<Record<string, unknown>> {
    const vessel = await dbVesselStorage.getVessel(vesselId, orgId);
    if (!vessel) {throw new Error(`Vessel ${vesselId} not found`);}
    return { ...vessel };
  }

  async importVessel(data: Record<string, unknown>, orgId: string): Promise<{ vesselId: string; equipmentCount: number; crewCount: number }> {
    const vesselData = { ...data, organizationId: orgId } as InsertVessel;
    const created = await dbVesselStorage.createVessel(vesselData);
    return { vesselId: created.id, equipmentCount: 0, crewCount: 0 };
  }

  async resetVesselDowntime(vesselId: string, _orgId?: string): Promise<Vessel> {
    return dbVesselStorage.updateVessel(vesselId, { status: "operational" });
  }

  async resetVesselOperation(vesselId: string, _orgId?: string): Promise<Vessel> {
    return dbVesselStorage.updateVessel(vesselId, { status: "operational" });
  }

  async wipeVesselData(vesselId: string, orgId?: string): Promise<{ deletedRecords: number }> {
    await dbVesselStorage.deleteVessel(vesselId, orgId);
    return { deletedRecords: 1 };
  }
}

export const vesselService = new VesselService();
