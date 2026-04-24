import { createLogger } from "./lib/structured-logger";
const logger = createLogger("MqttIngestionService");
/**
 * MQTT Ingestion Service - Deprecated Stub
 *
 * This service has been replaced by the SQLite bridge architecture.
 * All telemetry now flows through: Hardware → C# Agent → SQLite → Node Bridge → PostgreSQL
 *
 * This stub exists only for backward compatibility with code that references MqttIngestionService.
 * No actual MQTT functionality is provided.
 *
 * @deprecated Use server/services/sqlite-bridge for telemetry ingestion
 */

export interface MqttDevice {
  id: string;
  name: string;
  status: string;
}

class MqttIngestionServiceStub {
  async registerMqttDevice(_deviceData: unknown): Promise<MqttDevice> {
    logger.warn("[DEPRECATED] MqttIngestionService.registerMqttDevice - use SQLite bridge instead");
    throw new Error("MQTT ingestion is deprecated - use SQLite bridge architecture");
  }

  async getMqttDevices(): Promise<MqttDevice[]> {
    logger.warn("[DEPRECATED] MqttIngestionService.getMqttDevices - use SQLite bridge instead");
    return [];
  }

  getHealthStatus() {
    return {
      status: "deprecated",
      message: "MQTT ingestion is deprecated - use SQLite bridge architecture",
      timestamp: new Date().toISOString(),
    };
  }
}

export const mqttIngestionService = new MqttIngestionServiceStub();
export const MqttIngestionService = MqttIngestionServiceStub;
