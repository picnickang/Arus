import type { FmccPollingConfig, FmccRawPollData, FmccSnapshot } from "./fmcc-types";

export function buildFmccSnapshot(
  config: FmccPollingConfig,
  data: FmccRawPollData
): FmccSnapshot {
  const snapshot: FmccSnapshot = {
    vesselId: config.vesselId,
    orgId: config.orgId,
    timestamp: new Date().toISOString(),
    source: "fmcc",
    fuel: {},
  };

  const fuelData = data.fuel ?? data;
  const hasFuelData =
    fuelData.foFlowKgPerH !== undefined ||
    fuelData.foNetFlowKgPerH !== undefined ||
    fuelData.totalFlowKgPerH !== undefined ||
    fuelData.mainEngineFlowKgPerH !== undefined ||
    fuelData.bunkerFlowKgPerH !== undefined ||
    fuelData.doFlowKgPerH !== undefined ||
    fuelData.boilerFlowKgPerH !== undefined ||
    fuelData.foDensity !== undefined;
  if (hasFuelData) {
    snapshot.fuel = {
      totalFlowKgPerH:
        fuelData.totalFlowKgPerH ?? fuelData.foNetFlowKgPerH ?? fuelData.foFlowKgPerH,
      mainEngineFlowKgPerH: fuelData.mainEngineFlowKgPerH ?? fuelData.foFlowKgPerH,
      generatorFlowKgPerH: fuelData.generatorFlowKgPerH ?? fuelData.doFlowKgPerH,
      portEngineFlowKgPerH: fuelData.portEngineFlowKgPerH,
      stbdEngineFlowKgPerH: fuelData.stbdEngineFlowKgPerH,
      boilerFlowKgPerH: fuelData.boilerFlowKgPerH,
      auxEngine1FlowKgPerH: fuelData.auxEngine1FlowKgPerH,
      auxEngine2FlowKgPerH: fuelData.auxEngine2FlowKgPerH,
      foDensity: fuelData.foDensity,
      doDensity: fuelData.doDensity,
      foTemperature: fuelData.foTemperature,
      doTemperature: fuelData.doTemperature,
      foCumulativeKg: fuelData.foCumulativeKg,
      doCumulativeKg: fuelData.doCumulativeKg,
      doFlowKgPerH: fuelData.doFlowKgPerH,
      bunkerFlowKgPerH: fuelData.bunkerFlowKgPerH,
      bunkerCumulativeKg: fuelData.bunkerCumulativeKg,
    };
  }

  if (data.navigation || data.latitude !== undefined) {
    snapshot.navigation = {
      latDeg: data.navigation?.latDeg ?? data.latitude,
      lonDeg: data.navigation?.lonDeg ?? data.longitude,
      speedOverGround: data.navigation?.speedOverGround ?? data.sog,
      courseOverGround: data.navigation?.courseOverGround ?? data.cog,
      heading: data.navigation?.heading ?? data.heading,
    };
  }

  if (data.engine || data.rpm !== undefined) {
    snapshot.engine = {
      rpm: data.engine?.rpm ?? data.rpm,
      loadPercent: data.engine?.loadPercent ?? data.load,
      runningHours: data.engine?.runningHours,
      powerKw: data.engine?.powerKw,
    };
  }

  if (data.shaft || data.shaftPowerKw !== undefined) {
    snapshot.shaft = {
      powerKw: data.shaft?.powerKw ?? data.shaftPowerKw,
      torqueNm: data.shaft?.torqueNm ?? data.shaftTorqueNm,
      rpmShaft: data.shaft?.rpmShaft ?? data.shaftRpm,
      shaftGeneratorKw: data.shaft?.shaftGeneratorKw ?? data.shaftGeneratorKw,
    };
  }

  if (data.tanks || data.foServiceLevelPct !== undefined) {
    snapshot.tanks = {
      foServiceLevelPct: data.tanks?.foServiceLevelPct ?? data.foServiceLevelPct,
      foSettlingLevelPct: data.tanks?.foSettlingLevelPct ?? data.foSettlingLevelPct,
      doServiceLevelPct: data.tanks?.doServiceLevelPct ?? data.doServiceLevelPct,
      doSettlingLevelPct: data.tanks?.doSettlingLevelPct ?? data.doSettlingLevelPct,
      foServiceVolumeM3: data.tanks?.foServiceVolumeM3 ?? data.foServiceVolumeM3,
      foSettlingVolumeM3: data.tanks?.foSettlingVolumeM3 ?? data.foSettlingVolumeM3,
      doServiceVolumeM3: data.tanks?.doServiceVolumeM3 ?? data.doServiceVolumeM3,
      doSettlingVolumeM3: data.tanks?.doSettlingVolumeM3 ?? data.doSettlingVolumeM3,
    };
  }

  return snapshot;
}
