import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Equipment, InsertDecommissionEvent } from "@shared/schema";
import { AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  calculateDepreciation,
  createDecommissionDefaults,
  type DecommissionFormData,
  decommissionFormSchema,
} from "./EquipmentDecommissionDialogModel";
import {
  DecommissionFinancialSummary,
  DecommissionNotesAndActions,
  DecommissionReasonFields,
  DecommissionReplacementSection,
  EquipmentDecommissionSummary,
} from "./EquipmentDecommissionDialogSections";
import {
  DecommissionDisposalDetails,
  DecommissionSaleDetails,
} from "./EquipmentDecommissionDialogOptionalSections";

interface EquipmentDecommissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment | null;
  replacementOptions?: Equipment[];
  onSubmit: (equipmentId: string, data: InsertDecommissionEvent) => void;
  isPending?: boolean;
}

export function EquipmentDecommissionDialog({
  open,
  onOpenChange,
  equipment,
  replacementOptions = [],
  onSubmit,
  isPending,
}: EquipmentDecommissionDialogProps) {
  const { toast } = useToast();
  const [saleOpen, setSaleOpen] = useState(false);
  const [disposalOpen, setDisposalOpen] = useState(false);

  const depreciation = equipment
    ? calculateDepreciation(equipment.purchaseValue, equipment.purchaseDate)
    : { bookValue: 0, depreciationYears: 0 };

  const form = useForm<DecommissionFormData, unknown, DecommissionFormData>({
    resolver: zodResolver(decommissionFormSchema),
    defaultValues: createDecommissionDefaults(depreciation),
  });

  const selectedReason = form.watch("reason");
  const showSaleDetails = selectedReason === "sold";
  const showDisposalDetails =
    selectedReason === "scrapped" || selectedReason === "damaged_beyond_repair";
  const showReplacementLink = selectedReason === "replaced";

  const handleSubmit = (data: DecommissionFormData) => {
    if (!equipment) {
      return;
    }
    if (!equipment.orgId) {
      toast({
        title: "Cannot decommission equipment",
        description:
          "Equipment is missing an organization assignment. Please contact an administrator.",
        variant: "destructive",
      });
      return;
    }

    const submissionData: InsertDecommissionEvent = {
      orgId: equipment.orgId,
      equipmentId: equipment.id,
      reason: data.reason,
      eventDate: new Date(data.eventDate),
      authorizedBy: data.authorizedBy || undefined,
      finalCondition: data.finalCondition || undefined,
      notes: data.notes || undefined,
      saleDetails: showSaleDetails ? data.saleDetails : undefined,
      disposalDetails: showDisposalDetails ? data.disposalDetails : undefined,
      replacementEquipmentId:
        showReplacementLink && data.replacementEquipmentId
          ? data.replacementEquipmentId
          : undefined,
      bookValueAtRemoval: data.bookValueAtRemoval ?? depreciation.bookValue,
      residualValue: data.residualValue,
    };

    onSubmit(equipment.id, submissionData);
  };

  if (!equipment) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Decommission Equipment
          </DialogTitle>
          <DialogDescription>
            Remove <span className="font-medium">{equipment.name}</span> from active service. This
            action will mark the equipment as inactive and record the decommission details.
          </DialogDescription>
        </DialogHeader>

        <EquipmentDecommissionSummary equipment={equipment} depreciation={depreciation} />

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <DecommissionReasonFields form={form} />

            {showSaleDetails && (
              <DecommissionSaleDetails form={form} open={saleOpen} onOpenChange={setSaleOpen} />
            )}

            {showDisposalDetails && (
              <DecommissionDisposalDetails
                form={form}
                open={disposalOpen}
                onOpenChange={setDisposalOpen}
              />
            )}

            {showReplacementLink && replacementOptions.length > 0 && (
              <DecommissionReplacementSection form={form} replacementOptions={replacementOptions} />
            )}

            <DecommissionFinancialSummary form={form} depreciation={depreciation} />
            <DecommissionNotesAndActions
              form={form}
              isPending={isPending}
              onCancel={() => onOpenChange(false)}
            />
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
