import type { ISchematicLayoutRepository } from "../domain/ports";
import type {
  SchematicLayout,
  CreateZoneCommand,
  UpdateZoneCommand,
  CreateSlotCommand,
  UpdateSlotCommand,
  MoveSlotCommand,
} from "../domain/types";
import { getDefaultLayout } from "../domain/types";

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function notFound(message: string): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = 404;
  return err;
}

export class SchematicLayoutService {
  constructor(private readonly repo: ISchematicLayoutRepository) {}

  async getVesselLayout(vesselId: string, orgId: string): Promise<SchematicLayout> {
    const saved = await this.repo.getLayout(vesselId, orgId);
    if (saved === undefined) {
      throw notFound(`Vessel "${vesselId}" not found`);
    }
    return saved ?? getDefaultLayout();
  }

  async saveVesselLayout(
    vesselId: string,
    orgId: string,
    layout: SchematicLayout
  ): Promise<SchematicLayout> {
    await this.repo.saveLayout(vesselId, orgId, layout);
    return layout;
  }

  async addZone(vesselId: string, orgId: string, cmd: CreateZoneCommand): Promise<SchematicLayout> {
    const layout = await this.getVesselLayout(vesselId, orgId);
    const zoneId = generateId("zone");
    const order = cmd.order ?? layout.zones.length;
    layout.zones.push({ zoneId, label: cmd.label, order, slotIds: [] });
    layout.zones.sort((a, b) => a.order - b.order);
    await this.repo.saveLayout(vesselId, orgId, layout);
    return layout;
  }

  async updateZone(
    vesselId: string,
    orgId: string,
    zoneId: string,
    cmd: UpdateZoneCommand
  ): Promise<SchematicLayout> {
    const layout = await this.getVesselLayout(vesselId, orgId);
    const zone = layout.zones.find((z) => z.zoneId === zoneId);
    if (!zone) {
      throw notFound(`Zone "${zoneId}" not found`);
    }
    if (cmd.label !== undefined) {
      zone.label = cmd.label;
    }
    if (cmd.order !== undefined) {
      zone.order = cmd.order;
    }
    layout.zones.sort((a, b) => a.order - b.order);
    await this.repo.saveLayout(vesselId, orgId, layout);
    return layout;
  }

  async removeZone(vesselId: string, orgId: string, zoneId: string): Promise<SchematicLayout> {
    const layout = await this.getVesselLayout(vesselId, orgId);
    const idx = layout.zones.findIndex((z) => z.zoneId === zoneId);
    if (idx === -1) {
      throw notFound(`Zone "${zoneId}" not found`);
    }
    layout.zones.splice(idx, 1);
    layout.zones.forEach((z, i) => {
      z.order = i;
    });
    await this.repo.saveLayout(vesselId, orgId, layout);
    return layout;
  }

  async addSlot(vesselId: string, orgId: string, cmd: CreateSlotCommand): Promise<SchematicLayout> {
    const layout = await this.getVesselLayout(vesselId, orgId);
    const zone = layout.zones.find((z) => z.zoneId === cmd.zoneId);
    if (!zone) {
      throw notFound(`Zone "${cmd.zoneId}" not found`);
    }
    const slotId = generateId("slot");
    layout.slots.push({
      slotId,
      label: cmd.label,
      category: cmd.category,
      typeMatch: cmd.typeMatch,
    });
    zone.slotIds.push(slotId);
    await this.repo.saveLayout(vesselId, orgId, layout);
    return layout;
  }

  async updateSlot(
    vesselId: string,
    orgId: string,
    slotId: string,
    cmd: UpdateSlotCommand
  ): Promise<SchematicLayout> {
    const layout = await this.getVesselLayout(vesselId, orgId);
    const slot = layout.slots.find((s) => s.slotId === slotId);
    if (!slot) {
      throw notFound(`Slot "${slotId}" not found`);
    }
    if (cmd.label !== undefined) {
      slot.label = cmd.label;
    }
    if (cmd.category !== undefined) {
      slot.category = cmd.category;
    }
    if (cmd.typeMatch !== undefined) {
      slot.typeMatch = cmd.typeMatch;
    }
    await this.repo.saveLayout(vesselId, orgId, layout);
    return layout;
  }

  async removeSlot(
    vesselId: string,
    orgId: string,
    slotId: string,
    options: { force?: boolean; hasEquipment?: boolean } = {}
  ): Promise<SchematicLayout> {
    const layout = await this.getVesselLayout(vesselId, orgId);
    const slotIdx = layout.slots.findIndex((s) => s.slotId === slotId);
    if (slotIdx === -1) {
      throw notFound(`Slot "${slotId}" not found`);
    }
    if (options.hasEquipment && !options.force) {
      const err = new Error(
        `Slot "${slotId}" has equipment assigned. Unassign equipment first or pass force=true.`
      ) as Error & { statusCode: number };
      err.statusCode = 409;
      throw err;
    }
    layout.slots.splice(slotIdx, 1);
    for (const zone of layout.zones) {
      zone.slotIds = zone.slotIds.filter((id) => id !== slotId);
    }
    await this.repo.saveLayout(vesselId, orgId, layout);
    return layout;
  }

  async moveSlot(
    vesselId: string,
    orgId: string,
    slotId: string,
    cmd: MoveSlotCommand
  ): Promise<SchematicLayout> {
    const layout = await this.getVesselLayout(vesselId, orgId);
    const slot = layout.slots.find((s) => s.slotId === slotId);
    if (!slot) {
      throw notFound(`Slot "${slotId}" not found`);
    }
    const targetZone = layout.zones.find((z) => z.zoneId === cmd.targetZoneId);
    if (!targetZone) {
      throw notFound(`Target zone "${cmd.targetZoneId}" not found`);
    }
    for (const zone of layout.zones) {
      zone.slotIds = zone.slotIds.filter((id) => id !== slotId);
    }
    targetZone.slotIds.push(slotId);
    await this.repo.saveLayout(vesselId, orgId, layout);
    return layout;
  }

  async resetToDefault(vesselId: string, orgId: string): Promise<SchematicLayout> {
    const layout = getDefaultLayout();
    await this.repo.saveLayout(vesselId, orgId, layout);
    return layout;
  }
}
