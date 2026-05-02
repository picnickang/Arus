import { useMemo, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  const [workPerformed, setWorkPerformed] = useState("");
  const [causeFound, setCauseFound] = useState("");
  const [partsUsed, setPartsUsed] = useState("");
  const [laborHours, setLaborHours] = useState("");
  const [downtimeHours, setDowntimeHours] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [checklistVerified, setChecklistVerified] = useState(false);
  const [supervisorVerified, setSupervisorVerified] = useState(false);
  const [predictionFeedback, setPredictionFeedback] = useState<CloseoutPredictionFeedback | undefined>();

  const canSubmit = useMemo(() => {
    if (!workPerformed.trim() || !causeFound.trim() || !evidenceNote.trim()) {
      return false;
    }
    if (!checklistVerified || !supervisorVerified) {
      return false;
    }
    if (isPredictive && !predictionFeedback) {
      return false;
    }
    return true;
  }, [workPerformed, causeFound, evidenceNote, checklistVerified, supervisorVerified, isPredictive, predictionFeedback]);

  const toNumberOrNull = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && value.trim() !== "" ? parsed : null;
  };

  const handleComplete = () => {
    const closeout = {
      workPerformed: workPerformed.trim(),
      causeFound: causeFound.trim(),
      partsUsed: partsUsed.trim(),
      laborHours: toNumberOrNull(laborHours),
      downtimeHours: toNumberOrNull(downtimeHours),
      evidenceNote: evidenceNote.trim(),
      checklistVerified,
      supervisorVerified,
    };

    onComplete({
      ...(predictionFeedback || { workOrderId, outcome: "confirmed" as const }),
      workOrderId,
      closeout,
      notes: [predictionFeedback?.notes, `Closeout: ${closeout.workPerformed}`, `Cause: ${closeout.causeFound}`, closeout.partsUsed ? `Parts: ${closeout.partsUsed}` : "", `Evidence: ${closeout.evidenceNote}`]
        .filter(Boolean)
        .join("\n"),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Close work order
          </DialogTitle>
          <DialogDescription>
            Capture evidence, cause, parts, labour, downtime, verification, and PdM feedback before closing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label>Work performed</Label>
              <Textarea value={workPerformed} onChange={(event) => setWorkPerformed(event.target.value)} placeholder="Summarize the actual work completed..." />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Cause found</Label>
              <Textarea value={causeFound} onChange={(event) => setCauseFound(event.target.value)} placeholder="Root cause, defect found, or no-fault-found result..." />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Parts used</Label>
              <Textarea value={partsUsed} onChange={(event) => setPartsUsed(event.target.value)} placeholder="Parts used, quantities, or 'none'..." />
            </div>
            <div className="space-y-2">
              <Label>Labour hours</Label>
              <Input type="number" min="0" step="0.25" value={laborHours} onChange={(event) => setLaborHours(event.target.value)} placeholder="0.0" />
            </div>
            <div className="space-y-2">
              <Label>Downtime hours</Label>
              <Input type="number" min="0" step="0.25" value={downtimeHours} onChange={(event) => setDowntimeHours(event.target.value)} placeholder="0.0" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Evidence / photo note</Label>
              <Textarea value={evidenceNote} onChange={(event) => setEvidenceNote(event.target.value)} placeholder="Photos attached, readings after repair, test run result, or evidence reference..." />
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-start gap-2">
              <Checkbox checked={checklistVerified} onCheckedChange={(checked) => setChecklistVerified(Boolean(checked))} id="closeout-checklist" />
              <Label htmlFor="closeout-checklist" className="text-sm font-normal">
                Checklist/tasks verified complete or intentionally not applicable.
              </Label>
            </div>
            <div className="flex items-start gap-2">
              <Checkbox checked={supervisorVerified} onCheckedChange={(checked) => setSupervisorVerified(Boolean(checked))} id="closeout-supervisor" />
              <Label htmlFor="closeout-supervisor" className="text-sm font-normal">
                Supervisor/chief engineer verification completed.
              </Label>
            </div>
          </div>

          {isPredictive && (
            <div className="rounded-lg border p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="h-4 w-4 text-primary" />
                PdM learning feedback
              </div>
              <PredictionFeedbackForm workOrderId={workOrderId} onChange={(feedback) => setPredictionFeedback(feedback as CloseoutPredictionFeedback | undefined)} />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleComplete} disabled={!canSubmit || isSubmitting}>
            <CheckCircle2 className="h-4 w-4" />
            {isSubmitting ? "Closing..." : "Complete closeout"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default WorkOrderCloseoutWizard;
