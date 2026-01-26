/**
 * Maintenance Due Report Generator
 * Generates upcoming maintenance tasks report
 */

import { storage } from '../../../storage.js';
import type { IMaintenanceDueGenerator } from '../domain/ports.js';
import type { MaintenanceItem } from '../domain/types.js';
import { logger } from '../../../utils/logger.js';

const LOG_CTX = 'MaintenanceDueGenerator';

export class MaintenanceDueGenerator implements IMaintenanceDueGenerator {
  readonly reportType = 'maintenance_due' as const;

  async generate(orgId: string, vesselIds: string[] | null): Promise<MaintenanceItem[]> {
    logger.info(LOG_CTX, `Generating maintenance due report for org ${orgId}`);

    try {
      const items: MaintenanceItem[] = [];
      const allVessels = await storage.getVessels(orgId);
      const filteredVessels = vesselIds
        ? allVessels.filter((v) => vesselIds.includes(v.id))
        : allVessels;

      const now = new Date();
      const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

      for (const vessel of filteredVessels) {
        const tasks = await storage.getMaintenanceTasks({
          vesselId: vessel.id,
          status: 'pending',
        });

        for (const task of tasks) {
          const dueDate = task.dueDate ? new Date(task.dueDate) : null;

          if (dueDate && dueDate <= sixtyDaysFromNow) {
            const equipment = task.equipmentId
              ? await storage.getEquipment(task.equipmentId)
              : null;

            items.push({
              id: task.id,
              equipmentName: equipment?.name || 'Unknown Equipment',
              vesselName: vessel.name,
              taskName: task.title || task.name || 'Maintenance Task',
              dueDate,
              priority: this.calculatePriority(dueDate, now),
            });
          }
        }
      }

      return items.sort((a, b) => {
        const priorityOrder: Record<string, number> = {
          critical: 0,
          high: 1,
          normal: 2,
          low: 3,
        };
        const priorityDiff = (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
        if (priorityDiff !== 0) return priorityDiff;
        return a.dueDate.getTime() - b.dueDate.getTime();
      });
    } catch (error) {
      logger.error(LOG_CTX, 'Failed to generate maintenance due report', String(error));
      return [];
    }
  }

  private calculatePriority(dueDate: Date, now: Date): string {
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

    if (daysUntilDue <= 0) return 'critical';
    if (daysUntilDue <= 7) return 'high';
    if (daysUntilDue <= 30) return 'normal';
    return 'low';
  }
}
