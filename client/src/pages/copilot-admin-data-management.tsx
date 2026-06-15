import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { apiRequest, createHeaders, resolveUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, Database, Download, Trash2 } from "lucide-react";

export function CopilotDataManagement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return (
    <details className="border rounded-lg" data-testid="data-management">
      <summary className="p-3 text-sm font-semibold cursor-pointer hover:bg-accent/30 flex items-center gap-2">
        <Database className="h-4 w-4" /> Data Management
        <ChevronDown className="h-3 w-3 ml-auto" />
      </summary>
      <div className="p-4 border-t space-y-3">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                const res = await fetch(resolveUrl("/api/agent/admin/export-jsonl"), {
                  headers: createHeaders(),
                  credentials: "include",
                });
                if (!res.ok) {
                  throw new Error(await res.text());
                }
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const anchor = document.createElement("a");
                anchor.href = url;
                anchor.download = `agent-conversations-${new Date().toISOString().slice(0, 10)}.jsonl`;
                anchor.click();
                URL.revokeObjectURL(url);
                toast({ title: "Export downloaded" });
              } catch (err: unknown) {
                toast({
                  title: "Export failed",
                  description: err instanceof Error ? err.message : String(err),
                  variant: "destructive",
                });
              }
            }}
            data-testid="button-export-jsonl"
          >
            <Download className="h-4 w-4 mr-1" /> Export JSONL
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (
                window.confirm(
                  "Permanently delete ALL conversations, messages, tool calls, and drafts?"
                )
              ) {
                apiRequest<{ purged?: number }>("DELETE", "/api/agent/admin/conversations").then(
                  (data) => {
                    queryClient.invalidateQueries({
                      queryKey: ["/api/agent/admin/conversations"],
                    });
                    queryClient.invalidateQueries({ queryKey: ["/api/agent/usage"] });
                    toast({ title: `Purged ${data?.purged || 0} conversations` });
                  }
                );
              }
            }}
            data-testid="button-purge"
          >
            <Trash2 className="h-4 w-4 mr-1" /> Purge All
          </Button>
        </div>
      </div>
    </details>
  );
}
