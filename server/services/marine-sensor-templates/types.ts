/**
 * Marine Sensor Template Types
 * 
 * Type definitions for sensor template configurations.
 */

export type SensorTemplate = {
  sensorType: string;
  defaultThresholds: {
    warnLo?: number;
    warnHi?: number;
    critLo?: number;
    critHi?: number;
  };
  targetUnit: string;
  sampleRateHz?: number;
  enabled: boolean;
};

export type EquipmentTemplateMap = Record<string, SensorTemplate[]>;
