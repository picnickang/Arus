/**
 * STCW Rest Routes Types
 *
 * Shared types and schemas for STCW hours of rest API.
 */

import { z } from "zod";
import { IStorage } from "../../../storage";
import { RateLimitRequestHandler } from "express-rate-limit";

export interface RestDay {
  date: string;
  h0?: number; h1?: number; h2?: number; h3?: number;
  h4?: number; h5?: number; h6?: number; h7?: number;
  h8?: number; h9?: number; h10?: number; h11?: number;
  h12?: number; h13?: number; h14?: number; h15?: number;
  h16?: number; h17?: number; h18?: number; h19?: number;
  h20?: number; h21?: number; h22?: number; h23?: number;
  [key: string]: string | number | undefined;
}

export const rangeQuerySchema = z.object({
  vesselId: z.string().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  complianceFilter: z.enum(["all", "compliant", "non-compliant"]).optional().default("all"),
});

export interface StcwRestDependencies {
  storage: IStorage;
  writeOperationRateLimit: RateLimitRequestHandler;
  checkMonthCompliance: (rows: RestDay[]) => any;
  normalizeRestDays: (rows: any[]) => RestDay[];
  generatePdfFilename: (crewId: string, year: number, month: string) => string;
  renderRestPdf: (sheet: any, days: RestDay[], options: { outputPath: string; title: string }) => Promise<void>;
  incrementIdempotencyHit: (endpoint: string) => void;
  incrementHorImport: (crewId: string, format: string, rowCount: number) => void;
  incrementHorPdfExport: (crewId: string, month: string, year: number) => void;
  incrementRangeQuery: (queryType: string, id: string) => void;
  recordRangeQueryDuration: (queryType: string, durationMs: number) => void;
}
