import type { TelemetryReading } from "../../telemetry-batch-writer";
import type { PgnDecodeInput } from "./types";

export type PgnDecoder = (input: PgnDecodeInput) => TelemetryReading[];

const pgnRegistry = new Map<number, PgnDecoder>();

export function registerPgn(pgn: number, decoder: PgnDecoder): void {
  pgnRegistry.set(pgn, decoder);
}

export function decodePgn(input: PgnDecodeInput): TelemetryReading[] {
  const decoder = pgnRegistry.get(input.pgn);
  if (!decoder) {
    return [];
  }

  try {
    return decoder(input);
  } catch {
    return [];
  }
}

export function hasPgnDecoder(pgn: number): boolean {
  return pgnRegistry.has(pgn);
}

export function getRegisteredPgns(): number[] {
  return Array.from(pgnRegistry.keys());
}

registerPgn(0x00f004, (input) => {
  if (input.data.length < 5) {
    return [];
  }

  const raw = input.data.readUInt16LE(3);
  const rpm = raw * 0.125;

  return [
    {
      equipmentId: input.equipmentId,
      sensorType: "ENGINE_SPEED_RPM",
      value: rpm,
      timestamp: new Date(input.ts),
      metadata: {
        source: input.source,
        pgn: input.pgn,
        sa: input.sa,
      },
    },
  ];
});

registerPgn(0x00feee, (input) => {
  if (input.data.length < 2) {
    return [];
  }

  const raw = input.data.readUInt8(0);
  const tempC = raw - 40;

  return [
    {
      equipmentId: input.equipmentId,
      sensorType: "ENGINE_COOLANT_TEMP_C",
      value: tempC,
      timestamp: new Date(input.ts),
      unit: "C",
      metadata: {
        source: input.source,
        pgn: input.pgn,
        sa: input.sa,
      },
    },
  ];
});

registerPgn(0x00feef, (input) => {
  if (input.data.length < 4) {
    return [];
  }

  const raw = input.data.readUInt16LE(2);
  const kpa = raw * 0.5;

  return [
    {
      equipmentId: input.equipmentId,
      sensorType: "ENGINE_OIL_PRESSURE_KPA",
      value: kpa,
      timestamp: new Date(input.ts),
      unit: "kPa",
      metadata: {
        source: input.source,
        pgn: input.pgn,
        sa: input.sa,
      },
    },
  ];
});

registerPgn(0x00fee9, (input) => {
  if (input.data.length < 2) {
    return [];
  }

  const raw = input.data.readUInt16LE(0);
  const literPerHour = raw * 0.05;

  return [
    {
      equipmentId: input.equipmentId,
      sensorType: "FUEL_RATE_LPH",
      value: literPerHour,
      timestamp: new Date(input.ts),
      unit: "L/h",
      metadata: {
        source: input.source,
        pgn: input.pgn,
        sa: input.sa,
      },
    },
  ];
});

registerPgn(0x00fee5, (input) => {
  if (input.data.length < 4) {
    return [];
  }

  const raw = input.data.readUInt32LE(0);
  const hours = raw * 0.05;

  return [
    {
      equipmentId: input.equipmentId,
      sensorType: "ENGINE_HOURS",
      value: hours,
      timestamp: new Date(input.ts),
      unit: "hours",
      metadata: {
        source: input.source,
        pgn: input.pgn,
        sa: input.sa,
      },
    },
  ];
});

registerPgn(0x00fef7, (input) => {
  if (input.data.length < 2) {
    return [];
  }

  const raw = input.data.readUInt16LE(0);
  const volts = raw * 0.05;

  return [
    {
      equipmentId: input.equipmentId,
      sensorType: "BATTERY_VOLTAGE",
      value: volts,
      timestamp: new Date(input.ts),
      unit: "V",
      metadata: {
        source: input.source,
        pgn: input.pgn,
        sa: input.sa,
      },
    },
  ];
});

registerPgn(0x00febd, (input) => {
  if (input.data.length < 2) {
    return [];
  }

  const raw = input.data.readUInt16LE(0);
  const tempC = raw * 0.03125 - 273;

  return [
    {
      equipmentId: input.equipmentId,
      sensorType: "TRANSMISSION_OIL_TEMP_C",
      value: tempC,
      timestamp: new Date(input.ts),
      unit: "C",
      metadata: {
        source: input.source,
        pgn: input.pgn,
        sa: input.sa,
      },
    },
  ];
});

registerPgn(0x00f003, (input) => {
  if (input.data.length < 3) {
    return [];
  }

  const raw = input.data.readUInt8(2);
  const loadPercent = raw * 0.4;

  return [
    {
      equipmentId: input.equipmentId,
      sensorType: "ENGINE_LOAD_PERCENT",
      value: loadPercent,
      timestamp: new Date(input.ts),
      unit: "%",
      metadata: {
        source: input.source,
        pgn: input.pgn,
        sa: input.sa,
      },
    },
  ];
});

registerPgn(0x00fee6, (input) => {
  if (input.data.length < 1) {
    return [];
  }

  const raw = input.data.readUInt8(0);
  const kpa = raw * 2;

  return [
    {
      equipmentId: input.equipmentId,
      sensorType: "BOOST_PRESSURE_KPA",
      value: kpa,
      timestamp: new Date(input.ts),
      unit: "kPa",
      metadata: {
        source: input.source,
        pgn: input.pgn,
        sa: input.sa,
      },
    },
  ];
});

registerPgn(0x00fed9, (input) => {
  if (input.data.length < 2) {
    return [];
  }

  const raw = input.data.readUInt16LE(0);
  const tempC = raw * 0.03125 - 273;

  return [
    {
      equipmentId: input.equipmentId,
      sensorType: "EXHAUST_TEMP_C",
      value: tempC,
      timestamp: new Date(input.ts),
      unit: "C",
      metadata: {
        source: input.source,
        pgn: input.pgn,
        sa: input.sa,
      },
    },
  ];
});

registerPgn(0x00fef6, (input) => {
  if (input.data.length < 1) {
    return [];
  }

  const raw = input.data.readUInt8(0);
  const tempC = raw - 40;

  return [
    {
      equipmentId: input.equipmentId,
      sensorType: "INTAKE_MANIFOLD_TEMP_C",
      value: tempC,
      timestamp: new Date(input.ts),
      unit: "C",
      metadata: {
        source: input.source,
        pgn: input.pgn,
        sa: input.sa,
      },
    },
  ];
});
