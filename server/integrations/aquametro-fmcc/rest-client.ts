/**
 * Aquametro FMCC - REST API Client
 */

import type {
  FMCCConfig,
  FMCCInstantFlow,
  FMCCCumulativeCounters,
  FMCCMeterStatus,
} from "./types.js";

export class FMCCRestClient {
  private config: FMCCConfig["restConfig"];
  private abortController: AbortController | null = null;

  constructor(config: FMCCConfig["restConfig"]) {
    this.config = config;
  }

  private async request<T>(
    endpoint: string,
    method: "GET" | "POST" = "GET",
    body?: any
  ): Promise<T> {
    if (!this.config?.baseUrl) {
      throw new Error("FMCC REST base URL not configured");
    }

    this.abortController = new AbortController();
    const timeoutId = setTimeout(() => this.abortController?.abort(), this.config.timeoutMs);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      if (this.config.apiKey) {
        headers["X-API-Key"] = this.config.apiKey;
      }

      if (this.config.username && this.config.password) {
        const credentials = Buffer.from(`${this.config.username}:${this.config.password}`).toString(
          "base64"
        );
        headers["Authorization"] = `Basic ${credentials}`;
      }

      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: this.abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`FMCC API error: ${response.status} ${response.statusText}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutId);
      this.abortController = null;
    }
  }

  async getInstantFlow(vesselId: string): Promise<FMCCInstantFlow> {
    const data = await this.request<any>(`/api/v1/vessels/${vesselId}/flow/instant`);
    return this.mapInstantFlowResponse(vesselId, data);
  }

  async getCumulativeCounters(
    vesselId: string,
    from: Date,
    to: Date
  ): Promise<FMCCCumulativeCounters> {
    const data = await this.request<any>(
      `/api/v1/vessels/${vesselId}/flow/cumulative?from=${from.toISOString()}&to=${to.toISOString()}`
    );
    return this.mapCumulativeResponse(vesselId, from, to, data);
  }

  async getMeterStatus(vesselId: string): Promise<FMCCMeterStatus> {
    const data = await this.request<any>(`/api/v1/vessels/${vesselId}/status`);
    return this.mapMeterStatusResponse(vesselId, data);
  }

  private mapInstantFlowResponse(vesselId: string, data: any): FMCCInstantFlow {
    return {
      timestamp: new Date(data.timestamp || Date.now()),
      vesselId,
      foFlowKgPerH: data.fo_flow_rate ?? data.foFlowKgPerH ?? 0,
      doFlowKgPerH: data.do_flow_rate ?? data.doFlowKgPerH ?? 0,
      foReturnFlowKgPerH: data.fo_return_flow ?? data.foReturnFlowKgPerH ?? 0,
      doReturnFlowKgPerH: data.do_return_flow ?? data.doReturnFlowKgPerH ?? 0,
      foNetFlowKgPerH: (data.fo_flow_rate ?? 0) - (data.fo_return_flow ?? 0),
      doNetFlowKgPerH: (data.do_flow_rate ?? 0) - (data.do_return_flow ?? 0),
      foDensity: data.fo_density ?? data.foDensity ?? 0,
      doDensity: data.do_density ?? data.doDensity ?? 0,
      foTemperature: data.fo_temperature ?? data.foTemperature ?? 0,
      doTemperature: data.do_temperature ?? data.doTemperature ?? 0,
      meterStatus: this.mapMeterStatus(data.status),
      errorCode: data.error_code,
    };
  }

  private mapCumulativeResponse(
    vesselId: string,
    from: Date,
    to: Date,
    data: any
  ): FMCCCumulativeCounters {
    const foConsumedKg = data.fo_consumed_kg ?? data.foConsumedKg ?? 0;
    const doConsumedKg = data.do_consumed_kg ?? data.doConsumedKg ?? 0;

    return {
      vesselId,
      periodStart: from,
      periodEnd: to,
      foConsumedKg,
      doConsumedKg,
      foConsumedMt: foConsumedKg / 1000,
      doConsumedMt: doConsumedKg / 1000,
      totalFuelKg: foConsumedKg + doConsumedKg,
      totalFuelMt: (foConsumedKg + doConsumedKg) / 1000,
      avgFoDensity: data.avg_fo_density ?? data.avgFoDensity ?? 0,
      avgDoDensity: data.avg_do_density ?? data.avgDoDensity ?? 0,
      avgFoTemperature: data.avg_fo_temperature ?? data.avgFoTemperature ?? 0,
      avgDoTemperature: data.avg_do_temperature ?? data.avgDoTemperature ?? 0,
      dataPoints: data.data_points ?? data.dataPoints ?? 0,
      dataCompleteness: data.data_completeness ?? data.dataCompleteness ?? 0,
    };
  }

  private mapMeterStatusResponse(vesselId: string, data: any): FMCCMeterStatus {
    return {
      vesselId,
      timestamp: new Date(data.timestamp || Date.now()),
      foMeterOnline: data.fo_meter_online ?? data.foMeterOnline ?? false,
      doMeterOnline: data.do_meter_online ?? data.doMeterOnline ?? false,
      foMeterLastReading: data.fo_last_reading ? new Date(data.fo_last_reading) : null,
      doMeterLastReading: data.do_last_reading ? new Date(data.do_last_reading) : null,
      alarms: (data.alarms ?? []).map((a: any) => ({
        code: a.code,
        severity: a.severity || "warning",
        message: a.message,
        timestamp: new Date(a.timestamp),
        acknowledged: a.acknowledged ?? false,
      })),
      firmwareVersion: data.firmware_version || data.firmwareVersion || "unknown",
      calibrationDue: data.calibration_due ? new Date(data.calibration_due) : null,
    };
  }

  private mapMeterStatus(status: string): FMCCInstantFlow["meterStatus"] {
    const statusMap: Record<string, FMCCInstantFlow["meterStatus"]> = {
      online: "online",
      ok: "online",
      running: "online",
      offline: "offline",
      disconnected: "offline",
      maintenance: "maintenance",
      calibration: "maintenance",
    };
    return statusMap[status?.toLowerCase()] ?? "error";
  }
}
