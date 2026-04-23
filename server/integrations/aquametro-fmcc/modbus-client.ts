/**
 * Aquametro FMCC - Modbus TCP Client
 * Stubbed - requires modbus-serial package for full implementation
 */

import type { FMCCConfig, FMCCInstantFlow } from "./types.js";
import { cryptoRandomInt } from "@shared/crypto-random";
import { createLogger } from "../../lib/structured-logger";
const logger = createLogger("Integrations:AquametroFmcc:ModbusClient");

export class FMCCModbusClient {
  private config: FMCCConfig["modbusConfig"];
  private connected: boolean = false;

  constructor(config: FMCCConfig["modbusConfig"]) {
    this.config = config;
  }

  async connect(): Promise<void> {
    logger.info("[FMCC Modbus] Modbus TCP protocol not available - falling back to REST API");
    this.connected = false;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async readRegisters(_startAddress: number, quantity: number): Promise<number[]> {
    if (!this.connected) {
      logger.info("[FMCC Modbus] Not connected - returning empty registers");
      return new Array(quantity).fill(0);
    }
    return new Array(quantity).fill(0).map(() => cryptoRandomInt(65535));
  }

  async getInstantFlow(vesselId: string): Promise<FMCCInstantFlow> {
    logger.info("[FMCC Modbus] getInstantFlow not available via Modbus - use REST API");
    return {
      vesselId,
      timestamp: new Date(),
      foFlowKgPerH: 0,
      doFlowKgPerH: 0,
      foReturnFlowKgPerH: 0,
      doReturnFlowKgPerH: 0,
      foNetFlowKgPerH: 0,
      doNetFlowKgPerH: 0,
      foDensity: 0,
      doDensity: 0,
      foTemperature: 0,
      doTemperature: 0,
      meterStatus: "offline",
    };
  }
}
