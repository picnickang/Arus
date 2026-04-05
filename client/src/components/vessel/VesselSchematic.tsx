import { useState, useMemo, useCallback } from "react";
import { Settings2, Plus, Trash2, GripVertical, RotateCcw, Save, X, ArrowRight, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Equipment } from "@/features/vessels/types";
import type { SchematicLayout, SchematicZone, SchematicSlot } from "@/hooks/useSchematicLayout";

export const statusFill = (s: string) =>
  s === "operational" ? "#22c55e" :
  s === "degraded" || s === "warning" ? "#f59e0b" :
  s === "critical" ? "#ef4444" : "#64748b";

export const healthColor = (v: number) => v > 70 ? "#22c55e" : v > 40 ? "#f59e0b" : "#ef4444";

export interface PositionedSlot extends SchematicSlot {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SlotAssignment {
  slot: PositionedSlot;
  equipment: Equipment | null;
}

export interface ZoneRect {
  zone: SchematicZone;
  x: number;
  y: number;
  w: number;
  h: number;
}

const SVG_W = 200;
const SVG_H = 80;
const HULL_LEFT = 8;
const HULL_RIGHT = 192;
const HULL_TOP = 10;
const HULL_BOTTOM = 70;
const HULL_W = HULL_RIGHT - HULL_LEFT;
const WATERLINE_Y = 62;
const DECK_Y = 30;
const SUPER_TOP = 12;
const SUPER_BOTTOM = DECK_Y;
const SUPER_LEFT = 155;
const SUPER_RIGHT = 190;

function hullTopAt(x: number): number {
  if (x >= SUPER_LEFT && x <= SUPER_RIGHT) return SUPER_TOP;
  if (x > SUPER_RIGHT) {
    const t = (x - SUPER_RIGHT) / (HULL_RIGHT - SUPER_RIGHT);
    return DECK_Y + t * (DECK_Y - HULL_TOP);
  }
  return DECK_Y;
}

function hullBottomAt(x: number): number {
  if (x < HULL_LEFT + 20) {
    const t = (x - HULL_LEFT) / 20;
    return HULL_BOTTOM - (1 - t) * 5;
  }
  if (x > HULL_RIGHT - 15) {
    const t = (HULL_RIGHT - x) / 15;
    return HULL_BOTTOM - (1 - t) * 12;
  }
  return HULL_BOTTOM;
}

export function computeLayout(layout: SchematicLayout): { zones: ZoneRect[]; slots: PositionedSlot[] } {
  const sortedZones = [...layout.zones].sort((a, b) => a.order - b.order);
  const zoneCount = sortedZones.length;
  if (zoneCount === 0) return { zones: [], slots: [] };

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
      .map(sid => layout.slots.find(s => s.slotId === sid))
      .filter(Boolean) as SchematicSlot[];

    const count = slotDefs.length;
    if (count === 0) return;

    const innerPad = 1.5;
    const gutter = 1.5;
    const cols = count <= 2 ? 1 : 2;
    const rows = Math.ceil(count / cols);
    const cellW = (zoneW - innerPad * 2 - (cols - 1) * gutter) / cols;
    const cellH = Math.min((zh - innerPad * 2 - (rows - 1) * gutter) / rows, 18);

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
  equipment: Equipment[]
): SlotAssignment[] {
  const assignments: SlotAssignment[] = positionedSlots.map(slot => ({ slot, equipment: null }));
  const assigned = new Set<string>();

  for (const eq of equipment) {
    const typeLower = (eq.type || "").toLowerCase();
    const nameLower = (eq.name || "").toLowerCase();
    for (const assignment of assignments) {
      if (assignment.equipment) continue;
      const matches = assignment.slot.typeMatch.some(
        t => typeLower.includes(t) || nameLower.includes(t)
      );
      if (matches && !assigned.has(eq.id)) {
        assignment.equipment = eq;
        assigned.add(eq.id);
        break;
      }
    }
  }

  const unmatched = equipment.filter(eq => !assigned.has(eq.id));
  const emptySlots = assignments.filter(a => !a.equipment);
  for (let i = 0; i < Math.min(unmatched.length, emptySlots.length); i++) {
    emptySlots[i].equipment = unmatched[i];
  }

  return assignments;
}

function HullSVG({ zoneRects }: { zoneRects: ZoneRect[] }) {
  return (
    <>
      <defs>
        <linearGradient id="hull-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a2744" />
          <stop offset="100%" stopColor="#0d1829" />
        </linearGradient>
        <linearGradient id="water" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(56,189,248,0.05)" />
          <stop offset="50%" stopColor="rgba(56,189,248,0.12)" />
          <stop offset="100%" stopColor="rgba(56,189,248,0.05)" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <clipPath id="hull-clip">
          <path d={hullPath()} />
        </clipPath>
      </defs>

      <rect x="0" y={WATERLINE_Y} width={SVG_W} height={SVG_H - WATERLINE_Y} fill="url(#water)" />

      <path d={hullPath()} fill="url(#hull-grad)" stroke="rgba(56,189,248,0.25)" strokeWidth="0.4" />

      <line x1={HULL_LEFT} y1={WATERLINE_Y} x2={HULL_RIGHT} y2={WATERLINE_Y}
        stroke="rgba(56,189,248,0.15)" strokeWidth="0.3" strokeDasharray="2 1.5" />

      <line x1={HULL_LEFT + 5} y1={DECK_Y} x2={SUPER_LEFT} y2={DECK_Y}
        stroke="rgba(148,163,184,0.12)" strokeWidth="0.25" strokeDasharray="1.5 1" />

      <rect x={SUPER_LEFT} y={SUPER_TOP} width={SUPER_RIGHT - SUPER_LEFT} height={SUPER_BOTTOM - SUPER_TOP}
        rx="1.5" fill="#15243d" stroke="rgba(56,189,248,0.2)" strokeWidth="0.3" />
      {[0, 1, 2, 3].map(i => (
        <rect key={i} x={SUPER_LEFT + 2 + i * 8} y={SUPER_TOP + 2} width={6} height={3} rx={0.5}
          fill="rgba(56,189,248,0.3)" />
      ))}

      <line x1={SUPER_LEFT + 17} y1={SUPER_TOP - 5} x2={SUPER_LEFT + 17} y2={SUPER_TOP}
        stroke="rgba(148,163,184,0.4)" strokeWidth="0.4" />
      <circle cx={SUPER_LEFT + 17} cy={SUPER_TOP - 5.5} r="0.8" fill="#f59e0b" opacity={0.8}>
        <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
      </circle>

      {zoneRects.map((zr, i) => (
        i > 0 && (
          <line key={`div-${i}`}
            x1={zr.x} y1={Math.max(hullTopAt(zr.x), SUPER_TOP) + 0.5}
            x2={zr.x} y2={hullBottomAt(zr.x) - 0.5}
            stroke="rgba(148,163,184,0.18)" strokeWidth="0.5" strokeDasharray="2 1" />
        )
      ))}

      {zoneRects.map(zr => (
        <text key={`zl-${zr.zone.zoneId}`}
          x={zr.x + zr.w / 2} y={zr.y + zr.h - 1.5}
          textAnchor="middle" fill="rgba(148,163,184,0.18)"
          fontSize="2.5" fontWeight="700" fontFamily="monospace"
          style={{ textTransform: "uppercase" as const }}>
          {zr.zone.label}
        </text>
      ))}
    </>
  );
}

function hullPath(): string {
  return `M ${HULL_LEFT},${HULL_BOTTOM - 5}
    L ${HULL_LEFT},${DECK_Y}
    L ${SUPER_LEFT},${DECK_Y}
    L ${SUPER_LEFT},${SUPER_TOP}
    L ${SUPER_RIGHT},${SUPER_TOP}
    L ${SUPER_RIGHT},${DECK_Y}
    Q ${HULL_RIGHT - 2},${DECK_Y} ${HULL_RIGHT},${DECK_Y + 8}
    L ${HULL_RIGHT},${HULL_BOTTOM - 12}
    Q ${HULL_RIGHT},${HULL_BOTTOM} ${HULL_RIGHT - 10},${HULL_BOTTOM}
    L ${HULL_LEFT + 5},${HULL_BOTTOM}
    Q ${HULL_LEFT},${HULL_BOTTOM} ${HULL_LEFT},${HULL_BOTTOM - 5}
    Z`;
}

function SlotRect({
  assignment,
  isSelected,
  onClick,
}: {
  assignment: SlotAssignment;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { slot, equipment: eq } = assignment;
  const status = eq?.status || "offline";
  const sc = eq ? statusFill(status) : "rgba(148,163,184,0.3)";
  const health = eq?.healthScore ?? 0;
  const displayName = eq
    ? (eq.name.length > 14 ? eq.name.slice(0, 12) + "…" : eq.name)
    : slot.label;
  const displaySub = eq
    ? [eq.manufacturer, eq.model].filter(Boolean).join(" ").slice(0, 16)
    : "EMPTY SLOT";

  return (
    <g onClick={onClick} style={{ cursor: "pointer" }} data-testid={`slot-${slot.slotId}`}>
      <rect
        x={slot.x} y={slot.y} width={slot.w} height={slot.h} rx={1}
        fill={isSelected ? `${sc}22` : eq ? `${sc}10` : "rgba(148,163,184,0.03)"}
        stroke={isSelected ? sc : eq ? `${sc}66` : "rgba(148,163,184,0.15)"}
        strokeWidth={isSelected ? 0.7 : 0.35}
        strokeDasharray={!eq ? "1.2 0.8" : "none"}
        className="transition-all duration-200"
      />

      {eq && (
        <circle cx={slot.x + slot.w - 2} cy={slot.y + 2} r={1} fill={sc} filter="url(#glow)">
          {status === "critical" && (
            <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite" />
          )}
        </circle>
      )}

      {eq && (
        <>
          <rect x={slot.x + 0.8} y={slot.y + 0.8} width={4.5} height={1.8} rx={0.5}
            fill="rgba(34,197,94,0.2)" stroke="rgba(34,197,94,0.35)" strokeWidth="0.12" />
          <text x={slot.x + 3.05} y={slot.y + 2} textAnchor="middle" fill="#22c55e"
            fontSize="0.95" fontWeight="700" fontFamily="monospace">OK</text>
        </>
      )}

      <text x={slot.x + slot.w / 2} y={slot.y + slot.h / 2 - (eq ? 0.3 : 0)} textAnchor="middle"
        fill={eq ? "rgba(226,232,240,0.9)" : "rgba(148,163,184,0.5)"}
        fontSize="1.8" fontWeight={eq ? "600" : "400"} fontFamily="system-ui">
        {displayName}
      </text>

      <text x={slot.x + slot.w / 2} y={slot.y + slot.h / 2 + 1.8} textAnchor="middle"
        fill="rgba(148,163,184,0.5)" fontSize="1.2" fontFamily="monospace">
        {displaySub}
      </text>

      {eq && (
        <>
          <rect x={slot.x + 1.2} y={slot.y + slot.h - 2.2} width={slot.w - 2.4} height={0.9} rx={0.4}
            fill="rgba(255,255,255,0.06)" />
          <rect x={slot.x + 1.2} y={slot.y + slot.h - 2.2}
            width={(slot.w - 2.4) * health / 100} height={0.9} rx={0.4}
            fill={sc} opacity={0.7} />
        </>
      )}
    </g>
  );
}

export function VesselSchematic({
  slotAssignments,
  zoneRects,
  selectedSlotId,
  onSelectSlot,
}: {
  slotAssignments: SlotAssignment[];
  zoneRects: ZoneRect[];
  selectedSlotId: string | null;
  onSelectSlot: (slotId: string) => void;
}) {
  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-full min-h-[240px] sm:min-h-[320px]">
      <HullSVG zoneRects={zoneRects} />
      {slotAssignments.map(assignment => (
        <SlotRect
          key={assignment.slot.slotId}
          assignment={assignment}
          isSelected={selectedSlotId === assignment.slot.slotId}
          onClick={() => onSelectSlot(assignment.slot.slotId)}
        />
      ))}
    </svg>
  );
}

export function SchematicConfigPanel({
  layout,
  onAddZone,
  onUpdateZone,
  onRemoveZone,
  onAddSlot,
  onUpdateSlot,
  onRemoveSlot,
  onMoveSlot,
  onReset,
  onClose,
  isPending,
}: {
  layout: SchematicLayout;
  onAddZone: (label: string) => void;
  onUpdateZone: (zoneId: string, label: string) => void;
  onRemoveZone: (zoneId: string) => void;
  onAddSlot: (label: string, category: string, typeMatch: string[], zoneId: string) => void;
  onUpdateSlot: (slotId: string, label: string) => void;
  onRemoveSlot: (slotId: string) => void;
  onMoveSlot: (slotId: string, targetZoneId: string) => void;
  onReset: () => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [newZoneName, setNewZoneName] = useState("");
  const [newSlotName, setNewSlotName] = useState("");
  const [newSlotCategory, setNewSlotCategory] = useState("");
  const [newSlotTypeMatch, setNewSlotTypeMatch] = useState("");
  const [newSlotZone, setNewSlotZone] = useState("");
  const [editingZone, setEditingZone] = useState<string | null>(null);
  const [editZoneName, setEditZoneName] = useState("");
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [editSlotName, setEditSlotName] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  const sortedZones = [...layout.zones].sort((a, b) => a.order - b.order);

  const handleAddZone = () => {
    if (!newZoneName.trim()) return;
    onAddZone(newZoneName.trim());
    setNewZoneName("");
  };

  const handleAddSlot = () => {
    if (!newSlotName.trim() || !newSlotZone) return;
    const tm = newSlotTypeMatch.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    onAddSlot(newSlotName.trim(), newSlotCategory.trim() || "general", tm.length ? tm : [newSlotName.trim().toLowerCase()], newSlotZone);
    setNewSlotName("");
    setNewSlotCategory("");
    setNewSlotTypeMatch("");
  };

  return (
    <div className="bg-[#0a1328] border border-slate-700/20 rounded-lg p-4 max-h-[70vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wide">Schematic Configuration</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} data-testid="btn-close-config">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mb-5">
        <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Zones</h4>
        <div className="space-y-1.5">
          {sortedZones.map(zone => (
            <div key={zone.zoneId} className="flex items-center gap-2 p-2 rounded bg-slate-800/40 border border-slate-700/15">
              <GripVertical className="h-3.5 w-3.5 text-slate-600 shrink-0" />
              {editingZone === zone.zoneId ? (
                <div className="flex items-center gap-1.5 flex-1">
                  <Input
                    value={editZoneName}
                    onChange={e => setEditZoneName(e.target.value)}
                    className="h-7 text-xs bg-slate-900/50 border-slate-700/30"
                    data-testid={`input-edit-zone-${zone.zoneId}`}
                  />
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-green-400" data-testid={`btn-save-zone-${zone.zoneId}`}
                    onClick={() => { onUpdateZone(zone.zoneId, editZoneName); setEditingZone(null); }}>
                    <Save className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-slate-400"
                    onClick={() => setEditingZone(null)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <>
                  <span className="text-xs text-slate-200 flex-1">{zone.label}</span>
                  <Badge variant="secondary" className="text-[9px] bg-slate-700/30">{zone.slotIds.length} slots</Badge>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-slate-400 hover:text-sky-400" data-testid={`btn-edit-zone-${zone.zoneId}`}
                    onClick={() => { setEditingZone(zone.zoneId); setEditZoneName(zone.label); }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-slate-400 hover:text-red-400" data-testid={`btn-remove-zone-${zone.zoneId}`}
                    disabled={isPending} onClick={() => onRemoveZone(zone.zoneId)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-1.5 mt-2">
          <Input
            placeholder="New zone name"
            value={newZoneName}
            onChange={e => setNewZoneName(e.target.value)}
            className="h-8 text-xs bg-slate-900/50 border-slate-700/30 flex-1"
            data-testid="input-new-zone"
            onKeyDown={e => e.key === "Enter" && handleAddZone()}
          />
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs border-sky-500/30 text-sky-400"
            disabled={!newZoneName.trim() || isPending} onClick={handleAddZone} data-testid="btn-add-zone">
            <Plus className="h-3 w-3" /> Add
          </Button>
        </div>
      </div>

      <div className="mb-5">
        <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Slots</h4>
        <div className="space-y-1.5">
          {sortedZones.map(zone => (
            <div key={zone.zoneId}>
              <div className="text-[10px] text-slate-500 font-semibold uppercase mb-1 ml-1">{zone.label}</div>
              {zone.slotIds.map(sid => {
                const slot = layout.slots.find(s => s.slotId === sid);
                if (!slot) return null;
                return (
                  <div key={sid} className="flex items-center gap-2 p-2 ml-3 rounded bg-slate-800/30 border border-slate-700/10 mb-1">
                    {editingSlot === sid ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <Input
                          value={editSlotName}
                          onChange={e => setEditSlotName(e.target.value)}
                          className="h-7 text-xs bg-slate-900/50 border-slate-700/30"
                          data-testid={`input-edit-slot-${sid}`}
                        />
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-green-400" data-testid={`btn-save-slot-${sid}`}
                          onClick={() => { onUpdateSlot(sid, editSlotName); setEditingSlot(null); }}>
                          <Save className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-slate-400"
                          onClick={() => setEditingSlot(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs text-slate-200 flex-1">{slot.label}</span>
                        <Badge variant="secondary" className="text-[9px] bg-slate-700/30">{slot.category}</Badge>
                        <Select onValueChange={val => onMoveSlot(sid, val)}>
                          <SelectTrigger className="h-6 w-20 text-[10px] bg-slate-900/50 border-slate-700/30" data-testid={`select-move-slot-${sid}`}>
                            <SelectValue placeholder="Move" />
                          </SelectTrigger>
                          <SelectContent>
                            {sortedZones.filter(z => z.zoneId !== zone.zoneId).map(z => (
                              <SelectItem key={z.zoneId} value={z.zoneId}>{z.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-slate-400 hover:text-sky-400" data-testid={`btn-edit-slot-${sid}`}
                          onClick={() => { setEditingSlot(sid); setEditSlotName(slot.label); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-slate-400 hover:text-red-400" data-testid={`btn-remove-slot-${sid}`}
                          disabled={isPending} onClick={() => onRemoveSlot(sid)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1.5 mt-2 p-2 rounded bg-slate-800/20 border border-slate-700/10">
          <div className="flex gap-1.5">
            <Input placeholder="Slot name" value={newSlotName} onChange={e => setNewSlotName(e.target.value)}
              className="h-7 text-xs bg-slate-900/50 border-slate-700/30 flex-1" data-testid="input-new-slot-name" />
            <Input placeholder="Category" value={newSlotCategory} onChange={e => setNewSlotCategory(e.target.value)}
              className="h-7 text-xs bg-slate-900/50 border-slate-700/30 w-24" data-testid="input-new-slot-category" />
          </div>
          <div className="flex gap-1.5">
            <Input placeholder="Type matches (comma-sep)" value={newSlotTypeMatch} onChange={e => setNewSlotTypeMatch(e.target.value)}
              className="h-7 text-xs bg-slate-900/50 border-slate-700/30 flex-1" data-testid="input-new-slot-typematch" />
            <Select onValueChange={setNewSlotZone}>
              <SelectTrigger className="h-7 w-28 text-[10px] bg-slate-900/50 border-slate-700/30" data-testid="select-new-slot-zone">
                <SelectValue placeholder="Zone" />
              </SelectTrigger>
              <SelectContent>
                {sortedZones.map(z => (
                  <SelectItem key={z.zoneId} value={z.zoneId}>{z.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs border-sky-500/30 text-sky-400"
              disabled={!newSlotName.trim() || !newSlotZone || isPending} onClick={handleAddSlot} data-testid="btn-add-slot">
              <Plus className="h-3 w-3" /> Add
            </Button>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-3 border-t border-slate-700/15">
        <Button variant="outline" size="sm" className="gap-1.5 text-xs border-red-500/20 text-red-400 hover:bg-red-500/10"
          onClick={() => setConfirmReset(true)} disabled={isPending} data-testid="btn-reset-layout">
          <RotateCcw className="h-3 w-3" /> Reset to Default
        </Button>
      </div>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent className="bg-[#0f1729] border-slate-700/30 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Reset Layout</DialogTitle>
            <DialogDescription className="text-slate-400">
              This will reset all zones and slots back to the default configuration. Custom changes will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmReset(false)} className="border-slate-700/30 text-slate-300">Cancel</Button>
            <Button variant="destructive" onClick={() => { onReset(); setConfirmReset(false); }} data-testid="btn-confirm-reset">Reset</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function HealthBar({ value, width = 100, height = 6 }: { value: number; width?: number; height?: number }) {
  const color = healthColor(value);
  return (
    <svg width={width} height={height} className="rounded overflow-hidden">
      <rect width={width} height={height} fill="currentColor" className="text-white/5" rx={3} />
      <rect width={width * value / 100} height={height} fill={color} rx={3}>
        <animate attributeName="width" from="0" to={String(width * value / 100)} dur="0.8s" fill="freeze" />
      </rect>
    </svg>
  );
}

export function Pulse({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span className="relative inline-block" style={{ width: size, height: size }}>
      <span className="absolute inset-0 rounded-full animate-ping" style={{ backgroundColor: color, opacity: 0.6 }} />
      <span className="relative block rounded-full" style={{ width: size, height: size, backgroundColor: color }} />
    </span>
  );
}

export function StockBadge({ part }: { part: { minStockLevel?: number | null; reorderPoint?: number | null; criticality?: string | null } }) {
  const qty = part.minStockLevel ? (part.reorderPoint || 1) : 1;
  const min = part.minStockLevel ?? 0;
  if (qty === 0) return <Badge variant="destructive" className="text-[10px]">Out of Stock</Badge>;
  if (min > 0 && qty <= min) return <Badge variant="secondary" className="text-[10px] bg-yellow-500/15 text-yellow-500">Low Stock</Badge>;
  return <Badge variant="secondary" className="text-[10px] bg-green-500/15 text-green-500">In Stock</Badge>;
}
