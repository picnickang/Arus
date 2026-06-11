import { Link, useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/contexts/PermissionsContext";
import { vesselNameFor, type EquipmentRecord, type VesselRecord } from "./data";
import { DiagramDetailPage } from "./registry-screens/DiagramDetailPage";
import { DiagramManager } from "./registry-screens/DiagramManager";
import { DiagramVersionHistory } from "./registry-screens/DiagramVersionHistory";
import { PublishValidationPanel } from "./registry-screens/PublishValidationPanel";
import { SectionMapEditorEntry } from "./registry-screens/SectionMapEditorEntry";
import { ThumbnailManager } from "./registry-screens/ThumbnailManager";
import { type PermissionSet } from "./registry-screens/shared";

interface RegistryRouteScreenProps {
  vesselId: string;
  diagramId?: string;
  mapId?: string;
  selectedVessel?: VesselRecord;
  equipment: EquipmentRecord[];
}

export function isRegistryRoute(location: string) {
  return (
    location.includes("/diagrams") ||
    location.includes("/section-maps/") ||
    location.includes("/thumbnails")
  );
}

export function RegistryRouteScreen({
  vesselId,
  diagramId,
  mapId,
  selectedVessel,
  equipment,
}: RegistryRouteScreenProps) {
  const [location] = useLocation();
  const permissions = useRegistryPermissions();

  let content = (
    <DiagramManager
      vesselId={vesselId}
      vesselName={vesselNameFor(selectedVessel)}
      permissions={permissions}
    />
  );

  if (location.includes("/diagrams/") && location.endsWith("/versions") && diagramId) {
    content = (
      <DiagramVersionHistory vesselId={vesselId} diagramId={diagramId} permissions={permissions} />
    );
  } else if (location.includes("/diagrams/") && diagramId) {
    content = (
      <DiagramDetailPage vesselId={vesselId} diagramId={diagramId} permissions={permissions} />
    );
  } else if (location.includes("/section-maps/") && location.endsWith("/edit") && mapId) {
    content = (
      <SectionMapEditorEntry
        vesselId={vesselId}
        mapId={mapId}
        equipment={equipment}
        permissions={permissions}
      />
    );
  } else if (location.includes("/section-maps/") && location.endsWith("/validate") && mapId) {
    content = (
      <PublishValidationPanel vesselId={vesselId} mapId={mapId} permissions={permissions} />
    );
  } else if (location.includes("/thumbnails")) {
    content = (
      <ThumbnailManager vesselId={vesselId} equipment={equipment} permissions={permissions} />
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4" data-testid="vessel-intelligence-registry-route">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Badge variant="secondary">{vesselNameFor(selectedVessel)}</Badge>
          <h2 className="mt-2 text-lg font-semibold text-slate-50">Diagram Registry Workspace</h2>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/vessel-intelligence/${vesselId}/overview`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to hub
          </Link>
        </Button>
      </div>
      {content}
    </div>
  );
}

function useRegistryPermissions(): PermissionSet {
  const { hasAnyPermission } = usePermissions();
  return {
    canConfigure: hasAnyPermission("vessel-intelligence", ["configure"]),
    canUploadDiagram: hasAnyPermission("vessel-intelligence", ["upload-diagram"]),
    canRollbackDiagram: hasAnyPermission("vessel-intelligence", ["rollback-diagram"]),
    canEditMap: hasAnyPermission("vessel-intelligence", ["edit-section-map"]),
    canPublishMap: hasAnyPermission("vessel-intelligence", ["publish-map"]),
    canReplaceSectionThumbnail: hasAnyPermission("vessel-intelligence", [
      "replace-section-thumbnail",
    ]),
    canReplaceEquipmentThumbnail: hasAnyPermission("vessel-intelligence", [
      "replace-equipment-thumbnail",
    ]),
    canAssignEquipment: hasAnyPermission("vessel-intelligence", ["assign-equipment"]),
  };
}
