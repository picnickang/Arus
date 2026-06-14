/**
 * Devices Domain - Ports
 * The concrete adapter (wrapping dbDevicesStorage) lives in infrastructure/.
 */

import type { WidenPartial } from "../../../lib/widen-partial";
import type { Device, InsertDevice, DeviceWithStatusEntity } from "./types";

export interface IDeviceRepository {
  findAll(orgId?: string): Promise<Device[]>;
  findById(id: string, orgId?: string): Promise<Device | undefined>;
  create(device: InsertDevice): Promise<Device>;
  update(id: string, data: WidenPartial<InsertDevice>, orgId: string): Promise<Device>;
  delete(id: string, orgId: string): Promise<void>;
  getDevicesWithStatus(orgId?: string): Promise<DeviceWithStatusEntity[]>;
}
