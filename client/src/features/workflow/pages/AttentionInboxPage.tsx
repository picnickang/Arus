import { AlertTriangle, ClipboardCheck, Filter, Search, ShipWheel } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { PageHeader } from "@/components/navigation/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AttentionItemCard } from "../components/AttentionItemCard";
import { HandoverNotesPanel } from "../components/HandoverNotesPanel";
import { ReportIssueFlowCard } from "../components/ReportIssueFlowCard";
import { ResolveBlockerPanel } from "../components/ResolveBlockerPanel";
import { WorkflowQueueStrip } from "../components/WorkflowQueueStrip";
import { WorkOrderLifecycleStrip } from "../components/WorkOrderLifecycleStrip";
import type { AttentionItem, WorkflowStatus } from "../types";
import { useOperationalWorkflow } from "../useOperationalWorkflow";

function parseParams(location: string): URLSearchParams {
  const [, query = ""] = location.split("?");
  return new URLSearchParams(query);
}

function tabFromParams(params: URLSearchParams): "attention" | "blockers" | "handover" {
  const view = params.get("view");
  const queue = params.get("queue");
  if (view === "handover") return "handover";
  if (queue === "blocked" || queue === "waiting_parts") return "blockers";
  return "attention";
}

function queueLabel(queue: string | null, items: { id: string; label: string }[]): string {
  if (!queue) return "All attention";
  return items.find((item) => item.id === queue)?.label ?? queue.replace(/_/g, " ");
}

function itemMatchesQueue(item: AttentionItem, queue: string | null): boolean {
  if (!queue || queue === "all") return true;
  if (queue === "open_work") return item.type === "work_order";
  return item.queue === queue;
}

function itemMatchesFilter(item: AttentionItem, filter: string | null): boolean {
  if (!filter || filter === "all") return true;
  if (filter === "equipment") return item.type === "equipment" || item.source.toLowerCase().includes("equipment");
  if (filter === "inventory") return item.type === "inventory" || item.source.toLowerCase().includes("inventory");
  if (filter === "work_order") return item.type === "work_order";
  return [item.type, item.source, item.status].some((value) => String(value ?? "").toLowerCase().includes(filter.toLowerCase()));
}

function searchItems(items: AttentionItem[], search: string): AttentionItem[] {
  const term = search.trim().toLowerCase();
  if (!term) return items;
  return items.filter((item) =>
    [item.title, item.source, item.whyItMatters, item.recommendedAction, item.owner, item.queue, item.status]
      .join(" ")
      .toLowerCase()
      .includes(term)
  );
}

export default function AttentionInboxPage() {
  const [location, setLocation] = useLocation();
  const { queues, attentionItems, workOrders, handover, hasLiveData, usingAggregatedWorkflow, generatedAt, sources } = useOperationalWorkflow();
  const [search, setSearch] = useState("");
  const params = useMemo(() => parseParams(location), [location]);
  const queue = params.get("queue") as WorkflowStatus | null;
  const filter = params.get("filter");
  const activeTab = tabFromParams(params);

  const filteredItems = useMemo(() => {
    const queueFiltered = attentionItems.filter((item) => itemMatchesQueue(item, queue));
    const typeFiltered = queueFiltered.filter((item) => itemMatchesFilter(item, filter));
    return searchItems(typeFiltered, search);
  }, [attentionItems, queue, filter, search]);

  const blockerItems = useMemo(() => {
    if (queue === "blocked") {
      return attentionItems.filter((item) => item.queue === "blocked");
    }
    if (queue === "waiting_parts") {
      return attentionItems.filter((item) => item.queue === "waiting_parts");
    }
    return attentionItems.filter((item) => item.queue === "blocked" || item.queue === "waiting_parts");
  }, [attentionItems, queue]);

  const closeoutWork = workOrders
    .filter((item) => item.status?.toLowerCase().includes("ready") || item.status?.toLowerCase().includes("verify"))
    .slice(0, 8);

  const changeTab = (value: string) => {
    if (value === "handover") {
      setLocation("/attention-inbox?view=handover");
    } else if (value === "blockers") {
      setLocation("/attention-inbox?queue=blocked");
    } else {
      setLocation("/attention-inbox");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6">
      <PageHeader
        title="Attention Inbox"
        subtitle="A single operational queue for risks, blockers, handover items, and next actions."
      />

      <div className="space-y-6 px-4 pt-2 lg:px-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <ShipWheel className="h-5 w-5 text-primary" />
                  Work from risk to resolution
                </CardTitle>
                <CardDescription>
                  Each item shows what happened, why it matters, who owns it, and the recommended next action.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={usingAggregatedWorkflow ? "default" : "outline"}>
                  {usingAggregatedWorkflow ? "Aggregated workflow" : "Fallback workflow"}
                </Badge>
                <Button onClick={() => setLocation("/work-orders?action=create")}> 
                  <ClipboardCheck className="h-4 w-4" />
                  New work order
                </Button>
              </div>
            </div>
            {generatedAt && <p className="text-xs text-muted-foreground">Updated {new Date(generatedAt).toLocaleString()}</p>}
          </CardHeader>
          <CardContent>
            <WorkflowQueueStrip queues={queues} />
          </CardContent>
        </Card>

        {sources && Object.values(sources).some((status) => status === "failed") && (
          <Card className="border-destructive/40">
            <CardContent className="flex items-start gap-3 p-4 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
              <div>
                <div className="font-medium">Some attention sources are unavailable.</div>
                <p className="text-muted-foreground">The inbox is showing partial data. Source health: work orders {sources.workOrders}, alerts {sources.alerts}, equipment {sources.equipment}, inventory {sources.inventory}.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={changeTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 lg:w-[520px]">
            <TabsTrigger value="attention">Attention</TabsTrigger>
            <TabsTrigger value="blockers">Blockers</TabsTrigger>
            <TabsTrigger value="handover">Handover</TabsTrigger>
          </TabsList>

          <TabsContent value="attention" className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative max-w-xl flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by source, action, owner, or risk..."
                  className="pl-9"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span>Queue: {queueLabel(queue, queues)}</span>
                {filter && <span>• Filter: {filter}</span>}
                {(queue || filter) && (
                  <Button variant="ghost" size="sm" onClick={() => setLocation("/attention-inbox")}>Clear</Button>
                )}
              </div>
            </div>

            <ReportIssueFlowCard />

            {filteredItems.length > 0 ? (
              <div className="space-y-3">
                {filteredItems.map((item) => (
                  <AttentionItemCard key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold">
                    {hasLiveData ? "No matching attention items." : "No live attention data yet."}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Create a finding, import equipment, record logs, or add work orders to populate this queue.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="blockers" className="space-y-3">
            {blockerItems.length > 0 ? (
              blockerItems.map((item) => (
                <div key={item.id} className="space-y-3">
                  <AttentionItemCard item={item} />
                  <ResolveBlockerPanel item={item} />
                  {item.type === "work_order" && item.status && <WorkOrderLifecycleStrip status={item.status} />}
                </div>
              ))
            ) : (
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold">No blocked work detected.</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    When work is blocked, require a reason such as parts, vendor, approval, weather, crew, or missing information.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="handover" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Shift handover summary</CardTitle>
                <CardDescription>
                  Use this view before watch change or manager briefing.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
                <div className="rounded-lg border p-4">
                  <div className="text-2xl font-bold">{handover.openAttentionItems}</div>
                  <div className="text-sm text-muted-foreground">Open attention items</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-2xl font-bold">{handover.criticalItems}</div>
                  <div className="text-sm text-muted-foreground">Critical items</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-2xl font-bold">{handover.blockedJobs}</div>
                  <div className="text-sm text-muted-foreground">Blocked jobs</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-2xl font-bold">{handover.waitingOnParts}</div>
                  <div className="text-sm text-muted-foreground">Waiting on parts</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-2xl font-bold">{handover.readyForCloseout || closeoutWork.length}</div>
                  <div className="text-sm text-muted-foreground">Ready for closeout</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-2xl font-bold">{handover.openWorkOrders || workOrders.length}</div>
                  <div className="text-sm text-muted-foreground">Open work orders</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-2xl font-bold">{handover.lowStockParts}</div>
                  <div className="text-sm text-muted-foreground">Low-stock parts</div>
                </div>
              </CardContent>
            </Card>

            <HandoverNotesPanel handover={handover} items={attentionItems} />

            <div className="space-y-3">
              {attentionItems.slice(0, 6).map((item) => (
                <AttentionItemCard key={`handover-${item.id}`} item={item} />
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
