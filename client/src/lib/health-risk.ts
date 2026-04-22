export function healthColor(value: number): string {
  if (value >= 80) {
    return "text-green-600 dark:text-green-400";
  }
  if (value >= 60) {
    return "text-yellow-600 dark:text-yellow-400";
  }
  if (value >= 40) {
    return "text-orange-600 dark:text-orange-400";
  }
  return "text-red-600 dark:text-red-400";
}

export function computeRisk(healthIndex: number): "critical" | "high" | "medium" | "low" {
  if (healthIndex < 30) {
    return "critical";
  }
  if (healthIndex < 50) {
    return "high";
  }
  if (healthIndex < 70) {
    return "medium";
  }
  return "low";
}
