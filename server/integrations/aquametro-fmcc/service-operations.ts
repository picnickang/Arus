/**
 * Aquametro FMCC - Service Operations
 * 
 * Data fetching operations for fuel flow, counters, and meter status.
 */

import type {
  FMCCInstantFlow,
  FMCCCumulativeCounters,
  FMCCEngineEfficiency,
  FMCCMeterStatus,
  FMCCRawSample,
  FMCCServiceResult,
} from "./types.js";
import { generateMockInstantFlow, generateMockCumulativeCounters } from "./mock-data.js";
import { AquametroFMCCServiceCore } from "./service-core.js";
import { calculateEngineEfficiency } from "./efficiency-calculator.js";

export class AquametroFMCCService extends AquametroFMCCServiceCore {
  async getInstantFuelFlow(
    vesselId: string,
    _at?: Date
  ): Promise<FMCCServiceResult<FMCCInstantFlow>> {
    const startTime = Date.now();

    if (!this.config.enabled) {
      return {
        success: false,
        error: "FMCC integration is disabled",
        errorCode: "FMCC_DISABLED",
        source: "fmcc",
        responseTimeMs: Date.now() - startTime,
      };
    }

    try {
      if (this.useMockData) {
        return {
          success: true,
          data: generateMockInstantFlow(vesselId),
          source: "mock",
          responseTimeMs: Date.now() - startTime,
        };
      }

      if (this.restClient) {
        const data = await this.restClient.getInstantFlow(vesselId);
        return { success: true, data, source: "fmcc", responseTimeMs: Date.now() - startTime };
      }

      return {
        success: false,
        error: "No FMCC client available",
        errorCode: "FMCC_NO_CLIENT",
        source: "fmcc",
        responseTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error("[FMCC] Error getting instant flow:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        errorCode: "FMCC_ERROR",
        source: "fmcc",
        responseTimeMs: Date.now() - startTime,
      };
    }
  }

  async getCumulativeFuelCounters(
    vesselId: string,
    from: Date,
    to: Date
  ): Promise<FMCCServiceResult<FMCCCumulativeCounters>> {
    const startTime = Date.now();

    if (!this.config.enabled) {
      return {
        success: false,
        error: "FMCC integration is disabled",
        errorCode: "FMCC_DISABLED",
        source: "fmcc",
        responseTimeMs: Date.now() - startTime,
      };
    }

    try {
      if (this.useMockData) {
        return {
          success: true,
          data: generateMockCumulativeCounters(vesselId, from, to),
          source: "mock",
          responseTimeMs: Date.now() - startTime,
        };
      }

      if (this.restClient) {
        const data = await this.restClient.getCumulativeCounters(vesselId, from, to);
        return { success: true, data, source: "fmcc", responseTimeMs: Date.now() - startTime };
      }

      return {
        success: false,
        error: "No FMCC client available",
        errorCode: "FMCC_NO_CLIENT",
        source: "fmcc",
        responseTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error("[FMCC] Error getting cumulative counters:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        errorCode: "FMCC_ERROR",
        source: "fmcc",
        responseTimeMs: Date.now() - startTime,
      };
    }
  }

  async getEngineFuelEfficiency(
    vesselId: string,
    from: Date,
    to: Date,
    enginePowerKw?: number
  ): Promise<FMCCServiceResult<FMCCEngineEfficiency>> {
    const startTime = Date.now();

    if (!this.config.enabled) {
      return {
        success: false,
        error: "FMCC integration is disabled",
        errorCode: "FMCC_DISABLED",
        source: "fmcc",
        responseTimeMs: Date.now() - startTime,
      };
    }

    try {
      const countersResult = await this.getCumulativeFuelCounters(vesselId, from, to);

      if (!countersResult.success || !countersResult.data) {
        return {
          success: false,
          error: countersResult.error || "Failed to get fuel counters",
          source: countersResult.source,
          responseTimeMs: Date.now() - startTime,
        };
      }

      const result = calculateEngineEfficiency(
        countersResult.data,
        countersResult.source,
        vesselId,
        from,
        to,
        enginePowerKw
      );
      result.responseTimeMs = Date.now() - startTime;
      return result;
    } catch (error) {
      console.error("[FMCC] Error calculating efficiency:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        errorCode: "FMCC_ERROR",
        source: "fmcc",
        responseTimeMs: Date.now() - startTime,
      };
    }
  }

  async getMeterStatus(vesselId: string): Promise<FMCCServiceResult<FMCCMeterStatus>> {
    const startTime = Date.now();

    if (!this.config.enabled) {
      return {
        success: false,
        error: "FMCC integration is disabled",
        errorCode: "FMCC_DISABLED",
        source: "fmcc",
        responseTimeMs: Date.now() - startTime,
      };
    }

    try {
      if (this.useMockData) {
        const mockStatus: FMCCMeterStatus = {
          vesselId,
          timestamp: new Date(),
          foMeterOnline: true,
          doMeterOnline: true,
          foMeterLastReading: new Date(),
          doMeterLastReading: new Date(),
          alarms: [],
          firmwareVersion: "2.5.1",
          calibrationDue: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        };
        return { success: true, data: mockStatus, source: "mock", responseTimeMs: Date.now() - startTime };
      }

      if (this.restClient) {
        const data = await this.restClient.getMeterStatus(vesselId);
        return { success: true, data, source: "fmcc", responseTimeMs: Date.now() - startTime };
      }

      return {
        success: false,
        error: "No FMCC client available",
        errorCode: "FMCC_NO_CLIENT",
        source: "fmcc",
        responseTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error("[FMCC] Error getting meter status:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        errorCode: "FMCC_ERROR",
        source: "fmcc",
        responseTimeMs: Date.now() - startTime,
      };
    }
  }

  async getRawStreamSample(vesselId: string): Promise<FMCCServiceResult<FMCCRawSample>> {
    const startTime = Date.now();

    if (!this.config.enabled) {
      return {
        success: false,
        error: "FMCC integration is disabled",
        errorCode: "FMCC_DISABLED",
        source: "fmcc",
        responseTimeMs: Date.now() - startTime,
      };
    }

    try {
      const flowResult = await this.getInstantFuelFlow(vesselId);

      if (!flowResult.success) {
        return { success: false, error: flowResult.error, source: flowResult.source, responseTimeMs: Date.now() - startTime };
      }

      const sample: FMCCRawSample = {
        timestamp: new Date(),
        registers: {
          fo_flow_rate: flowResult.data?.foFlowKgPerH ?? 0,
          do_flow_rate: flowResult.data?.doFlowKgPerH ?? 0,
          fo_return_flow: flowResult.data?.foReturnFlowKgPerH ?? 0,
          do_return_flow: flowResult.data?.doReturnFlowKgPerH ?? 0,
          fo_density: flowResult.data?.foDensity ?? 0,
          do_density: flowResult.data?.doDensity ?? 0,
          fo_temperature: flowResult.data?.foTemperature ?? 0,
          do_temperature: flowResult.data?.doTemperature ?? 0,
        },
        rawJson: flowResult.data,
      };

      return { success: true, data: sample, source: flowResult.source, responseTimeMs: Date.now() - startTime };
    } catch (error) {
      console.error("[FMCC] Error getting raw sample:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        errorCode: "FMCC_ERROR",
        source: "fmcc",
        responseTimeMs: Date.now() - startTime,
      };
    }
  }
}

let fmccServiceInstance: AquametroFMCCService | null = null;

export function getFMCCService(): AquametroFMCCService {
  if (!fmccServiceInstance) {
    fmccServiceInstance = new AquametroFMCCService();
  }
  return fmccServiceInstance;
}
