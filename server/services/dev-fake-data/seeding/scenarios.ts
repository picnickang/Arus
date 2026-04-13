/**
 * Dev Fake Data - Scenario Seeders
 * 
 * High-level scenario functions for engine room and deck log testing.
 */

import { vesselService, deckLogStorage } from "../../../repositories.js";
import { autoFillFromTelemetry, autoFillGeneratorsFromTelemetry } from "../../engine-log-autofill-service.js";
import { stormgeoIntegrationService } from "../../stormgeo-integration-service.js";
import type { SeedResult } from "../types.js";
import { assertDevMode, log } from "../dev-guards.js";
import { seedFakeTelemetryAndEvents } from "./telemetry-seeder.js";

export async function seedFakeEngineRoomLogScenario(
  orgId: string = 'default-org-id',
  vesselId?: string,
  hoursBack: number = 12
): Promise<SeedResult> {
  assertDevMode();

  if (!vesselId) {
    const vessels = await vesselService.getVessels(orgId);
    if (vessels.length === 0) {
      throw new Error('No vessels found. Create a vessel first or provide vesselId');
    }
    vesselId = vessels[0].id;
    log('info', 'Using first available vessel', { vesselId, vesselName: vessels[0].name });
  }

  const now = new Date();
  const start = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);

  const seedResult = await seedFakeTelemetryAndEvents({
    orgId,
    vesselId,
    startTime: start,
    endTime: now,
    intervalMinutes: 30,
    includeEngineLogTestData: true,
    includeDeckLogTestData: false,
    includeEvents: true,
  });

  const uniqueDates = new Set<string>();
  for (let t = start.getTime(); t <= now.getTime(); t += 24 * 60 * 60 * 1000) {
    uniqueDates.add(new Date(t).toISOString().split('T')[0]);
  }
  uniqueDates.add(now.toISOString().split('T')[0]);

  let totalHoursProcessed = 0;
  let totalFieldsPopulated = 0;
  let totalAnomalies = 0;

  for (const logDate of uniqueDates) {
    try {
      const summary = await autoFillFromTelemetry(vesselId, orgId, logDate);
      totalHoursProcessed += summary.hoursProcessed;
      totalFieldsPopulated += summary.totalFieldsPopulated;
      totalAnomalies += summary.totalAnomalies;

      await autoFillGeneratorsFromTelemetry(vesselId, orgId, logDate);
    } catch (error) {
      log('warn', 'Auto-fill failed for date', { logDate, error: String(error) });
    }
  }

  seedResult.autoFillEngineResults = {
    hoursProcessed: totalHoursProcessed,
    fieldsPopulated: totalFieldsPopulated,
    anomalies: totalAnomalies,
  };

  log('info', 'Engine Room Log scenario complete', seedResult);
  return seedResult;
}

export async function seedFakeDeckLogScenario(
  orgId: string = 'default-org-id',
  vesselId?: string,
  hoursBack: number = 12
): Promise<SeedResult> {
  assertDevMode();

  if (!vesselId) {
    const vessels = await vesselService.getVessels(orgId);
    if (vessels.length === 0) {
      throw new Error('No vessels found. Create a vessel first or provide vesselId');
    }
    vesselId = vessels[0].id;
    log('info', 'Using first available vessel', { vesselId, vesselName: vessels[0].name });
  }

  const now = new Date();
  const start = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);

  const seedResult = await seedFakeTelemetryAndEvents({
    orgId,
    vesselId,
    startTime: start,
    endTime: now,
    intervalMinutes: 30,
    includeEngineLogTestData: false,
    includeDeckLogTestData: true,
    includeEvents: true,
  });

  const uniqueDates = new Set<string>();
  for (let t = start.getTime(); t <= now.getTime(); t += 24 * 60 * 60 * 1000) {
    uniqueDates.add(new Date(t).toISOString().split('T')[0]);
  }
  uniqueDates.add(now.toISOString().split('T')[0]);

  let hoursProcessed = 0;
  let fieldsPopulated = 0;

  for (const logDate of uniqueDates) {
    try {
      let dailyLog = await deckLogStorage.getDeckLogDailyByDate(vesselId, logDate, orgId);
      if (!dailyLog) {
        dailyLog = await deckLogStorage.createDeckLogDaily({
          orgId,
          vesselId,
          logDate,
          status: 'open',
        });
      }

      for (let hour = 0; hour < 24; hour++) {
        const autoFillResult = await stormgeoIntegrationService.autoFillHourlyEntry(
          vesselId,
          logDate,
          hour,
          orgId
        );

        if (autoFillResult) {
          await deckLogStorage.upsertDeckLogHourly({
            orgId,
            dailyLogId: dailyLog.id,
            hour,
            ...autoFillResult.fields,
          });

          hoursProcessed++;
          fieldsPopulated += Object.keys(autoFillResult.fields).filter(
            k => autoFillResult.fields[k as keyof typeof autoFillResult.fields] !== undefined
          ).length;
        }
      }
    } catch (error) {
      log('warn', 'Deck log auto-fill failed for date', { logDate, error: String(error) });
    }
  }

  seedResult.autoFillDeckResults = {
    hoursProcessed,
    fieldsPopulated,
  };

  log('info', 'Deck Log scenario complete', seedResult);
  return seedResult;
}

export async function seedBothLogScenarios(
  orgId: string = 'default-org-id',
  vesselId?: string,
  hoursBack: number = 24
): Promise<SeedResult> {
  assertDevMode();

  if (!vesselId) {
    const vessels = await vesselService.getVessels(orgId);
    if (vessels.length === 0) {
      throw new Error('No vessels found. Create a vessel first or provide vesselId');
    }
    vesselId = vessels[0].id;
    log('info', 'Using first available vessel', { vesselId, vesselName: vessels[0].name });
  }

  const now = new Date();
  const start = new Date(now.getTime() - hoursBack * 60 * 60 * 1000);

  const seedResult = await seedFakeTelemetryAndEvents({
    orgId,
    vesselId,
    startTime: start,
    endTime: now,
    intervalMinutes: 30,
    includeEngineLogTestData: true,
    includeDeckLogTestData: true,
    includeEvents: true,
  });

  const uniqueDates = new Set<string>();
  for (let t = start.getTime(); t <= now.getTime(); t += 24 * 60 * 60 * 1000) {
    uniqueDates.add(new Date(t).toISOString().split('T')[0]);
  }
  uniqueDates.add(now.toISOString().split('T')[0]);

  let engineHoursProcessed = 0;
  let engineFieldsPopulated = 0;
  let engineAnomalies = 0;
  let deckHoursProcessed = 0;
  let deckFieldsPopulated = 0;

  for (const logDate of uniqueDates) {
    try {
      const engineSummary = await autoFillFromTelemetry(vesselId, orgId, logDate);
      engineHoursProcessed += engineSummary.hoursProcessed;
      engineFieldsPopulated += engineSummary.totalFieldsPopulated;
      engineAnomalies += engineSummary.totalAnomalies;

      await autoFillGeneratorsFromTelemetry(vesselId, orgId, logDate);
    } catch (error) {
      log('warn', 'Engine auto-fill failed', { logDate, error: String(error) });
    }

    try {
      let dailyLog = await deckLogStorage.getDeckLogDailyByDate(vesselId, logDate, orgId);
      if (!dailyLog) {
        dailyLog = await deckLogStorage.createDeckLogDaily({
          orgId,
          vesselId,
          logDate,
          status: 'open',
        });
      }

      for (let hour = 0; hour < 24; hour++) {
        const autoFillResult = await stormgeoIntegrationService.autoFillHourlyEntry(
          vesselId,
          logDate,
          hour,
          orgId
        );

        if (autoFillResult) {
          await deckLogStorage.upsertDeckLogHourly({
            orgId,
            dailyLogId: dailyLog.id,
            hour,
            ...autoFillResult.fields,
          });

          deckHoursProcessed++;
          deckFieldsPopulated += Object.keys(autoFillResult.fields).filter(
            k => autoFillResult.fields[k as keyof typeof autoFillResult.fields] !== undefined
          ).length;
        }
      }
    } catch (error) {
      log('warn', 'Deck auto-fill failed', { logDate, error: String(error) });
    }
  }

  seedResult.autoFillEngineResults = {
    hoursProcessed: engineHoursProcessed,
    fieldsPopulated: engineFieldsPopulated,
    anomalies: engineAnomalies,
  };

  seedResult.autoFillDeckResults = {
    hoursProcessed: deckHoursProcessed,
    fieldsPopulated: deckFieldsPopulated,
  };

  log('info', 'Both log scenarios complete', seedResult);
  return seedResult;
}
