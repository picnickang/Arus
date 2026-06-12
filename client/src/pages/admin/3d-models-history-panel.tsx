import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, createHeaders, queryClient, resolveUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight, History, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { formatBytes, type ModelMetadata } from "./3d-models-model";

interface HistoryPanelProps {
  vesselId: string;
  currentModelId: string | null;
  onChanged: () => void;
}

export function HistoryPanel({ vesselId, currentModelId, onChanged }: HistoryPanelProps) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);

  const historyQuery = useQuery<ModelMetadata[]>({
    queryKey: ["/api/v1/vessels", vesselId, "3d-model", "history"],
    queryFn: async () => {
      const res = await fetch(
        resolveUrl(`/api/v1/vessels/${encodeURIComponent(vesselId)}/3d-model/history`),
        { credentials: "include", headers: createHeaders() }
      );
      if (!res.ok) {
        throw new Error(`${res.status}: ${await res.text().catch(() => res.statusText)}`);
      }
      return (await res.json()) as ModelMetadata[];
    },
    enabled: expanded,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: ["/api/v1/vessels", vesselId, "3d-model"],
    });
    queryClient.invalidateQueries({
      queryKey: ["/api/v1/vessels", vesselId, "3d-model", "history"],
    });
    onChanged();
  };

  const promote = useMutation({
    mutationFn: (modelId: string) =>
      apiRequest("POST", `/api/v1/vessels/3d-model/${encodeURIComponent(modelId)}/promote`),
    onSuccess: () => {
      toast({ title: "Model promoted to current" });
      invalidate();
    },
    onError: (err: unknown) => {
      const raw = err instanceof Error ? err.message : String(err);
      const friendly =
        /^403:/.test(raw) || /forbidden/i.test(raw)
          ? "Admin role required to promote models."
          : raw;
      toast({ title: "Promote failed", description: friendly, variant: "destructive" });
    },
  });

  const remove = useMutation({
    mutationFn: (modelId: string) =>
      apiRequest("DELETE", `/api/v1/vessels/3d-model/${encodeURIComponent(modelId)}`),
    onSuccess: () => {
      toast({ title: "Model deleted" });
      invalidate();
    },
    onError: (err: unknown) => {
      const raw = err instanceof Error ? err.message : String(err);
      const friendly =
        /^403:/.test(raw) || /forbidden/i.test(raw) ? "Admin role required to delete models." : raw;
      toast({ title: "Delete failed", description: friendly, variant: "destructive" });
    },
  });

  const items = historyQuery.data ?? [];

  return (
    <div className="border-t pt-4" data-testid={`history-panel-${vesselId}`}>
      <button
        type="button"
        className="flex items-center gap-1 text-sm font-medium hover:underline"
        onClick={() => setExpanded((v) => !v)}
        data-testid={`button-toggle-history-${vesselId}`}
        aria-expanded={expanded}
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <History className="h-4 w-4" />
        Upload history
        {expanded && historyQuery.isSuccess && (
          <span className="text-muted-foreground font-normal">({items.length})</span>
        )}
      </button>

      {expanded && (
        <div className="mt-3">
          {historyQuery.isLoading && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
            </div>
          )}
          {historyQuery.isError && (
            <div className="text-sm text-destructive" data-testid={`text-history-error-${vesselId}`}>
              Failed to load history: {historyQuery.error.message}
            </div>
          )}
          {historyQuery.isSuccess && items.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No upload history yet. Upload a .glb above to start a version trail.
            </p>
          )}
          {historyQuery.isSuccess && items.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Filename</TableHead>
                  <TableHead className="w-24">Size</TableHead>
                  <TableHead className="w-44">Uploaded</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-40 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <HistoryRow
                    key={row.id}
                    row={row}
                    vesselId={vesselId}
                    isCurrent={row.id === currentModelId}
                    busy={
                      (promote.isPending && promote.variables === row.id) ||
                      (remove.isPending && remove.variables === row.id)
                    }
                    onPromote={() => promote.mutate(row.id)}
                    onDelete={() => remove.mutate(row.id)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}

function HistoryRow({
  row,
  vesselId,
  isCurrent,
  busy,
  onPromote,
  onDelete,
}: {
  row: ModelMetadata;
  vesselId: string;
  isCurrent: boolean;
  busy: boolean;
  onPromote: () => void;
  onDelete: () => void;
}) {
  return (
    <TableRow key={row.id} data-testid={`row-history-${vesselId}-${row.id}`}>
      <TableCell className="font-mono text-xs">{row.filename}</TableCell>
      <TableCell>{formatBytes(row.sizeBytes)}</TableCell>
      <TableCell>{row.createdAt ? new Date(row.createdAt).toLocaleString() : "—"}</TableCell>
      <TableCell>
        {isCurrent ? (
          <Badge data-testid={`badge-history-current-${vesselId}-${row.id}`}>Current</Badge>
        ) : (
          <Badge variant="outline">Archived</Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button
            size="sm"
            variant="outline"
            disabled={isCurrent || busy}
            onClick={onPromote}
            data-testid={`button-history-promote-${vesselId}-${row.id}`}
            title={isCurrent ? "Already current" : "Make this the active model"}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Promote
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => {
              const ok = window.confirm(
                isCurrent
                  ? `Delete the CURRENT model "${row.filename}"? The next-newest upload will become current. This cannot be undone.`
                  : `Delete archived model "${row.filename}"? This cannot be undone.`
              );
              if (ok) {
                onDelete();
              }
            }}
            data-testid={`button-history-delete-${vesselId}-${row.id}`}
            aria-label="Delete this upload"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
