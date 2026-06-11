/** Section map validation + publish workflow: run validation, review
 * blockers/warnings/passed checks, publish when clean. Extracted verbatim
 * from the pre-split registry-screens.tsx. */

import { useLocation } from "wouter";
import { CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePublishSectionMap, useSectionMap, useValidateSectionMap } from "../registry-api";
import { EmptyState, PermissionDeniedInline, type PermissionSet } from "./shared";

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
