import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ResponsiveDialog";
import { Camera, Upload, Trash2, ImageOff } from "lucide-react";
import { createHeaders, resolveUrl, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { crewInitials } from "./crew-roster-shared";

const MAX_BYTES = 5 * 1024 * 1024; // Mirror server multer limit (5 MB).
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** Load an auth-gated object path into a blob URL for the current-photo preview. */
function useAuthedPreview(path?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    void (async () => {
      try {
        const res = await fetch(resolveUrl(path), {
          headers: createHeaders(false),
          credentials: "include",
        });
        if (!res.ok || cancelled) {
          return;
        }
        const blob = await res.blob();
        if (cancelled) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        /* fall back to initials */
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
      setUrl(null);
    };
  }, [path]);
  return url;
}

interface CrewPhotoModalProps {
  crewId: string;
  crewName: string;
  photoPath?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CrewPhotoModal({
  crewId,
  crewName,
  photoPath,
  open,
  onOpenChange,
}: CrewPhotoModalProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const currentPreview = useAuthedPreview(photoPath);

  // Reset transient state whenever the dialog re-opens.
  useEffect(() => {
    if (!open) {
      setFile(null);
      setError(null);
      setBusy(false);
    }
  }, [open]);

  // Build/revoke the object URL for the chosen file.
  useEffect(() => {
    if (!file) {
      setLocalPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setLocalPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const handleSelect = (selected: File | null | undefined) => {
    setError(null);
    if (!selected) {
      return;
    }
    if (!ACCEPTED.includes(selected.type)) {
      setError("Please choose a JPG, PNG, WebP, or GIF image.");
      return;
    }
    if (selected.size > MAX_BYTES) {
      setError("Image is too large. Maximum size is 5 MB.");
      return;
    }
    setFile(selected);
  };

  const afterMutation = () => {
    void queryClient.invalidateQueries({ queryKey: ["/api/crew"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/crew/list"] });
  };

  const handleUpload = async () => {
    if (!file) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch(resolveUrl(`/api/crew/${crewId}/photo`), {
        method: "POST",
        headers: createHeaders(false),
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || `Upload failed (${res.status}).`);
      }
      afterMutation();
      toast({ title: "Profile photo updated", description: crewName });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(resolveUrl(`/api/crew/${crewId}/photo`), {
        method: "DELETE",
        headers: createHeaders(false),
        credentials: "include",
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || `Remove failed (${res.status}).`);
      }
      afterMutation();
      toast({ title: "Profile photo removed", description: crewName });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed.");
    } finally {
      setBusy(false);
    }
  };

  const previewSrc = localPreview ?? currentPreview;

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Profile photo"
      description={`Upload or replace the profile photo for ${crewName}.`}
      className="max-w-md"
    >
      <div className="space-y-5">
        <div className="flex flex-col items-center gap-3">
          <div
            className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.04]"
            data-testid="preview-crew-photo"
          >
            {previewSrc ? (
              <img
                src={previewSrc}
                alt={`${crewName} profile preview`}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-3xl font-semibold text-slate-300">
                {crewInitials(crewName)}
              </span>
            )}
          </div>
          {file && (
            <p className="text-xs text-muted-foreground" data-testid="text-photo-filename">
              {file.name} ({(file.size / 1024).toFixed(0)} KB)
            </p>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          className="hidden"
          data-testid="input-photo-file"
          onChange={(e) => handleSelect(e.target.files?.[0])}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          data-testid="input-photo-camera"
          onChange={(e) => handleSelect(e.target.files?.[0])}
        />

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            data-testid="button-choose-photo"
          >
            <Upload className="mr-2 h-4 w-4" />
            Choose file
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => cameraInputRef.current?.click()}
            disabled={busy}
            data-testid="button-take-photo"
          >
            <Camera className="mr-2 h-4 w-4" />
            Take photo
          </Button>
        </div>

        {error && (
          <p className="text-sm text-destructive" data-testid="text-photo-error">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            onClick={handleUpload}
            disabled={!file || busy}
            data-testid="button-save-photo"
          >
            {busy ? "Saving…" : "Save photo"}
          </Button>
          {photoPath && (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={handleRemove}
              disabled={busy}
              data-testid="button-remove-photo"
            >
              {previewSrc ? <Trash2 className="mr-2 h-4 w-4" /> : <ImageOff className="mr-2 h-4 w-4" />}
              Remove current photo
            </Button>
          )}
        </div>
      </div>
    </ResponsiveDialog>
  );
}
