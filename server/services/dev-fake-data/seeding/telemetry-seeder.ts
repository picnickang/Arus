/**
 * Dev Fake Data - Telemetry Seeder
 * 
 * Main telemetry and weather seeding logic.
 */

import { storage } from "../../../repositories.js";
import type { InsertEquipmentTelemetry, InsertStormgeoSnapshot } from "@shared/schema";
import type { SeedFakeDataOptions, SeedResult } from "../types.js";
import { assertDevMode, acquireSeedingLock, releaseSeedingLock, log } from "../dev-guards.js";
import { windSpeedToBeaufort, waveHeightToSeaState } from "../scale-conversions.js";
import { getSensorUnit } from "../sensor-units.js";
import {
  NavigationGenerator,
  WeatherGenerator,
  EngineTelemetryGenerator,
  GeneratorTelemetryGenerator,
} from "../generators/index.js";
import { seedFakeEvents } from "./event-seeder.js";

export async function seedFakeTelemetryAndEvents(options: SeedFakeDataOptions): Promise<SeedResult> {
  assertDevMode();

  const {
    orgId,
    vesselId,
    startTime,
    endTime,
    intervalMinutes = 30,
    includeEngineLogTestData = true,
    includeDeckLogTestData = true,
    includeEvents = true,
    vesselType = 'tug',
  } = options;

  if (!acquireSeedingLock(orgId, vesselId)) {
    throw new Error(`Seeding already in progress for vessel ${vesselId}. Please wait for it to complete.`);
  }

  log('info', 'Acquired seeding lock', { orgId, vesselId });

  try {
    log('info', 'Starting fake data seeding', {
      orgId,
      vesselId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      intervalMinutes,
      includeEngine: includeEngineLogTestData,
      includeDeck: includeDeckLogTestData,
    });

    const result: SeedResult = {
      telemetryRecords: 0,
      weatherSnapshots: 0,
      events: 0,
    };

    const vessel = await storage.getVessel(vesselId, orgId);
    if (!vessel) {
      log('warn', 'Vessel not found, will use vessel ID directly', { vesselId });
    }

    const equipment = await storage.getEquipmentByVessel(vesselId, orgId);
    let mainEngineId = equipment.find(e => 
      e.type?.toLowerCase().includes('engine') && 
      !e.type?.toLowerCase().includes('generator')
    )?.id;

    const generators = equipment.filter(e => 
      e.type?.toLowerCase().includes('generator') || 
      e.type?.toLowerCase().includes('dg')
    );

    if (!mainEngineId && includeEngineLogTestData) {
      log('info', 'No main engine found, creating demo equipment');
      const demoEngine = await storage.createEquipment({
        orgId,
        vesselId,
        name: 'Main Engine (Demo)',
        type: 'main_engine',
        status: 'operational',
        manufacturer: 'Demo Manufacturer',
        model: 'Demo Model',
      });
      mainEngineId = demoEngine.id;
      log('info', 'Created demo main engine', { equipmentId: mainEngineId });
    }

    if (generators.length < 2 && includeEngineLogTestData) {
      log('info', 'Creating demo generators for telemetry seeding');
      for (let i = generators.length + 1; i <= 2; i++) {
        const demoGen = await storage.createEquipment({
          orgId,
          vesselId,
          name: `DG${i} (Demo)`,
          type: 'generator',
          status: 'operational',
          manufacturer: 'Demo Manufacturer',
          model: `Demo Generator ${i}`,
        });
        generators.push(demoGen);
        log('info', `Created demo generator DG${i}`, { equipmentId: demoGen.id });
      }
    }

    const navGen = NavigationGenerator.createRoute(vesselType);
    const weatherGen = new WeatherGenerator();
    const engineGen = new EngineTelemetryGenerator(vesselType);
    const genTelemetryGen = new GeneratorTelemetryGenerator();

    const durationMs = endTime.getTime() - startTime.getTime();
    const intervalMs = intervalMinutes * 60 * 1000;
    const totalIntervals = Math.floor(durationMs / intervalMs);

    for (let i = 0; i <= totalIntervals; i++) {
      const timestamp = new Date(startTime.getTime() + i * intervalMs);
      const progress = i / totalIntervals;
      const hour = timestamp.getHours();

      const nav = navGen.generate(progress);

      if (includeEngineLogTestData && mainEngineId) {
        const engineData = engineGen.generate(hour, nav);
        
        for (const [sensorType, value] of Object.entries(engineData)) {
          const telemetry: InsertEquipmentTelemetry = {
            equipmentId: mainEngineId,
            orgId,
            ts: timestamp,
            sensorType,
            value,
            unit: getSensorUnit(sensorType),
            status: 'normal',
            metadata: { simulated: true, source: 'dev-fake-data' },
          };
          await storage.createTelemetryReading(telemetry);
          result.telemetryRecords++;
        }

        for (const gen of generators.slice(0, 2)) {
          const genNum = gen.name?.match(/(\d+)/)?.[1] ? Number.parseInt(gen.name.match(/(\d+)/)![1]) : 1;
          const genData = genTelemetryGen.generate(genNum, hour, engineData.me_load);
          
          for (const [sensorType, value] of Object.entries(genData)) {
            const telemetry: InsertEquipmentTelemetry = {
              equipmentId: gen.id,
              orgId,
              ts: timestamp,
              sensorType,
              value,
              unit: getSensorUnit(sensorType),
              status: 'normal',
              metadata: { simulated: true, source: 'dev-fake-data', generatorNumber: genNum },
            };
            await storage.createTelemetryReading(telemetry);
            result.telemetryRecords++;
          }
        }
      }

      if (includeDeckLogTestData) {
        const weather = weatherGen.generate(hour);
        
        const snapshot: InsertStormgeoSnapshot = {
          orgId,
          vesselId,
          snapshotType: 'weather',
          sourceFile: 'dev-fake-data',
          importMethod: 'api',
          forecastTime: timestamp,
          latitude: nav.lat,
          longitude: nav.lon,
          windSpeed: weather.windSpeed,
          windDirection: weather.windDirection,
          windForceBeaufort: windSpeedToBeaufort(weather.windSpeed),
          waveHeight: weather.waveHeight,
          seaState: waveHeightToSeaState(weather.waveHeight),
          swellHeight: weather.swellHeight,
          swellDirection: weather.swellDirection,
          airTemperature: weather.airTemp,
          seaTemperature: weather.seaTemp,
          barometer: weather.pressure,
          visibility: weather.visibility,
          humidity: Math.round(weather.humidity),
          cloudCover: Math.round(weather.cloudCover),
          skyCondition: weather.skyCondition,
          rawData: { sog: nav.sog, cog: nav.cog, simulated: true },
        };

        await storage.createStormgeoSnapshot(snapshot);
        result.weatherSnapshots++;

        if (mainEngineId) {
          const navTelemetry: InsertEquipmentTelemetry[] = [
            {
              equipmentId: mainEngineId,
              orgId,
              ts: timestamp,
              sensorType: 'gps_lat',
              value: nav.lat,
              unit: 'degrees',
              status: 'normal',
              metadata: { simulated: true },
            },
            {
              equipmentId: mainEngineId,
              orgId,
              ts: timestamp,
              sensorType: 'gps_lon',
              value: nav.lon,
              unit: 'degrees',
              status: 'normal',
              metadata: { simulated: true },
            },
            {
              equipmentId: mainEngineId,
              orgId,
              ts: timestamp,
              sensorType: 'sog',
              value: nav.sog,
              unit: 'knots',
              status: 'normal',
              metadata: { simulated: true },
            },
            {
              equipmentId: mainEngineId,
              orgId,
              ts: timestamp,
              sensorType: 'cog',
              value: nav.cog,
              unit: 'degrees',
              status: 'normal',
              metadata: { simulated: true },
            },
          ];

          for (const telemetry of navTelemetry) {
            await storage.createTelemetryReading(telemetry);
            result.telemetryRecords++;
          }
        }
      }

      if (i % 10 === 0) {
        log('info', `Progress: ${Math.round(progress * 100)}%`, {
          telemetry: result.telemetryRecords,
          weather: result.weatherSnapshots,
        });
      }
    }

    if (includeEvents) {
      result.events = await seedFakeEvents(orgId, vesselId, startTime, endTime, mainEngineId);
    }

    log('info', 'Fake data seeding complete', result);
    return result;
  } finally {
    releaseSeedingLock(orgId, vesselId);
    log('info', 'Released seeding lock', { orgId, vesselId });
  }
}
