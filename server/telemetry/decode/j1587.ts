import type { TelemetryBatchReading } from "../../telemetry-batch-writer";
import type { RawFrame, DecodeContext } from "./types";

const CURRENT_PAYLOAD_VERSION = 1;

type J1587Decoder = (
  data: Buffer,
  ts: number,
  equipmentId: string,
  source: string
) => TelemetryBatchReading[];

const j1587Registry = new Map<number, J1587Decoder>();

function registerJ1587Pid(pid: number, decoder: J1587Decoder): void {
  j1587Registry.set(pid, decoder);
}

registerJ1587Pid(190, (data, ts, equipmentId, source) => {
  if (data.length < 3) {
    return [];
  }

  const raw = data.readUInt16LE(1);
  const rpm = raw * 0.25;

  return [
    {
      equipmentId,
      sensorType: "ENGINE_SPEED_RPM",
      value: rpm,
      timestamp: new Date(ts),
      metadata: {
        source,
        protocol: "J1587",
        pid: 190,
      },
    },
  ];
});

registerJ1587Pid(110, (data, ts, equipmentId, source) => {
  if (data.length < 2) {
    return [];
  }

  const raw = data.readUInt8(1);
  const tempC = raw - 40;

  return [
    {
      equipmentId,
      sensorType: "ENGINE_COOLANT_TEMP_C",
      value: tempC,
      unit: "C",
      timestamp: new Date(ts),
      metadata: {
        source,
        protocol: "J1587",
        pid: 110,
      },
    },
  ];
});

registerJ1587Pid(100, (data, ts, equipmentId, source) => {
  if (data.length < 2) {
    return [];
  }

  const raw = data.readUInt8(1);
  const kpa = raw * 4;

  return [
    {
      equipmentId,
      sensorType: "ENGINE_OIL_PRESSURE_KPA",
      value: kpa,
      unit: "kPa",
      timestamp: new Date(ts),
      metadata: {
        source,
        protocol: "J1587",
        pid: 100,
      },
    },
  ];
});

registerJ1587Pid(182, (data, ts, equipmentId, source) => {
  if (data.length < 3) {
    return [];
  }

  const raw = data.readUInt16LE(1);
  const literPerHour = raw * 0.05;

  return [
    {
      equipmentId,
      sensorType: "FUEL_RATE_LPH",
      value: literPerHour,
      unit: "L/h",
      timestamp: new Date(ts),
      metadata: {
        source,
        protocol: "J1587",
        pid: 182,
      },
    },
  ];
});

registerJ1587Pid(247, (data, ts, equipmentId, source) => {
  if (data.length < 5) {
    return [];
  }

  const raw = data.readUInt32LE(1);
  const hours = raw * 0.05;

  return [
    {
      equipmentId,
      sensorType: "ENGINE_HOURS",
      value: hours,
      unit: "hours",
      timestamp: new Date(ts),
      metadata: {
        source,
        protocol: "J1587",
        pid: 247,
      },
    },
  ];
});

registerJ1587Pid(168, (data, ts, equipmentId, source) => {
  if (data.length < 3) {
    return [];
  }

  const raw = data.readUInt16LE(1);
  const volts = raw * 0.05;

  return [
    {
      equipmentId,
      sensorType: "BATTERY_VOLTAGE",
      value: volts,
      unit: "V",
      timestamp: new Date(ts),
      metadata: {
        source,
        protocol: "J1587",
        pid: 168,
      },
    },
  ];
});

registerJ1587Pid(177, (data, ts, equipmentId, source) => {
  if (data.length < 2) {
    return [];
  }

  const raw = data.readUInt8(1);
  const tempC = raw - 40;

  return [
    {
      equipmentId,
      sensorType: "TRANSMISSION_OIL_TEMP_C",
      value: tempC,
      unit: "C",
      timestamp: new Date(ts),
      metadata: {
        source,
        protocol: "J1587",
        pid: 177,
      },
    },
  ];
});

registerJ1587Pid(102, (data, ts, equipmentId, source) => {
  if (data.length < 2) {
    return [];
  }

  const raw = data.readUInt8(1);
  const kpa = raw * 2;

  return [
    {
      equipmentId,
      sensorType: "BOOST_PRESSURE_KPA",
      value: kpa,
      unit: "kPa",
      timestamp: new Date(ts),
      metadata: {
        source,
        protocol: "J1587",
        pid: 102,
      },
    },
  ];
});

registerJ1587Pid(92, (data, ts, equipmentId, source) => {
  if (data.length < 2) {
    return [];
  }

  const raw = data.readUInt8(1);
  const loadPercent = raw * 0.5;

  return [
    {
      equipmentId,
      sensorType: "ENGINE_LOAD_PERCENT",
      value: loadPercent,
      unit: "%",
      timestamp: new Date(ts),
      metadata: {
        source,
        protocol: "J1587",
        pid: 92,
      },
    },
  ];
});

registerJ1587Pid(173, (data, ts, equipmentId, source) => {
  if (data.length < 3) {
    return [];
  }

  const raw = data.readUInt16LE(1);
  const tempC = raw * 0.03125 - 273;

  return [
    {
      equipmentId,
      sensorType: "EXHAUST_TEMP_C",
      value: tempC,
      unit: "C",
      timestamp: new Date(ts),
      metadata: {
        source,
        protocol: "J1587",
        pid: 173,
      },
    },
  ];
});

registerJ1587Pid(105, (data, ts, equipmentId, source) => {
  if (data.length < 2) {
    return [];
  }

  const raw = data.readUInt8(1);
  const tempC = raw - 40;

  return [
    {
      equipmentId,
      sensorType: "INTAKE_MANIFOLD_TEMP_C",
      value: tempC,
      unit: "C",
      timestamp: new Date(ts),
      metadata: {
        source,
        protocol: "J1587",
        pid: 105,
      },
    },
  ];
});

export function decodeJ1587(frame: RawFrame, ctx: DecodeContext = {}): TelemetryBatchReading[] {
  if (frame.payloadFormatVersion !== CURRENT_PAYLOAD_VERSION) {
    return [];
  }

  const buf = frame.payload;
  if (buf.length < 2) {
    return [];
  }

  const pid = buf.readUInt8(0);

  const decoder = j1587Registry.get(pid);
  if (!decoder) {
    return [];
  }

  const equipmentId = ctx.resolveEquipmentId?.(frame.source) ?? ctx.defaultEquipmentId ?? "unknown";

  try {
    return decoder(buf, frame.ts, equipmentId, frame.source);
  } catch {
    return [];
  }
}
