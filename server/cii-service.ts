/**
 * Legacy CII (Carbon Intensity Indicator) service shim.
 */

export interface CIIRating {
  vesselId: string;
  rating: "A" | "B" | "C" | "D" | "E";
  value: number;
  startDate: Date;
  endDate: Date;
}

export interface CIITrendPoint {
  period: string;
  rating: CIIRating["rating"];
  value: number;
}

export class CIIService {
  async calculateCIIFromTelemetry(
    _vesselId: string,
    _orgId: string,
    _startDate: Date,
    _endDate: Date
  ): Promise<CIIRating | null> {
    return null;
  }

  async getCIITrend(_vesselId: string, _orgId: string): Promise<CIITrendPoint[]> {
    return [];
  }
}
