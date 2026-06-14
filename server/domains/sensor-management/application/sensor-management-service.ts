/**
 * Sensor Management Application Service
 *
 * Sensor configuration, status, J1939, threshold-optimization, and telemetry-
 * history use-cases over the ISensorRepository port plus cross-domain ports
 * (equipment, ML optimization, telemetry history) — all constructor-injected.
 * The sensor-status rollup, bulk-create validation, and apply-tuning
 * update-or-create logic live here rather than in the routes.
 */

import type {
  ISensorRepository,
  ISensorEquipmentPort,
  ISensorThresholdOptimizationPort,
  ISensorTelemetryHistoryPort,
} from "../domain/ports";
import type {
  ThresholdOptimization,
  EquipmentTelemetry,
  SensorStatusEntry,
  SensorStatusValue,
} from "../domain/types";

/** Thrown when bulk-create references an equipment that does not exist. */
export class EquipmentNotFoundError extends Error {
  constructor() {
    super("Equipment not found");
    this.name = "EquipmentNotFoundError";
  }
}

type SensorConfigInput = Record<string, unknown>;

const DEFAULT_THRESHOLD_MS = 5 * 60 * 1000;

export class SensorManagementService {
  constructor(
    private readonly sensors: ISensorRepository,
    private readonly equipment: ISensorEquipmentPort,
    private readonly optimization: ISensorThresholdOptimizationPort,
    private readonly telemetryHistory: ISensorTelemetryHistoryPort
  ) {}

  // ===== Sensor configurations =====

  listSensorConfigurations(orgId: string, equipmentId?: string, sensorType?: string) {
    return this.sensors.getSensorConfigurations(orgId, equipmentId, sensorType);
  }

  getSensorConfiguration(equipmentId: string, sensorType: string, orgId: string) {
    return this.sensors.getSensorConfiguration(equipmentId, sensorType, orgId);
  }

  createSensorConfiguration(orgId: string, configData: SensorConfigInput) {
    return this.sensors.createSensorConfiguration({
      ...configData,
      orgId,
    } as object as Parameters<ISensorRepository["createSensorConfiguration"]>[0]);
  }

  async bulkCreateSensorConfigurations(
    orgId: string,
    equipmentId: string,
    configs: SensorConfigInput[],
    overwriteExisting?: boolean
  ) {
    const equipment = await this.equipment.getEquipment(orgId, equipmentId);
    if (!equipment) {
      throw new EquipmentNotFoundError();
    }
    const fullConfigs = configs.map((config) => ({ ...config, equipmentId, orgId }));
    return this.sensors.bulkCreateSensorConfigurations(
      fullConfigs as object as Parameters<ISensorRepository["bulkCreateSensorConfigurations"]>[0],
      overwriteExisting
    );
  }

  updateSensorConfiguration(
    equipmentId: string,
    sensorType: string,
    configData: SensorConfigInput,
    orgId: string
  ) {
    return this.sensors.updateSensorConfiguration(equipmentId, sensorType, configData, orgId);
  }

  updateSensorConfigurationById(id: string, configData: SensorConfigInput, orgId: string) {
    return this.sensors.updateSensorConfigurationById(id, configData, orgId);
  }

  deleteSensorConfiguration(equipmentId: string, sensorType: string, orgId: string) {
    return this.sensors.deleteSensorConfiguration(equipmentId, sensorType, orgId);
  }

  deleteSensorConfigurationById(id: string, orgId: string) {
    return this.sensors.deleteSensorConfigurationById(id, orgId);
  }

  // ===== Sensor status & state =====

  async getSensorStatus(orgId: string, equipmentId?: string): Promise<SensorStatusEntry[]> {
    const sensorConfigs = await this.sensors.getSensorConfigurations(orgId, equipmentId);
    const now = new Date();
    const sensors = sensorConfigs.map((config) => ({
      equipmentId: config.equipmentId,
      sensorType: config.sensorType,
    }));

    // `getLatestTelemetryForSensors` is an optional storage capability; probe it
    // defensively (it is not part of the core ISensorRepository surface).
    const telemetrySource = this.sensors as object as {
      getLatestTelemetryForSensors?: (
        s: Array<{ equipmentId: string; sensorType: string }>,
        orgId: string
      ) => Promise<
        Array<{ equipmentId: string; sensorType: string; ts?: string | Date; value?: number }>
      >;
    };
    const telemetryResults = telemetrySource.getLatestTelemetryForSensors
      ? await telemetrySource.getLatestTelemetryForSensors(sensors, orgId)
      : [];
    const telemetryMap = new Map<string, { ts?: string | Date; value?: number }>(
      telemetryResults.map((result) => [`${result.equipmentId}:${result.sensorType}`, result])
    );

    return sensorConfigs.map((config) => {
      const key = `${config.equipmentId}:${config.sensorType}`;
      const telemetry = telemetryMap.get(key);
      let status: SensorStatusValue;
      if (!config.enabled) {
        status = "disabled";
      } else if (!telemetry || !telemetry.ts) {
        status = "inactive";
      } else {
        const thresholdMs = config.expectedIntervalMs
          ? config.expectedIntervalMs * (config.graceMultiplier || 2)
          : DEFAULT_THRESHOLD_MS;
        const elapsedMs = now.getTime() - new Date(telemetry.ts).getTime();
        status = elapsedMs < thresholdMs ? "online" : "offline";
      }
      return {
        id: config.id,
        equipmentId: config.equipmentId,
        sensorType: config.sensorType,
        status,
        lastTelemetry: telemetry?.ts || null,
        lastValue: telemetry?.value || null,
        enabled: config.enabled,
        expectedIntervalMs: config.expectedIntervalMs || null,
        graceMultiplier: config.graceMultiplier || null,
      };
    });
  }

  getSensorState(equipmentId: string, sensorType: string, orgId: string) {
    return this.sensors.getSensorState(equipmentId, sensorType, orgId);
  }

  upsertSensorState(state: Parameters<ISensorRepository["upsertSensorState"]>[0]) {
    return this.sensors.upsertSensorState(state);
  }

  // ===== Threshold optimizations =====

  listThresholdOptimizations(
    orgId: string,
    equipmentId?: string,
    sensorType?: string
  ): Promise<ThresholdOptimization[]> {
    return this.optimization.getThresholdOptimizations(orgId, equipmentId, sensorType);
  }

  getThresholdOptimization(
    id: number,
    orgId: string
  ): Promise<ThresholdOptimization | undefined> {
    return this.optimization.getThresholdOptimization(id, orgId);
  }

  applyThresholdOptimization(id: number, orgId: string): Promise<ThresholdOptimization> {
    return this.optimization.applyThresholdOptimization(id, orgId);
  }

  rejectThresholdOptimization(
    id: number,
    reason: string,
    orgId: string
  ): Promise<ThresholdOptimization> {
    return this.optimization.rejectThresholdOptimization(id, reason, orgId);
  }

  /** Apply tuning parameters to a sensor config, creating it if absent. */
  async applySensorTuning(
    equipmentId: string,
    sensorType: string,
    parameters: SensorConfigInput,
    orgId: string
  ) {
    try {
      return await this.sensors.updateSensorConfiguration(
        equipmentId,
        sensorType,
        parameters,
        orgId
      );
    } catch (updateError) {
      if (updateError instanceof Error && updateError.message?.includes("not found")) {
        return this.sensors.createSensorConfiguration({
          equipmentId,
          sensorType,
          orgId,
          enabled: true,
          ...parameters,
        });
      }
      throw updateError;
    }
  }

  // ===== J1939 =====

  listJ1939Configurations(orgId: string, deviceId?: string) {
    return this.sensors.getJ1939Configurations(orgId, deviceId);
  }

  getJ1939Configuration(id: string, orgId: string) {
    return this.sensors.getJ1939Configuration(id, orgId);
  }

  createJ1939Configuration(config: Parameters<ISensorRepository["createJ1939Configuration"]>[0]) {
    return this.sensors.createJ1939Configuration(config);
  }

  updateJ1939Configuration(id: string, configData: SensorConfigInput, orgId: string) {
    return this.sensors.updateJ1939Configuration(id, configData, orgId);
  }

  deleteJ1939Configuration(id: string, orgId: string) {
    return this.sensors.deleteJ1939Configuration(id, orgId);
  }

  // ===== Telemetry history =====

  getTelemetryHistory(
    equipmentId: string,
    sensorType: string,
    hours: number
  ): Promise<EquipmentTelemetry[]> {
    // Preserves the historical quirk where `hours` is passed as the storage's
    // limit argument.
    return this.telemetryHistory.getTelemetryHistory(equipmentId, sensorType, hours);
  }
}
