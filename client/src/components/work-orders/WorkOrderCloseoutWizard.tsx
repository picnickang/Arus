import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, ClipboardCheck, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useDiscardGuard, DiscardConfirmDialog } from "@/hooks/useDiscardGuard";
import {
  makeCloseoutSchema,
  parseCloseout,
  CLOSEOUT_DEFAULTS,
  type CloseoutFormValues,
} from "@/features/work-orders/lib/closeoutSchema";
import { PredictionFeedbackForm } from "./PredictionFeedbackForm";

export interface CloseoutPredictionFeedback {
  workOrderId: string;
  predictionId?: string | number | null;
  outcome: "confirmed" | "partial" | "false_alarm";
  notes?: string;
  closeout?: {
    workPerformed: string;
    causeFound: string;
    partsUsed: string;
    laborHours: number | null;
    downtimeHours: number | null;
    evidenceNote: string;
    checklistVerified: boolean;
    supervisorVerified: boolean;
  };
}

interface WorkOrderCloseoutWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workOrderId: string;
  isPredictive: boolean;
  isSubmitting?: boolean;
  onComplete: (feedback?: CloseoutPredictionFeedback) => void;
}

export function WorkOrderCloseoutWizard({
  open,
  onOpenChange,
  workOrderId,
  isPredictive,
  isSubmitting = false,
  onComplete,
}: WorkOrderCloseoutWizardProps) {
  const [predictionFeedback, setPredictionFeedback] = useState<
    CloseoutPredictionFeedback | undefined
  >();

  const schema = useMemo(() => makeCloseoutSchema(isPredictive), [isPredictive]);
  const form = useForm<CloseoutFormValues, unknown, CloseoutFormValues>({
    resolver: zodResolver(schema),
    defaultValues: CLOSEOUT_DEFAULTS,
  });

  useEffect(() => {
    if (open) {
      form.reset(CLOSEOUT_DEFAULTS);
      setPredictionFeedback(undefined);
    }
  }, [open, form]);

  const guard = useDiscardGuard({ isDirty: form.formState.isDirty, onOpenChange });

  function onSubmit(values: CloseoutFormValues) {
    const closeout = parseCloseout(values);

    onComplete({
      ...(predictionFeedback || { workOrderId, outcome: "confirmed" as const }),
      workOrderId,
      closeout,
      notes: [
        predictionFeedback?.notes,
        `Closeout: ${closeout.workPerformed}`,
        `Cause: ${closeout.causeFound}`,
        closeout.partsUsed ? `Parts: ${closeout.partsUsed}` : "",
        `Evidence: ${closeout.evidenceNote}`,
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }

  return (
    <Dialog open={open} onOpenChange={guard.handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Close work order
          </DialogTitle>
          <DialogDescription>
            Capture evidence, cause, parts, labour, downtime, verification, and PdM feedback before
            closing.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="workPerformed"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel required>Work performed</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Summarize the actual work completed..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="causeFound"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel required>Cause found</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Root cause, defect found, or no-fault-found result..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="partsUsed"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Parts used</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Parts used, quantities, or 'none'..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="laborHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Labour hours</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.25" placeholder="0.0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="downtimeHours"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Downtime hours</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" step="0.25" placeholder="0.0" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="evidenceNote"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel required>Evidence / photo note</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Photos attached, readings after repair, test run result, or evidence reference..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <FormField
                control={form.control}
                name="checklistVerified"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-start gap-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                        />
                      </FormControl>
                      <FormLabel required className="text-sm font-normal">
                        Checklist/tasks verified complete or intentionally not applicable.
                      </FormLabel>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="supervisorVerified"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-start gap-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) => field.onChange(Boolean(checked))}
                        />
                      </FormControl>
                      <FormLabel required className="text-sm font-normal">
                        Supervisor/chief engineer verification completed.
                      </FormLabel>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {isPredictive && (
              <div className="rounded-lg border p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  PdM learning feedback
                </div>
                <PredictionFeedbackForm
                  workOrderId={workOrderId}
                  onChange={(feedback) => {
                    setPredictionFeedback(feedback as CloseoutPredictionFeedback | undefined);
                    form.setValue("hasPredictionFeedback", Boolean(feedback), {
                      shouldValidate: form.formState.isSubmitted,
                    });
                  }}
                />
                {form.formState.errors.hasPredictionFeedback && (
                  <p className="mt-2 text-sm font-medium text-destructive">
                    {form.formState.errors.hasPredictionFeedback.message}
                  </p>
                )}
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => guard.handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                <CheckCircle2 className="h-4 w-4" />
                {isSubmitting ? "Closing..." : "Complete closeout"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
      <DiscardConfirmDialog
        open={guard.confirmOpen}
        onConfirm={guard.onConfirm}
        onCancel={guard.onCancel}
      />
    </Dialog>
  );
}
