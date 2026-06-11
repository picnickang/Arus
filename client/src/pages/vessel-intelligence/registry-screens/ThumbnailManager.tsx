/** Thumbnail management grid: per-section and per-equipment thumbnail
 * override upload/delete cards with the documented fallback chain.
 * Extracted verbatim from the pre-split registry-screens.tsx. */

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { equipmentNameFor, type EquipmentRecord, type RegistrySectionRecord } from "../data";
import {
  equipmentIdForThumbnail,
  useDeleteEquipmentThumbnail,
  useDeleteSectionThumbnail,
  useSectionMaps,
  useUploadEquipmentThumbnail,
  useUploadSectionThumbnail,
} from "../registry-api";
import { EmptyState, type PermissionSet } from "./shared";

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
