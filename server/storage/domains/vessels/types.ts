/**
 * Vessel Storage Types
 * Vessel management and fleet operations
 */

import type {
  SelectVessel,
  InsertVessel,
} from "@shared/schema-runtime";

export interface VesselFilters {
  orgId?: string;
  status?: string;
}

export interface VesselContext {
  vessel: SelectVessel;
  ageYears: number;
  operatingConditions: string[];
  environmentalFactors: string[];
  maintenanceHistory: any[];
  fleetPosition?: { lat: number; lng: number };
}

/**
 * Vessel Storage Interface
 */
export interface IVesselStorage {
  getVessels(orgId?: string): Promise<SelectVessel[]>;
  getVessel(id: string, orgId?: string): Promise<SelectVessel | undefined>;
  createVessel(vessel: InsertVessel): Promise<SelectVessel>;
  updateVessel(id: string, vessel: Partial<InsertVessel>): Promise<SelectVessel>;
  deleteVessel(id: string, orgId?: string): Promise<void>;
  resetVesselDowntime(id: string): Promise<SelectVessel>;
  resetVesselOperation(id: string): Promise<SelectVessel>;
  getVesselContext(vesselId: string, orgId?: string): Promise<VesselContext>;
}

export type {
  SelectVessel,
  InsertVessel,
};
