export interface SensorFormValues {
  equipmentId: string;
  sensorType: string;
  targetUnit: string;
  gain: number | undefined;
  offset: number | undefined;
  enabled: boolean | undefined;
  notes: string;
  critHi: number | null;
  critLo: number | null;
  warnHi: number | null;
  warnLo: number | null;
}

export function createDefaultSensorFormValues(equipmentId: string): SensorFormValues {
  return {
    equipmentId,
    sensorType: "",
    targetUnit: "",
    gain: 1,
    offset: 0,
    enabled: true,
    notes: "",
    critHi: null,
    critLo: null,
    warnHi: null,
    warnLo: null,
  };
}

export function getLoadDistributionDateRange() {
  return {
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
  };
}
