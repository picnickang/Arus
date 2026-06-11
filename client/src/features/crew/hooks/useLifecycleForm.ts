import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useRetireCrew,
  useCancelContract,
  useReinstateCrew,
  useDeleteFormerCrew,
} from "./useCrewLifecycle";
import {
  lifecycleOffboardSchema,
  createDefaultLifecycleOffboardValues,
  type LifecycleOffboardFormData,
} from "../lib/lifecycleSchema";

export interface LifecycleDialogState {
  action: "retire" | "cancel" | "reinstate" | "delete";
  crewId: string;
  crewName: string;
  vesselName?: string;
  contractPenalty?: number;
}

/**
 * Form wiring for the lifecycle dialog's offboarding (retire / cancel) flows:
 * the zod-validated RHF form, reset-on-open, and a submit path that sends the
 * exact payloads the dialog sent before the RHF migration. Reinstate and the
 * typed-confirm delete keep their existing non-form handling in the dialog.
 */
export function useLifecycleForm(state: LifecycleDialogState | null) {
  const form = useForm<LifecycleOffboardFormData, unknown, LifecycleOffboardFormData>({
    resolver: zodResolver(lifecycleOffboardSchema),
    defaultValues: createDefaultLifecycleOffboardValues(),
    mode: "onSubmit",
  });

  const open = state !== null;
  const crewId = state?.crewId;
  const action = state?.action;

  // Reset on every (re)open so a previous offboarding never leaks into a new one.
  useEffect(() => {
    if (open) {
      form.reset(createDefaultLifecycleOffboardValues());
    }
  }, [open, crewId, action, form]);

  const retireMutation = useRetireCrew();
  const cancelMutation = useCancelContract();
  const reinstateMutation = useReinstateCrew();
  const deleteMutation = useDeleteFormerCrew();

  const isPending =
    retireMutation.isPending ||
    cancelMutation.isPending ||
    reinstateMutation.isPending ||
    deleteMutation.isPending;

  /**
   * Retire / cancel submit. `notes` is the structured exit summary the dialog
   * composes (composeOffboardingNote) — payloads are exactly pre-RHF.
   */
  const submitOffboard = (
    values: LifecycleOffboardFormData,
    notes: string | undefined,
    onSuccess: () => void
  ) => {
    if (!state) {
      return;
    }
    const common = {
      crewId: state.crewId,
      notes,
      disableLogin: values.disableLogin,
      removeVesselAccess: values.removeVesselAccess,
      removeDashboardAccess: values.removeDashboardAccess,
      removeAdditionalRoles: values.removeAdditionalRoles,
      downgradePrimaryRole: values.downgradePrimaryRole,
      endDutyStatus: values.endDutyStatus,
      preserveRecords: true,
    };
    if (state.action === "retire") {
      retireMutation.mutate(common, { onSuccess });
    } else if (state.action === "cancel") {
      cancelMutation.mutate({ ...common, applyPenalty: values.applyPenalty }, { onSuccess });
    }
  };

  return { form, isPending, submitOffboard, reinstateMutation, deleteMutation };
}
