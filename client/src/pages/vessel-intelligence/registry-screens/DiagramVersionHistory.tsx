/** Diagram version history list with publish / archive / restore-as-draft
 * actions per version. Extracted verbatim from the pre-split
 * registry-screens.tsx. */

import { Archive, CheckCircle, Eye, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { statusText } from "../data";
import {
  type RegistryDiagramVersionRecord,
  useArchiveDiagramVersion,
  useDiagramDetail,
  useDiagramVersions,
  usePublishDiagramVersion,
  useRestoreDiagramVersion,
} from "../registry-api";
import {
  ActionButton,
  EmptyState,
  ErrorState,
  formatDate,
  LoadingState,
  type PermissionSet,
} from "./shared";

export function DiagramVersionHistory({
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
  const publish = usePublishDiagramVersion();
  const archive = useArchiveDiagramVersion();
  const restore = useRestoreDiagramVersion();
  const versions = versionsQuery.data ?? [];

  return (
    <section className="space-y-4">
      <div className="rounded-md border p-4">
        <h1 className="text-xl font-semibold tracking-normal">Version History</h1>
        <p className="text-sm text-muted-foreground">{diagramQuery.data?.title ?? diagramId}</p>
      </div>
      {versionsQuery.isLoading && <LoadingState message="Loading versions." />}
      {versionsQuery.isError && <ErrorState message="Versions could not be loaded." />}
      {versions.length === 0 && !versionsQuery.isLoading ? (
        <EmptyState message="This diagram has no active version. Upload and publish a version." />
      ) : (
        <div className="space-y-2">
          {versions.map((version) => (
            <VersionRow
              key={version.id}
              version={version}
              canRollback={permissions.canRollbackDiagram}
              publishing={publish.isPending}
              archiving={archive.isPending}
              restoring={restore.isPending}
              onPublish={() => publish.mutate({ vesselId, diagramId, versionId: version.id })}
              onArchive={() => archive.mutate({ vesselId, diagramId, versionId: version.id })}
              onRestore={() => restore.mutate({ vesselId, diagramId, versionId: version.id })}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function VersionRow({
  version,
  canRollback,
  publishing,
  archiving,
  restoring,
  onPublish,
  onArchive,
  onRestore,
}: {
  version: RegistryDiagramVersionRecord;
  canRollback: boolean;
  publishing: boolean;
  archiving: boolean;
  restoring: boolean;
  onPublish: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border p-3 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">v{version.versionNumber}</span>
          <Badge variant={version.status === "active" ? "default" : "outline"}>
            {statusText(version.status)}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {version.originalFileName} | uploaded by {version.uploadedBy ?? "unknown"} |{" "}
          {formatDate(version.uploadedAt)}
        </p>
        <p className="text-xs text-muted-foreground">
          published by {version.publishedBy ?? "not published"} | {formatDate(version.publishedAt)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {version.mediaUrl && (
          <Button variant="outline" size="sm" asChild>
            <a href={version.mediaUrl} target="_blank" rel="noreferrer">
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </a>
          </Button>
        )}
        <ActionButton
          icon={CheckCircle}
          label="Publish"
          allowed={canRollback && version.status !== "active"}
          reason="Requires vessel-intelligence:rollback-diagram"
          loading={publishing}
          onClick={onPublish}
        />
        <ActionButton
          icon={Archive}
          label="Archive"
          allowed={canRollback && version.status !== "archived"}
          reason="Requires vessel-intelligence:rollback-diagram"
          loading={archiving}
          onClick={onArchive}
        />
        <ActionButton
          icon={RotateCcw}
          label="Restore as draft"
          allowed={canRollback}
          reason="Requires vessel-intelligence:rollback-diagram"
          loading={restoring}
          onClick={onRestore}
        />
      </div>
    </div>
  );
}
