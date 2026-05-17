export type {
  Vessel,
  Vessel as SelectVessel,
  InsertVessel,
  PortCall,
  InsertPortCall,
  DrydockWindow,
  InsertDrydockWindow,
} from "@shared/schema-runtime";

export type {
  Organization,
  InsertOrganization,
  User,
  InsertUser,
  UpdateUser,
  SystemSettings,
  InsertSystemSettings,
} from "@shared/schema/core";

export interface FleetOverview {
  totalVessels: number;
  activeVessels: number;
  vesselsByStatus: Record<string, number>;
}

export interface VesselExportData {
  vessel: Record<string, unknown>;
  equipment: Record<string, unknown>[];
  crew: Record<string, unknown>[];
  exportedAt: string;
}

export interface VesselImportResult {
  vesselId: string;
  equipmentCount: number;
  crewCount: number;
  vessel?: { id: string } & Record<string, unknown>;
}

export interface WipeDataResult {
  deletedRecords: number;
}

export interface EquipmentAssignment {
  equipmentId: string;
  vesselId: string;
}
