/**
 * Telemetry Pipeline Test Fixtures
 * 
 * Sample J1939/J1587 protocol frames and expected decoded readings
 * for end-to-end integration testing.
 */

import type { RawFrame } from "../../telemetry/decode/types";
import type { TelemetryReading } from "../../telemetry-batch-writer";

export const TEST_ORG_ID = "test-org-integration";
export const TEST_EQUIPMENT_ID = "test-engine-001";
export const TEST_VESSEL_ID = "test-vessel-001";

export function createJ1939EngineSpeedFrame(
  id: number,
  rpm: number,
  timestampMs: number = Date.now(),
  source: string = "CAN0"
): RawFrame {
  const canId = 0x18F00400;
  const payload = Buffer.alloc(13);
  
  payload.writeUInt32LE(canId, 0);
  payload.writeUInt8(8, 4);
  
  const rawRpm = Math.round(rpm / 0.125);
  payload.writeUInt16LE(rawRpm, 8);
  
  return {
    id,
    ts: timestampMs,
    source,
    protocol: "J1939",
    payload,
    qualityFlags: 0,
    payloadFormatVersion: 1,
  };
}

export function createJ1939CoolantTempFrame(
  id: number,
  tempC: number,
  timestampMs: number = Date.now(),
  source: string = "CAN0"
): RawFrame {
  const canId = 0x18FEEE00;
  const payload = Buffer.alloc(9);
  
  payload.writeUInt32LE(canId, 0);
  payload.writeUInt8(8, 4);
  
  const rawTemp = tempC + 40;
  payload.writeUInt8(Math.max(0, Math.min(255, rawTemp)), 5);
  
  return {
    id,
    ts: timestampMs,
    source,
    protocol: "J1939",
    payload,
    qualityFlags: 0,
    payloadFormatVersion: 1,
  };
}

export function createJ1939OilPressureFrame(
  id: number,
  pressureKpa: number,
  timestampMs: number = Date.now(),
  source: string = "CAN0"
): RawFrame {
  const canId = 0x18FEEF00;
  const payload = Buffer.alloc(9);
  
  payload.writeUInt32LE(canId, 0);
  payload.writeUInt8(8, 4);
  
  const rawPressure = Math.round(pressureKpa / 0.5);
  payload.writeUInt16LE(rawPressure, 7);
  
  return {
    id,
    ts: timestampMs,
    source,
    protocol: "J1939",
    payload,
    qualityFlags: 0,
    payloadFormatVersion: 1,
  };
}

export function createJ1587EngineSpeedFrame(
  id: number,
  rpm: number,
  timestampMs: number = Date.now(),
  source: string = "J1708"
): RawFrame {
  const payload = Buffer.alloc(6);
  
  payload.writeUInt8(190, 0);
  
  const rawRpm = Math.round(rpm / 0.25);
  payload.writeUInt16LE(Math.min(rawRpm, 65535), 1);
  
  payload.writeUInt8(0, 3);
  
  return {
    id,
    ts: timestampMs,
    source,
    protocol: "J1587",
    payload,
    qualityFlags: 0,
    payloadFormatVersion: 1,
  };
}

export function createJ1587CoolantTempFrame(
  id: number,
  tempC: number,
  timestampMs: number = Date.now(),
  source: string = "J1708"
): RawFrame {
  const payload = Buffer.alloc(4);
  
  payload.writeUInt8(110, 0);
  
  const rawTemp = tempC + 40;
  payload.writeUInt8(Math.max(0, Math.min(255, rawTemp)), 1);
  
  return {
    id,
    ts: timestampMs,
    source,
    protocol: "J1587",
    payload,
    qualityFlags: 0,
    payloadFormatVersion: 1,
  };
}

export function createJ1587OilPressureFrame(
  id: number,
  pressureKpa: number,
  timestampMs: number = Date.now(),
  source: string = "J1708"
): RawFrame {
  const payload = Buffer.alloc(4);
  
  payload.writeUInt8(100, 0);
  
  const rawPressure = Math.round(pressureKpa / 4);
  payload.writeUInt8(Math.min(rawPressure, 255), 1);
  
  return {
    id,
    ts: timestampMs,
    source,
    protocol: "J1587",
    payload,
    qualityFlags: 0,
    payloadFormatVersion: 1,
  };
}

export function createJ1939FuelRateFrame(
  id: number,
  literPerHour: number,
  timestampMs: number = Date.now(),
  source: string = "CAN0"
): RawFrame {
  const canId = 0x18FEE900;
  const payload = Buffer.alloc(7);
  
  payload.writeUInt32LE(canId, 0);
  payload.writeUInt8(8, 4);
  
  const raw = Math.round(literPerHour / 0.05);
  payload.writeUInt16LE(raw, 5);
  
  return {
    id,
    ts: timestampMs,
    source,
    protocol: "J1939",
    payload,
    qualityFlags: 0,
    payloadFormatVersion: 1,
  };
}

export function createJ1939EngineHoursFrame(
  id: number,
  hours: number,
  timestampMs: number = Date.now(),
  source: string = "CAN0"
): RawFrame {
  const canId = 0x18FEE500;
  const payload = Buffer.alloc(9);
  
  payload.writeUInt32LE(canId, 0);
  payload.writeUInt8(8, 4);
  
  const raw = Math.round(hours / 0.05);
  payload.writeUInt32LE(raw, 5);
  
  return {
    id,
    ts: timestampMs,
    source,
    protocol: "J1939",
    payload,
    qualityFlags: 0,
    payloadFormatVersion: 1,
  };
}

export function createJ1939BatteryVoltageFrame(
  id: number,
  volts: number,
  timestampMs: number = Date.now(),
  source: string = "CAN0"
): RawFrame {
  const canId = 0x18FEF700;
  const payload = Buffer.alloc(7);
  
  payload.writeUInt32LE(canId, 0);
  payload.writeUInt8(8, 4);
  
  const raw = Math.round(volts / 0.05);
  payload.writeUInt16LE(raw, 5);
  
  return {
    id,
    ts: timestampMs,
    source,
    protocol: "J1939",
    payload,
    qualityFlags: 0,
    payloadFormatVersion: 1,
  };
}

export function createJ1939TransmissionTempFrame(
  id: number,
  tempC: number,
  timestampMs: number = Date.now(),
  source: string = "CAN0"
): RawFrame {
  const canId = 0x18FEBD00;
  const payload = Buffer.alloc(7);
  
  payload.writeUInt32LE(canId, 0);
  payload.writeUInt8(8, 4);
  
  const raw = Math.round((tempC + 273) / 0.03125);
  payload.writeUInt16LE(raw, 5);
  
  return {
    id,
    ts: timestampMs,
    source,
    protocol: "J1939",
    payload,
    qualityFlags: 0,
    payloadFormatVersion: 1,
  };
}

export function createJ1939EngineLoadFrame(
  id: number,
  loadPercent: number,
  timestampMs: number = Date.now(),
  source: string = "CAN0"
): RawFrame {
  const canId = 0x18F00300;
  const payload = Buffer.alloc(8);
  
  payload.writeUInt32LE(canId, 0);
  payload.writeUInt8(8, 4);
  
  const raw = Math.round(loadPercent / 0.4);
  payload.writeUInt8(Math.min(raw, 255), 7);
  
  return {
    id,
    ts: timestampMs,
    source,
    protocol: "J1939",
    payload,
    qualityFlags: 0,
    payloadFormatVersion: 1,
  };
}

export function createJ1939BoostPressureFrame(
  id: number,
  kpa: number,
  timestampMs: number = Date.now(),
  source: string = "CAN0"
): RawFrame {
  const canId = 0x18FEE600;
  const payload = Buffer.alloc(13);
  
  payload.writeUInt32LE(canId, 0);
  payload.writeUInt8(8, 4);
  
  const raw = Math.round(kpa / 2);
  payload.writeUInt8(Math.min(raw, 255), 5);
  
  return {
    id,
    ts: timestampMs,
    source,
    protocol: "J1939",
    payload,
    qualityFlags: 0,
    payloadFormatVersion: 1,
  };
}

export function createJ1939ExhaustTempFrame(
  id: number,
  tempC: number,
  timestampMs: number = Date.now(),
  source: string = "CAN0"
): RawFrame {
  const canId = 0x18FED900;
  const payload = Buffer.alloc(13);
  
  payload.writeUInt32LE(canId, 0);
  payload.writeUInt8(8, 4);
  
  const raw = Math.round((tempC + 273) / 0.03125);
  payload.writeUInt16LE(raw, 5);
  
  return {
    id,
    ts: timestampMs,
    source,
    protocol: "J1939",
    payload,
    qualityFlags: 0,
    payloadFormatVersion: 1,
  };
}

export function createJ1939IntakeTempFrame(
  id: number,
  tempC: number,
  timestampMs: number = Date.now(),
  source: string = "CAN0"
): RawFrame {
  const canId = 0x18FEF600;
  const payload = Buffer.alloc(13);
  
  payload.writeUInt32LE(canId, 0);
  payload.writeUInt8(8, 4);
  
  const raw = tempC + 40;
  payload.writeUInt8(Math.max(0, Math.min(255, raw)), 5);
  
  return {
    id,
    ts: timestampMs,
    source,
    protocol: "J1939",
    payload,
    qualityFlags: 0,
    payloadFormatVersion: 1,
  };
}

export function createJ1587FuelRateFrame(
  id: number,
  literPerHour: number,
  timestampMs: number = Date.now(),
  source: string = "J1708"
): RawFrame {
  const payload = Buffer.alloc(4);
  payload.writeUInt8(182, 0);
  const raw = Math.round(literPerHour / 0.05);
  payload.writeUInt16LE(raw, 1);
  
  return {
    id,
    ts: timestampMs,
    source,
    protocol: "J1587",
    payload,
    qualityFlags: 0,
    payloadFormatVersion: 1,
  };
}

export function createJ1587EngineHoursFrame(
  id: number,
  hours: number,
  timestampMs: number = Date.now(),
  source: string = "J1708"
): RawFrame {
  const payload = Buffer.alloc(6);
  payload.writeUInt8(247, 0);
  const raw = Math.round(hours / 0.05);
  payload.writeUInt32LE(raw, 1);
  
  return {
    id,
    ts: timestampMs,
    source,
    protocol: "J1587",
    payload,
    qualityFlags: 0,
    payloadFormatVersion: 1,
  };
}

export function createJ1587BatteryVoltageFrame(
  id: number,
  volts: number,
  timestampMs: number = Date.now(),
  source: string = "J1708"
): RawFrame {
  const payload = Buffer.alloc(4);
  payload.writeUInt8(168, 0);
  const raw = Math.round(volts / 0.05);
  payload.writeUInt16LE(raw, 1);
  
  return {
    id,
    ts: timestampMs,
    source,
    protocol: "J1587",
    payload,
    qualityFlags: 0,
    payloadFormatVersion: 1,
  };
}

export function createJ1587TransmissionTempFrame(
  id: number,
  tempC: number,
  timestampMs: number = Date.now(),
  source: string = "J1708"
): RawFrame {
  const payload = Buffer.alloc(3);
  payload.writeUInt8(177, 0);
  const raw = tempC + 40;
  payload.writeUInt8(Math.max(0, Math.min(255, raw)), 1);
  
  return {
    id,
    ts: timestampMs,
    source,
    protocol: "J1587",
    payload,
    qualityFlags: 0,
    payloadFormatVersion: 1,
  };
}

export function createJ1587BoostPressureFrame(
  id: number,
  kpa: number,
  timestampMs: number = Date.now(),
  source: string = "J1708"
): RawFrame {
  const payload = Buffer.alloc(3);
  payload.writeUInt8(102, 0);
  const raw = Math.round(kpa / 2);
  payload.writeUInt8(Math.min(raw, 255), 1);
  
  return {
    id,
    ts: timestampMs,
    source,
    protocol: "J1587",
    payload,
    qualityFlags: 0,
    payloadFormatVersion: 1,
  };
}

export function createJ1587EngineLoadFrame(
  id: number,
  loadPercent: number,
  timestampMs: number = Date.now(),
  source: string = "J1708"
): RawFrame {
  const payload = Buffer.alloc(3);
  payload.writeUInt8(92, 0);
  const raw = Math.round(loadPercent / 0.5);
  payload.writeUInt8(Math.min(raw, 255), 1);
  
  return {
    id,
    ts: timestampMs,
    source,
    protocol: "J1587",
    payload,
    qualityFlags: 0,
    payloadFormatVersion: 1,
  };
}

export function createJ1587ExhaustTempFrame(
  id: number,
  tempC: number,
  timestampMs: number = Date.now(),
  source: string = "J1708"
): RawFrame {
  const payload = Buffer.alloc(4);
  payload.writeUInt8(173, 0);
  const raw = Math.round((tempC + 273) / 0.03125);
  payload.writeUInt16LE(raw, 1);
  
  return {
    id,
    ts: timestampMs,
    source,
    protocol: "J1587",
    payload,
    qualityFlags: 0,
    payloadFormatVersion: 1,
  };
}

export function createJ1587IntakeTempFrame(
  id: number,
  tempC: number,
  timestampMs: number = Date.now(),
  source: string = "J1708"
): RawFrame {
  const payload = Buffer.alloc(3);
  payload.writeUInt8(105, 0);
  const raw = tempC + 40;
  payload.writeUInt8(Math.max(0, Math.min(255, raw)), 1);
  
  return {
    id,
    ts: timestampMs,
    source,
    protocol: "J1587",
    payload,
    qualityFlags: 0,
    payloadFormatVersion: 1,
  };
}

export function createInvalidFrame(id: number): RawFrame {
  return {
    id,
    ts: Date.now(),
    source: "CAN0",
    protocol: "J1939",
    payload: Buffer.alloc(2),
    qualityFlags: 0,
    payloadFormatVersion: 1,
  };
}

export function createFutureTimestampFrame(id: number): RawFrame {
  return createJ1939EngineSpeedFrame(
    id,
    1500,
    Date.now() + 10 * 60 * 1000
  );
}

export function createAncientTimestampFrame(id: number): RawFrame {
  return createJ1939EngineSpeedFrame(
    id,
    1500,
    new Date("1990-01-01").getTime()
  );
}

export function createInvalidPayloadVersionFrame(id: number): RawFrame {
  const frame = createJ1939EngineSpeedFrame(id, 1500);
  frame.payloadFormatVersion = 99;
  return frame;
}

export function createBatchOfFrames(
  startId: number,
  count: number,
  baseTimestamp: number = Date.now()
): RawFrame[] {
  const frames: RawFrame[] = [];
  const maxRpm = 8000;
  
  for (let i = 0; i < count; i++) {
    const rpm = 1000 + ((i % 700) * 10);
    frames.push(
      createJ1939EngineSpeedFrame(
        startId + i,
        Math.min(rpm, maxRpm),
        baseTimestamp + (i * 100)
      )
    );
  }
  
  return frames;
}

export function createMixedProtocolBatch(
  startId: number,
  baseTimestamp: number = Date.now()
): RawFrame[] {
  return [
    createJ1939EngineSpeedFrame(startId, 1500, baseTimestamp),
    createJ1939CoolantTempFrame(startId + 1, 85, baseTimestamp + 100),
    createJ1939OilPressureFrame(startId + 2, 450, baseTimestamp + 200),
    createJ1939EngineSpeedFrame(startId + 3, 1600, baseTimestamp + 300),
    createJ1939CoolantTempFrame(startId + 4, 87, baseTimestamp + 400),
  ];
}

export function createIntegrityTestBatch(startId: number): {
  frames: RawFrame[];
  expectedReadings: number;
  checksums: Map<number, string>;
} {
  const timestamp = Date.now();
  const frames: RawFrame[] = [];
  const checksums = new Map<number, string>();
  
  for (let i = 0; i < 10; i++) {
    const frame = createJ1939EngineSpeedFrame(startId + i, 1000 + i * 100, timestamp + i * 1000);
    frames.push(frame);
    
    checksums.set(frame.id, computeFrameChecksum(frame));
  }
  
  return {
    frames,
    expectedReadings: 10,
    checksums,
  };
}

export function computeFrameChecksum(frame: RawFrame): string {
  const data = `${frame.id}:${frame.ts}:${frame.protocol}:${frame.payload.toString("hex")}`;
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

export function verifyReadingIntegrity(
  reading: TelemetryReading,
  expectedEquipmentId: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!reading.equipmentId) {
    errors.push("Missing equipmentId");
  } else if (reading.equipmentId !== expectedEquipmentId) {
    errors.push(`Unexpected equipmentId: ${reading.equipmentId}`);
  }
  
  if (!Number.isFinite(reading.value)) {
    errors.push(`Invalid value: ${reading.value}`);
  }
  
  if (!(reading.timestamp instanceof Date) || isNaN(reading.timestamp.getTime())) {
    errors.push(`Invalid timestamp: ${reading.timestamp}`);
  }
  
  if (!reading.sensorType) {
    errors.push("Missing sensorType");
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

export interface DeduplicationTestCase {
  name: string;
  frames: RawFrame[];
  expectedUniqueCount: number;
}

export function createDeduplicationTestCases(startId: number): DeduplicationTestCase[] {
  const timestamp = Date.now();
  
  return [
    {
      name: "No duplicates",
      frames: createBatchOfFrames(startId, 5, timestamp),
      expectedUniqueCount: 5,
    },
    {
      name: "Same ID different timestamps",
      frames: [
        createJ1939EngineSpeedFrame(startId + 100, 1500, timestamp),
        createJ1939EngineSpeedFrame(startId + 100, 1500, timestamp + 1000),
      ],
      expectedUniqueCount: 1,
    },
    {
      name: "Same timestamp different IDs",
      frames: [
        createJ1939EngineSpeedFrame(startId + 200, 1500, timestamp),
        createJ1939EngineSpeedFrame(startId + 201, 1600, timestamp),
      ],
      expectedUniqueCount: 2,
    },
  ];
}

export interface OrderingTestCase {
  name: string;
  frames: RawFrame[];
  expectedOrder: number[];
}

export function createOrderingTestCases(startId: number): OrderingTestCase[] {
  const timestamp = Date.now();
  
  return [
    {
      name: "Already ordered",
      frames: [
        createJ1939EngineSpeedFrame(startId, 1500, timestamp),
        createJ1939EngineSpeedFrame(startId + 1, 1600, timestamp + 100),
        createJ1939EngineSpeedFrame(startId + 2, 1700, timestamp + 200),
      ],
      expectedOrder: [startId, startId + 1, startId + 2],
    },
    {
      name: "Reverse order input",
      frames: [
        createJ1939EngineSpeedFrame(startId + 12, 1700, timestamp + 200),
        createJ1939EngineSpeedFrame(startId + 11, 1600, timestamp + 100),
        createJ1939EngineSpeedFrame(startId + 10, 1500, timestamp),
      ],
      expectedOrder: [startId + 10, startId + 11, startId + 12],
    },
  ];
}
