// Stub file - equipment analytics consolidated
export async function getEquipmentHealthScore(_equipmentId: string): Promise<number> {
  return 100;
}

export async function getEquipmentAnalytics(_equipmentId: string): Promise<any> {
  return { score: 100, status: 'healthy' };
}

export function trackEquipmentMetric(_equipmentId: string, _metric: string, _value: number): void {}

export const equipmentAnalyticsService = {
  getHealthScore: getEquipmentHealthScore,
  getAnalytics: getEquipmentAnalytics,
  trackMetric: trackEquipmentMetric,
};
