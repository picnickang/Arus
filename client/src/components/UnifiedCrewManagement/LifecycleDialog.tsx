import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import {
  useRetireCrew,
  useCancelContract,
  useReinstateCrew,
  useDeleteFormerCrew,
} from "@/features/crew";
import {
  OFFBOARD_REASONS,
  composeOffboardingNote,
  previewRehireFromAction,
} from "@/features/crew/lib/crewManagementUtils";

export type LifecycleAction = "retire" | "cancel" | "reinstate" | "delete";

interface LifecycleDialogState {
  action: LifecycleAction;
  crewId: string;
  crewName: string;
  vesselName?: string;
  contractPenalty?: number;
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

// Mirrors deriveRehireStatus (crewManagementUtils) but works from the operator's
// in-dialog choices so they see the rehire signal BEFORE confirming:
//   retire                          -> Rehire OK
//   cancel WITH contract penalty    -> No rehire
//   cancel (no penalty)             -> Review
const REHIRE_BADGE_CLASS: Record<string, string> = {
  rehire_ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  no_rehire: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  review: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

export function useLifecycleDialog() {
  const [state, setState] = useState<LifecycleDialogState | null>(null);
  return {
    state,
    open: (
      action: LifecycleAction,
      crewId: string,
      crewName: string,
      vesselName?: string,
      contractPenalty?: number,
    ) =>
      setState({
        action,
        crewId,
        crewName,
        ...(vesselName != null && { vesselName }),
        ...(contractPenalty != null && { contractPenalty }),
      }),
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
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [exitNotes, setExitNotes] = useState("");
  const [handoverDocs, setHandoverDocs] = useState(false);
  const [returnPpe, setReturnPpe] = useState(false);
  const [finalPayroll, setFinalPayroll] = useState(false);
  const [applyPenalty, setApplyPenalty] = useState(false);
  const [disableLogin, setDisableLogin] = useState(true);
  const [removeVesselAccess, setRemoveVesselAccess] = useState(true);
  const [removeDashboardAccess, setRemoveDashboardAccess] = useState(true);
  const [removeAdditionalRoles, setRemoveAdditionalRoles] = useState(true);
  const [downgradePrimaryRole, setDowngradePrimaryRole] = useState(true);
  const [endDutyStatus, setEndDutyStatus] = useState(true);
  const [confirmDeleteText, setConfirmDeleteText] = useState("");

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
    setEndDate("");
    setReason("");
    setExitNotes("");
    setHandoverDocs(false);
    setReturnPpe(false);
    setFinalPayroll(false);
    setApplyPenalty(false);
    setDisableLogin(true);
    setRemoveVesselAccess(true);
    setRemoveDashboardAccess(true);
    setRemoveAdditionalRoles(true);
    setDowngradePrimaryRole(true);
    setEndDutyStatus(true);
    setConfirmDeleteText("");
    onClose();
  };

  // Builds the structured exit summary saved as the lifecycle note so all the
  // offboarding context (final vessel, end date, reason, checklist, exit notes)
  // is preserved without a new backend field.
  const composeOffboardingNotes = (): string | undefined =>
    composeOffboardingNote({
      reason,
      endDate,
      vesselName: state?.vesselName,
      handoverDocs,
      returnPpe,
      finalPayroll,
      exitNotes,
    });

  const handleAction = () => {
    if (!state) {
      return;
    }
    const { action, crewId } = state;
    const onSuccess = reset;
    switch (action) {
      case "retire":
        retireMutation.mutate(
          {
            crewId,
            notes: composeOffboardingNotes(),
            disableLogin,
            removeVesselAccess,
            removeDashboardAccess,
            removeAdditionalRoles,
            downgradePrimaryRole,
            endDutyStatus,
            preserveRecords: true,
          },
          { onSuccess },
        );
        break;
      case "cancel":
        cancelMutation.mutate(
          {
            crewId,
            notes: composeOffboardingNotes(),
            applyPenalty,
            disableLogin,
            removeVesselAccess,
            removeDashboardAccess,
            removeAdditionalRoles,
            downgradePrimaryRole,
            endDutyStatus,
            preserveRecords: true,
          },
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

  const isOffboarding = state?.action === "retire" || state?.action === "cancel";
  // Mirror the backend: a cancel persists `applyPenalty ? crew.contractPenalty : null`,
  // so ticking "apply penalty" with no configured penalty still resolves to Review.
  const effectivePenalty = applyPenalty ? (state?.contractPenalty ?? 0) : 0;
  const rehire = state ? previewRehireFromAction(state.action, effectivePenalty) : null;

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
            disabled={
              isPending ||
              (state?.action === "delete" && confirmDeleteText !== state.crewName)
            }
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
        {isOffboarding && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Final vessel</label>
              <Input
                value={state?.vesselName || "Unassigned"}
                readOnly
                className="bg-muted/40"
                data-testid="text-offboard-vessel"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" htmlFor="offboard-end-date">
                End date
              </label>
              <Input
                id="offboard-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-offboard-end-date"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-sm font-medium">Reason</label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger data-testid="select-offboard-reason">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent>
                  {OFFBOARD_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        {state?.action === "reinstate" && (
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
        {isOffboarding && (
          <div className="space-y-3 rounded-md border p-3">
            <p className="text-sm font-medium">Offboarding checklist</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center space-x-2 text-sm">
                <Checkbox
                  checked={handoverDocs}
                  onCheckedChange={(checked) => setHandoverDocs(checked === true)}
                  data-testid="checkbox-handover-docs"
                />
                <span>Handed over documents</span>
              </label>
              <label className="flex items-center space-x-2 text-sm">
                <Checkbox
                  checked={returnPpe}
                  onCheckedChange={(checked) => setReturnPpe(checked === true)}
                  data-testid="checkbox-return-ppe"
                />
                <span>Returned PPE / access card</span>
              </label>
              <label className="flex items-center space-x-2 text-sm">
                <Checkbox
                  checked={finalPayroll}
                  onCheckedChange={(checked) => setFinalPayroll(checked === true)}
                  data-testid="checkbox-final-payroll"
                />
                <span>Final payroll settled</span>
              </label>
            </div>
          </div>
        )}
        {isOffboarding && (
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="offboard-exit-notes">
              Exit notes
            </label>
            <Textarea
              id="offboard-exit-notes"
              value={exitNotes}
              onChange={(e) => setExitNotes(e.target.value)}
              placeholder="Handover summary, outstanding items, exit-interview notes..."
              data-testid="input-offboard-exit-notes"
            />
          </div>
        )}
        {isOffboarding && (
          <div className="space-y-3 rounded-md border p-3">
            <p className="text-sm font-medium">Safe offboarding actions</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center space-x-2 text-sm">
                <Checkbox
                  checked={disableLogin}
                  onCheckedChange={(checked) => setDisableLogin(checked === true)}
                  data-testid="checkbox-disable-login"
                />
                <span>Disable linked login</span>
              </label>
              <label className="flex items-center space-x-2 text-sm">
                <Checkbox
                  checked={removeVesselAccess}
                  onCheckedChange={(checked) => setRemoveVesselAccess(checked === true)}
                  data-testid="checkbox-remove-vessel-access"
                />
                <span>Remove vessel access</span>
              </label>
              <label className="flex items-center space-x-2 text-sm">
                <Checkbox
                  checked={removeDashboardAccess}
                  onCheckedChange={(checked) => setRemoveDashboardAccess(checked === true)}
                  data-testid="checkbox-remove-dashboard-access"
                />
                <span>Remove dashboard/admin access</span>
              </label>
              <label className="flex items-center space-x-2 text-sm">
                <Checkbox
                  checked={removeAdditionalRoles}
                  onCheckedChange={(checked) => setRemoveAdditionalRoles(checked === true)}
                  data-testid="checkbox-remove-additional-roles"
                />
                <span>Remove additional roles</span>
              </label>
              <label className="flex items-center space-x-2 text-sm">
                <Checkbox
                  checked={downgradePrimaryRole}
                  onCheckedChange={(checked) => setDowngradePrimaryRole(checked === true)}
                  data-testid="checkbox-downgrade-primary-role"
                />
                <span>Downgrade primary role to viewer</span>
              </label>
              <label className="flex items-center space-x-2 text-sm">
                <Checkbox
                  checked={endDutyStatus}
                  onCheckedChange={(checked) => setEndDutyStatus(checked === true)}
                  data-testid="checkbox-end-duty-status"
                />
                <span>End duty status</span>
              </label>
              <label className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Checkbox checked disabled data-testid="checkbox-preserve-records" />
                <span>Preserve profile, history, documents, and alerts</span>
              </label>
            </div>
          </div>
        )}
        {isOffboarding && (
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
            <div className="text-sm">
              <p className="font-medium">Rehire eligibility</p>
              <p className="text-xs text-muted-foreground">
                Derived from this action and any contract penalty.
              </p>
            </div>
            {rehire && (
              <Badge
                className={REHIRE_BADGE_CLASS[rehire.key]}
                data-testid="badge-rehire-eligibility"
              >
                {rehire.label}
              </Badge>
            )}
          </div>
        )}
        {isOffboarding && removeDashboardAccess && (
          <p
            className="text-xs text-amber-700 dark:text-amber-400"
            data-testid="text-offboard-warning"
          >
            This removes dashboard and admin access for this crew member.
          </p>
        )}
        {state?.action === "reinstate" && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            Reinstatement restores roster status only. Login, vessel scope, and admin access stay
            disabled until explicitly re-enabled.
          </div>
        )}
        {state?.action === "delete" && (
          <div className="space-y-3 bg-destructive/10 p-3 rounded-md">
            <p className="text-sm text-destructive">
              This action is permanent and cannot be undone. All employment history for this crew
              member will also be deleted.
            </p>
            <div className="space-y-1">
              <label className="text-sm font-medium">
                Type {state.crewName} to permanently delete
              </label>
              <Input
                value={confirmDeleteText}
                onChange={(event) => setConfirmDeleteText(event.target.value)}
                data-testid="input-confirm-delete-crew"
              />
            </div>
          </div>
        )}
      </div>
    </ResponsiveDialog>
  );
}
