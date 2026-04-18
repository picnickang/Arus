import { Equipment } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCw, CheckCircle } from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EquipmentReinstateDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment | null;
  onSuccess: () => void;
}

export function EquipmentReinstateDialog({
  isOpen,
  onOpenChange,
  equipment,
  onSuccess,
}: EquipmentReinstateDialogProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState("");

  const reinstateMutation = useMutation({
    mutationFn: async (data: { notes: string }) => {
      return apiRequest("POST", `/api/equipment/${equipment?.id}/reinstate`, data);
    },
    onSuccess: () => {
      toast({
        title: "Equipment Reinstated",
        description: `${equipment?.name} has been successfully reinstated to active service.`,
      });
      setNotes("");
      onOpenChange(false);
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reinstate equipment.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!equipment) return;
    reinstateMutation.mutate({ notes });
  };

  const handleClose = () => {
    setNotes("");
    onOpenChange(false);
  };

  if (!equipment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-green-600" />
            Reinstate Equipment
          </DialogTitle>
          <DialogDescription>
            This will restore {equipment.name} to active service. The equipment will be moved back
            to the active roster.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3 p-3 rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-green-800 dark:text-green-200">
              <p className="font-medium">Reinstatement</p>
              <p>This equipment was previously decommissioned. Reinstating will return it to active operations.</p>
            </div>
          </div>

          <div className="bg-muted/50 rounded-md p-4 space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Equipment:</span>{" "}
              <span className="font-medium">{equipment.name}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Type:</span>{" "}
              <span className="font-medium">{equipment.type}</span>
            </div>
            {equipment.decommissionedAt && (
              <div>
                <span className="text-muted-foreground">Previous Decommission Reason:</span>{" "}
                <span className="font-medium">{equipment.decommissionedAt}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Reinstatement Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Enter any notes about why this equipment is being reinstated..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[100px]"
              data-testid="input-reinstate-notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel-reinstate">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={reinstateMutation.isPending}
            className="bg-green-600 hover:bg-green-700 text-white"
            data-testid="button-confirm-reinstate"
          >
            {reinstateMutation.isPending ? "Reinstating..." : "Reinstate Equipment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
