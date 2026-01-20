/**
 * Dev Fake Data - Types
 * 
 * Type definitions for fake data seeding.
 */

export interface SeedFakeDataOptions {
  orgId: string;
  vesselId: string;
  startTime: Date;
  endTime: Date;
  intervalMinutes?: number;
  includeEngineLogTestData?: boolean;
  includeDeckLogTestData?: boolean;
  includeEvents?: boolean;
  vesselType?: 'tug' | 'psv' | 'tanker' | 'cargo' | 'ferry';
}

export interface SeedResult {
  telemetryRecords: number;
  weatherSnapshots: number;
  events: number;
  autoFillEngineResults?: {
    hoursProcessed: number;
    fieldsPopulated: number;
    anomalies: number;
  };
  autoFillDeckResults?: {
    hoursProcessed: number;
    fieldsPopulated: number;
  };
}
