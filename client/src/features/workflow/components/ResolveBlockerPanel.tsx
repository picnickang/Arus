import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ExternalLink, PackageSearch, Save, ShieldCheck, Wrench } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AttentionItem, BlockerResolutionRecord } from "../types";

function blockerType(reason: string | null | undefined): string {
  const normalized = reason?.toLowerCase() ?? "";
  if (normalized.includes("part") || normalized.includes("stock") || normalized.includes("inventory")) return "Parts / inventory";
  if (normalized.includes("vendor") || normalized.includes("supplier")) return "Vendor / supplier";
  if (normalized.includes("approval") || normalized.includes("sign")) return "Approval";
  if (normalized.includes("weather")) return "Weather";
  if (normalized.includes("crew") || normalized.includes("technician")) return "Crew availability";
  return "Information needed";
}

export function ResolveBlockerPanel({ item }: { item: AttentionItem }) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const reason = item.blockerReason || item.whyItMatters.replace(/^Blocked because:\s*/i, "");
  const type = blockerType(reason);
  const isInventory = item.type === "inventory";
  const [owner, setOwner] = useState(item.lastResolution?.owner || item.owner || "");
  const [eta, setEta] = useState(item.lastResolution?.eta || "");
  const [status, setStatus] = useState<BlockerResolutionRecord["status"]>(item.lastResolution?.status || "updated");
  const [note, setNote] = useState(item.lastResolution?.note || "");

  const inventoryActions = useMemo(
    () => [
      {
        label: "Review part",
        href: item.href,
      },
      {
        label: "Create PR / service request",
        href: `/service-requests?workflow=low-stock&partId=${encodeURIComponent(item.sourceId ?? "")}`,
      },
      {
        label: "Open inventory",
        href: `/inventory-management?partId=${encodeURIComponent(item.sourceId ?? "")}&workflow=low-stock`,
      },
    ],
    [item.href, item.sourceId]
  );

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest<BlockerResolutionRecord>("POST", "/api/attention/blocker-resolutions", {
        itemId: item.id,
        workOrderId: isInventory ? undefined : item.sourceId,
        inventoryItemId: isInventory ? item.sourceId : undefined,
        blockerType: type,
        reason,
        owner: owner || undefined,
        eta: eta || undefined,
        status,
        note: note || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attention/items"] });
      toast({ title: "Resolution saved", description: "The blocker update is now part of the workflow state." });
    },
    onError: (error) => {
      toast({
        title: "Could not save blocker update",
        description: error instanceof Error ? error.message : "The backend rejected the blocker update.",
        variant: "destructive",
      });
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Resolve blocker</CardTitle>
        <CardDescription>
          Capture reason, owner, ETA, and resolution status so the blocker is more than a navigation link.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border p-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Blocker type</div>
          <div className="font-semibold">{type}</div>
          <p className="mt-1 text-sm text-muted-foreground">{reason || "No blocker reason captured yet."}</p>
          {item.lastResolution && (
            <p className="mt-2 text-xs text-muted-foreground">
              Last update: {item.lastResolution.status} {item.lastResolution.eta ? `• ETA ${item.lastResolution.eta}` : ""} •{" "}
              {new Date(item.lastResolution.savedAt).toLocaleString()}
            </p>
          )}
        </div>

        {isInventory ? (
          <div className="grid gap-2 md:grid-cols-3">
            {inventoryActions.map((action) => (
              <Button key={action.href} variant="outline" onClick={() => setLocation(action.href)}>
                <PackageSearch className="h-4 w-4" />
                {action.label}
              </Button>
            ))}
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-3">
            <Button variant="outline" onClick={() => setLocation(`/inventory-management?workflow=resolve-blocker&workOrderId=${item.sourceId ?? ""}`)}>
              <PackageSearch className="h-4 w-4" />
              Check parts
            </Button>
            <Button variant="outline" onClick={() => setLocation(`/service-requests?workflow=work-order-blocker&workOrderId=${item.sourceId ?? ""}`)}>
              <ExternalLink className="h-4 w-4" />
              Vendor / PR
            </Button>
            <Button onClick={() => setLocation(item.href)}>
              <Wrench className="h-4 w-4" />
              Open job
            </Button>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-3">
          <Input value={owner} onChange={(event) => setOwner(event.target.value)} placeholder="Owner / next action holder" />
          <Input value={eta} onChange={(event) => setEta(event.target.value)} placeholder="ETA, due date, or next check" />
          <Select value={status} onValueChange={(value) => setStatus(value as BlockerResolutionRecord["status"])}>
            <SelectTrigger>
              <SelectValue placeholder="Resolution status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated">Updated</SelectItem>
              <SelectItem value="waiting">Waiting</SelectItem>
              <SelectItem value="unblocked">Unblocked</SelectItem>
              <SelectItem value="deferred">Deferred</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Resolution note, vendor status, part order reference, approval note, or deferment reason..."
        />
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            <Save className="h-4 w-4" />
            {saveMutation.isPending ? "Saving..." : "Save blocker update"}
          </Button>
        </div>
        <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            This records workflow state without requiring a risky work-order schema migration. A future migration can promote blocker reason/ETA to first-class work-order fields.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
