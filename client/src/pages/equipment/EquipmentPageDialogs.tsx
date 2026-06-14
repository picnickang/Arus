import type { Dispatch, SetStateAction } from "react";
import type { Equipment } from "@shared/schema";
import { Server } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EquipmentCreateDialog,
  EquipmentEditDialog,
} from "@/components/equipment/EquipmentFormDialog";
import { EquipmentDecommissionDialog } from "@/components/equipment/EquipmentDecommissionDialog";
import { EquipmentHistoryDialog } from "@/components/equipment/EquipmentHistoryDialog";
import { EquipmentReinstateDialog } from "@/components/equipment/EquipmentReinstateDialog";
import { SensorSetupWizard } from "@/components/sensors/SensorSetupWizard";
import { apiRequest } from "@/lib/queryClient";
import { EquipmentActionsTab } from "./EquipmentActionsTab";
import { EquipmentCertificationsTab } from "./EquipmentCertificationsTab";
import { EquipmentDetailsTab } from "./EquipmentDetailsTab";
import { EquipmentHealthTab } from "./EquipmentHealthTab";
import { HealthBadge } from "./HealthBadge";
import { StatusBadge } from "./StatusBadge";
import type { EquipmentPageModel } from "./EquipmentPageTypes";
import type { CertSummary } from "./types";
import type { useToast } from "@/hooks/use-toast";

interface EquipmentPageDialogsProps {
  m: EquipmentPageModel;
  allCerts: CertSummary[];
  lifecycleEquipment: Equipment | null;
  setLifecycleEquipment: Dispatch<SetStateAction<Equipment | null>>;
  isDecommissionDialogOpen: boolean;
  setIsDecommissionDialogOpen: Dispatch<SetStateAction<boolean>>;
  isReinstateDialogOpen: boolean;
  setIsReinstateDialogOpen: Dispatch<SetStateAction<boolean>>;
  isHistoryDialogOpen: boolean;
  setIsHistoryDialogOpen: Dispatch<SetStateAction<boolean>>;
  onLifecycleSuccess: () => void;
  toast: ReturnType<typeof useToast>["toast"];
}

export function EquipmentPageDialogs({
  m,
  allCerts,
  lifecycleEquipment,
  setIsDecommissionDialogOpen,
  isDecommissionDialogOpen,
  isReinstateDialogOpen,
  setIsReinstateDialogOpen,
  isHistoryDialogOpen,
  setIsHistoryDialogOpen,
  onLifecycleSuccess,
  toast,
}: EquipmentPageDialogsProps) {
  return (
    <>
      <Sheet open={m.isDetailDrawerOpen} onOpenChange={m.setIsDetailDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {m.selectedEquipment && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  {m.selectedEquipment.name}
                </SheetTitle>
                <SheetDescription>
                  {m.selectedEquipment.manufacturer}
                  {m.selectedEquipment.model && ` • ${m.selectedEquipment.model}`}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                <div className="flex items-center justify-between">
                  <HealthBadge health={m.selectedEquipment.health} />
                  <StatusBadge isActive={m.selectedEquipment.isActive ?? true} />
                </div>
                <Tabs defaultValue="details">
                  <TabsList className="w-full grid grid-cols-4">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="health">Health</TabsTrigger>
                    <TabsTrigger value="certs" data-testid="tab-equipment-certs">
                      Certs
                    </TabsTrigger>
                    <TabsTrigger value="actions">Actions</TabsTrigger>
                  </TabsList>
                  <EquipmentDetailsTab
                    equipment={m.selectedEquipment}
                    getVesselName={m.getVesselName}
                  />
                  <EquipmentHealthTab equipment={m.selectedEquipment} setLocation={m.setLocation} />
                  <EquipmentCertificationsTab
                    equipmentId={m.selectedEquipment.id}
                    equipmentName={m.selectedEquipment.name}
                    allCerts={allCerts}
                    setLocation={m.setLocation}
                  />
                  <EquipmentActionsTab
                    equipment={m.selectedEquipment}
                    setLocation={m.setLocation}
                    handleEdit={m.handleEdit}
                    handleSetupSensors={m.handleSetupSensors}
                    setIsDetailDrawerOpen={m.setIsDetailDrawerOpen}
                  />
                </Tabs>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <EquipmentCreateDialog
        open={m.isCreateDialogOpen}
        onOpenChange={m.setIsCreateDialogOpen}
        vessels={m.vessels}
        onSuccess={() => {
          m.setIsCreateDialogOpen(false);
          m.refetchEquipment();
        }}
      />
      {m.selectedEquipment && (
        <EquipmentEditDialog
          open={m.isEditDialogOpen}
          onOpenChange={m.setIsEditDialogOpen}
          equipment={m.selectedEquipment}
          vessels={m.vessels}
          onSuccess={() => {
            m.setIsEditDialogOpen(false);
            m.refetchEquipment();
          }}
        />
      )}
      {m.selectedEquipment && (
        <SensorSetupWizard
          equipment={m.selectedEquipment as object as Parameters<typeof SensorSetupWizard>[0]["equipment"]}
          open={m.isSensorWizardOpen}
          onClose={() => m.setIsSensorWizardOpen(false)}
          onSuccess={() => {
            m.setIsSensorWizardOpen(false);
            m.refetchEquipment();
          }}
        />
      )}

      <EquipmentDecommissionDialog
        open={isDecommissionDialogOpen}
        onOpenChange={setIsDecommissionDialogOpen}
        equipment={lifecycleEquipment}
        onSubmit={async (data) => {
          try {
            await apiRequest("POST", `/api/equipment/${lifecycleEquipment?.id}/decommission`, data);
            toast({
              title: "Equipment Decommissioned",
              description: `${lifecycleEquipment?.name} has been decommissioned.`,
            });
            setIsDecommissionDialogOpen(false);
            onLifecycleSuccess();
          } catch {
            toast({
              title: "Error",
              description: "Failed to decommission equipment.",
              variant: "destructive",
            });
          }
        }}
        isPending={false}
      />

      <EquipmentReinstateDialog
        isOpen={isReinstateDialogOpen}
        onOpenChange={setIsReinstateDialogOpen}
        equipment={lifecycleEquipment}
        onSuccess={onLifecycleSuccess}
      />

      <EquipmentHistoryDialog
        isOpen={isHistoryDialogOpen}
        onOpenChange={setIsHistoryDialogOpen}
        equipment={lifecycleEquipment}
      />
    </>
  );
}
