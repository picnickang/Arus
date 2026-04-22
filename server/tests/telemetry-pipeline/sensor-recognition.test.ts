/**
 * Comprehensive Sensor Recognition Tests
 * 
 * Tests telemetry recognition across all supported sensor types
 * for both J1939 and J1587 protocols.
 */

import { describe, it, expect, beforeAll } from "@jest/globals";
import { BridgeProcessor } from "../../services/sqlite-bridge/bridgeProcessor";
import { decodeFrame } from "../../telemetry/decode";
import { getRegisteredPgns } from "../../telemetry/decode/registry";
import {
  TEST_ORG_ID,
  TEST_EQUIPMENT_ID,
  createJ1939EngineSpeedFrame,
  createJ1939CoolantTempFrame,
  createJ1939OilPressureFrame,
  createJ1939FuelRateFrame,
  createJ1939EngineHoursFrame,
  createJ1939BatteryVoltageFrame,
  createJ1939TransmissionTempFrame,
  createJ1939EngineLoadFrame,
  createJ1939BoostPressureFrame,
  createJ1939ExhaustTempFrame,
  createJ1939IntakeTempFrame,
  createJ1587EngineSpeedFrame,
  createJ1587CoolantTempFrame,
  createJ1587OilPressureFrame,
  createJ1587FuelRateFrame,
  createJ1587EngineHoursFrame,
  createJ1587BatteryVoltageFrame,
  createJ1587TransmissionTempFrame,
  createJ1587BoostPressureFrame,
  createJ1587EngineLoadFrame,
  createJ1587ExhaustTempFrame,
  createJ1587IntakeTempFrame,
} from "./fixtures";

describe("Sensor Recognition - All Sensor Types", () => {
  let processor: BridgeProcessor;

  beforeAll(() => {
    processor = new BridgeProcessor({
      defaultEquipmentId: TEST_EQUIPMENT_ID,
      defaultOrgId: TEST_ORG_ID,
    });
  });

  describe("J1939 Protocol Sensors", () => {
    const j1939TestCases = [
      {
        name: "Engine Speed",
        createFrame: () => createJ1939EngineSpeedFrame(1, 1500),
        expectedSensorType: "ENGINE_SPEED_RPM",
        expectedValue: 1500,
        tolerance: 10,
      },
      {
        name: "Coolant Temperature",
        createFrame: () => createJ1939CoolantTempFrame(2, 85),
        expectedSensorType: "ENGINE_COOLANT_TEMP_C",
        expectedValue: 85,
        expectedUnit: "C",
        tolerance: 1,
      },
      {
        name: "Oil Pressure",
        createFrame: () => createJ1939OilPressureFrame(3, 450),
        expectedSensorType: "ENGINE_OIL_PRESSURE_KPA",
        expectedValue: 450,
        expectedUnit: "kPa",
        tolerance: 5,
      },
      {
        name: "Fuel Rate",
        createFrame: () => createJ1939FuelRateFrame(4, 25.5),
        expectedSensorType: "FUEL_RATE_LPH",
        expectedValue: 25.5,
        expectedUnit: "L/h",
        tolerance: 0.1,
      },
      {
        name: "Engine Hours",
        createFrame: () => createJ1939EngineHoursFrame(5, 12500),
        expectedSensorType: "ENGINE_HOURS",
        expectedValue: 12500,
        expectedUnit: "hours",
        tolerance: 1,
      },
      {
        name: "Battery Voltage",
        createFrame: () => createJ1939BatteryVoltageFrame(6, 24.5),
        expectedSensorType: "BATTERY_VOLTAGE",
        expectedValue: 24.5,
        expectedUnit: "V",
        tolerance: 0.1,
      },
      {
        name: "Transmission Oil Temperature",
        createFrame: () => createJ1939TransmissionTempFrame(7, 80),
        expectedSensorType: "TRANSMISSION_OIL_TEMP_C",
        expectedValue: 80,
        expectedUnit: "C",
        tolerance: 2,
      },
      {
        name: "Engine Load",
        createFrame: () => createJ1939EngineLoadFrame(8, 75),
        expectedSensorType: "ENGINE_LOAD_PERCENT",
        expectedValue: 75,
        expectedUnit: "%",
        tolerance: 2,
      },
      {
        name: "Boost Pressure",
        createFrame: () => createJ1939BoostPressureFrame(9, 150),
        expectedSensorType: "BOOST_PRESSURE_KPA",
        expectedValue: 150,
        expectedUnit: "kPa",
        tolerance: 5,
      },
      {
        name: "Exhaust Temperature",
        createFrame: () => createJ1939ExhaustTempFrame(10, 400),
        expectedSensorType: "EXHAUST_TEMP_C",
        expectedValue: 400,
        expectedUnit: "C",
        tolerance: 5,
      },
      {
        name: "Intake Manifold Temperature",
        createFrame: () => createJ1939IntakeTempFrame(11, 45),
        expectedSensorType: "INTAKE_MANIFOLD_TEMP_C",
        expectedValue: 45,
        expectedUnit: "C",
        tolerance: 1,
      },
    ];

    it.each(j1939TestCases)(
      "should decode $name sensor correctly",
      ({ createFrame, expectedSensorType, expectedValue, expectedUnit, tolerance }) => {
        const frame = createFrame();
        const readings = decodeFrame(frame, { defaultEquipmentId: TEST_EQUIPMENT_ID });

        expect(readings.length).toBe(1);
        expect(readings[0].sensorType).toBe(expectedSensorType);
        expect(readings[0].value).toBeCloseTo(expectedValue, -Math.log10(tolerance));
        if (expectedUnit) {
          expect(readings[0].unit).toBe(expectedUnit);
        }
        expect(readings[0].metadata?.pgn).toBeDefined();
      }
    );

    it("should process all J1939 sensors through BridgeProcessor", () => {
      const frames = j1939TestCases.map((tc, idx) => {
        const frame = tc.createFrame();
        frame.id = 1000 + idx;
        return frame;
      });

      const readings = processor.process(frames);

      expect(readings.length).toBe(j1939TestCases.length);
      
      const sensorTypes = new Set(readings.map(r => r.sensorType));
      expect(sensorTypes.size).toBe(j1939TestCases.length);
      
      readings.forEach(r => {
        expect(r.orgId).toBe(TEST_ORG_ID);
        expect(r.equipmentId).toBe(TEST_EQUIPMENT_ID);
        expect(r.metadata?.idempotencyKey).toBeDefined();
      });
    });
  });

  describe("J1587 Protocol Sensors", () => {
    const j1587TestCases = [
      {
        name: "Engine Speed",
        createFrame: () => createJ1587EngineSpeedFrame(101, 1500),
        expectedSensorType: "ENGINE_SPEED_RPM",
        expectedValue: 1500,
        expectedPid: 190,
        tolerance: 10,
      },
      {
        name: "Coolant Temperature",
        createFrame: () => createJ1587CoolantTempFrame(102, 85),
        expectedSensorType: "ENGINE_COOLANT_TEMP_C",
        expectedValue: 85,
        expectedPid: 110,
        expectedUnit: "C",
        tolerance: 1,
      },
      {
        name: "Oil Pressure",
        createFrame: () => createJ1587OilPressureFrame(103, 400),
        expectedSensorType: "ENGINE_OIL_PRESSURE_KPA",
        expectedValue: 400,
        expectedPid: 100,
        expectedUnit: "kPa",
        tolerance: 5,
      },
      {
        name: "Fuel Rate",
        createFrame: () => createJ1587FuelRateFrame(104, 25.5),
        expectedSensorType: "FUEL_RATE_LPH",
        expectedValue: 25.5,
        expectedPid: 182,
        expectedUnit: "L/h",
        tolerance: 0.1,
      },
      {
        name: "Engine Hours",
        createFrame: () => createJ1587EngineHoursFrame(105, 12500),
        expectedSensorType: "ENGINE_HOURS",
        expectedValue: 12500,
        expectedPid: 247,
        expectedUnit: "hours",
        tolerance: 1,
      },
      {
        name: "Battery Voltage",
        createFrame: () => createJ1587BatteryVoltageFrame(106, 24.5),
        expectedSensorType: "BATTERY_VOLTAGE",
        expectedValue: 24.5,
        expectedPid: 168,
        expectedUnit: "V",
        tolerance: 0.1,
      },
      {
        name: "Transmission Oil Temperature",
        createFrame: () => createJ1587TransmissionTempFrame(107, 80),
        expectedSensorType: "TRANSMISSION_OIL_TEMP_C",
        expectedValue: 80,
        expectedPid: 177,
        expectedUnit: "C",
        tolerance: 1,
      },
      {
        name: "Boost Pressure",
        createFrame: () => createJ1587BoostPressureFrame(108, 150),
        expectedSensorType: "BOOST_PRESSURE_KPA",
        expectedValue: 150,
        expectedPid: 102,
        expectedUnit: "kPa",
        tolerance: 5,
      },
      {
        name: "Engine Load",
        createFrame: () => createJ1587EngineLoadFrame(109, 75),
        expectedSensorType: "ENGINE_LOAD_PERCENT",
        expectedValue: 75,
        expectedPid: 92,
        expectedUnit: "%",
        tolerance: 2,
      },
      {
        name: "Exhaust Temperature",
        createFrame: () => createJ1587ExhaustTempFrame(110, 400),
        expectedSensorType: "EXHAUST_TEMP_C",
        expectedValue: 400,
        expectedPid: 173,
        expectedUnit: "C",
        tolerance: 5,
      },
      {
        name: "Intake Manifold Temperature",
        createFrame: () => createJ1587IntakeTempFrame(111, 45),
        expectedSensorType: "INTAKE_MANIFOLD_TEMP_C",
        expectedValue: 45,
        expectedPid: 105,
        expectedUnit: "C",
        tolerance: 1,
      },
    ];

    it.each(j1587TestCases)(
      "should decode $name sensor correctly",
      ({ createFrame, expectedSensorType, expectedValue, expectedPid, expectedUnit, tolerance }) => {
        const frame = createFrame();
        const readings = decodeFrame(frame, { defaultEquipmentId: TEST_EQUIPMENT_ID });

        expect(readings.length).toBe(1);
        expect(readings[0].sensorType).toBe(expectedSensorType);
        expect(readings[0].value).toBeCloseTo(expectedValue, -Math.log10(tolerance));
        expect(readings[0].metadata?.protocol).toBe("J1587");
        expect(readings[0].metadata?.pid).toBe(expectedPid);
        if (expectedUnit) {
          expect(readings[0].unit).toBe(expectedUnit);
        }
      }
    );

    it("should process all J1587 sensors through BridgeProcessor", () => {
      const frames = j1587TestCases.map((tc, idx) => {
        const frame = tc.createFrame();
        frame.id = 2000 + idx;
        return frame;
      });

      const readings = processor.process(frames);

      expect(readings.length).toBe(j1587TestCases.length);
      
      const sensorTypes = new Set(readings.map(r => r.sensorType));
      expect(sensorTypes.size).toBe(j1587TestCases.length);
      
      readings.forEach(r => {
        expect(r.orgId).toBe(TEST_ORG_ID);
        expect(r.metadata?.protocol).toBe("J1587");
        expect(r.metadata?.idempotencyKey).toBeDefined();
      });
    });
  });

  describe("Cross-Protocol Recognition", () => {
    it("should recognize the same sensor type from both protocols", () => {
      const j1939Frame = createJ1939EngineSpeedFrame(3001, 1800);
      const j1587Frame = createJ1587EngineSpeedFrame(3002, 1800);

      const j1939Readings = decodeFrame(j1939Frame, { defaultEquipmentId: TEST_EQUIPMENT_ID });
      const j1587Readings = decodeFrame(j1587Frame, { defaultEquipmentId: TEST_EQUIPMENT_ID });

      expect(j1939Readings[0].sensorType).toBe("ENGINE_SPEED_RPM");
      expect(j1587Readings[0].sensorType).toBe("ENGINE_SPEED_RPM");
      expect(j1939Readings[0].value).toBeCloseTo(j1587Readings[0].value, -1);
    });

    it("should process mixed protocol batch and identify all sensors", () => {
      const mixedFrames = [
        createJ1939EngineSpeedFrame(4001, 1500),
        createJ1587FuelRateFrame(4002, 30),
        createJ1939BatteryVoltageFrame(4003, 24),
        createJ1587EngineHoursFrame(4004, 5000),
        createJ1939ExhaustTempFrame(4005, 350),
        createJ1587BoostPressureFrame(4006, 120),
      ];

      const readings = processor.process(mixedFrames);

      expect(readings.length).toBe(6);
      
      const j1939Readings = readings.filter(r => r.metadata?.pgn !== undefined);
      const j1587Readings = readings.filter(r => r.metadata?.protocol === "J1587");
      
      expect(j1939Readings.length).toBe(3);
      expect(j1587Readings.length).toBe(3);
    });

    it("should correctly identify all registered PGNs", () => {
      const registeredPgns = getRegisteredPgns();
      
      expect(registeredPgns.length).toBeGreaterThanOrEqual(11);
      
      expect(registeredPgns).toContain(0x00F004);
      expect(registeredPgns).toContain(0x00FEEE);
      expect(registeredPgns).toContain(0x00FEEF);
      expect(registeredPgns).toContain(0x00FEE9);
      expect(registeredPgns).toContain(0x00FEE5);
      expect(registeredPgns).toContain(0x00FEF7);
    });
  });

  describe("Sensor Value Ranges", () => {
    it("should handle minimum values correctly", () => {
      const frames = [
        createJ1939EngineSpeedFrame(5001, 0),
        createJ1939CoolantTempFrame(5002, -40),
        createJ1939BatteryVoltageFrame(5003, 0),
        createJ1939EngineLoadFrame(5004, 0),
      ];

      const readings = processor.process(frames);
      
      expect(readings.length).toBe(4);
      readings.forEach(r => {
        expect(Number.isFinite(r.value)).toBe(true);
      });
    });

    it("should handle maximum values correctly", () => {
      const frames = [
        createJ1939EngineSpeedFrame(5101, 8000),
        createJ1939CoolantTempFrame(5102, 215),
        createJ1939BatteryVoltageFrame(5103, 36),
        createJ1939EngineLoadFrame(5104, 100),
      ];

      const readings = processor.process(frames);
      
      expect(readings.length).toBe(4);
      readings.forEach(r => {
        expect(Number.isFinite(r.value)).toBe(true);
      });
    });

    it("should handle typical operating values", () => {
      const typicalValues = [
        { frame: createJ1939EngineSpeedFrame(5201, 1800), expected: 1800 },
        { frame: createJ1939CoolantTempFrame(5202, 85), expected: 85 },
        { frame: createJ1939OilPressureFrame(5203, 400), expected: 400 },
        { frame: createJ1939FuelRateFrame(5204, 45), expected: 45 },
        { frame: createJ1939BatteryVoltageFrame(5205, 28), expected: 28 },
      ];

      typicalValues.forEach(({ frame, expected }) => {
        const readings = processor.process([frame]);
        expect(readings.length).toBe(1);
        expect(readings[0].value).toBeCloseTo(expected, -1);
      });
    });
  });

  describe("Sensor Recognition Summary", () => {
    it("should provide a summary of all supported sensor types", () => {
      const allJ1939Frames = [
        createJ1939EngineSpeedFrame(6001, 1500),
        createJ1939CoolantTempFrame(6002, 85),
        createJ1939OilPressureFrame(6003, 400),
        createJ1939FuelRateFrame(6004, 25),
        createJ1939EngineHoursFrame(6005, 10000),
        createJ1939BatteryVoltageFrame(6006, 24),
        createJ1939TransmissionTempFrame(6007, 75),
        createJ1939EngineLoadFrame(6008, 60),
        createJ1939BoostPressureFrame(6009, 100),
        createJ1939ExhaustTempFrame(6010, 300),
        createJ1939IntakeTempFrame(6011, 40),
      ];

      const allJ1587Frames = [
        createJ1587EngineSpeedFrame(6101, 1500),
        createJ1587CoolantTempFrame(6102, 85),
        createJ1587OilPressureFrame(6103, 400),
        createJ1587FuelRateFrame(6104, 25),
        createJ1587EngineHoursFrame(6105, 10000),
        createJ1587BatteryVoltageFrame(6106, 24),
        createJ1587TransmissionTempFrame(6107, 75),
        createJ1587BoostPressureFrame(6108, 100),
        createJ1587EngineLoadFrame(6109, 60),
        createJ1587ExhaustTempFrame(6110, 300),
        createJ1587IntakeTempFrame(6111, 40),
      ];

      const j1939Readings = processor.process(allJ1939Frames);
      const j1587Readings = processor.process(allJ1587Frames);

      expect(j1939Readings.length).toBe(11);
      expect(j1587Readings.length).toBe(11);

      const j1939SensorTypes = j1939Readings.map(r => r.sensorType).sort();
      const j1587SensorTypes = j1587Readings.map(r => r.sensorType).sort();

      expect(j1939SensorTypes).toEqual(j1587SensorTypes);
    });
  });
});
