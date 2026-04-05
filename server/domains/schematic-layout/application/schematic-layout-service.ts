import type { ISchematicLayoutRepository } from '../domain/ports';
import type {
  SchematicLayout,
  SchematicZone,
  SchematicSlot,
  CreateZoneCommand,
  UpdateZoneCommand,
  CreateSlotCommand,
  UpdateSlotCommand,
  MoveSlotCommand,
} from '../domain/types';

const DEFAULT_SLOTS: SchematicSlot[] = [
  { slotId: "me", label: "Main Engine", category: "propulsion", typeMatch: ["engine", "main engine", "propulsion"] },
  { slotId: "gen1", label: "Generator #1", category: "power", typeMatch: ["generator"] },
  { slotId: "gen2", label: "Generator #2", category: "power", typeMatch: ["generator"] },
  { slotId: "pump1", label: "Cargo Pump", category: "cargo", typeMatch: ["pump"] },
  { slotId: "bow", label: "Bow Thruster", category: "thrusters", typeMatch: ["thruster", "bow thruster"] },
  { slotId: "crane", label: "Deck Crane", category: "deck", typeMatch: ["crane", "deck crane"] },
  { slotId: "dp", label: "DP System", category: "navigation", typeMatch: ["navigation", "dp", "dynamic positioning"] },
  { slotId: "fuel", label: "Fuel System", category: "fuel", typeMatch: ["tank", "fuel", "boiler"] },
  { slotId: "comp", label: "Compressor", category: "aux", typeMatch: ["compressor", "air compressor"] },
  { slotId: "elec", label: "Switchboard", category: "electrical", typeMatch: ["electrical", "switchboard", "transformer"] },
];

const DEFAULT_ZONES: SchematicZone[] = [
  { zoneId: "bow-thruster", label: "Bow / Thruster", order: 0, slotIds: ["bow"] },
  { zoneId: "bridge-nav", label: "Bridge / Navigation", order: 1, slotIds: ["dp", "comp"] },
  { zoneId: "main-deck", label: "Main Deck", order: 2, slotIds: ["crane"] },
  { zoneId: "engine-room", label: "Engine Room", order: 3, slotIds: ["me", "gen1", "gen2"] },
  { zoneId: "tank-cargo", label: "Tank / Cargo", order: 4, slotIds: ["fuel", "pump1", "elec"] },
];

export function getDefaultLayout(): SchematicLayout {
  return {
    zones: DEFAULT_ZONES.map(z => ({ ...z, slotIds: [...z.slotIds] })),
    slots: DEFAULT_SLOTS.map(s => ({ ...s, typeMatch: [...s.typeMatch] })),
  };
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export class SchematicLayoutService {
  constructor(private readonly repo: ISchematicLayoutRepository) {}

  async getVesselLayout(vesselId: string, orgId: string): Promise<SchematicLayout> {
    const saved = await this.repo.getLayout(vesselId, orgId);
    return saved ?? getDefaultLayout();
  }

  async saveVesselLayout(vesselId: string, orgId: string, layout: SchematicLayout): Promise<SchematicLayout> {
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

  async updateZone(vesselId: string, orgId: string, zoneId: string, cmd: UpdateZoneCommand): Promise<SchematicLayout> {
    const layout = await this.getVesselLayout(vesselId, orgId);
    const zone = layout.zones.find(z => z.zoneId === zoneId);
    if (!zone) throw new Error(`Zone "${zoneId}" not found`);
    if (cmd.label !== undefined) zone.label = cmd.label;
    if (cmd.order !== undefined) zone.order = cmd.order;
    layout.zones.sort((a, b) => a.order - b.order);
    await this.repo.saveLayout(vesselId, orgId, layout);
    return layout;
  }

  async removeZone(vesselId: string, orgId: string, zoneId: string): Promise<SchematicLayout> {
    const layout = await this.getVesselLayout(vesselId, orgId);
    const idx = layout.zones.findIndex(z => z.zoneId === zoneId);
    if (idx === -1) throw new Error(`Zone "${zoneId}" not found`);
    layout.zones.splice(idx, 1);
    layout.zones.forEach((z, i) => { z.order = i; });
    await this.repo.saveLayout(vesselId, orgId, layout);
    return layout;
  }

  async addSlot(vesselId: string, orgId: string, cmd: CreateSlotCommand): Promise<SchematicLayout> {
    const layout = await this.getVesselLayout(vesselId, orgId);
    const zone = layout.zones.find(z => z.zoneId === cmd.zoneId);
    if (!zone) throw new Error(`Zone "${cmd.zoneId}" not found`);
    const slotId = generateId("slot");
    layout.slots.push({ slotId, label: cmd.label, category: cmd.category, typeMatch: cmd.typeMatch });
    zone.slotIds.push(slotId);
    await this.repo.saveLayout(vesselId, orgId, layout);
    return layout;
  }

  async updateSlot(vesselId: string, orgId: string, slotId: string, cmd: UpdateSlotCommand): Promise<SchematicLayout> {
    const layout = await this.getVesselLayout(vesselId, orgId);
    const slot = layout.slots.find(s => s.slotId === slotId);
    if (!slot) throw new Error(`Slot "${slotId}" not found`);
    if (cmd.label !== undefined) slot.label = cmd.label;
    if (cmd.category !== undefined) slot.category = cmd.category;
    if (cmd.typeMatch !== undefined) slot.typeMatch = cmd.typeMatch;
    await this.repo.saveLayout(vesselId, orgId, layout);
    return layout;
  }

  async removeSlot(vesselId: string, orgId: string, slotId: string, force: boolean = false): Promise<SchematicLayout> {
    if (!force) {
      throw new Error(`Slot "${slotId}" removal requires force=true. Unassign equipment first.`);
    }
    const layout = await this.getVesselLayout(vesselId, orgId);
    const slotIdx = layout.slots.findIndex(s => s.slotId === slotId);
    if (slotIdx === -1) throw new Error(`Slot "${slotId}" not found`);
    layout.slots.splice(slotIdx, 1);
    for (const zone of layout.zones) {
      zone.slotIds = zone.slotIds.filter(id => id !== slotId);
    }
    await this.repo.saveLayout(vesselId, orgId, layout);
    return layout;
  }

  async moveSlot(vesselId: string, orgId: string, slotId: string, cmd: MoveSlotCommand): Promise<SchematicLayout> {
    const layout = await this.getVesselLayout(vesselId, orgId);
    const slot = layout.slots.find(s => s.slotId === slotId);
    if (!slot) throw new Error(`Slot "${slotId}" not found`);
    const targetZone = layout.zones.find(z => z.zoneId === cmd.targetZoneId);
    if (!targetZone) throw new Error(`Target zone "${cmd.targetZoneId}" not found`);
    for (const zone of layout.zones) {
      zone.slotIds = zone.slotIds.filter(id => id !== slotId);
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
