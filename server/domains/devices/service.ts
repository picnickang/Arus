// @ts-nocheck
import type { Device, InsertDevice } from "@shared/schema";
import { deviceRepository } from "./repository";
import { recordAndPublish } from "../../sync-events";
import { mqttReliableSync } from "../../mqtt-reliable-sync";
import { logger } from "../../utils/logger.js";

/**
 * Devices Service
 * Handles business logic, orchestration, and event publishing
 */
export class DeviceService {
  async listDevices(orgId?: string): Promise<Device[]> {
    return deviceRepository.findAll(orgId);
  }

  async getDeviceById(id: string, orgId?: string): Promise<Device | undefined> {
    return deviceRepository.findById(id, orgId);
  }

  async getDevicesWithStatus(orgId?: string) {
    return deviceRepository.getDevicesWithStatus(orgId);
  }

  async createDevice(data: InsertDevice, userId?: string): Promise<Device> {
    // Create device
    const device = await deviceRepository.create(data);

    // Publish events
    await recordAndPublish("device", device.id, "create", device, userId);

    mqttReliableSync.publishDataChange("device", "create", device).catch((err) => {
      logger.error("DeviceService", "Failed to publish device create to MQTT", err);
    });

    return device;
  }

  async updateDevice(
    id: string,
    data: Partial<InsertDevice>,
    orgId: string,
    userId?: string
  ): Promise<Device> {
    // Update device with org validation (Phase 4 security fix)
    const device = await deviceRepository.update(id, data, orgId);

    // Publish events
    await recordAndPublish("device", device.id, "update", device, userId);

    mqttReliableSync.publishDataChange("device", "update", device).catch((err) => {
      logger.error("DeviceService", "Failed to publish device update to MQTT", err);
    });

    return device;
  }

  async deleteDevice(id: string, orgId: string, userId?: string): Promise<void> {
    // Get device data before deletion for event
    const device = await deviceRepository.findById(id, orgId);

    // Delete device with org validation (Phase 4 security fix)
    await deviceRepository.delete(id, orgId);

    // Publish delete event
    if (device) {
      await recordAndPublish("device", id, "delete", device, userId);

      mqttReliableSync.publishDataChange("device", "delete", device).catch((err) => {
        logger.error("DeviceService", "Failed to publish device delete to MQTT", err);
      });
    }
  }
}

// Export singleton instance
export const deviceService = new DeviceService();
