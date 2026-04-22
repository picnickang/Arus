export interface Vessel {
  id: string;
  orgId: string;
  name: string;
  imo?: string;
  mmsi?: string;
  callSign?: string;
  vesselType?: string;
  flag?: string;
  grossTonnage?: number;
  deadweightTonnage?: number;
  length?: number;
  beam?: number;
  draft?: number;
  yearBuilt?: number;
  classificationSociety?: string;
  homePort?: string;
  status: "active" | "in_port" | "at_anchor" | "in_drydock" | "laid_up" | "decommissioned";
  currentPosition?: {
    latitude: number;
    longitude: number;
    heading?: number;
    speed?: number;
    timestamp?: Date;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Equipment {
  id: string;
  orgId: string;
  vesselId: string;
  name: string;
  type: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  installDate?: Date;
  lastMaintenanceDate?: Date;
  nextMaintenanceDate?: Date;
  status: "operational" | "degraded" | "warning" | "critical" | "offline";
  location?: string;
  runningHours?: number;
  healthScore?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Device {
  id: string;
  orgId: string;
  vesselId: string;
  equipmentId?: string;
  deviceType: string;
  serialNumber?: string;
  firmwareVersion?: string;
  lastSeen?: Date;
  isOnline: boolean;
  ipAddress?: string;
  macAddress?: string;
}

export const VESSEL_TYPES = [
  "Bulk Carrier",
  "Container Ship",
  "Tanker",
  "LNG Carrier",
  "Passenger Ship",
  "Ro-Ro",
  "General Cargo",
  "Tug",
  "Offshore Support",
  "Research Vessel",
] as const;

export const VESSEL_STATUSES = [
  "active",
  "in_port",
  "at_anchor",
  "in_drydock",
  "laid_up",
  "decommissioned",
] as const;
export const EQUIPMENT_STATUSES = [
  "operational",
  "degraded",
  "warning",
  "critical",
  "offline",
] as const;

export type VesselType = (typeof VESSEL_TYPES)[number];
export type VesselStatus = (typeof VESSEL_STATUSES)[number];
export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number];
