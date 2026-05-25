import type { VesselEquipment } from "@/features/vessels/types";
import type { SchematicLayout, SchematicSlot } from "@/hooks/useSchematicLayout";
import { HULL_LEFT, HULL_W, hullBottomAt, hullTopAt } from "./constants";
import type { PositionedSlot, SlotAssignment, ZoneRect } from "./types";

export const statusFill = (s: string) =>
  s === "operational"
    ? "#22c55e"
    : s === "degraded" || s === "warning"
      ? "#f59e0b"
      : s === "critical"
        ? "#ef4444"
        : "#64748b";

export const healthColor = (v: number) => (v > 70 ? "#22c55e" : v > 40 ? "#f59e0b" : "#ef4444");

export function computeLayout(layout: SchematicLayout): {
  zones: ZoneRect[];
  slots: PositionedSlot[];
} {
  const sortedZones = [...layout.zones].sort((a, b) => a.order - b.order);
  const zoneCount = sortedZones.length;
  if (zoneCount === 0) {
    return { zones: [], slots: [] };
  }

  const pad = 2;
  const usableW = HULL_W - pad * 2;
  const zoneW = usableW / zoneCount;

  const zoneRects: ZoneRect[] = [];
  const positionedSlots: PositionedSlot[] = [];

  sortedZones.forEach((zone, i) => {
    const zx = HULL_LEFT + pad + i * zoneW;
    const midX = zx + zoneW / 2;
    const zt = Math.max(hullTopAt(zx), hullTopAt(zx + zoneW), hullTopAt(midX)) + 1;
    const zb = Math.min(hullBottomAt(zx), hullBottomAt(zx + zoneW), hullBottomAt(midX)) - 1;
    const zh = zb - zt;

    zoneRects.push({ zone, x: zx, y: zt, w: zoneW, h: zh });

    const slotDefs = zone.slotIds
      .map((sid) => layout.slots.find((s) => s.slotId === sid))
      .filter(Boolean) as SchematicSlot[];

    const count = slotDefs.length;
    if (count === 0) {
      return;
    }

    const innerPad = 1.5;
    const gutter = 1.5;
    const MIN_CELL_H = 2.5;
    const MIN_CELL_W = 4;
    const availableH = zh - innerPad * 2;
    const availableW = zoneW - innerPad * 2;

    const cols = (() => {
      if (count <= 2) {
        return 1;
      }
      if (count <= 6) {
        return 2;
      }
      if (count <= 12) {
        return 3;
      }
      return Math.min(4, Math.ceil(Math.sqrt(count)));
    })();
    const rows = Math.ceil(count / cols);
    const cellW = Math.max(MIN_CELL_W, (availableW - (cols - 1) * gutter) / cols);
    const rawCellH = (availableH - (rows - 1) * gutter) / rows;
    const cellH = Math.min(Math.max(MIN_CELL_H, rawCellH), 18);

    slotDefs.forEach((slot, si) => {
      const col = si % cols;
      const row = Math.floor(si / cols);
      const sx = zx + innerPad + col * (cellW + gutter);
      const sy = zt + innerPad + row * (cellH + gutter);
      positionedSlots.push({ ...slot, x: sx, y: sy, w: cellW, h: cellH });
    });
  });

  return { zones: zoneRects, slots: positionedSlots };
}

export function assignEquipmentToSlots(
  positionedSlots: PositionedSlot[],
  equipment: VesselEquipment[]
): SlotAssignment[] {
  const assignments: SlotAssignment[] = positionedSlots.map((slot) => ({ slot, equipment: null }));
  const assigned = new Set<string>();

  for (const eq of equipment) {
    const typeLower = (eq.type || "").toLowerCase();
    const nameLower = (eq.name || "").toLowerCase();
    for (const assignment of assignments) {
      if (assignment.equipment) {
        continue;
      }
      const matches = assignment.slot.typeMatch.some(
        (t) => typeLower.includes(t) || nameLower.includes(t)
      );
      if (matches && !assigned.has(eq.id)) {
        assignment.equipment = eq;
        assigned.add(eq.id);
        break;
      }
    }
  }

  const unmatched = equipment.filter((eq) => !assigned.has(eq.id));
  const emptySlots = assignments.filter((a) => !a.equipment);
  for (let i = 0; i < Math.min(unmatched.length, emptySlots.length); i++) {
    const slot = emptySlots[i];
    if (slot) {
      slot.equipment = unmatched[i] ?? null;
    }
  }

  return assignments;
}

export function generateLocalId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function getUnassignedSlots(layout: SchematicLayout): SchematicSlot[] {
  const assignedIds = new Set(layout.zones.flatMap((z) => z.slotIds));
  return layout.slots.filter((s) => !assignedIds.has(s.slotId));
}
