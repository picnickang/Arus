
export interface AnomalyThreshold {
  min?: number;
  max?: number;
  unit: string;
  severity: 'warning' | 'critical';
}

export const ENGINE_ANOMALY_THRESHOLDS: Record<string, AnomalyThreshold> = {
  meRpm: { min: 0, max: 150, unit: 'RPM', severity: 'warning' },
  meLoad: { min: 0, max: 110, unit: '%', severity: 'warning' },
  meExhaustTempPort: { min: 200, max: 450, unit: '°C', severity: 'critical' },
  meExhaustTempStbd: { min: 200, max: 450, unit: '°C', severity: 'critical' },
  meExhaustTemp: { min: 200, max: 450, unit: '°C', severity: 'critical' },
  meScavAirPress: { min: 0.5, max: 3.5, unit: 'bar', severity: 'warning' },
  meScavAirTemp: { min: 30, max: 60, unit: '°C', severity: 'warning' },
  meTurbochargerRpm: { min: 0, max: 30000, unit: 'RPM', severity: 'warning' },
  meTurbochargerExhaustTemp: { min: 200, max: 500, unit: '°C', severity: 'critical' },
  meTcRpm: { min: 0, max: 30000, unit: 'RPM', severity: 'warning' },
  meCoolantTempIn: { min: 60, max: 95, unit: '°C', severity: 'warning' },
  meCoolantTempOut: { min: 70, max: 100, unit: '°C', severity: 'warning' },
  meLubOilPress: { min: 2, max: 8, unit: 'bar', severity: 'critical' },
  meLubOilTemp: { min: 40, max: 70, unit: '°C', severity: 'warning' },
  meFuelOilPress: { min: 4, max: 12, unit: 'bar', severity: 'warning' },
  meFuelOilTemp: { min: 80, max: 150, unit: '°C', severity: 'warning' },
  meFuelRackPosition: { min: 0, max: 100, unit: '%', severity: 'warning' },
  foPress: { min: 4, max: 12, unit: 'bar', severity: 'warning' },
  foTemp: { min: 80, max: 150, unit: '°C', severity: 'warning' },
  meFuelRack: { min: 0, max: 100, unit: '%', severity: 'warning' },
  seaWaterCoolingTemp: { min: 20, max: 35, unit: '°C', severity: 'warning' },
  freshWaterCoolingTemp: { min: 30, max: 50, unit: '°C', severity: 'warning' },
  engineRoomTemp: { min: 25, max: 55, unit: '°C', severity: 'warning' },
  engineRoomHumidity: { min: 30, max: 80, unit: '%', severity: 'warning' },
};

export interface AnomalyCheckResult {
  isAnomaly: boolean;
  severity?: 'warning' | 'critical';
  message?: string;
}

export function checkAnomaly(field: string, value: number | undefined | null): AnomalyCheckResult {
  if (value === null || value === undefined) { return { isAnomaly: false }; }
  
  const threshold = ENGINE_ANOMALY_THRESHOLDS[field];
  if (!threshold) { return { isAnomaly: false }; }
  
  if (threshold.min !== undefined && value < threshold.min) {
    return { 
      isAnomaly: true, 
      severity: threshold.severity,
      message: `Below min (${threshold.min} ${threshold.unit})`
    };
  }

  if (threshold.max !== undefined && value > threshold.max) {
    return { 
      isAnomaly: true, 
      severity: threshold.severity,
      message: `Above max (${threshold.max} ${threshold.unit})`
    };
  }
  return { isAnomaly: false };
}

export function getAnomalyClass(field: string, value: number | undefined | null): string {
  const check = checkAnomaly(field, value);
  if (!check.isAnomaly) { return ""; }
  return check.severity === 'critical' 
    ? "bg-red-100 dark:bg-red-900/30 border-red-500" 
    : "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-500";
}
