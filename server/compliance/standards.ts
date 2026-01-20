/**
 * Maritime Compliance Standards - Pre-defined standards for ABS, DNV, etc.
 */

import type { ComplianceStandard } from "./types";

export const MARITIME_STANDARDS: ComplianceStandard[] = [
  {
    code: "ABS-A1-MACHINERY",
    name: "ABS A1 Machinery Condition Monitoring",
    authority: "ABS",
    category: "machinery",
    requirements: [
      {
        id: "VIBR-001",
        description: "Main engine crankcase vibration monitoring",
        mandatory: true,
        frequency: "continuous",
        measurementType: "vibration",
        thresholds: { warning: 2, critical: 4, unit: "mm/s" },
      },
      {
        id: "TEMP-001",
        description: "Engine coolant temperature monitoring",
        mandatory: true,
        frequency: "continuous",
        measurementType: "temperature",
        thresholds: { warning: 85, critical: 95, unit: "°C" },
      },
      {
        id: "PRES-001",
        description: "Lube oil pressure monitoring",
        mandatory: true,
        frequency: "continuous",
        measurementType: "pressure",
        thresholds: { warning: 2.5, critical: 2, unit: "bar" },
      },
    ],
  },
  {
    code: "DNV-GL-OS-E101",
    name: "DNV GL Offshore Standards - Electrical Systems",
    authority: "DNV",
    category: "electrical",
    requirements: [
      {
        id: "VOLT-001",
        description: "Main switchboard voltage stability",
        mandatory: true,
        frequency: "continuous",
        measurementType: "voltage",
        thresholds: { warning: 440, critical: 400, unit: "V" },
      },
      {
        id: "FREQ-001",
        description: "Generator frequency regulation",
        mandatory: true,
        frequency: "continuous",
        measurementType: "frequency",
        thresholds: { warning: 61, critical: 63, unit: "Hz" },
      },
    ],
  },
];
