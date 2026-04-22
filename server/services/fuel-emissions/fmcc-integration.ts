/**
 * FMCC Integration - Aquametro flow meter data retrieval
 */

import { getFMCCService, type FMCCCumulativeCounters } from "../../integrations/aquametro-fmcc";

export async function tryGetFMCCData(
  vesselId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<FMCCCumulativeCounters | null> {
  try {
    const fmccService = getFMCCService();

    if (!fmccService.isEnabled() || !fmccService.isReady()) {
      return null;
    }

    const result = await fmccService.getCumulativeFuelCounters(vesselId, periodStart, periodEnd);

    if (result.success && result.data) {
      console.log(`[FuelEmissions] FMCC data retrieved for vessel ${vesselId}:`, {
        source: result.source,
        foConsumedMt: result.data.foConsumedMt,
        doConsumedMt: result.data.doConsumedMt,
        dataPoints: result.data.dataPoints,
      });
      return result.data;
    }

    return null;
  } catch (error) {
    console.warn("[FuelEmissions] FMCC data fetch failed, falling back to telemetry:", error);
    return null;
  }
}
