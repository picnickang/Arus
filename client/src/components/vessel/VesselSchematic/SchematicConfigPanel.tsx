import { useState } from "react";
import {
  Plus,
  Trash2,
  RotateCcw,
  Save,
  X,
  Pencil,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SchematicLayout } from "@/hooks/useSchematicLayout";
import { generateLocalId, getUnassignedSlots } from "./utils";

export function SchematicConfigPanel({
  layout,
  equipmentSlotMap,
  onSave,
  onReset,
  onClose,
  onDraftChange,
  isPending,
}: {
  layout: SchematicLayout;
  equipmentSlotMap?: Map<string, string>;
  onSave: (draft: SchematicLayout) => void;
  onReset: () => void;
  onClose: () => void;
  onDraftChange?: (draft: SchematicLayout) => void;
  isPending: boolean;
}) {
  const [draft, setDraft] = useState<SchematicLayout>(() => JSON.parse(JSON.stringify(layout)));
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

  const isDirty = JSON.stringify(draft) !== JSON.stringify(layout);
  const sortedZones = [...draft.zones].sort((a, b) => a.order - b.order);
  const unassignedSlots = getUnassignedSlots(draft);

  const updateDraft = (fn: (d: SchematicLayout) => void) => {
    setDraft((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      fn(next);
      onDraftChange?.(next);
      return next;
    });
  };

  const handleAddZone = () => {
    if (!newZoneName.trim()) {
      return;
    }
    updateDraft((d) => {
      d.zones.push({
        zoneId: generateLocalId("zone"),
        label: newZoneName.trim(),
        order: d.zones.length,
        slotIds: [],
      });
    });
    setNewZoneName("");
  };

  const handleRemoveZone = (zoneId: string) => {
    updateDraft((d) => {
      const idx = d.zones.findIndex((z) => z.zoneId === zoneId);
      if (idx !== -1) {
        d.zones.splice(idx, 1);
        d.zones.forEach((z, i) => {
          z.order = i;
        });
      }
    });
  };

  const handleMoveZoneUp = (zoneId: string) => {
    updateDraft((d) => {
      const sorted = d.zones.sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((z) => z.zoneId === zoneId);
      if (idx > 0) {
        const cur = sorted[idx];
        const prev = sorted[idx - 1];
        if (!cur || !prev) {
          return;
        }
        const tmp = cur.order;
        cur.order = prev.order;
        prev.order = tmp;
      }
    });
  };

  const handleMoveZoneDown = (zoneId: string) => {
    updateDraft((d) => {
      const sorted = d.zones.sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((z) => z.zoneId === zoneId);
      if (idx >= 0 && idx < sorted.length - 1) {
        const cur = sorted[idx];
        const next = sorted[idx + 1];
        if (!cur || !next) {
          return;
        }
        const tmp = cur.order;
        cur.order = next.order;
        next.order = tmp;
      }
    });
  };

  const handleAddSlot = () => {
    if (!newSlotName.trim() || !newSlotZone) {
      return;
    }
    const tm = newSlotTypeMatch
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const slotId = generateLocalId("slot");
    updateDraft((d) => {
      d.slots.push({
        slotId,
        label: newSlotName.trim(),
        category: newSlotCategory.trim() || "general",
        typeMatch: tm.length ? tm : [newSlotName.trim().toLowerCase()],
      });
      const zone = d.zones.find((z) => z.zoneId === newSlotZone);
      if (zone) {
        zone.slotIds.push(slotId);
      }
    });
    setNewSlotName("");
    setNewSlotCategory("");
    setNewSlotTypeMatch("");
  };

  const handleRemoveSlot = (slotId: string) => {
    const hasEquipment = equipmentSlotMap?.has(slotId);
    if (hasEquipment) {
      return;
    }
    updateDraft((d) => {
      d.slots = d.slots.filter((s) => s.slotId !== slotId);
      for (const zone of d.zones) {
        zone.slotIds = zone.slotIds.filter((id) => id !== slotId);
      }
    });
  };

  const handleMoveSlot = (slotId: string, targetZoneId: string) => {
    updateDraft((d) => {
      for (const zone of d.zones) {
        zone.slotIds = zone.slotIds.filter((id) => id !== slotId);
      }
      const target = d.zones.find((z) => z.zoneId === targetZoneId);
      if (target) {
        target.slotIds.push(slotId);
      }
    });
  };

  const handleSave = () => {
    onSave(draft);
  };

  const handleCancel = () => {
    setDraft(JSON.parse(JSON.stringify(layout)));
    onClose();
  };

  return (
    <div className="bg-[#0a1328] border border-slate-700/20 rounded-lg p-4 max-h-[70vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wide">
            Schematic Configuration
          </h3>
          {isDirty && (
            <Badge variant="secondary" className="text-[9px] bg-amber-500/20 text-amber-400">
              Unsaved
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleCancel}
          data-testid="btn-close-config"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mb-5">
        <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Zones
        </h4>
        <div className="space-y-1.5">
          {sortedZones.map((zone, zIdx) => (
            <div
              key={zone.zoneId}
              className="flex items-center gap-2 p-2 rounded bg-slate-800/40 border border-slate-700/15"
            >
              <div className="flex flex-col gap-0.5">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-4 w-4 p-0 text-slate-500 hover:text-slate-200"
                  data-testid={`btn-zone-up-${zone.zoneId}`}
                  disabled={zIdx === 0}
                  onClick={() => handleMoveZoneUp(zone.zoneId)}
                >
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-4 w-4 p-0 text-slate-500 hover:text-slate-200"
                  data-testid={`btn-zone-down-${zone.zoneId}`}
                  disabled={zIdx === sortedZones.length - 1}
                  onClick={() => handleMoveZoneDown(zone.zoneId)}
                >
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>
              {editingZone === zone.zoneId ? (
                <div className="flex items-center gap-1.5 flex-1">
                  <Input
                    value={editZoneName}
                    onChange={(e) => setEditZoneName(e.target.value)}
                    className="h-7 text-xs bg-slate-900/50 border-slate-700/30"
                    data-testid={`input-edit-zone-${zone.zoneId}`}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-green-400"
                    data-testid={`btn-save-zone-${zone.zoneId}`}
                    onClick={() => {
                      updateDraft((d) => {
                        const z = d.zones.find((z) => z.zoneId === zone.zoneId);
                        if (z) {
                          z.label = editZoneName;
                        }
                      });
                      setEditingZone(null);
                    }}
                  >
                    <Save className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-slate-400"
                    onClick={() => setEditingZone(null)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <>
                  <span className="text-xs text-slate-200 flex-1">{zone.label}</span>
                  <Badge variant="secondary" className="text-[9px] bg-slate-700/30">
                    {zone.slotIds.length} slots
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-slate-400 hover:text-sky-400"
                    data-testid={`btn-edit-zone-${zone.zoneId}`}
                    onClick={() => {
                      setEditingZone(zone.zoneId);
                      setEditZoneName(zone.label);
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-slate-400 hover:text-red-400"
                    data-testid={`btn-remove-zone-${zone.zoneId}`}
                    onClick={() => handleRemoveZone(zone.zoneId)}
                  >
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
            onChange={(e) => setNewZoneName(e.target.value)}
            className="h-8 text-xs bg-slate-900/50 border-slate-700/30 flex-1"
            data-testid="input-new-zone"
            onKeyDown={(e) => e.key === "Enter" && handleAddZone()}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs border-sky-500/30 text-sky-400"
            disabled={!newZoneName.trim()}
            onClick={handleAddZone}
            data-testid="btn-add-zone"
          >
            <Plus className="h-3 w-3" /> Add
          </Button>
        </div>
      </div>

      <div className="mb-5">
        <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Slots
        </h4>
        <div className="space-y-1.5">
          {sortedZones.map((zone) => (
            <div key={zone.zoneId}>
              <div className="text-[10px] text-slate-500 font-semibold uppercase mb-1 ml-1">
                {zone.label}
              </div>
              {zone.slotIds.map((sid) => {
                const slot = draft.slots.find((s) => s.slotId === sid);
                if (!slot) {
                  return null;
                }
                const hasEq = equipmentSlotMap?.has(sid);
                return (
                  <div
                    key={sid}
                    className="flex items-center gap-2 p-2 ml-3 rounded bg-slate-800/30 border border-slate-700/10 mb-1"
                  >
                    {editingSlot === sid ? (
                      <div className="flex items-center gap-1.5 flex-1">
                        <Input
                          value={editSlotName}
                          onChange={(e) => setEditSlotName(e.target.value)}
                          className="h-7 text-xs bg-slate-900/50 border-slate-700/30"
                          data-testid={`input-edit-slot-${sid}`}
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-green-400"
                          data-testid={`btn-save-slot-${sid}`}
                          onClick={() => {
                            updateDraft((d) => {
                              const s = d.slots.find((s) => s.slotId === sid);
                              if (s) {
                                s.label = editSlotName;
                              }
                            });
                            setEditingSlot(null);
                          }}
                        >
                          <Save className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-slate-400"
                          onClick={() => setEditingSlot(null)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs text-slate-200 flex-1">{slot.label}</span>
                        {hasEq && (
                          <Badge
                            variant="secondary"
                            className="text-[9px] bg-green-500/20 text-green-400"
                          >
                            Installed
                          </Badge>
                        )}
                        <Badge variant="secondary" className="text-[9px] bg-slate-700/30">
                          {slot.category}
                        </Badge>
                        <Select onValueChange={(val) => handleMoveSlot(sid, val)}>
                          <SelectTrigger
                            className="h-6 w-20 text-[10px] bg-slate-900/50 border-slate-700/30"
                            data-testid={`select-move-slot-${sid}`}
                          >
                            <SelectValue placeholder="Move" />
                          </SelectTrigger>
                          <SelectContent>
                            {sortedZones
                              .filter((z) => z.zoneId !== zone.zoneId)
                              .map((z) => (
                                <SelectItem key={z.zoneId} value={z.zoneId}>
                                  {z.label}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-slate-400 hover:text-sky-400"
                          data-testid={`btn-edit-slot-${sid}`}
                          onClick={() => {
                            setEditingSlot(sid);
                            setEditSlotName(slot.label);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        {hasEq ? (
                          <div className="relative group">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-slate-600 cursor-not-allowed"
                              disabled
                              data-testid={`btn-remove-slot-${sid}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                            <div className="absolute bottom-full right-0 mb-1 px-2 py-1 bg-slate-900 border border-amber-500/30 rounded text-[9px] text-amber-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                              Unassign equipment first
                            </div>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-slate-400 hover:text-red-400"
                            data-testid={`btn-remove-slot-${sid}`}
                            onClick={() => handleRemoveSlot(sid)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {unassignedSlots.length > 0 && (
            <div>
              <div className="text-[10px] text-amber-400/80 font-semibold uppercase mb-1 ml-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Unassigned Slots
              </div>
              {unassignedSlots.map((slot) => {
                const hasEq = equipmentSlotMap?.has(slot.slotId);
                return (
                  <div
                    key={slot.slotId}
                    className="flex items-center gap-2 p-2 ml-3 rounded bg-amber-500/5 border border-amber-500/15 mb-1"
                  >
                    <span className="text-xs text-slate-200 flex-1">{slot.label}</span>
                    {hasEq && (
                      <Badge
                        variant="secondary"
                        className="text-[9px] bg-green-500/20 text-green-400"
                      >
                        Installed
                      </Badge>
                    )}
                    <Select onValueChange={(val) => handleMoveSlot(slot.slotId, val)}>
                      <SelectTrigger
                        className="h-6 w-24 text-[10px] bg-slate-900/50 border-amber-500/20"
                        data-testid={`select-assign-slot-${slot.slotId}`}
                      >
                        <SelectValue placeholder="Assign to" />
                      </SelectTrigger>
                      <SelectContent>
                        {sortedZones.map((z) => (
                          <SelectItem key={z.zoneId} value={z.zoneId}>
                            {z.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {hasEq ? (
                      <div className="relative group">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-slate-600 cursor-not-allowed"
                          disabled
                          data-testid={`btn-remove-slot-${slot.slotId}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                        <div className="absolute bottom-full right-0 mb-1 px-2 py-1 bg-slate-900 border border-amber-500/30 rounded text-[9px] text-amber-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          Unassign equipment first
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-slate-400 hover:text-red-400"
                        data-testid={`btn-remove-slot-${slot.slotId}`}
                        onClick={() => handleRemoveSlot(slot.slotId)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5 mt-2 p-2 rounded bg-slate-800/20 border border-slate-700/10">
          <div className="flex gap-1.5">
            <Input
              placeholder="Slot name"
              value={newSlotName}
              onChange={(e) => setNewSlotName(e.target.value)}
              className="h-7 text-xs bg-slate-900/50 border-slate-700/30 flex-1"
              data-testid="input-new-slot-name"
            />
            <Input
              placeholder="Category"
              value={newSlotCategory}
              onChange={(e) => setNewSlotCategory(e.target.value)}
              className="h-7 text-xs bg-slate-900/50 border-slate-700/30 w-24"
              data-testid="input-new-slot-category"
            />
          </div>
          <div className="flex gap-1.5">
            <Input
              placeholder="Type matches (comma-sep)"
              value={newSlotTypeMatch}
              onChange={(e) => setNewSlotTypeMatch(e.target.value)}
              className="h-7 text-xs bg-slate-900/50 border-slate-700/30 flex-1"
              data-testid="input-new-slot-typematch"
            />
            <Select onValueChange={setNewSlotZone}>
              <SelectTrigger
                className="h-7 w-28 text-[10px] bg-slate-900/50 border-slate-700/30"
                data-testid="select-new-slot-zone"
              >
                <SelectValue placeholder="Zone" />
              </SelectTrigger>
              <SelectContent>
                {sortedZones.map((z) => (
                  <SelectItem key={z.zoneId} value={z.zoneId}>
                    {z.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs border-sky-500/30 text-sky-400"
              disabled={!newSlotName.trim() || !newSlotZone}
              onClick={handleAddSlot}
              data-testid="btn-add-slot"
            >
              <Plus className="h-3 w-3" /> Add
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-slate-700/15">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs border-red-500/20 text-red-400 hover:bg-red-500/10"
          onClick={() => setConfirmReset(true)}
          disabled={isPending}
          data-testid="btn-reset-layout"
        >
          <RotateCcw className="h-3 w-3" /> Reset to Default
        </Button>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          className="text-xs border-slate-700/30 text-slate-300"
          onClick={handleCancel}
          data-testid="btn-cancel-config"
        >
          Cancel
        </Button>
        <Button
          size="sm"
          className="gap-1.5 text-xs bg-sky-500 hover:bg-sky-600 text-white"
          onClick={handleSave}
          disabled={!isDirty || isPending}
          data-testid="btn-save-config"
        >
          <Save className="h-3 w-3" /> Save
        </Button>
      </div>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent className="bg-[#0f1729] border-slate-700/30 max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Reset Layout</DialogTitle>
            <DialogDescription className="text-slate-400">
              This will reset all zones and slots back to the default configuration. Custom changes
              will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setConfirmReset(false)}
              className="border-slate-700/30 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onReset();
                setConfirmReset(false);
              }}
              data-testid="btn-confirm-reset"
            >
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
