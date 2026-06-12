import { lazy, Suspense, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Crosshair, Loader2, Plus, Trash2, Upload } from "lucide-react";
import type { Equipment } from "@shared/schema";
import type { EquipmentPin, ModelMetadata, PlacementArm } from "./3d-models-model";

const Vessel3DTwin = lazy(() => import("@/components/vessel/Vessel3DTwin"));

interface PinEditorProps {
  model: ModelMetadata;
  vesselId: string;
  onSaved: () => void;
}

export function PinEditor({ model, vesselId, onSaved }: PinEditorProps) {
  const { toast } = useToast();
  const [pins, setPins] = useState<EquipmentPin[]>(model.equipmentPins ?? []);
  const [dirty, setDirty] = useState(false);
  const [placement, setPlacement] = useState<PlacementArm>(null);

  const equipmentQuery = useQuery<Equipment[]>({
    queryKey: ["/api/equipment", { vesselId }],
  });
  const equipmentList = equipmentQuery.data ?? [];
  const equipmentById = useMemo(() => {
    const map = new Map<string, Equipment>();
    for (const equipment of equipmentList) {
      map.set(equipment.id, equipment);
    }
    return map;
  }, [equipmentList]);

  const save = useMutation({
    mutationFn: async () => {
      const clean = pins
        .map((pin) => ({
          equipmentId: pin.equipmentId.trim(),
          x: Number(pin.x),
          y: Number(pin.y),
          z: Number(pin.z),
          label: pin.label?.trim() || undefined,
        }))
        .filter((pin) => pin.equipmentId.length > 0);
      return apiRequest("PATCH", `/api/v1/vessels/3d-model/${encodeURIComponent(model.id)}/pins`, {
        pins: clean,
      });
    },
    onSuccess: () => {
      toast({ title: "Pins saved" });
      setDirty(false);
      onSaved();
    },
    onError: (error: unknown) => {
      const raw = error instanceof Error ? error.message : JSON.stringify(error);
      const friendly =
        /^403:/.test(raw) || /forbidden/i.test(raw)
          ? "Admin role required to edit equipment pins."
          : raw;
      toast({ title: "Save failed", description: friendly, variant: "destructive" });
    },
  });

  const updatePin = (index: number, patch: Partial<EquipmentPin>) => {
    setPins((prev) => prev.map((pin, idx) => (idx === index ? { ...pin, ...patch } : pin)));
    setDirty(true);
  };

  const addPin = () => {
    setPins((prev) => [...prev, { equipmentId: "", x: 0, y: 0, z: 0 }]);
    setDirty(true);
  };

  const removePin = (index: number) => {
    setPins((prev) => prev.filter((_, idx) => idx !== index));
    setDirty(true);
    setPlacement((arm) => {
      if (arm?.mode !== "move") {
        return arm;
      }
      if (arm.targetIdx === index) {
        return null;
      }
      if (arm.targetIdx > index) {
        return { mode: "move", targetIdx: arm.targetIdx - 1 };
      }
      return arm;
    });
  };

  const disarmPlacement = () => setPlacement(null);
  const handlePlaceAt = (point: { x: number; y: number; z: number }) => {
    if (!placement) {
      return;
    }
    const round = (n: number) => Math.round(n * 1000) / 1000;
    const next = { x: round(point.x), y: round(point.y), z: round(point.z) };
    if (placement.mode === "add") {
      setPins((prev) => [...prev, { equipmentId: "", ...next }]);
    } else {
      setPins((prev) =>
        prev.map((pin, idx) => (idx === placement.targetIdx ? { ...pin, ...next } : pin))
      );
    }
    setDirty(true);
    setPlacement(null);
  };

  const placementHint = placement
    ? placement.mode === "add"
      ? "Click on the 3D model to drop a new pin at that point."
      : `Click on the 3D model to move pin #${placement.targetIdx + 1}.`
    : null;

  return (
    <div className="border-t pt-4 space-y-3" data-testid={`pin-editor-${vesselId}`}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-medium">Equipment Pins ({pins.length})</h3>
        <PinEditorActions
          vesselId={vesselId}
          dirty={dirty}
          saving={save.isPending}
          placement={placement}
          onAddPin={addPin}
          onToggleAddPlacement={() =>
            placement?.mode === "add" ? disarmPlacement() : setPlacement({ mode: "add" })
          }
          onSave={() => save.mutate()}
        />
      </div>

      <div
        className={`h-[420px] rounded-md overflow-hidden border ${
          placement ? "ring-2 ring-primary cursor-crosshair" : ""
        }`}
        data-testid={`viewer-3d-${vesselId}`}
      >
        <Suspense
          fallback={
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading 3D viewer…
            </div>
          }
        >
          <Vessel3DTwin
            modelUrl={`/api/v1/vessels/3d-model/${encodeURIComponent(model.id)}/binary`}
            pins={pins.filter((pin) => pin.equipmentId.trim().length > 0)}
            healthByEquipmentId={{}}
            placementMode={placement !== null}
            onPlaceAt={handlePlaceAt}
          />
        </Suspense>
      </div>

      {placementHint && (
        <p className="text-xs text-primary" data-testid={`text-placement-hint-${vesselId}`}>
          {placementHint}{" "}
          <button
            type="button"
            className="underline"
            onClick={disarmPlacement}
            data-testid={`button-cancel-placement-${vesselId}`}
          >
            Cancel
          </button>
        </p>
      )}

      {dirty && (
        <p className="text-xs text-muted-foreground" data-testid={`text-pins-unsaved-${vesselId}`}>
          Unsaved changes — click "Save pins" to persist.
        </p>
      )}

      {pins.some((pin) => pin.equipmentId.trim().length === 0) && (
        <p
          className="text-xs text-destructive"
          data-testid={`text-pins-missing-equipment-${vesselId}`}
        >
          {pins.filter((pin) => pin.equipmentId.trim().length === 0).length} pin(s) have no
          equipment selected and will be discarded on save. Use the Equipment selector on each row.
        </p>
      )}

      {pins.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No pins yet. Use "Add via 3D click" to drop a pin directly on the model, or "Add empty row"
          to enter coordinates manually.
        </p>
      ) : (
        <PinTable
          vesselId={vesselId}
          pins={pins}
          equipmentList={equipmentList}
          equipmentById={equipmentById}
          equipmentQuery={equipmentQuery}
          placement={placement}
          onUpdatePin={updatePin}
          onMovePin={(index) => setPlacement({ mode: "move", targetIdx: index })}
          onCancelPlacement={disarmPlacement}
          onRemovePin={removePin}
        />
      )}
    </div>
  );
}

function PinEditorActions({
  vesselId,
  dirty,
  saving,
  placement,
  onAddPin,
  onToggleAddPlacement,
  onSave,
}: {
  vesselId: string;
  dirty: boolean;
  saving: boolean;
  placement: PlacementArm;
  onAddPin: () => void;
  onToggleAddPlacement: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      <Button size="sm" variant="outline" onClick={onAddPin} data-testid={`button-add-pin-${vesselId}`}>
        <Plus className="h-4 w-4 mr-1" /> Add empty row
      </Button>
      <Button
        size="sm"
        variant={placement?.mode === "add" ? "default" : "outline"}
        onClick={onToggleAddPlacement}
        data-testid={`button-add-pin-via-click-${vesselId}`}
      >
        <Crosshair className="h-4 w-4 mr-1" />
        {placement?.mode === "add" ? "Cancel placement" : "Add via 3D click"}
      </Button>
      <Button
        size="sm"
        disabled={!dirty || saving}
        onClick={onSave}
        data-testid={`button-save-pins-${vesselId}`}
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving…
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-1" /> Save pins
          </>
        )}
      </Button>
    </div>
  );
}

function PinTable({
  vesselId,
  pins,
  equipmentList,
  equipmentById,
  equipmentQuery,
  placement,
  onUpdatePin,
  onMovePin,
  onCancelPlacement,
  onRemovePin,
}: {
  vesselId: string;
  pins: EquipmentPin[];
  equipmentList: Equipment[];
  equipmentById: Map<string, Equipment>;
  equipmentQuery: ReturnType<typeof useQuery<Equipment[]>>;
  placement: PlacementArm;
  onUpdatePin: (index: number, patch: Partial<EquipmentPin>) => void;
  onMovePin: (index: number) => void;
  onCancelPlacement: () => void;
  onRemovePin: (index: number) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Equipment</TableHead>
          <TableHead className="w-24">X</TableHead>
          <TableHead className="w-24">Y</TableHead>
          <TableHead className="w-24">Z</TableHead>
          <TableHead>Label (optional)</TableHead>
          <TableHead className="w-32" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {pins.map((pin, index) => (
          <PinRow
            key={index}
            pin={pin}
            index={index}
            vesselId={vesselId}
            equipmentList={equipmentList}
            knownEquipment={equipmentById.get(pin.equipmentId)}
            equipmentQuery={equipmentQuery}
            isMoveTarget={placement?.mode === "move" && placement.targetIdx === index}
            onUpdatePin={onUpdatePin}
            onMovePin={onMovePin}
            onCancelPlacement={onCancelPlacement}
            onRemovePin={onRemovePin}
          />
        ))}
      </TableBody>
    </Table>
  );
}

function PinRow({
  pin,
  index,
  vesselId,
  equipmentList,
  knownEquipment,
  equipmentQuery,
  isMoveTarget,
  onUpdatePin,
  onMovePin,
  onCancelPlacement,
  onRemovePin,
}: {
  pin: EquipmentPin;
  index: number;
  vesselId: string;
  equipmentList: Equipment[];
  knownEquipment: Equipment | undefined;
  equipmentQuery: ReturnType<typeof useQuery<Equipment[]>>;
  isMoveTarget: boolean;
  onUpdatePin: (index: number, patch: Partial<EquipmentPin>) => void;
  onMovePin: (index: number) => void;
  onCancelPlacement: () => void;
  onRemovePin: (index: number) => void;
}) {
  return (
    <TableRow data-testid={`row-pin-${vesselId}-${index}`}>
      <TableCell>
        {equipmentList.length > 0 ? (
          <Select value={pin.equipmentId || undefined} onValueChange={(v) => onUpdatePin(index, { equipmentId: v })}>
            <SelectTrigger data-testid={`select-pin-equipment-${vesselId}-${index}`}>
              <SelectValue
                placeholder={
                  pin.equipmentId && !knownEquipment
                    ? `${pin.equipmentId} (not on vessel)`
                    : "Select equipment"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {equipmentList.map((equipment) => (
                <SelectItem
                  key={equipment.id}
                  value={equipment.id}
                  data-testid={`option-pin-equipment-${vesselId}-${index}-${equipment.id}`}
                >
                  {equipment.name} ({equipment.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={pin.equipmentId}
            onChange={(e) => onUpdatePin(index, { equipmentId: e.target.value })}
            placeholder={
              equipmentQuery.isLoading
                ? "Loading equipment…"
                : equipmentQuery.isError
                  ? "Equipment list unavailable — enter ID"
                  : "eq_…"
            }
            data-testid={`input-pin-equipment-${vesselId}-${index}`}
          />
        )}
      </TableCell>
      {(["x", "y", "z"] as const).map((axis) => (
        <TableCell key={axis}>
          <Input
            type="number"
            step="0.01"
            value={pin[axis]}
            onChange={(e) =>
              onUpdatePin(index, { [axis]: Number(e.target.value) } as Partial<EquipmentPin>)
            }
            data-testid={`input-pin-${axis}-${vesselId}-${index}`}
          />
        </TableCell>
      ))}
      <TableCell>
        <Input
          value={pin.label ?? ""}
          onChange={(e) => onUpdatePin(index, { label: e.target.value })}
          placeholder="(optional)"
          data-testid={`input-pin-label-${vesselId}-${index}`}
        />
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant={isMoveTarget ? "default" : "ghost"}
            onClick={() => (isMoveTarget ? onCancelPlacement() : onMovePin(index))}
            data-testid={`button-place-pin-${vesselId}-${index}`}
            aria-label={isMoveTarget ? "Cancel placement" : "Move pin via 3D click"}
            title={isMoveTarget ? "Cancel placement" : "Click here, then click on the 3D model"}
          >
            <Crosshair className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onRemovePin(index)}
            data-testid={`button-remove-pin-${vesselId}-${index}`}
            aria-label="Remove pin"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
