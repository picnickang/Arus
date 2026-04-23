import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { FileText, Pencil, TrendingUp, Wrench } from "lucide-react";
import type { EquipmentItem } from "./types";

export function EquipmentActionsTab({
  equipment,
  setLocation,
  handleEdit,
  handleSetupSensors,
  setIsDetailDrawerOpen,
}: {
  equipment: EquipmentItem;
  setLocation: (path: string) => void;
  handleEdit: (item: EquipmentItem) => void;
  handleSetupSensors: (item: EquipmentItem) => void;
  setIsDetailDrawerOpen: (open: boolean) => void;
}) {
  return (
    <TabsContent value="actions" className="space-y-3 mt-4">
      <Button
        variant="outline"
        className="w-full justify-start"
        onClick={() => {
          setIsDetailDrawerOpen(false);
          handleSetupSensors(equipment);
        }}
      >
        <Wrench className="h-4 w-4 mr-2" />
        Configure Sensors
      </Button>
      <Button
        variant="outline"
        className="w-full justify-start"
        onClick={() => {
          setIsDetailDrawerOpen(false);
          handleEdit(equipment);
        }}
      >
        <Pencil className="h-4 w-4 mr-2" />
        Edit Equipment
      </Button>
      <Button
        variant="outline"
        className="w-full justify-start"
        onClick={() => setLocation(`/pdm/equipment/${equipment.id}`)}
      >
        <TrendingUp className="h-4 w-4 mr-2" />
        View Analytics
      </Button>
      <Button
        variant="outline"
        className="w-full justify-start"
        onClick={() => setLocation(`/work-orders?action=create&equipmentId=${equipment.id}`)}
      >
        <FileText className="h-4 w-4 mr-2" />
        Create Work Order
      </Button>
    </TabsContent>
  );
}
