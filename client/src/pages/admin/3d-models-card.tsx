import { useRef, useState } from "react";
import { createHeaders, resolveUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import type { Vessel } from "@shared/schema";
import { HistoryPanel } from "./3d-models-history-panel";
import { formatBytes, isForbiddenError, type ModelMetadata } from "./3d-models-model";
import { PinEditor } from "./3d-models-pin-editor";

interface VesselModelCardProps {
  vessel: Vessel;
  model: ModelMetadata | null;
  loading: boolean;
  error: Error | null;
  onChanged: () => void;
}

export function VesselModelCard({
  vessel,
  model,
  loading,
  error,
  onChanged,
}: VesselModelCardProps) {
  const { toast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("model", file);
      const res = await fetch(
        resolveUrl(`/api/v1/vessels/${encodeURIComponent(vessel.id)}/3d-model`),
        {
          method: "POST",
          body: formData,
          credentials: "include",
          headers: createHeaders(),
        }
      );
      if (!res.ok) {
        let msg = res.statusText;
        try {
          const body = await res.json();
          msg =
            typeof body?.message === "string"
              ? body.message
              : typeof body?.error === "string"
                ? body.error
                : JSON.stringify(body?.error ?? body);
        } catch {
          /* ignore */
        }
        if (res.status === 403) {
          throw new Error("Admin role required to upload 3D models.");
        }
        throw new Error(msg);
      }
      onChanged();
    } catch (err: unknown) {
      const description = err instanceof Error ? err.message : String(err);
      toast({ title: "Upload failed", description, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInput.current) {
        fileInput.current.value = "";
      }
    }
  };

  return (
    <Card data-testid={`card-vessel-model-${vessel.id}`}>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-3 text-base">
          <span>{vessel.name}</span>
          <span className="font-mono text-xs text-muted-foreground">{vessel.id}</span>
          {model ? (
            <Badge variant="secondary" data-testid={`badge-model-status-${vessel.id}`}>
              Model attached
            </Badge>
          ) : (
            <Badge variant="outline" data-testid={`badge-model-status-${vessel.id}`}>
              No model uploaded
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading && (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading model…
          </div>
        )}

        {error && !loading && (
          <div className="text-sm text-destructive" data-testid={`text-model-error-${vessel.id}`}>
            {isForbiddenError(error)
              ? "Admin role required to view this model."
              : `Failed to load model: ${error.message}`}
          </div>
        )}

        {!loading && model && <ModelSummary model={model} />}

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor={`file-${vessel.id}`}>Upload .glb</Label>
            <Input
              id={`file-${vessel.id}`}
              ref={fileInput}
              type="file"
              accept=".glb,model/gltf-binary"
              data-testid={`input-model-file-${vessel.id}`}
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void handleUpload(file);
                }
              }}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            Self-contained .glb only, max 100 MB. The server rejects spoofed extensions via
            magic-byte verification.
          </span>
          {uploading && (
            <span className="text-sm flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
            </span>
          )}
        </div>

        {model && <PinEditor model={model} vesselId={vessel.id} onSaved={onChanged} />}

        <HistoryPanel
          vesselId={vessel.id}
          currentModelId={model?.id ?? null}
          onChanged={onChanged}
        />
      </CardContent>
    </Card>
  );
}

function ModelSummary({ model }: { model: ModelMetadata }) {
  return (
    <dl className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-1 text-sm">
      <div>
        <dt className="text-muted-foreground">File</dt>
        <dd className="font-mono">{model.filename}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Size</dt>
        <dd>{formatBytes(model.sizeBytes)}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Updated</dt>
        <dd>{model.updatedAt ? new Date(model.updatedAt).toLocaleString() : "—"}</dd>
      </div>
    </dl>
  );
}
