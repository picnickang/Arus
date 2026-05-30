import type { ComponentType } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Clock, ShipWheel, Wrench } from "lucide-react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOperationalWorkflow } from "../useOperationalWorkflow";
import { getPortalForRole } from "@/application/navigation/role-navigation-policy";

const ROLE_TITLES: Record<string, string> = {
  chief_engineer: "Chief Engineer Today",
  deck_officer: "Deck Officer Today",
  fleet_manager: "Fleet Manager Today",
  system_admin: "System Admin Today",
  default: "Today",
};

const ROLE_PRIMARY_ACTIONS: Record<string, Array<{ label: string; href: string }>> = {
  chief_engineer: [
    { label: "Close ready jobs", href: "/attention-inbox?queue=ready_to_close" },
    { label: "Review PdM risks", href: "/equipment-intelligence" },
    { label: "Scan equipment", href: "/equipment-scan" },
  ],
  deck_officer: [
    { label: "Prepare handover", href: "/attention-inbox?view=handover" },
    { label: "New deck log", href: "/logs?tab=deck&action=new" },
    { label: "Rest hours", href: "/hours-of-rest" },
  ],
  fleet_manager: [
    { label: "Fleet risk", href: "/analytics" },
    { label: "Compliance queue", href: "/logs?tab=compliance" },
    { label: "Overdue work", href: "/attention-inbox?queue=due_today" },
  ],
  system_admin: [
    { label: "Sync outbox", href: "/offline-outbox" },
    { label: "Sensor health", href: "/sensors" },
    { label: "Audit/system", href: "/system-administration" },
  ],
  default: [
    { label: "Attention Inbox", href: "/attention-inbox" },
    { label: "New work order", href: "/work-orders?action=create" },
    { label: "Offline Outbox", href: "/offline-outbox" },
  ],
};

export function RoleTodayPanel({ roleId }: { roleId: string | null }) {
  const [, setLocation] = useLocation();
  const { attentionItems, handover } = useOperationalWorkflow();
  const roleKey = roleId || "default";
  const critical = attentionItems.filter((item) => item.severity === "critical").length;
  const readyToClose = handover.readyForCloseout ?? 0;
  const blocked = handover.blockedJobs ?? 0;
  const waitingParts = handover.waitingOnParts ?? 0;
  // Command Queue (Attention Inbox) is admin-portal only. For
  // user-portal roles (deck_officer, viewer) we hide the header
  // button AND strip any role action whose href targets
  // /attention-inbox so a user can't deep-link in.
  const isAdminPortal = getPortalForRole(roleId) === "admin";
  const rawActions = ROLE_PRIMARY_ACTIONS[roleKey] ?? ROLE_PRIMARY_ACTIONS['default'];
  const actions = isAdminPortal
    ? rawActions
    : (rawActions ?? []).filter((a) => !a.href.startsWith("/attention-inbox"));

  return (
    <Card className="mb-6" data-testid="role-today-panel">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShipWheel className="h-5 w-5 text-primary" />
              {ROLE_TITLES[roleKey] ?? ROLE_TITLES['default']}
            </CardTitle>
            <CardDescription>Start with risk, blockers, closeout, and handover before opening modules.</CardDescription>
          </div>
          {isAdminPortal && (
            <Button
              variant="outline"
              onClick={() => setLocation("/attention-inbox")}
              data-testid="button-open-command-queue"
            >
              Open command queue
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric icon={AlertTriangle} label="Critical" value={critical} variant={critical > 0 ? "destructive" : "secondary"} />
          <Metric icon={Wrench} label="Blocked" value={blocked} variant={blocked > 0 ? "destructive" : "secondary"} />
          <Metric icon={ClipboardCheck} label="Ready closeout" value={readyToClose} />
          <Metric icon={Clock} label="Waiting parts" value={waitingParts} />
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {(actions ?? []).map((action) => (
            <Button key={action.href} variant="secondary" className="justify-between" onClick={() => setLocation(action.href)}>
              {action.label}
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ icon: Icon, label, value, variant = "outline" }: { icon: ComponentType<{ className?: string | undefined }>; label: string; value: number; variant?: "outline" | "secondary" | "destructive" }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <Badge variant={variant}>{value}</Badge>
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export default RoleTodayPanel;
