/** Diagram registry dashboard: one card per diagram type with create /
 * upload / versions / map actions. Extracted verbatim from the pre-split
 * registry-screens.tsx. */

import { useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle, Eye, History, ImagePlus, Map, Plus, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DIAGRAM_TYPES, type DiagramTypeDefinition } from "../registry";
import { statusText, type RegistryDiagramRecord, type RegistrySectionMapRecord } from "../data";
import { useCreateDiagram, useSectionMaps, useVesselDiagrams } from "../registry-api";
import { DiagramUploadReplaceDialog } from "./DiagramUploadReplaceDialog";
import {
  ActionButton,
  EmptyState,
  ErrorState,
  formatDate,
  LoadingState,
  PermissionDeniedInline,
  StatusLine,
  type PermissionSet,
} from "./shared";

export function DiagramManager({
  vesselId,
  vesselName,
  permissions,
}: {
  vesselId: string;
  vesselName: string;
  permissions: PermissionSet;
}) {
  const diagramsQuery = useVesselDiagrams(vesselId);
  const mapsQuery = useSectionMaps(vesselId);
  const createDiagram = useCreateDiagram();
  const [uploadDiagram, setUploadDiagram] = useState<RegistryDiagramRecord | null>(null);
  const [, setLocation] = useLocation();
  const diagrams = diagramsQuery.data ?? [];
  const maps = mapsQuery.data ?? [];

  const createDiagramForType = (type: DiagramTypeDefinition) => {
    createDiagram.mutate({
      vesselId,
      payload: {
        diagramType: type.key,
        title: type.label,
        description: type.defaultFor,
      },
    });
  };

  return (
    <section className="space-y-4" data-testid="diagram-manager">
      <div className="flex flex-col justify-between gap-3 rounded-md border p-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-xl font-semibold tracking-normal">Diagram Manager</h1>
          <p className="text-sm text-muted-foreground">{vesselName}</p>
        </div>
        {!permissions.canConfigure && (
          <PermissionDeniedInline message="You can view this registry, but you do not have permission to configure diagrams." />
        )}
      </div>

      {diagramsQuery.isLoading && <LoadingState message="Loading diagram registry." />}
      {diagramsQuery.isError && <ErrorState message="Diagram registry could not be loaded." />}
      {!diagramsQuery.isLoading && !diagramsQuery.isError && diagrams.length === 0 && (
        <EmptyState message="No vessel diagrams uploaded yet. Upload a side elevation, deck plan, or machinery arrangement to start." />
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {DIAGRAM_TYPES.map((type) => {
          const diagram = diagrams.find((item) => item.diagramType === type.key);
          const map = diagram ? mapForDiagram(maps, diagram) : undefined;
          return (
            <DiagramTypeCard
              key={type.key}
              type={type}
              diagram={diagram}
              sectionMap={map}
              permissions={permissions}
              creating={createDiagram.isPending}
              onCreate={() => createDiagramForType(type)}
              onUpload={() => diagram && setUploadDiagram(diagram)}
              onVersions={() =>
                diagram &&
                setLocation(`/vessel-intelligence/${vesselId}/diagrams/${diagram.id}/versions`)
              }
              onDetail={() =>
                diagram && setLocation(`/vessel-intelligence/${vesselId}/diagrams/${diagram.id}`)
              }
              onEditMap={() =>
                map && setLocation(`/vessel-intelligence/${vesselId}/section-maps/${map.id}/edit`)
              }
              onValidateMap={() =>
                map &&
                setLocation(`/vessel-intelligence/${vesselId}/section-maps/${map.id}/validate`)
              }
              onThumbnails={() => setLocation(`/vessel-intelligence/${vesselId}/thumbnails`)}
            />
          );
        })}
      </div>

      {uploadDiagram && (
        <DiagramUploadReplaceDialog
          vesselId={vesselId}
          diagram={uploadDiagram}
          open={Boolean(uploadDiagram)}
          onOpenChange={(open) => !open && setUploadDiagram(null)}
        />
      )}
    </section>
  );
}

export function DiagramTypeCard({
  type,
  diagram,
  sectionMap,
  permissions,
  creating,
  onCreate,
  onUpload,
  onVersions,
  onDetail,
  onEditMap,
  onValidateMap,
  onThumbnails,
}: {
  type: DiagramTypeDefinition;
  diagram?: RegistryDiagramRecord | undefined;
  sectionMap?: RegistrySectionMapRecord | undefined;
  permissions: PermissionSet;
  creating: boolean;
  onCreate: () => void;
  onUpload: () => void;
  onVersions: () => void;
  onDetail: () => void;
  onEditMap: () => void;
  onValidateMap: () => void;
  onThumbnails: () => void;
}) {
  const status = diagram?.status ?? "not_uploaded";
  const testId = `diagram-type-card-${type.key}`;
  return (
    <div className="rounded-md border p-4" data-testid={testId}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{type.label}</h2>
          <p className="text-sm text-muted-foreground">{type.defaultFor}</p>
        </div>
        <Badge variant={status === "active" ? "default" : "outline"}>{statusText(status)}</Badge>
      </div>
      <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <StatusLine
          label="Active version"
          value={diagram?.activeVersionId ? "Available" : "None"}
        />
        <StatusLine
          label="Section map"
          value={sectionMap ? statusText(sectionMap.status) : "No map"}
        />
        <StatusLine
          label="Last updated"
          value={formatDate((diagram as { updatedAt?: string })?.updatedAt)}
        />
        <StatusLine label="Record" value={diagram ? "Created" : "Not uploaded"} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {!diagram ? (
          <ActionButton
            icon={Plus}
            label="Create diagram"
            allowed={permissions.canConfigure}
            reason="Requires vessel-intelligence:configure"
            loading={creating}
            onClick={onCreate}
          />
        ) : (
          <ActionButton icon={Eye} label="Open" allowed onClick={onDetail} />
        )}
        <ActionButton
          testId="button-upload-replace-diagram"
          icon={Upload}
          label="Upload / Replace"
          allowed={Boolean(diagram && permissions.canUploadDiagram)}
          reason={diagram ? "Requires vessel-intelligence:upload-diagram" : "Create diagram first"}
          onClick={onUpload}
        />
        <ActionButton
          testId="button-view-versions"
          icon={History}
          label="View versions"
          allowed={Boolean(diagram)}
          reason="Create diagram first"
          onClick={onVersions}
        />
        <ActionButton
          icon={Map}
          label="Edit section map"
          allowed={Boolean(sectionMap && permissions.canEditMap)}
          reason={
            sectionMap
              ? "Requires vessel-intelligence:edit-section-map"
              : "No section map exists for this diagram"
          }
          onClick={onEditMap}
        />
        <ActionButton
          testId="button-validate-map"
          icon={CheckCircle}
          label="Validate map"
          allowed={Boolean(sectionMap && permissions.canEditMap)}
          reason={
            sectionMap
              ? "Requires vessel-intelligence:edit-section-map"
              : "No section map exists for this diagram"
          }
          onClick={onValidateMap}
        />
        <ActionButton
          testId="button-manage-thumbnails"
          icon={ImagePlus}
          label="Manage thumbnails"
          allowed
          onClick={onThumbnails}
        />
      </div>
    </div>
  );
}

function mapForDiagram(maps: RegistrySectionMapRecord[], diagram: RegistryDiagramRecord) {
  return (
    maps.find(
      (map) => map.id === (diagram as { currentSectionMapId?: string | null }).currentSectionMapId
    ) ??
    maps.find((map) => map.diagramId === diagram.id && map.status === "draft") ??
    maps.find((map) => map.diagramId === diagram.id)
  );
}
