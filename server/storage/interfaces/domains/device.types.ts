/**
 * Device Storage Interface - Devices, Heartbeats, Registry
 * Part of IStorage modularization for improved maintainability
 */

import type {
  Device,
  InsertDevice,
  EdgeHeartbeat,
  InsertEquipmentHeartbeat as InsertHeartbeat,
  Device as DeviceWithStatus,
  DeviceRegistry,
  InsertDeviceRegistry,
  ReplayIncoming,
  InsertReplayIncoming,
  EdgeDiagnosticLog,
  InsertEdgeDiagnosticLog,
  TransportSettings,
  InsertTransportSettings,
  TransportFailover,
  InsertTransportFailover,
  SerialPortState,
  InsertSerialPortState,
  CalibrationCache,
  InsertCalibrationCache,
} from "@shared/schema";
import type { WidenPartial } from "../../../lib/widen-partial";

/**
 * Device storage operations for edge devices, heartbeats, and transport
 */
export interface IDeviceStorage {
  // Devices
  getDevices(orgId?: string): Promise<Device[]>;
  getDevice(id: string, orgId?: string): Promise<Device | undefined>;
  createDevice(device: InsertDevice): Promise<Device>;
  updateDevice(id: string, device: WidenPartial<InsertDevice>, orgId: string): Promise<Device>;
  deleteDevice(id: string, orgId: string): Promise<void>;
  getDevicesWithStatus(orgId?: string): Promise<DeviceWithStatus[]>;

  // Heartbeats
  getHeartbeats(): Promise<EdgeHeartbeat[]>;
  getHeartbeat(deviceId: string): Promise<EdgeHeartbeat | undefined>;
  upsertHeartbeat(heartbeat: InsertHeartbeat): Promise<EdgeHeartbeat>;

  // Device Registry
  getDeviceRegistryEntries(): Promise<DeviceRegistry[]>;
  getDeviceRegistryEntry(id: string): Promise<DeviceRegistry | undefined>;
  createDeviceRegistryEntry(device: InsertDeviceRegistry): Promise<DeviceRegistry>;
  updateDeviceRegistryEntry(
    id: string,
    device: Partial<InsertDeviceRegistry>
  ): Promise<DeviceRegistry>;
  deleteDeviceRegistryEntry(id: string): Promise<void>;

  // Replay
  logReplayRequest(request: InsertReplayIncoming): Promise<ReplayIncoming>;
  getReplayHistory(deviceId?: string, endpoint?: string): Promise<ReplayIncoming[]>;

  // Edge Diagnostics
  createEdgeDiagnosticLog(log: InsertEdgeDiagnosticLog): Promise<EdgeDiagnosticLog>;
  getEdgeDiagnosticLogs(
    deviceId?: string,
    orgId?: string,
    eventType?: string
  ): Promise<EdgeDiagnosticLog[]>;

  // Transport Settings
  getTransportSettings(): Promise<TransportSettings | undefined>;
  createTransportSettings(settings: InsertTransportSettings): Promise<TransportSettings>;
  updateTransportSettings(
    id: string,
    settings: Partial<InsertTransportSettings>
  ): Promise<TransportSettings>;

  // Transport Failover
  createTransportFailover(failover: InsertTransportFailover): Promise<TransportFailover>;
  getActiveTransportFailovers(deviceId: string): Promise<TransportFailover[]>;
  updateTransportFailover(
    id: string,
    updates: Partial<InsertTransportFailover>
  ): Promise<TransportFailover>;

  // Serial Port State
  getSerialPortState(deviceId: string, portPath: string): Promise<SerialPortState | undefined>;
  upsertSerialPortState(state: InsertSerialPortState): Promise<SerialPortState>;

  // Calibration Cache
  createCalibrationCache(cache: InsertCalibrationCache): Promise<CalibrationCache>;
  getCalibrationCache(
    equipmentType: string,
    manufacturer: string,
    model: string,
    sensorType: string
  ): Promise<CalibrationCache | undefined>;
}
