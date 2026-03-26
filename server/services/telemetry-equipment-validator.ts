import { logger } from "../utils/logger";

const LOG_CTX = "TelemetryEquipmentValidator";

class EquipmentIdValidator {
  private validIds = new Map<string, Set<string>>();
  private lastRefresh = new Map<string, number>();
  private refreshIntervalMs = 5 * 60 * 1000;
  private suppressedWarnings = new Set<string>();

  async isValid(equipmentId: string, orgId: string, storage: any): Promise<boolean> {
    await this.ensureFresh(orgId, storage);
    const orgIds = this.validIds.get(orgId);
    return orgIds?.has(equipmentId) ?? false;
  }

  async validate(
    equipmentId: string,
    orgId: string,
    storage: any
  ): Promise<{ valid: boolean; reason?: string }> {
    const valid = await this.isValid(equipmentId, orgId, storage);

    if (!valid) {
      const warningKey = `${orgId}:${equipmentId}`;
      if (!this.suppressedWarnings.has(warningKey)) {
        logger.warn(LOG_CTX, `Unknown equipment ID in telemetry: ${equipmentId} (org: ${orgId})`);
        this.suppressedWarnings.add(warningKey);

        setTimeout(() => this.suppressedWarnings.delete(warningKey), 60 * 60 * 1000);
      }

      return { valid: false, reason: `Equipment ${equipmentId} not found in registry for org ${orgId}` };
    }

    return { valid: true };
  }

  async refresh(orgId: string, storage: any): Promise<number> {
    try {
      const equipment = await storage.getEquipmentRegistry(orgId);
      const ids = new Set(equipment.map((e: any) => e.id));
      this.validIds.set(orgId, ids);
      this.lastRefresh.set(orgId, Date.now());

      return ids.size;
    } catch (error) {
      logger.error(LOG_CTX, `Failed to refresh equipment cache for org ${orgId}`, error);
      return this.validIds.get(orgId)?.size ?? 0;
    }
  }

  private async ensureFresh(orgId: string, storage: any): Promise<void> {
    const lastRefresh = this.lastRefresh.get(orgId) ?? 0;
    if (Date.now() - lastRefresh > this.refreshIntervalMs) {
      await this.refresh(orgId, storage);
    }
  }

  getStats(): { orgs: number; totalEquipment: number; suppressedWarnings: number } {
    let total = 0;
    for (const ids of this.validIds.values()) total += ids.size;
    return {
      orgs: this.validIds.size,
      totalEquipment: total,
      suppressedWarnings: this.suppressedWarnings.size,
    };
  }
}

export const equipmentValidator = new EquipmentIdValidator();
export default EquipmentIdValidator;
