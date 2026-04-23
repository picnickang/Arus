import { TabsContent } from "@/components/ui/tabs";
import type { EquipmentItem, GetVesselName } from "./types";

export function EquipmentDetailsTab({
  equipment,
  getVesselName,
}: {
  equipment: EquipmentItem;
  getVesselName: GetVesselName;
}) {
  return (
    <TabsContent value="details" className="space-y-4 mt-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Type</p>
          <p className="font-medium">{equipment.type || "—"}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Vessel</p>
          <p className="font-medium">{getVesselName(equipment.vesselId) || "—"}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Location</p>
          <p className="font-medium">{equipment.location || "—"}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Serial Number</p>
          <p className="font-medium">{equipment.serialNumber || "—"}</p>
        </div>
        {equipment.installDate && (
          <div>
            <p className="text-sm text-muted-foreground">Install Date</p>
            <p className="font-medium">{new Date(equipment.installDate).toLocaleDateString()}</p>
          </div>
        )}
        {equipment.lastMaintenanceDate && (
          <div>
            <p className="text-sm text-muted-foreground">Last Maintenance</p>
            <p className="font-medium">
              {new Date(equipment.lastMaintenanceDate).toLocaleDateString()}
            </p>
          </div>
        )}
      </div>
      {equipment.notes && (
        <div>
          <p className="text-sm text-muted-foreground">Notes</p>
          <p className="mt-1">{equipment.notes}</p>
        </div>
      )}
    </TabsContent>
  );
}
