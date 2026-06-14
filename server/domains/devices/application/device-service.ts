/**
 * Devices Application Service
 * Business logic, orchestration, and event publishing over the IDeviceRepository
 * port (constructor DI).
 */

import type { IDeviceRepository } from "../domain/ports";
import type { Device, InsertDevice, DeviceWithStatusEntity } from "../domain/types";
import type { WidenPartial } from "../../../lib/widen-partial";
import { recordAndPublish } from "../../../sync-events";
import { mqttReliableSync } from "../../../mqtt-reliable-sync";
import { logger } from "../../../utils/logger.js";

export class DeviceService {
  constructor(private readonly repository: IDeviceRepository) {}

  listDevices(orgId?: string): Promise<Device[]> {
    return this.repository.findAll(orgId);
  }

  getDeviceById(id: string, orgId?: string): Promise<Device | undefined> {
    return this.repository.findById(id, orgId);
  }

  getDevicesWithStatus(orgId?: string): Promise<DeviceWithStatusEntity[]> {
    return this.repository.getDevicesWithStatus(orgId);
  }

  async createDevice(data: InsertDevice, userId?: string): Promise<Device> {
    const device = await this.repository.create(data);

    await recordAndPublish("device", device.id, "create", device, userId);

    mqttReliableSync.publishDataChange("device", "create", device).catch((err) => {
      logger.error("DeviceService", "Failed to publish device create to MQTT", err);
    });

    return device;
  }

  async updateDevice(
    id: string,
    data: WidenPartial<InsertDevice>,
    orgId: string,
    userId?: string | undefined
  ): Promise<Device> {
    const device = await this.repository.update(id, data, orgId);

    await recordAndPublish("device", device.id, "update", device, userId);

    mqttReliableSync.publishDataChange("device", "update", device).catch((err) => {
      logger.error("DeviceService", "Failed to publish device update to MQTT", err);
    });

    return device;
  }

  async deleteDevice(id: string, orgId: string, userId?: string): Promise<void> {
    const device = await this.repository.findById(id, orgId);

    await this.repository.delete(id, orgId);

    if (device) {
      await recordAndPublish("device", id, "delete", device, userId);

      mqttReliableSync.publishDataChange("device", "delete", device).catch((err) => {
        logger.error("DeviceService", "Failed to publish device delete to MQTT", err);
      });
    }
  }
}
