/** Single-diagram detail view: active/draft preview plus version, map-edit,
 * and validation actions. Extracted verbatim from the pre-split
 * registry-screens.tsx. */

import { useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle, History, Map, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { statusText } from "../data";
import { useDiagramDetail, useDiagramVersions, useSectionMaps } from "../registry-api";
import { DiagramUploadReplaceDialog } from "./DiagramUploadReplaceDialog";
import {
  ActionButton,
  EmptyState,
  ErrorState,
  LoadingState,
  StatusLine,
  type PermissionSet,
} from "./shared";

export function DiagramDetailPage({
  vesselId,
  diagramId,
  permissions,
}: {
  vesselId: string;
  diagramId: string;
  permissions: PermissionSet;
}) {
  const diagramQuery = useDiagramDetail(vesselId, diagramId);
  const versionsQuery = useDiagramVersions(vesselId, diagramId);
  const mapsQuery = useSectionMaps(vesselId);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [, setLocation] = useLocation();
  const diagram = diagramQuery.data;
  const versions = versionsQuery.data ?? [];
  const active = versions.find((version) => version.status === "active");
  const draft = versions.find(
    (version) => version.status === "draft" || version.status === "uploaded"
  );
  const linkedMaps = (mapsQuery.data ?? []).filter((map) => map.diagramId === diagramId);
  const currentMap = linkedMaps.find((map) => map.status === "draft") ?? linkedMaps[0];

  return (
    <section className="space-y-4">
      {diagramQuery.isLoading && <LoadingState message="Loading diagram detail." />}
      {diagramQuery.isError && <ErrorState message="Diagram detail could not be loaded." />}
      {diagram && (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="rounded-md border p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h1 className="text-xl font-semibold tracking-normal">{diagram.title}</h1>
                  <p className="text-sm text-muted-foreground">{statusText(diagram.diagramType)}</p>
                </div>
                <Badge>{statusText(diagram.status)}</Badge>
              </div>
              {active?.mediaUrl || draft?.mediaUrl ? (
                <div className="overflow-hidden rounded-md border bg-muted">
                  <img
                    src={active?.mediaUrl ?? draft?.mediaUrl}
                    alt={diagram.title}
                    className="h-auto w-full object-contain"
                  />
                </div>
              ) : (
                <EmptyState message="This diagram has no active version. Upload and publish a version." />
              )}
            </div>
            <div className="space-y-3 rounded-md border p-4">
              <StatusLine
                label="Active version"
                value={active ? `v${active.versionNumber}` : "None"}
              />
              <StatusLine
                label="Draft version"
                value={draft ? `v${draft.versionNumber}` : "None"}
              />
              <StatusLine
                label="Validation"
                value={
                  currentMap?.validationSummary
                    ? `${currentMap.validationSummary.blockers} blockers`
                    : "Not validated"
                }
              />
              <StatusLine label="Linked maps" value={String(linkedMaps.length)} />
              <ActionButton
                testId="button-upload-replace-diagram"
                icon={Upload}
                label="Upload new version"
                allowed={permissions.canUploadDiagram}
                reason="Requires vessel-intelligence:upload-diagram"
                onClick={() => setUploadOpen(true)}
              />
              <ActionButton
                testId="button-view-versions"
                icon={History}
                label="Version history"
                allowed
                onClick={() =>
                  setLocation(`/vessel-intelligence/${vesselId}/diagrams/${diagramId}/versions`)
                }
              />
              <ActionButton
                icon={Map}
                label="Edit section map"
                allowed={Boolean(currentMap && permissions.canEditMap)}
                reason={
                  currentMap
                    ? "Requires vessel-intelligence:edit-section-map"
                    : "No section map exists for this diagram. Start blank, copy from another vessel, or use a vessel type template."
                }
                onClick={() =>
                  currentMap &&
                  setLocation(`/vessel-intelligence/${vesselId}/section-maps/${currentMap.id}/edit`)
                }
              />
              <ActionButton
                testId="button-validate-map"
                icon={CheckCircle}
                label="Validate map"
                allowed={Boolean(currentMap && permissions.canEditMap)}
                reason={
                  currentMap
                    ? "Requires vessel-intelligence:edit-section-map"
                    : "No section map exists for this diagram. Start blank, copy from another vessel, or use a vessel type template."
                }
                onClick={() =>
                  currentMap &&
                  setLocation(
                    `/vessel-intelligence/${vesselId}/section-maps/${currentMap.id}/validate`
                  )
                }
              />
            </div>
          </div>
          <DiagramUploadReplaceDialog
            vesselId={vesselId}
            diagram={diagram}
            open={uploadOpen}
            onOpenChange={setUploadOpen}
          />
        </>
      )}
    </section>
  );
}
