/**
 * Shared Compliance Utilities
 * Common utility functions used by both PDF and Excel report generators
 */

import type { EquipmentHealth } from '@shared/schema-runtime';

/**
 * Format a date to ISO date string (YYYY-MM-DD)
 */
export function formatDate(date: Date | null | undefined): string {
  return date?.toISOString().split('T')[0] ?? '';
}

/**
 * Count equipment by status
 */
export function countByStatus(equipment: EquipmentHealth[]): {
  healthy: number;
  warning: number;
  critical: number;
} {
  return {
    healthy: equipment.filter((e) => e.status === 'healthy').length,
    warning: equipment.filter((e) => e.status === 'warning').length,
    critical: equipment.filter((e) => e.status === 'critical').length,
  };
}
