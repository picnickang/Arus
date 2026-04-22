import { Badge } from "@/components/ui/badge";
import { Loader2, FileBox } from "lucide-react";
import { useTrainingArtifacts } from "@/features/ml-ai/hooks/useTrainingPipeline";

export function ArtifactsViewer({ modelVersionId }: { modelVersionId: string }) {
  const { data: artifacts, isLoading } = useTrainingArtifacts(modelVersionId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading artifacts...
      </div>
    );
  }
  if (!Array.isArray(artifacts) || artifacts.length === 0) {
    return <div className="text-sm text-muted-foreground py-2">No artifacts found.</div>;
  }

  return (
    <div className="space-y-2">
      {artifacts.map((a: any) => (
        <div
          key={a.id}
          className="flex items-center justify-between p-3 rounded-lg border"
          data-testid={`row-artifact-${a.id}`}
        >
          <div className="flex items-center gap-2">
            <FileBox className="w-4 h-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">{a.artifactType}</div>
              <div className="text-xs text-muted-foreground">
                {a.framework} / {a.format}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {a.sizeBytes && (
              <span className="text-xs text-muted-foreground">
                {(a.sizeBytes / 1024 / 1024).toFixed(1)} MB
              </span>
            )}
            <Badge variant="outline">{a.status || "stored"}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}
