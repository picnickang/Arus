/**
 * Dev Fake Data - Event Seeder
 * 
 * Seeds fake engine and deck log events.
 */

import { engineLogStorage, deckLogStorage } from "../../../repositories.js";
import { log } from "../dev-guards.js";
import { cryptoRandom } from "@shared/crypto-random";

export async function seedFakeEvents(
  orgId: string,
  vesselId: string,
  startTime: Date,
  endTime: Date,
  equipmentId?: string | null
): Promise<number> {
  let eventsCreated = 0;
  const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

  const engineEvents: Array<{ type: string; description: string }> = [
    { type: 'ME_START', description: 'Main engine started for departure' },
    { type: 'MAINTENANCE', description: 'Routine oil level check completed' },
    { type: 'DG_START', description: 'DG1 started for hotel load' },
    { type: 'FUEL_TRANSFER', description: 'Fuel transfer from storage to service tank' },
    { type: 'INSPECTION', description: 'Chief Engineer rounds - all systems normal' },
  ];

  const deckEvents: Array<{ type: string; description: string }> = [
    { type: 'DEPARTURE', description: 'Departed anchorage' },
    { type: 'COURSE_CHANGE', description: 'Altered course for traffic' },
    { type: 'SAFETY_DRILL', description: 'Fire drill conducted' },
    { type: 'WEATHER', description: 'Weather observation recorded' },
    { type: 'ARRIVAL', description: 'Arrived at pilot station' },
  ];

  const numEngineEvents = Math.max(2, Math.floor(durationHours / 4));
  for (let i = 0; i < numEngineEvents; i++) {
    const eventTime = new Date(
      startTime.getTime() + cryptoRandom() * (endTime.getTime() - startTime.getTime())
    );
    const event = engineEvents[i % engineEvents.length];

    try {
      const logDate = eventTime.toISOString().split('T')[0];
      let dailyLog = await engineLogStorage.getEngineLogDailyByDate(vesselId, logDate, orgId);
      if (!dailyLog) {
        dailyLog = await engineLogStorage.createEngineLogDaily({
          orgId,
          vesselId,
          logDate,
          status: 'open',
        });
      }

      await engineLogStorage.createEngineLogEvent({
        orgId,
        vesselId,
        dayId: dailyLog.id,
        eventType: event.type as any,
        timestamp: eventTime,
        summary: event.description,
        details: event.description,
        source: 'simulated',
        createdByName: 'Demo System',
        metadata: { simulated: true },
      });
      eventsCreated++;
    } catch (error) {
      log('warn', 'Failed to create engine event', { error: String(error) });
    }
  }

  const numDeckEvents = Math.max(2, Math.floor(durationHours / 3));
  for (let i = 0; i < numDeckEvents; i++) {
    const eventTime = new Date(
      startTime.getTime() + cryptoRandom() * (endTime.getTime() - startTime.getTime())
    );
    const event = deckEvents[i % deckEvents.length];

    try {
      const logDate = eventTime.toISOString().split('T')[0];
      let dailyLog = await deckLogStorage.getDeckLogDailyByDate(vesselId, logDate, orgId);
      if (!dailyLog) {
        dailyLog = await deckLogStorage.createDeckLogDaily({
          orgId,
          vesselId,
          logDate,
          status: 'open',
        });
      }

      await deckLogStorage.createDeckLogEvent({
        orgId,
        vesselId,
        dayId: dailyLog.id,
        eventType: event.type as any,
        timestamp: eventTime,
        summary: event.description,
        details: event.description,
        source: 'simulated',
        createdByName: 'Demo System',
        metadata: { simulated: true },
      });
      eventsCreated++;
    } catch (error) {
      log('warn', 'Failed to create deck event', { error: String(error) });
    }
  }

  return eventsCreated;
}
