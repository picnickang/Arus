import type {
  DeckLogEntry,
  InsertDeckLogEntry,
  EngineLogEntry,
  InsertEngineLogEntry,
} from "@shared/schema-runtime";

export interface LogbookFilters {
  vesselId?: string;
  startDate?: Date;
  endDate?: Date;
  entryType?: string;
  shift?: string;
  status?: "draft" | "submitted" | "approved";
  orgId?: string;
  limit?: number;
  offset?: number;
}

export interface FuelEmissionsEntry {
  id: string;
  vesselId: string;
  timestamp: Date;
  fuelType: string;
  fuelConsumed: number;
  distance: number;
  co2Emissions: number;
  ciiRating?: string;
  orgId: string;
}

export interface VesselTrackEntry {
  id: string;
  vesselId: string;
  timestamp: Date;
  latitude: number;
  longitude: number;
  sog: number;
  cog: number;
  heading?: number;
  orgId: string;
}

export interface ConditionMonitoringEntry {
  id: string;
  equipmentId: string;
  vesselId: string;
  timestamp: Date;
  healthScore: number;
  anomalyDetected: boolean;
  alertsTriggered: number;
  orgId: string;
}

export interface IDeckLogStorage {
  getDeckLogEntries(filters: LogbookFilters): Promise<DeckLogEntry[]>;
  getDeckLogEntry(id: string, orgId?: string): Promise<DeckLogEntry | undefined>;
  createDeckLogEntry(entry: InsertDeckLogEntry): Promise<DeckLogEntry>;
  updateDeckLogEntry(
    id: string,
    entry: Partial<InsertDeckLogEntry>,
    orgId?: string
  ): Promise<DeckLogEntry>;
  deleteDeckLogEntry(id: string, orgId?: string): Promise<void>;
  getDeckLogEntriesByVessel(
    vesselId: string,
    startDate?: Date,
    endDate?: Date,
    orgId?: string
  ): Promise<DeckLogEntry[]>;
  submitDeckLogEntry(id: string, submittedBy: string, orgId?: string): Promise<DeckLogEntry>;
  approveDeckLogEntry(id: string, approvedBy: string, orgId?: string): Promise<DeckLogEntry>;
}

export interface IEngineLogStorage {
  getEngineLogEntries(filters: LogbookFilters): Promise<EngineLogEntry[]>;
  getEngineLogEntry(id: string, orgId?: string): Promise<EngineLogEntry | undefined>;
  createEngineLogEntry(entry: InsertEngineLogEntry): Promise<EngineLogEntry>;
  updateEngineLogEntry(
    id: string,
    entry: Partial<InsertEngineLogEntry>,
    orgId?: string
  ): Promise<EngineLogEntry>;
  deleteEngineLogEntry(id: string, orgId?: string): Promise<void>;
  getEngineLogEntriesByVessel(
    vesselId: string,
    startDate?: Date,
    endDate?: Date,
    orgId?: string
  ): Promise<EngineLogEntry[]>;
  submitEngineLogEntry(id: string, submittedBy: string, orgId?: string): Promise<EngineLogEntry>;
  approveEngineLogEntry(id: string, approvedBy: string, orgId?: string): Promise<EngineLogEntry>;
}

export interface IFuelEmissionsStorage {
  getFuelEmissionsLog(
    vesselId: string,
    startDate?: Date,
    endDate?: Date,
    orgId?: string
  ): Promise<FuelEmissionsEntry[]>;
  getFuelEmissionsSummary(
    vesselId: string,
    period: "daily" | "weekly" | "monthly",
    orgId?: string
  ): Promise<{
    totalFuel: number;
    totalDistance: number;
    totalEmissions: number;
    avgCiiRating: string;
  }>;
  autofillFuelEmissions(
    vesselId: string,
    startDate: Date,
    endDate: Date,
    orgId?: string
  ): Promise<{ created: number; skipped: number }>;
}

export interface IVesselTrackStorage {
  getVesselTrack(
    vesselId: string,
    startDate?: Date,
    endDate?: Date,
    orgId?: string
  ): Promise<VesselTrackEntry[]>;
  getVesselTrackStats(vesselId: string, period: string, orgId?: string): Promise<{
    totalDistance: number;
    avgSpeed: number;
    maxSpeed: number;
    operatingHours: number;
  }>;
  getLastPosition(vesselId: string, orgId?: string): Promise<VesselTrackEntry | undefined>;
  exportTrackAsGpx(
    vesselId: string,
    startDate: Date,
    endDate: Date,
    orgId?: string
  ): Promise<string>;
  processTrackTelemetry(
    vesselId: string,
    equipmentId: string,
    orgId?: string
  ): Promise<{ processed: number }>;
}

export interface IConditionMonitoringStorage {
  getConditionMonitoringLog(
    vesselId: string,
    startDate?: Date,
    endDate?: Date,
    orgId?: string
  ): Promise<ConditionMonitoringEntry[]>;
  getConditionByEquipment(
    equipmentId: string,
    startDate?: Date,
    endDate?: Date,
    orgId?: string
  ): Promise<ConditionMonitoringEntry[]>;
  getConditionSummary(vesselId: string, orgId?: string): Promise<{
    equipmentCount: number;
    avgHealthScore: number;
    anomaliesDetected: number;
    alertsTriggered: number;
  }>;
  autofillConditionMonitoring(
    vesselId: string,
    startDate: Date,
    endDate: Date,
    orgId?: string
  ): Promise<{ created: number; skipped: number }>;
}
