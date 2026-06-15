import { MarkerType, applyNodeChanges, type Edge, type Node, type NodeChange } from "reactflow";
import type { Equipment, EquipmentDependency } from "@shared/schema";

export type DependencyWithEditor = EquipmentDependency & {
  notesUpdatedByName?: string | null;
};

export interface DependenciesResponse {
  dependencies: DependencyWithEditor[];
}

export type NodePositions = Record<string, { x: number; y: number }>;

export interface LayoutResponse {
  positions: NodePositions;
}

export interface CsvRow {
  upstreamEquipmentId: string;
  downstreamEquipmentId: string;
  notes?: string | null;
}

export type NotesDialogState =
  | {
      mode: "edit";
      dependencyId: string;
      upstreamId: string;
      downstreamId: string;
      notes: string;
    }
  | {
      mode: "create";
      upstreamId: string;
      downstreamId: string;
      notes: string;
    }
  | null;

export function isForbiddenVesselsError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return !!error && (/^403:/.test(message) || /forbidden/i.test(message));
}

export function indexEquipmentById(equipmentList: Equipment[]): Map<string, Equipment> {
  const indexed = new Map<string, Equipment>();
  for (const equipment of equipmentList) {
    indexed.set(equipment.id, equipment);
  }
  return indexed;
}

export function formatEquipmentLabel(equipmentById: Map<string, Equipment>, id: string): string {
  const equipment = equipmentById.get(id);
  return equipment ? `${equipment.name} (${equipment.id.slice(0, 8)}…)` : id;
}

export function buildOptimisticDependency(
  vesselId: string,
  input: { upstreamEquipmentId: string; downstreamEquipmentId: string }
): DependencyWithEditor {
  return {
    id: `optimistic-${input.upstreamEquipmentId}-${input.downstreamEquipmentId}`,
    orgId: "",
    vesselId,
    upstreamEquipmentId: input.upstreamEquipmentId,
    downstreamEquipmentId: input.downstreamEquipmentId,
    notes: null,
    notesUpdatedBy: null,
    notesUpdatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    notesUpdatedByName: null,
  };
}

/**
 * Parse the CSV body the admin pastes into the import textarea. We
 * deliberately accept the simplest possible shape so an operator
 * editing a spreadsheet doesn't need to fight quoting:
 *
 *   upstreamEquipmentId,downstreamEquipmentId[,notes]
 *
 * Header row optional. Blank lines + `#`-comment lines ignored.
 */
export function parseCsv(text: string): { rows: CsvRow[]; errors: string[] } {
  const errors: string[] = [];
  const rows: CsvRow[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = (lines[i] ?? "").trim();
    if (!raw || raw.startsWith("#")) {
      continue;
    }
    const parts = raw.split(",").map((p) => p.trim());
    // Skip header row.
    if (i === 0 && /upstream/i.test(parts[0] ?? "")) {
      continue;
    }
    if (parts.length < 2) {
      errors.push(`Line ${i + 1}: need at least 2 columns`);
      continue;
    }
    const [up, down, notes] = parts;
    if (!up || !down) {
      errors.push(`Line ${i + 1}: missing upstream or downstream id`);
      continue;
    }
    if (up === down) {
      errors.push(`Line ${i + 1}: self-loop (${up})`);
      continue;
    }
    rows.push({
      upstreamEquipmentId: up,
      downstreamEquipmentId: down,
      notes: notes && notes.length > 0 ? notes : null,
    });
  }
  return { rows, errors };
}

/**
 * Deterministic circular layout — used as the fallback only when the
 * server has no saved layout for this (user, vessel) pair.
 */
export function circularLayout(ids: string[]): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  const n = Math.max(ids.length, 1);
  const radius = Math.max(180, n * 28);
  const cx = radius + 80;
  const cy = radius + 80;
  ids.forEach((id, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    out[id] = {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    };
  });
  return out;
}

export function mergeLayoutPositions(
  equipmentList: Equipment[],
  saved: NodePositions
): NodePositions {
  const ids = equipmentList.map((equipment) => equipment.id);
  const fallback = circularLayout(ids);
  const merged: NodePositions = {};
  for (const id of ids) {
    const savedPosition = saved[id];
    merged[id] =
      savedPosition && Number.isFinite(savedPosition.x) && Number.isFinite(savedPosition.y)
        ? savedPosition
        : (fallback[id] ?? { x: 0, y: 0 });
  }
  return merged;
}

export function buildDependencyNodes(
  equipmentList: Equipment[],
  nodePositions: NodePositions
): Node[] {
  return equipmentList.map((equipment) => ({
    id: equipment.id,
    type: "default",
    position: nodePositions[equipment.id] ?? { x: 0, y: 0 },
    data: { label: equipment.name },
    draggable: true,
  }));
}

export function buildDependencyEdges(dependencies: DependencyWithEditor[]): Edge[] {
  return dependencies.map((dependency) => ({
    id: dependency.id,
    source: dependency.upstreamEquipmentId,
    target: dependency.downstreamEquipmentId,
    ...(dependency.notes != null ? { label: dependency.notes } : {}),
    markerEnd: { type: MarkerType.ArrowClosed },
    animated: dependency.id.startsWith("optimistic-"),
    ...(dependency.id.startsWith("optimistic-") ? { style: { opacity: 0.6 } } : {}),
    data: { dependencyId: dependency.id },
  }));
}

export function changesAffectLayout(changes: NodeChange[]): boolean {
  return changes.some(
    (change) => change.type === "position" || change.type === "remove" || change.type === "add"
  );
}

export function applyDependencyNodeChanges(
  previous: NodePositions,
  changes: NodeChange[]
): NodePositions {
  const next = { ...previous };
  const updated = applyNodeChanges(
    changes,
    Object.entries(previous).map(([id, position]) => ({ id, position, data: {} })) as Node[]
  );
  for (const node of updated) {
    next[node.id] = node.position;
  }
  return next;
}
