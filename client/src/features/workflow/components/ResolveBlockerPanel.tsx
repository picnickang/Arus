import { ExternalLink, PackageSearch, ShieldCheck, Wrench } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { AttentionItem } from "../types";

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
  const reason = item.blockerReason || item.whyItMatters.replace(/^Blocked because:\s*/i, "");
  const type = blockerType(reason);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Resolve blocker</CardTitle>
        <CardDescription>
          Use a structured reason so managers can see what is actually delaying work.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border p-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Blocker type</div>
          <div className="font-semibold">{type}</div>
          <p className="mt-1 text-sm text-muted-foreground">{reason || "No blocker reason captured yet."}</p>
        </div>
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
        <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Next version should write blocker reason, owner, ETA, and resolution note back to the work order audit trail.</span>
        </div>
      </CardContent>
    </Card>
  );
}
