import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import {
  useRetireCrew,
  useCancelContract,
  useReinstateCrew,
  useDeleteFormerCrew,
} from "@/features/crew";

export type LifecycleAction = "retire" | "cancel" | "reinstate" | "delete";

interface LifecycleDialogState {
  action: LifecycleAction;
  crewId: string;
  crewName: string;
}

const TITLES: Record<LifecycleAction, string> = {
  retire: "Retire Crew Member",
  cancel: "Cancel Contract",
  reinstate: "Reinstate Crew Member",
  delete: "Delete Former Crew Record",
};

const describe = (action: LifecycleAction, name: string) => {
  switch (action) {
    case "retire":
      return `${name} will be moved to the former crew roster.`;
    case "cancel":
      return `${name}'s contract will be terminated and they will be moved to the former crew roster.`;
    case "reinstate":
      return `${name} will be restored to the active crew roster.`;
    case "delete":
      return `This will permanently delete ${name}'s record. This action cannot be undone.`;
  }
};

export function useLifecycleDialog() {
  const [state, setState] = useState<LifecycleDialogState | null>(null);
  return {
    state,
    open: (action: LifecycleAction, crewId: string, crewName: string) =>
      setState({ action, crewId, crewName }),
    close: () => setState(null),
  };
}

export function LifecycleDialog({
  state,
  onClose,
}: {
  state: LifecycleDialogState | null;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [applyPenalty, setApplyPenalty] = useState(false);

  const retireMutation = useRetireCrew();
  const cancelMutation = useCancelContract();
  const reinstateMutation = useReinstateCrew();
  const deleteMutation = useDeleteFormerCrew();

  const isPending =
    retireMutation.isPending ||
    cancelMutation.isPending ||
    reinstateMutation.isPending ||
    deleteMutation.isPending;

  const reset = () => {
    setNotes("");
    setApplyPenalty(false);
    onClose();
  };

  const handleAction = () => {
    if (!state) {
      return;
    }
    const { action, crewId } = state;
    const onSuccess = reset;
    switch (action) {
      case "retire":
        retireMutation.mutate({ crewId, notes: notes || undefined }, { onSuccess });
        break;
      case "cancel":
        cancelMutation.mutate(
          { crewId, notes: notes || undefined, applyPenalty },
          { onSuccess }
        );
        break;
      case "reinstate":
        reinstateMutation.mutate({ crewId, notes: notes || undefined }, { onSuccess });
        break;
      case "delete":
        deleteMutation.mutate(crewId, { onSuccess });
        break;
    }
  };

  return (
    <ResponsiveDialog
      open={!!state}
      onOpenChange={(open) => {
        if (!open) {
          reset();
        }
      }}
      title={state ? TITLES[state.action] : ""}
      description={state ? describe(state.action, state.crewName) : ""}
      footer={
        <div className="flex gap-2 w-full">
          <Button type="button" variant="outline" onClick={reset} className="flex-1">
            Cancel
          </Button>
          <Button
            type="button"
            variant={
              state?.action === "delete" || state?.action === "cancel" ? "destructive" : "default"
            }
            onClick={handleAction}
            disabled={isPending}
            className="flex-1"
            data-testid="button-confirm-lifecycle"
          >
            {isPending
              ? "Processing..."
              : state?.action === "delete"
                ? "Delete Permanently"
                : "Confirm"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {state?.action !== "delete" && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Notes (optional)</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this action..."
              data-testid="input-lifecycle-notes"
            />
          </div>
        )}
        {state?.action === "cancel" && (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="applyPenalty"
              checked={applyPenalty}
              onCheckedChange={(checked) => setApplyPenalty(checked === true)}
              data-testid="checkbox-apply-penalty"
            />
            <label
              htmlFor="applyPenalty"
              className="text-sm font-medium leading-none cursor-pointer"
            >
              Apply contract penalty (if configured)
            </label>
          </div>
        )}
        {state?.action === "delete" && (
          <div className="bg-destructive/10 p-3 rounded-md">
            <p className="text-sm text-destructive">
              This action is permanent and cannot be undone. All employment history for this crew
              member will also be deleted.
            </p>
          </div>
        )}
      </div>
    </ResponsiveDialog>
  );
}
