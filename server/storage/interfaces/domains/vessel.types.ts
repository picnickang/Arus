/**
 * Vessel Storage Interface - Vessels, Port Calls, Drydocks, Weather
 * Part of IStorage modularization for improved maintainability
 */

import type { WidenPartial } from "../../../lib/widen-partial";
import type {
  Vessel as SelectVessel,
  InsertVessel,
  PortCall as SelectPortCall,
  InsertPortCall,
  DrydockWindow as SelectDrydockWindow,
  InsertDrydockWindow,
} from "@shared/schema";

/**
 * Vessel storage operations for fleet management
 */
export interface IVesselStorage {
  // Vessels
  getVessels(orgId?: string): Promise<SelectVessel[]>;
  getVesselsPaginated(
    orgId: string | undefined,
    limit: number,
    offset: number
  ): Promise<{ items: SelectVessel[]; total: number }>;
  getVessel(id: string, orgId?: string): Promise<SelectVessel | undefined>;
  createVessel(vessel: InsertVessel): Promise<SelectVessel>;
  updateVessel(id: string, vessel: WidenPartial<InsertVessel>, orgId?: string): Promise<SelectVessel>;
  deleteVessel(id: string, deleteEquipment?: boolean, orgId?: string): Promise<void>;
  resetVesselDowntime(id: string): Promise<SelectVessel>;
  resetVesselOperation(id: string): Promise<SelectVessel>;
  wipeVesselData(vesselId: string, orgId?: string): Promise<{ deletedRecords: number }>;
  exportVessel(vesselId: string, orgId: string): Promise<Record<string, unknown>>;
  importVessel(
    data: Record<string, unknown>,
    orgId: string
  ): Promise<{ vesselId: string; equipmentCount: number; crewCount: number }>;

  // Fleet Overview
  getVesselFleetOverview(
    orgId?: string
  ): Promise<{
    vessels: number;
    signalsMapped: number;
    signalsDiscovered: number;
    latestPerVessel: Array<{ vesselId: string; lastTs: string }>;
    dq7d: Record<string, number>;
  }>;

  // Weather Data
  cacheWeatherData(data: Record<string, unknown>, orgId: string): Promise<void>;
  getLatestWeatherForVessel(
    vesselId: string,
    orgId: string
  ): Promise<Record<string, unknown> | null>;

  // Port Calls
  getPortCalls(vesselId?: string): Promise<SelectPortCall[]>;
  createPortCall(portCall: InsertPortCall): Promise<SelectPortCall>;
  updatePortCall(id: string, portCall: Partial<InsertPortCall>): Promise<SelectPortCall>;
  deletePortCall(id: string): Promise<void>;

  // Drydock Windows
  getDrydockWindows(vesselId?: string): Promise<SelectDrydockWindow[]>;
  createDrydockWindow(drydock: InsertDrydockWindow): Promise<SelectDrydockWindow>;
  updateDrydockWindow(
    id: string,
    drydock: Partial<InsertDrydockWindow>
  ): Promise<SelectDrydockWindow>;
  deleteDrydockWindow(id: string): Promise<void>;
}
