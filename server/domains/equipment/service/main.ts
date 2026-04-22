/**
 * Equipment Service - Main Service Class
 */

import type { Equipment, InsertEquipment, InsertDecommissionEvent } from "@shared/schema";
import type { EquipmentHealth } from "../../../db/equipment/types.js";
import { DualWriteAdapter } from "../../../infrastructure/DualWriteAdapter";
import { featureFlags } from "../../../infrastructure/feature-flags";
import type {
  PaginationOptions,
  PaginatedResult,
  SensorCoverageResult,
  SensorSetupResult,
} from "./types.js";
import type {
  DecommissionResult,
  DecommissionedEquipmentWithEvent,
} from "./decommission-operations.js";
import * as crud from "./crud-operations.js";
import * as health from "./health-operations.js";
import * as sensors from "./sensor-operations.js";
import * as parts from "./parts-operations.js";
import * as decommission from "./decommission-operations.js";

export class EquipmentService {
  private adapter: DualWriteAdapter;

  constructor() {
    this.adapter = new DualWriteAdapter({
      featureFlag: () => featureFlags.isEnabled("useTenantScopedEquipment"),
      domain: "equipment",
    });
  }

  async listEquipment(orgId: string): Promise<Equipment[]> {
    return crud.listEquipment(this.adapter, orgId);
  }

  async listEquipmentPaginated(
    orgId: string,
    options: PaginationOptions
  ): Promise<PaginatedResult<Equipment>> {
    return crud.listEquipmentPaginated(this.adapter, orgId, options);
  }

  async getEquipmentById(equipmentId: string, orgId: string): Promise<Equipment | undefined> {
    return crud.getEquipmentById(this.adapter, equipmentId, orgId);
  }

  async createEquipment(data: InsertEquipment, userId?: string): Promise<Equipment> {
    return crud.createEquipment(this.adapter, data, userId);
  }

  async updateEquipment(
    id: string,
    data: Partial<InsertEquipment>,
    orgId: string,
    userId?: string
  ): Promise<Equipment> {
    return crud.updateEquipment(this.adapter, id, data, orgId, userId);
  }

  async deleteEquipment(id: string, orgId: string, userId?: string): Promise<void> {
    return crud.deleteEquipment(this.adapter, id, orgId, userId);
  }

  async disassociateVessel(equipmentId: string, orgId: string, userId?: string): Promise<void> {
    return crud.disassociateVessel(this.adapter, equipmentId, orgId, userId);
  }

  async getEquipmentHealth(
    orgId: string,
    vesselId?: string,
    equipmentId?: string
  ): Promise<EquipmentHealth[]> {
    return health.getEquipmentHealth(this.adapter, orgId, vesselId, equipmentId);
  }

  async getEquipmentWithSensorIssues(orgId: string): Promise<Equipment[]> {
    return health.getEquipmentWithSensorIssues(this.adapter, orgId);
  }

  async getSensorCoverage(equipmentId: string, orgId: string): Promise<SensorCoverageResult> {
    return sensors.getSensorCoverage(this.adapter, equipmentId, orgId);
  }

  async setupSensors(equipmentId: string, orgId: string): Promise<SensorSetupResult> {
    return sensors.setupSensors(this.adapter, equipmentId, orgId);
  }

  async getCompatibleParts(equipmentId: string, orgId: string) {
    return parts.getCompatibleParts(this.adapter, equipmentId, orgId);
  }

  async getSuggestedParts(equipmentId: string, orgId: string) {
    return parts.getSuggestedParts(this.adapter, equipmentId, orgId);
  }

  async decommissionEquipment(
    equipmentId: string,
    orgId: string,
    data: InsertDecommissionEvent
  ): Promise<DecommissionResult> {
    return decommission.decommissionEquipment(this.adapter, equipmentId, orgId, data);
  }

  async listDecommissionedEquipment(orgId: string): Promise<DecommissionedEquipmentWithEvent[]> {
    return decommission.listDecommissionedEquipment(orgId);
  }

  async getEquipmentFinancialSummary(orgId: string) {
    return decommission.getEquipmentFinancialSummary(orgId);
  }
}

export const equipmentService = new EquipmentService();
