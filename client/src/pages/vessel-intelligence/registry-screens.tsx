import { Link, useLocation } from "wouter";
import { ArrowLeft, CheckCircle, Loader2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePermissions } from "@/contexts/PermissionsContext";
import {
  equipmentNameFor,
  vesselNameFor,
  type EquipmentRecord,
  type RegistrySectionRecord,
  type VesselRecord,
} from "./data";
import {
  equipmentIdForThumbnail,
  useDeleteEquipmentThumbnail,
  useDeleteSectionThumbnail,
  usePublishSectionMap,
  useSectionMap,
  useSectionMaps,
  useUploadEquipmentThumbnail,
  useUploadSectionThumbnail,
  useValidateSectionMap,
} from "./registry-api";
import { DiagramDetailPage } from "./registry-screens/DiagramDetailPage";
import { DiagramManager } from "./registry-screens/DiagramManager";
import { DiagramVersionHistory } from "./registry-screens/DiagramVersionHistory";
import { SectionMapEditorEntry } from "./registry-screens/SectionMapEditorEntry";
import { EmptyState, PermissionDeniedInline, type PermissionSet } from "./registry-screens/shared";

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

export function PublishValidationPanel({
  vesselId,
  mapId,
  permissions,
}: {
  vesselId: string;
  mapId: string;
  permissions: PermissionSet;
}) {
  const mapQuery = useSectionMap(vesselId, mapId);
  const validate = useValidateSectionMap();
  const publish = usePublishSectionMap();
  const [, setLocation] = useLocation();
  const validation = validate.data;
  const blockers = validation?.issues.filter((issue) => issue.severity === "blocker") ?? [];
  const warnings = validation?.issues.filter((issue) => issue.severity === "warning") ?? [];
  const canPublish = permissions.canPublishMap && Boolean(validation) && blockers.length === 0;

  return (
    <section className="space-y-4">
      <div className="rounded-md border p-4">
        <h1 className="text-xl font-semibold tracking-normal">Validate Section Map</h1>
        <p className="text-sm text-muted-foreground">{mapQuery.data?.name ?? mapId}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={() => validate.mutate({ vesselId, mapId })}
          disabled={!permissions.canEditMap || validate.isPending}
        >
          {validate.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="mr-2 h-4 w-4" />
          )}
          Run validation
        </Button>
        <Button
          data-testid="button-publish-map"
          onClick={() => publish.mutate({ vesselId, mapId })}
          disabled={!canPublish || publish.isPending}
          title={
            permissions.canPublishMap ? "Publish map" : "Requires vessel-intelligence:publish-map"
          }
        >
          {publish.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle className="mr-2 h-4 w-4" />
          )}
          Publish map
        </Button>
        <Button
          variant="outline"
          onClick={() => setLocation(`/vessel-intelligence/${vesselId}/section-maps/${mapId}/edit`)}
        >
          Back to editor
        </Button>
      </div>
      {!permissions.canPublishMap && (
        <PermissionDeniedInline message="You can validate this map, but you do not have permission to publish maps. Requires vessel-intelligence:publish-map." />
      )}
      {!validation ? (
        <EmptyState message="Run validation to see blockers, warnings, and passed checks." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          <ValidationColumn
            title="Blockers"
            issues={blockers}
            empty="No blockers found."
            variant="destructive"
          />
          <ValidationColumn
            title="Warnings"
            issues={warnings}
            empty="No warnings found."
            variant="warning"
          />
          <ValidationColumn
            title="Passed checks"
            issues={[
              {
                code: "sections_loaded",
                message: `${mapQuery.data?.sections.length ?? 0} sections loaded`,
              },
              { code: "validation_complete", message: validation.summary.checkedAt },
            ]}
            empty="No passed checks."
            variant="success"
          />
        </div>
      )}
    </section>
  );
}

export function ThumbnailManager({
  vesselId,
  equipment,
  permissions,
}: {
  vesselId: string;
  equipment: EquipmentRecord[];
  permissions: PermissionSet;
}) {
  const mapsQuery = useSectionMaps(vesselId);
  const uploadSection = useUploadSectionThumbnail();
  const uploadEquipment = useUploadEquipmentThumbnail();
  const deleteSection = useDeleteSectionThumbnail();
  const deleteEquipment = useDeleteEquipmentThumbnail();
  const sections = (mapsQuery.data ?? []).flatMap((map) => map.sections);

  return (
    <section className="space-y-4" data-testid="thumbnail-manager">
      <div className="rounded-md border p-4">
        <h1 className="text-xl font-semibold tracking-normal">Thumbnail Management</h1>
        <p className="text-sm text-muted-foreground">
          {
            "Fallback chain: manual upload -> crop from active schematic -> generated placeholder -> generic icon."
          }
        </p>
      </div>
      {sections.length === 0 && (
        <EmptyState message="No thumbnails yet. The fallback chain will use generated placeholders until sections or equipment have overrides." />
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Section thumbnails</h2>
          {sections.map((section) => (
            <SectionThumbnailCard
              key={section.id}
              vesselId={vesselId}
              section={section}
              canReplace={permissions.canReplaceSectionThumbnail}
              uploading={uploadSection.isPending}
              deleting={deleteSection.isPending}
              onUpload={(file) => uploadSection.mutate({ vesselId, sectionId: section.id, file })}
              onDelete={() => deleteSection.mutate({ vesselId, sectionId: section.id })}
            />
          ))}
        </div>
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Equipment thumbnails</h2>
          {equipment.length === 0 && (
            <EmptyState message="No equipment assigned to this section." />
          )}
          {equipment.map((item) => {
            const equipmentId = equipmentIdForThumbnail(item);
            if (!equipmentId) {
              return (
                <div
                  key={equipmentNameFor(item)}
                  className="rounded-md border border-dashed p-3 text-sm text-muted-foreground"
                >
                  {equipmentNameFor(item)} cannot use thumbnail actions until it has an equipment
                  ID, asset code, or name.
                </div>
              );
            }
            return (
              <EquipmentThumbnailCard
                key={equipmentId}
                vesselId={vesselId}
                equipment={item}
                equipmentId={equipmentId}
                canReplace={permissions.canReplaceEquipmentThumbnail}
                uploading={uploadEquipment.isPending}
                deleting={deleteEquipment.isPending}
                onUpload={(file) => uploadEquipment.mutate({ vesselId, equipmentId, file })}
                onDelete={() => deleteEquipment.mutate({ vesselId, equipmentId })}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function SectionThumbnailCard({
  section,
  canReplace,
  uploading,
  deleting,
  onUpload,
  onDelete,
}: {
  vesselId: string;
  section: RegistrySectionRecord;
  canReplace: boolean;
  uploading: boolean;
  deleting: boolean;
  onUpload: (file: File) => void;
  onDelete: () => void;
}) {
  return (
    <ThumbnailCard
      title={section.name}
      color={section.color}
      fallback={
        section.thumbnailFallback ??
        "manual upload -> crop from active schematic -> generated placeholder -> generic icon"
      }
      canReplace={canReplace}
      permissionReason="Requires vessel-intelligence:replace-section-thumbnail"
      uploading={uploading}
      deleting={deleting}
      uploadTestId="section-thumbnail-upload"
      onUpload={onUpload}
      onDelete={onDelete}
    />
  );
}

export function EquipmentThumbnailCard({
  equipment,
  equipmentId,
  canReplace,
  uploading,
  deleting,
  onUpload,
  onDelete,
}: {
  vesselId: string;
  equipment: EquipmentRecord;
  equipmentId: string;
  canReplace: boolean;
  uploading: boolean;
  deleting: boolean;
  onUpload: (file: File) => void;
  onDelete: () => void;
}) {
  return (
    <ThumbnailCard
      title={equipmentNameFor(equipment)}
      color="#64748b"
      fallback="manual upload -> section crop -> generated placeholder -> equipment icon"
      canReplace={canReplace && Boolean(equipmentId)}
      permissionReason={
        equipmentId
          ? "Requires vessel-intelligence:replace-equipment-thumbnail"
          : "Equipment has no stable ID"
      }
      uploading={uploading}
      deleting={deleting}
      uploadTestId="equipment-thumbnail-upload"
      onUpload={onUpload}
      onDelete={onDelete}
    />
  );
}

function ThumbnailCard({
  title,
  color,
  fallback,
  canReplace,
  permissionReason,
  uploading,
  deleting,
  uploadTestId,
  onUpload,
  onDelete,
}: {
  title: string;
  color: string;
  fallback: string;
  canReplace: boolean;
  permissionReason: string;
  uploading: boolean;
  deleting: boolean;
  uploadTestId: string;
  onUpload: (file: File) => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex gap-3">
        <div
          className="grid h-16 w-20 shrink-0 place-items-center rounded-md border text-xs font-medium"
          style={{ backgroundColor: color }}
        >
          Preview
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Current thumbnail: manual override if present, otherwise fallback.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Fallback source: {fallback}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Input
          type="file"
          accept="image/svg+xml,image/png,image/jpeg,image/webp"
          data-testid={uploadTestId}
          disabled={!canReplace || uploading}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            if (file) {
              onUpload(file);
            }
          }}
        />
        <Button variant="outline" size="sm" onClick={onDelete} disabled={!canReplace || deleting}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete override
        </Button>
      </div>
      {!canReplace && <p className="mt-2 text-xs text-muted-foreground">{permissionReason}</p>}
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

function ValidationColumn({
  title,
  issues,
  empty,
  variant,
}: {
  title: string;
  issues: Array<{ code: string; message: string }>;
  empty: string;
  variant: "destructive" | "warning" | "success";
}) {
  const border =
    variant === "destructive"
      ? "border-red-500/50"
      : variant === "warning"
        ? "border-amber-500/50"
        : "border-emerald-500/50";
  return (
    <div className={`rounded-md border p-4 ${border}`}>
      <h2 className="text-base font-semibold">{title}</h2>
      {issues.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="mt-2 space-y-2">
          {issues.map((issue) => (
            <div
              key={`${title}-${issue.code}-${issue.message}`}
              className="rounded-md border px-3 py-2 text-sm"
            >
              <p className="font-medium">{issue.code}</p>
              <p className="text-muted-foreground">{issue.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
