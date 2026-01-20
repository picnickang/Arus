/**
 * Condition Log Service - Health Calculation Utilities
 */

export function getHealthGrade(healthIndex: number): string {
  if (healthIndex >= 90) { return 'A'; }
  if (healthIndex >= 75) { return 'B'; }
  if (healthIndex >= 60) { return 'C'; }
  if (healthIndex >= 40) { return 'D'; }
  return 'F';
}

export function getConditionRating(healthIndex: number): string {
  if (healthIndex >= 80) { return 'good'; }
  if (healthIndex >= 60) { return 'fair'; }
  if (healthIndex >= 40) { return 'poor'; }
  return 'critical';
}

export function calculateDegradationRate(currentHealth: number, previousHealth: number, daysBetween: number): number {
  if (daysBetween <= 0) { return 0; }
  return (previousHealth - currentHealth) / daysBetween;
}

export function estimateRUL(currentHealth: number, degradationRate: number, failureThreshold: number = 20): number | null {
  if (degradationRate <= 0) { return null; }
  const healthRemaining = currentHealth - failureThreshold;
  if (healthRemaining <= 0) { return 0; }
  return Math.round(healthRemaining / degradationRate);
}
