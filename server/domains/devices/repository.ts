import type { Device, InsertDevice } from "@shared/schema";
import { dbDevicesStorage } from "../../repositories";

export class DeviceRepository {
  async findAll(orgId?: string): Promise<Device[]> {
    return dbDevicesStorage.getDevices(orgId);
  }

  async findById(id: string, orgId?: string): Promise<Device | undefined> {
    return dbDevicesStorage.getDevice(id, orgId);
  }

  async create(device: InsertDevice): Promise<Device> {
    return dbDevicesStorage.createDevice(device);
  }

  async update(id: string, data: Partial<InsertDevice>, orgId: string): Promise<Device> {
    return dbDevicesStorage.updateDevice(id, data, orgId);
  }

  async delete(id: string, orgId: string): Promise<void> {
    return dbDevicesStorage.deleteDevice(id, orgId);
  }

  async getDevicesWithStatus(orgId?: string) {
    return dbDevicesStorage.getDevicesWithStatus(orgId);
  }
}

export const deviceRepository = new DeviceRepository();
