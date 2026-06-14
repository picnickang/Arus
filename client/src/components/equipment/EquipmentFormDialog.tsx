import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Equipment, InsertEquipment, Vessel } from "@shared/schema";
import { useEquipmentForm, useEquipmentEditForm } from "@/hooks/useEquipmentForm";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { equipmentKeys } from "@/utils/queryKeys";
import { EquipmentFormFields } from "./EquipmentFormFields";

type FormMode = "create" | "edit";

interface EquipmentFormDialogProps {
  mode: FormMode;
  open?: boolean;
  isOpen?: boolean;
  onOpenChange: (open: boolean) => void;
  vessels: Vessel[];
  equipment?: Equipment | null;
  onSubmit?: (data: InsertEquipment | Partial<InsertEquipment>, id?: string) => void;
  onSuccess?: () => void;
  isPending?: boolean;
  onClose?: () => void;
}

export function EquipmentFormDialog({
  mode,
  open,
  isOpen,
  onOpenChange,
  vessels,
  equipment,
  onSubmit,
  onSuccess,
  isPending: externalPending,
  onClose,
}: EquipmentFormDialogProps) {
  const createForm = useEquipmentForm();
  const editForm = useEquipmentEditForm(equipment);
  const form = mode === "create" ? createForm : editForm;

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const dialogOpen = open ?? isOpen ?? false;

  const createMutation = useMutation({
    mutationFn: (data: InsertEquipment) => apiRequest<Equipment>("POST", "/api/equipment", data),
    onSuccess: async (created) => {
      if (created && created.id) {
        queryClient.setQueryData<Equipment[]>(equipmentKeys.list(), (old) =>
          old ? [...old, created] : [created]
        );
      }
      await queryClient.invalidateQueries({ queryKey: equipmentKeys.list() });
      toast({
        title: "Equipment created",
        description: "The equipment has been added successfully",
      });
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create equipment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertEquipment> }) =>
      apiRequest("PUT", `/api/equipment/${id}`, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: equipmentKeys.list() });
      toast({
        title: "Equipment updated",
        description: "The equipment has been updated successfully",
      });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update equipment",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: InsertEquipment) => {
    const submissionData = {
      ...data,
      vesselId: data.vesselId === "unassigned" || data.vesselId === "" ? undefined : data.vesselId,
    };

    if (onSubmit) {
      onSubmit(submissionData, equipment?.id);
    } else if (mode === "create") {
      createMutation.mutate(submissionData as InsertEquipment);
    } else if (equipment) {
      updateMutation.mutate({ id: equipment.id, data: submissionData });
    }
  };

  const isPending =
    externalPending ?? (mode === "create" ? createMutation.isPending : updateMutation.isPending);

  const handleClose = () => {
    onOpenChange(false);
    onClose?.();
  };

  const isCreate = mode === "create";
  const dialogTitle = isCreate ? "Add New Equipment" : "Edit Equipment";
  const dialogDescription = isCreate
    ? "Register new equipment in your fleet inventory"
    : "Update equipment information";
  const submitLabel = isCreate
    ? isPending
      ? "Creating..."
      : "Create Equipment"
    : isPending
      ? "Updating..."
      : "Update Equipment";

  return (
    <Dialog open={dialogOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <EquipmentFormFields
          form={form}
          vessels={vessels}
          isCreate={isCreate}
          isPending={isPending}
          submitLabel={submitLabel}
          onCancel={handleClose}
          onSubmit={handleSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}

export function EquipmentCreateDialog(props: Omit<EquipmentFormDialogProps, "mode" | "equipment">) {
  return <EquipmentFormDialog mode="create" {...props} />;
}

export function EquipmentEditDialog(
  props: Omit<EquipmentFormDialogProps, "mode"> & { equipment: Equipment | null }
) {
  return <EquipmentFormDialog mode="edit" {...props} />;
}
