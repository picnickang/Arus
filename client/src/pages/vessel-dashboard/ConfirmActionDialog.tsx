import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { VesselEquipment } from "@/features/vessels/types";
import type { Part } from "@/features/inventory/types";

export interface ConfirmAction {
  type: "equip" | "swap" | "uninstall";
  part?: Part;
  equipment?: VesselEquipment;
  slotLabel: string;
}

export function ConfirmActionDialog({
  action,
  isPending,
  onCancel,
  onConfirm,
}: {
  action: ConfirmAction | null;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={!!action} onOpenChange={onCancel}>
      <DialogContent className="bg-[#0f1729] border-slate-700/30 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-slate-100">
            {action?.type === "uninstall" && `Uninstall — ${action.equipment?.name}`}
            {action?.type === "swap" && `Swap Equipment — ${action.slotLabel}`}
            {action?.type === "equip" && `Install Equipment — ${action.slotLabel}`}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {action?.type === "uninstall" &&
              `Remove ${action.equipment?.name} from the ${action.slotLabel} slot? A work order should be created for this removal.`}
            {action?.type === "swap" &&
              `Remove ${action.equipment?.name} and install ${action.part?.name} in the ${action.slotLabel} slot?`}
            {action?.type === "equip" &&
              `Install ${action.part?.name} into the ${action.slotLabel} slot?`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onCancel}
            className="border-slate-700/30 text-slate-300"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            variant={action?.type === "uninstall" ? "destructive" : "default"}
            disabled={isPending}
            className={action?.type !== "uninstall" ? "bg-sky-600 hover:bg-sky-700" : ""}
          >
            {isPending
              ? "Processing..."
              : action?.type === "uninstall"
                ? "Remove Equipment"
                : "Install Equipment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
