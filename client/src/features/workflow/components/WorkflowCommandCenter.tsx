import { ArrowRight, ShipWheel } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRoleWorkflowGuidance } from "../workflow-model";
import { useOperationalWorkflow } from "../useOperationalWorkflow";
import { AttentionItemCard } from "./AttentionItemCard";
import { WorkflowQueueStrip } from "./WorkflowQueueStrip";

export function WorkflowCommandCenter({ roleId }: { roleId: string | null }) {
  const [, setLocation] = useLocation();
  const { queues, attentionItems } = useOperationalWorkflow();
  const roleActions = getRoleWorkflowGuidance(roleId);
  const topItems = attentionItems.slice(0, 3);

  return (
    <section className="mb-6 space-y-4" data-testid="workflow-command-center">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShipWheel className="h-5 w-5 text-primary" />
                Operations Command Center
              </CardTitle>
              <CardDescription>
                Work from queues and next actions instead of hunting through modules.
              </CardDescription>
            </div>
            <Button onClick={() => setLocation("/attention-inbox")} variant="outline">
              Open Attention Inbox
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <WorkflowQueueStrip queues={queues} />
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Highest-priority items</h2>
            <Button variant="ghost" size="sm" onClick={() => setLocation("/attention-inbox")}>
              View all
            </Button>
          </div>

          {topItems.length > 0 ? (
            topItems.map((item) => <AttentionItemCard key={item.id} item={item} />)
          ) : (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-medium">No live attention items right now.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Start from a daily briefing, create a finding, or review scheduled maintenance.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Role next actions</CardTitle>
            <CardDescription>Recommended workflow based on your selected role.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {roleActions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => setLocation(action.href)}
                className="w-full rounded-lg border p-3 text-left transition-colors hover:border-primary"
                data-testid={`role-next-action-${action.id}`}
              >
                <div className="text-sm font-semibold">{action.label}</div>
                <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
