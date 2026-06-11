/**
 * Aquametro FMCC - Service Core
 *
 * Core service class with initialization and status methods.
 */

import type { FMCCConfig } from "./types.js";
import { loadFMCCConfig } from "./config.js";
import { FMCCRestClient } from "./rest-client.js";
import { FMCCModbusClient } from "./modbus-client.js";

export class AquametroFMCCServiceCore {
  protected config: FMCCConfig;
  protected restClient: FMCCRestClient | null = null;
  protected modbusClient: FMCCModbusClient | null = null;
  protected useMockData: boolean;

  constructor() {
    this.config = loadFMCCConfig();
    this.useMockData =
      process.env["FMCC_USE_MOCK"] === "true" || process.env["NODE_ENV"] === "test";

    if (this.config.enabled) {
      if (this.config.protocol === "rest" && this.config.restConfig) {
        this.restClient = new FMCCRestClient(this.config.restConfig);
      } else if (this.config.protocol === "modbus" && this.config.modbusConfig) {
        this.modbusClient = new FMCCModbusClient(this.config.modbusConfig);
      }
    }
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  isReady(): boolean {
    if (!this.config.enabled) {
      return false;
    }
    if (this.useMockData) {
      return true;
    }

    if (this.config.protocol === "rest") {
      return !!this.config.restConfig?.baseUrl;
    }
    if (this.config.protocol === "modbus") {
      return !!this.config.modbusConfig?.host;
    }

    return false;
  }

  getConfigInfo(): { enabled: boolean; protocol: string; ready: boolean; mockMode: boolean } {
    return {
      enabled: this.config.enabled,
      protocol: this.config.protocol,
      ready: this.isReady(),
      mockMode: this.useMockData,
    };
  }

  getStatus(): {
    enabled: boolean;
    ready: boolean;
    protocol: string;
    restApiConfigured: boolean;
    modbusConfigured: boolean;
    connectionStatus: string;
    mockMode: boolean;
  } {
    const ready = this.isReady();
    let connectionStatus = "disabled";

    if (this.config.enabled) {
      if (this.useMockData) {
        connectionStatus = "mock";
      } else if (ready) {
        connectionStatus = "connected";
      } else {
        connectionStatus = "not_configured";
      }
    }

    return {
      enabled: this.config.enabled,
      ready,
      protocol: this.config.protocol,
      restApiConfigured: !!this.config.restConfig?.baseUrl,
      modbusConfigured: !!this.config.modbusConfig?.host,
      connectionStatus,
      mockMode: this.useMockData,
    };
  }
}
