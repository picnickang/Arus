import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import {
  useModels,
  useModelVersions,
  useActiveDeployment,
} from "@/features/pdm/hooks/use-model-registry";
import { useOrganization } from "@/contexts/OrganizationContext";

export function ModelRegistryTab({
  highlightedVersionId,
}: {
  highlightedVersionId?: string | null;
}) {
  const { data: models, isLoading } = useModels();
  const { currentOrgId } = useOrganization();
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const resolvedRef = useRef<string | null>(null);

  const modelsList = Array.isArray(models) ? models : [];

  const { data: versions } = useModelVersions(selectedModelId ?? "");
  const { data: deployment } = useActiveDeployment(selectedModelId ?? "");

  useEffect(() => {
    if (
      !highlightedVersionId ||
      highlightedVersionId === resolvedRef.current ||
      modelsList.length === 0
    ) {
      return;
    }
    resolvedRef.current = highlightedVersionId;
    const resolveParentModel = async () => {
      for (const m of modelsList) {
        try {
          const res = await fetch(`/api/pdm/models/${m.id}/versions`, {
            headers: { "x-org-id": String(currentOrgId ?? "") },
          });
          if (!res.ok) {
            continue;
          }
          const versionsList = await res.json();
          if (
            Array.isArray(versionsList) &&
            versionsList.some((v: any) => v.id === highlightedVersionId)
          ) {
            setSelectedModelId(m.id);
            return;
          }
        } catch {
          continue;
        }
      }
      if (!selectedModelId && modelsList.length > 0) {
        setSelectedModelId(modelsList[0].id);
      }
    };
    resolveParentModel();
  }, [highlightedVersionId, modelsList, currentOrgId]);

  return (
    <div className="space-y-4">
      {isLoading && (
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading models...
        </div>
      )}

      {Array.isArray(models) && models.length > 0 ? (
        <div className="grid gap-3">
          {models.map((m: any) => (
            <Card
              key={m.id}
              className={`cursor-pointer transition-colors ${selectedModelId === m.id ? "ring-2 ring-primary" : ""}`}
              onClick={() => setSelectedModelId(m.id)}
              data-testid={`card-model-${m.id}`}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold">{m.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {m.type} • {m.equipmentType || "all"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={m.status === "deployed" ? "default" : "secondary"}>
                    {m.status}
                  </Badge>
                  {m.accuracy && (
                    <span className="text-sm">Acc: {parseFloat(m.accuracy).toFixed(1)}%</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !isLoading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No models registered yet.
          </CardContent>
        </Card>
      ) : null}

      {selectedModelId && Array.isArray(versions) && versions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Versions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {versions.map((v: any) => (
                <div
                  key={v.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${highlightedVersionId === v.id ? "ring-2 ring-primary bg-primary/5" : ""}`}
                  data-testid={`row-version-${v.id}`}
                >
                  <div>
                    <span className="font-medium">v{v.version}</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      {v.artifactPath || "no artifact"}
                    </span>
                    {v.trainingDataPoints && (
                      <span className="text-xs text-muted-foreground ml-2">
                        ({v.trainingDataPoints} training pts)
                      </span>
                    )}
                  </div>
                  <Badge variant={v.status === "production" ? "default" : "secondary"}>
                    {v.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedModelId && deployment != null && !(deployment as Record<string, unknown>).message && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Active Deployment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Target:</span>{" "}
                {String((deployment as Record<string, unknown>).deploymentTarget ?? "")}
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>{" "}
                <Badge>{String((deployment as Record<string, unknown>).deploymentStatus ?? "")}</Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Traffic:</span>{" "}
                {String((deployment as Record<string, unknown>).trafficPercentage ?? 0)}%
              </div>
              <div>
                <span className="text-muted-foreground">Deployed:</span>{" "}
                {new Date(
                  (deployment as Record<string, unknown>).deployedOn as string | number | Date
                ).toLocaleDateString()}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
