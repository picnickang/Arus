/**
 * Devices Infrastructure - Repository Adapter
 * Implements IDeviceRepository using dbDevicesStorage (the only devices layer
 * permitted to touch the storage barrel).
 */

import type { IDeviceRepository } from "../domain/ports";
import type { Device, InsertDevice, DeviceWithStatusEntity } from "../domain/types";
import type { WidenPartial } from "../../../lib/widen-partial";
import { dbDevicesStorage } from "../../../repositories";

export class DeviceRepositoryAdapter implements IDeviceRepository {
  findAll(orgId?: string): Promise<Device[]> {
    return dbDevicesStorage.getDevices(orgId);
  }

  findById(id: string, orgId?: string): Promise<Device | undefined> {
    return dbDevicesStorage.getDevice(id, orgId) as Promise<Device | undefined>;
  }

  create(device: InsertDevice): Promise<Device> {
    return dbDevicesStorage.createDevice(device);
  }

  update(id: string, data: WidenPartial<InsertDevice>, orgId: string): Promise<Device> {
    return dbDevicesStorage.updateDevice(id, data, orgId) as Promise<Device>;
  }

  async delete(id: string, orgId: string): Promise<void> {
    await dbDevicesStorage.deleteDevice(id, orgId);
  }

  getDevicesWithStatus(orgId?: string): Promise<DeviceWithStatusEntity[]> {
    return dbDevicesStorage.getDevicesWithStatus(orgId);
  }
}

export const deviceRepository = new DeviceRepositoryAdapter();
