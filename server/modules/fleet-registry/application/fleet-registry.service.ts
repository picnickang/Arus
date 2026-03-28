import type { InsertVessel, Vessel, FleetOverview } from "../domain/types";
import type {
  VesselRepositoryPort,
  PortCallRepositoryPort,
  DrydockWindowRepositoryPort,
  VesselOperationsPort,
  EventPublisherPort,
} from "../domain/ports";
import { incrementVesselOperation } from "../../../observability";

export class FleetRegistryService {
  constructor(
    private readonly vesselRepo: VesselRepositoryPort,
    private readonly portCallRepo: PortCallRepositoryPort,
    private readonly drydockRepo: DrydockWindowRepositoryPort,
    private readonly vesselOps: VesselOperationsPort,
    private readonly eventPublisher: EventPublisherPort
  ) {}

  async listVessels(orgId?: string): Promise<Vessel[]> {
    return this.vesselRepo.findAll(orgId);
  }

  async getVesselById(id: string): Promise<Vessel | undefined> {
    return this.vesselRepo.findById(id);
  }

  async getVesselByName(name: string, orgId: string): Promise<Vessel | undefined> {
    return this.vesselRepo.findByName(name, orgId);
  }

  async getFleetOverview(orgId?: string): Promise<FleetOverview> {
    return this.vesselRepo.getFleetOverview(orgId);
  }

  async createVessel(data: InsertVessel, userId?: string): Promise<Vessel> {
    const vessel = await this.vesselRepo.create(data);
    incrementVesselOperation("create", vessel.id);
    await this.eventPublisher.publish("vessel", vessel.id, "create", vessel, userId);
    this.eventPublisher.publishVesselMqtt("create", vessel);
    return vessel;
  }

  async updateVessel(id: string, data: Partial<InsertVessel>, userId?: string): Promise<Vessel> {
    const vessel = await this.vesselRepo.update(id, data);
    await this.eventPublisher.publish("vessel", vessel.id, "update", vessel, userId);
    this.eventPublisher.publishVesselMqtt("update", vessel);
    return vessel;
  }

  async deleteVessel(id: string, _deleteEquipment: boolean, orgId: string, userId?: string): Promise<void> {
    await this.vesselRepo.delete(id, orgId);
    await this.eventPublisher.publish("vessel", id, "delete", { id }, userId);
    this.eventPublisher.publishVesselMqtt("delete", { id } as any);
  }

  async exportVessel(id: string, orgId: string) {
    return this.vesselOps.exportVessel(id, orgId);
  }

  async importVessel(data: any, orgId: string, userId?: string) {
    const result = await this.vesselOps.importVessel(data, orgId);
    if (result.vessel) {
      await this.eventPublisher.publish("vessel", result.vessel.id, "create", result.vessel, userId);
    }
    return result;
  }

  async resetDowntime(vesselId: string, orgId: string, userId?: string) {
    const result = await this.vesselOps.resetDowntime(vesselId, orgId);
    await this.eventPublisher.publish("vessel", vesselId, "update", { id: vesselId }, userId);
    return result;
  }

  async resetOperation(vesselId: string, orgId: string, userId?: string) {
    const result = await this.vesselOps.resetOperation(vesselId, orgId);
    await this.eventPublisher.publish("vessel", vesselId, "update", { id: vesselId }, userId);
    return result;
  }

  async wipeData(vesselId: string, orgId: string, userId?: string) {
    const result = await this.vesselOps.wipeData(vesselId, orgId);
    await this.eventPublisher.publish("vessel", vesselId, "update", { id: vesselId }, userId);
    return result;
  }

  async getVesselEquipment(vesselId: string, orgId: string) {
    return this.vesselOps.getVesselEquipment(vesselId, orgId);
  }

  async assignEquipment(vesselId: string, equipmentId: string, orgId: string, userId?: string) {
    const result = await this.vesselOps.assignEquipment(vesselId, equipmentId, orgId);
    await this.eventPublisher.publish("equipment", equipmentId, "update", { id: equipmentId, vesselId }, userId);
    return result;
  }

  async unassignEquipment(vesselId: string, equipmentId: string, orgId: string, userId?: string) {
    const result = await this.vesselOps.unassignEquipment(vesselId, equipmentId, orgId);
    await this.eventPublisher.publish("equipment", equipmentId, "update", { id: equipmentId, vesselId: null }, userId);
    return result;
  }

  async getPortCalls(vesselId: string, orgId: string) {
    return this.portCallRepo.findByVessel(vesselId, orgId);
  }

  async createPortCall(data: any) {
    return this.portCallRepo.create(data);
  }

  async updatePortCall(id: string, updates: any, orgId: string) {
    return this.portCallRepo.update(id, updates, orgId);
  }

  async deletePortCall(id: string, orgId: string) {
    return this.portCallRepo.delete(id, orgId);
  }

  async getDrydockWindows(vesselId: string, orgId: string) {
    return this.drydockRepo.findByVessel(vesselId, orgId);
  }

  async createDrydockWindow(data: any) {
    return this.drydockRepo.create(data);
  }

  async updateDrydockWindow(id: string, updates: any, orgId: string) {
    return this.drydockRepo.update(id, updates, orgId);
  }

  async deleteDrydockWindow(id: string, orgId: string) {
    return this.drydockRepo.delete(id, orgId);
  }
}
