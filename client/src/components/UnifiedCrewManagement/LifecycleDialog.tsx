import { useState } from "react";
import type { Control } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import {
  OFFBOARD_REASONS,
  composeOffboardingNote,
  previewRehireFromAction,
} from "@/features/crew/lib/crewManagementUtils";
import {
  useLifecycleForm,
  type LifecycleDialogState,
} from "@/features/crew/hooks/useLifecycleForm";
import type { LifecycleOffboardFormData } from "@/features/crew/lib/lifecycleSchema";

export type LifecycleAction = "retire" | "cancel" | "reinstate" | "delete";

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
      contractPenalty?: number
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

type OffboardBooleanField =
  | "handoverDocs"
  | "returnPpe"
  | "finalPayroll"
  | "disableLogin"
  | "removeVesselAccess"
  | "removeDashboardAccess"
  | "removeAdditionalRoles"
  | "downgradePrimaryRole"
  | "endDutyStatus";

/** One checklist / safe-offboarding toggle, RHF-bound, testid kept on the Checkbox. */
function OffboardCheckboxField({
  control,
  name,
  label,
  testId,
}: {
  control: Control<LifecycleOffboardFormData>;
  name: OffboardBooleanField;
  label: string;
  testId: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex items-center space-x-2 space-y-0">
          <FormControl>
            <Checkbox
              checked={field.value}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              data-testid={testId}
            />
          </FormControl>
          <FormLabel className="!mt-0 cursor-pointer text-sm font-normal">{label}</FormLabel>
        </FormItem>
      )}
    />
  );
}

export function LifecycleDialog({
  state,
  onClose,
}: {
  state: LifecycleDialogState | null;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [confirmDeleteText, setConfirmDeleteText] = useState("");

  const { form, isPending, submitOffboard, reinstateMutation, deleteMutation } =
    useLifecycleForm(state);

  // Form values reset on the next open (useLifecycleForm); only the non-form
  // fields need clearing here.
  const reset = () => {
    setNotes("");
    setConfirmDeleteText("");
    onClose();
  };

  // Builds the structured exit summary saved as the lifecycle note so all the
  // offboarding context (final vessel, end date, reason, checklist, exit notes)
  // is preserved without a new backend field.
  const onSubmitOffboard = (values: LifecycleOffboardFormData) =>
    submitOffboard(
      values,
      composeOffboardingNote({
        reason: values.reason,
        endDate: values.endDate,
        vesselName: state?.vesselName,
        handoverDocs: values.handoverDocs,
        returnPpe: values.returnPpe,
        finalPayroll: values.finalPayroll,
        exitNotes: values.exitNotes,
      }),
      reset
    );

  // Reinstate and the typed-confirm delete keep their pre-RHF handling.
  const handleNonFormAction = () => {
    if (!state) {
      return;
    }
    if (state.action === "reinstate") {
      reinstateMutation.mutate(
        { crewId: state.crewId, notes: notes || undefined },
        { onSuccess: reset }
      );
    } else if (state.action === "delete") {
      deleteMutation.mutate(state.crewId, { onSuccess: reset });
    }
  };

  const isOffboarding = state?.action === "retire" || state?.action === "cancel";
  // Mirror the backend: a cancel persists `applyPenalty ? crew.contractPenalty : null`,
  // so ticking "apply penalty" with no configured penalty still resolves to Review.
  const applyPenalty = form.watch("applyPenalty");
  const removeDashboardAccess = form.watch("removeDashboardAccess");
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
            onClick={isOffboarding ? form.handleSubmit(onSubmitOffboard) : handleNonFormAction}
            disabled={
              isPending || (state?.action === "delete" && confirmDeleteText !== state.crewName)
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
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmitOffboard)} className="space-y-4">
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
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <FormLabel required>End date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-offboard-end-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem className="space-y-1 sm:col-span-2">
                    <FormLabel required>Reason</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger data-testid="select-offboard-reason">
                          <SelectValue placeholder="Select a reason" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {OFFBOARD_REASONS.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
            <FormField
              control={form.control}
              name="applyPenalty"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                      data-testid="checkbox-apply-penalty"
                    />
                  </FormControl>
                  <FormLabel className="!mt-0 cursor-pointer text-sm font-medium leading-none">
                    Apply contract penalty (if configured)
                  </FormLabel>
                </FormItem>
              )}
            />
          )}
          {isOffboarding && (
            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-medium">Offboarding checklist</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <OffboardCheckboxField
                  control={form.control}
                  name="handoverDocs"
                  label="Handed over documents"
                  testId="checkbox-handover-docs"
                />
                <OffboardCheckboxField
                  control={form.control}
                  name="returnPpe"
                  label="Returned PPE / access card"
                  testId="checkbox-return-ppe"
                />
                <OffboardCheckboxField
                  control={form.control}
                  name="finalPayroll"
                  label="Final payroll settled"
                  testId="checkbox-final-payroll"
                />
              </div>
            </div>
          )}
          {isOffboarding && (
            <FormField
              control={form.control}
              name="exitNotes"
              render={({ field }) => (
                <FormItem className="space-y-1">
                  <FormLabel>Exit notes</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Handover summary, outstanding items, exit-interview notes..."
                      data-testid="input-offboard-exit-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          {isOffboarding && (
            <div className="space-y-3 rounded-md border p-3">
              <p className="text-sm font-medium">Safe offboarding actions</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <OffboardCheckboxField
                  control={form.control}
                  name="disableLogin"
                  label="Disable linked login"
                  testId="checkbox-disable-login"
                />
                <OffboardCheckboxField
                  control={form.control}
                  name="removeVesselAccess"
                  label="Remove vessel access"
                  testId="checkbox-remove-vessel-access"
                />
                <OffboardCheckboxField
                  control={form.control}
                  name="removeDashboardAccess"
                  label="Remove dashboard/admin access"
                  testId="checkbox-remove-dashboard-access"
                />
                <OffboardCheckboxField
                  control={form.control}
                  name="removeAdditionalRoles"
                  label="Remove additional roles"
                  testId="checkbox-remove-additional-roles"
                />
                <OffboardCheckboxField
                  control={form.control}
                  name="downgradePrimaryRole"
                  label="Downgrade primary role to viewer"
                  testId="checkbox-downgrade-primary-role"
                />
                <OffboardCheckboxField
                  control={form.control}
                  name="endDutyStatus"
                  label="End duty status"
                  testId="checkbox-end-duty-status"
                />
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
        </form>
      </Form>
    </ResponsiveDialog>
  );
}
