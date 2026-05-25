import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { MoveHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PdmScheduledTask } from "@/features/pdm";

interface MoveTaskDialogProps {
  task: PdmScheduledTask | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newDate: Date, isOverride: boolean) => void;
}

export function MoveTaskDialog({ task, isOpen, onClose, onConfirm }: MoveTaskDialogProps) {
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [isOverride, setIsOverride] = useState(false);

  useEffect(() => {
    if (task && isOpen) {
      const preferredDate =
        typeof task.schedulingWindow.preferredDate === "string"
          ? task.schedulingWindow.preferredDate
          : task.schedulingWindow.preferredDate.toISOString().split("T")[0];
      setSelectedDate(preferredDate ?? "");
      setIsOverride(false);
    }
  }, [task, isOpen]);

  if (!task) {
    return null;
  }

  const earliestStart =
    typeof task.schedulingWindow.earliestStart === "string"
      ? parseISO(task.schedulingWindow.earliestStart)
      : task.schedulingWindow.earliestStart;
  const latestFinish =
    typeof task.schedulingWindow.latestFinish === "string"
      ? parseISO(task.schedulingWindow.latestFinish)
      : task.schedulingWindow.latestFinish;

  const handleDateChange = (dateStr: string) => {
    setSelectedDate(dateStr);
    const date = parseISO(dateStr);
    const needsOverride = date < earliestStart || date > latestFinish;
    setIsOverride(needsOverride);
  };

  const handleConfirm = () => {
    onConfirm(parseISO(selectedDate), isOverride);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MoveHorizontal className="h-5 w-5" />
            Move Task
          </DialogTitle>
          <DialogDescription>
            {task.equipmentName} - {task.failureMode}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Allowed Window:</span>
            </div>
            <div className="flex justify-between">
              <span>Earliest:</span>
              <span>{format(earliestStart, "MMM d, yyyy")}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>Latest:</span>
              <span>{format(latestFinish, "MMM d, yyyy")}</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">New Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full p-2 border rounded-md bg-background"
              data-testid="input-move-date"
            />
          </div>

          {isOverride && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Selected date is outside the recommended window. This will be marked as an override.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} data-testid="btn-confirm-move">
            {isOverride ? "Move with Override" : "Move Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
