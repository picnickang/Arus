import { ClipboardCheck, Search, ShipWheel } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/navigation/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AttentionItemCard } from "../components/AttentionItemCard";
import { WorkflowQueueStrip } from "../components/WorkflowQueueStrip";
import { WorkOrderLifecycleStrip } from "../components/WorkOrderLifecycleStrip";
import { useOperationalWorkflow } from "../useOperationalWorkflow";

export default function AttentionInboxPage() {
  const { queues, attentionItems, workOrders, hasLiveData } = useOperationalWorkflow();
  const [search, setSearch] = useState("");

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return attentionItems;
    }

    return attentionItems.filter((item) =>
      [item.title, item.source, item.whyItMatters, item.recommendedAction, item.owner]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [attentionItems, search]);

  const blockedWork = workOrders.filter((item) => Boolean(item.blockedReason)).slice(0, 8);
  const closeoutWork = workOrders
    .filter((item) => item.status?.toLowerCase().includes("ready") || item.status?.toLowerCase().includes("verify"))
    .slice(0, 8);

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
              <Button onClick={() => window.location.assign("/work-orders?action=create")}>
                <ClipboardCheck className="h-4 w-4" />
                New work order
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <WorkflowQueueStrip queues={queues} />
          </CardContent>
        </Card>

        <Tabs defaultValue="attention" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 lg:w-[520px]">
            <TabsTrigger value="attention">Attention</TabsTrigger>
            <TabsTrigger value="blockers">Blockers</TabsTrigger>
            <TabsTrigger value="handover">Handover</TabsTrigger>
          </TabsList>

          <TabsContent value="attention" className="space-y-4">
            <div className="relative max-w-xl">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by source, action, owner, or risk..."
                className="pl-9"
              />
            </div>

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
            {blockedWork.length > 0 ? (
              blockedWork.map((item) => (
                <Card key={item.id}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h3 className="font-semibold">{item.title || `Work order ${item.id}`}</h3>
                        <p className="text-sm text-muted-foreground">
                          Blocked because: {item.blockedReason}
                        </p>
                      </div>
                      <Button variant="outline" onClick={() => window.location.assign(`/work-orders?id=${item.id}`)}>
                        Resolve blocker
                      </Button>
                    </div>
                    <WorkOrderLifecycleStrip status={item.status} />
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-semibold">No blocked work detected.</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    When work is blocked, require a reason such as parts, vendor, approval, weather, or missing information.
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
              <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-lg border p-4">
                  <div className="text-2xl font-bold">{attentionItems.length}</div>
                  <div className="text-sm text-muted-foreground">Open attention items</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-2xl font-bold">{blockedWork.length}</div>
                  <div className="text-sm text-muted-foreground">Blocked jobs</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-2xl font-bold">{closeoutWork.length}</div>
                  <div className="text-sm text-muted-foreground">Ready for closeout</div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-2xl font-bold">{workOrders.length}</div>
                  <div className="text-sm text-muted-foreground">Open work orders</div>
                </div>
              </CardContent>
            </Card>

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
