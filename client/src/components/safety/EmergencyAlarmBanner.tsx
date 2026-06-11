import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { POLL_INTERVALS, pollingInterval } from "@/lib/polling";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, BellRing, Check, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALARM_SEVERITY_RANK, ALARM_SAFETY_NOTE, type AlarmSeverity } from "@shared/role-dashboard";

interface MeSafetyAlarm {
  id: string;
  alarmTypeId: string;
  vesselId: string | null;
  title: string;
  message: string | null;
  severity: string;
  mode: string;
  status: string;
  requiresAcknowledgement: boolean;
  triggeredByName: string | null;
  triggeredAt: string | null;
  acknowledged?: boolean;
}

const SEVERITY_STYLES: Record<string, string> = {
  emergency: "border-red-600 bg-red-50 dark:bg-red-950/40 text-red-900 dark:text-red-100",
  critical: "border-red-500 bg-red-50 dark:bg-red-950/30 text-red-900 dark:text-red-100",
  warning: "border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100",
  info: "border-blue-400 bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-100",
};

function severityRank(severity: string): number {
  return ALARM_SEVERITY_RANK[severity as AlarmSeverity] ?? 0;
}

/**
 * Reusable emergency banner shown at the very top of the User page. Polls the
 * scoped active-alarm feed as a fallback to WebSocket delivery. A fetch failure
 * must NOT block the dashboard — we surface a non-blocking refresh warning.
 */
export function EmergencyAlarmBanner() {
  const { toast } = useToast();
  const [refreshFailed, setRefreshFailed] = useState(false);
  const { lastMessage, subscribe } = useWebSocket();

  // Canonical near-real-time delivery: subscribe to the tenant-scoped
  // safety-alarm channel and invalidate the alarm feed on any
  // trigger/clear/acknowledge event. The 15s poll below is the fallback
  // when the socket is unavailable.
  useEffect(() => {
    subscribe("safety-alarms");
  }, [subscribe]);

  useEffect(() => {
    const type = lastMessage?.type;
    if (
      type === "safety_alarm_triggered" ||
      type === "safety_alarm_cleared" ||
      type === "safety_alarm_acknowledged"
    ) {
      queryClient.invalidateQueries({ queryKey: ["/api/me/safety-alarms"] });
    }
  }, [lastMessage]);

  const {
    data: alarms = [],
    isError,
    isSuccess,
  } = useQuery<MeSafetyAlarm[]>({
    queryKey: ["/api/me/safety-alarms"],
    refetchInterval: pollingInterval(POLL_INTERVALS.FAST),
    refetchOnWindowFocus: true,
    retry: 1,
    select: (rows) =>
      [...rows].sort((a, b) => {
        const rank = severityRank(b.severity) - severityRank(a.severity);
        if (rank !== 0) {
          return rank;
        }
        return (b.triggeredAt ?? "").localeCompare(a.triggeredAt ?? "");
      }),
  });

  // A fetch failure must never block the dashboard — surface a non-blocking
  // warning instead. A subsequent successful refresh clears it.
  useEffect(() => {
    if (isError) {
      setRefreshFailed(true);
    } else if (isSuccess) {
      setRefreshFailed(false);
    }
  }, [isError, isSuccess]);

  const acknowledge = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/me/safety-alarms/${id}/acknowledge`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/me/safety-alarms"] });
      toast({ title: "Acknowledged", description: "Your acknowledgement was recorded." });
    },
    onError: () =>
      toast({
        title: "Could not acknowledge",
        description: "Please try again.",
        variant: "destructive",
      }),
  });

  if (alarms.length === 0) {
    return refreshFailed ? (
      <div
        className="rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-200"
        data-testid="banner-alarm-refresh-warning"
      >
        Emergency status could not be refreshed. Showing last known state.
      </div>
    ) : null;
  }

  return (
    <div className="space-y-2" data-testid="emergency-alarm-banner">
      {alarms.map((alarm) => {
        const styles = SEVERITY_STYLES[alarm.severity] ?? SEVERITY_STYLES["info"];
        const isDrillOrTest = alarm.mode === "drill" || alarm.mode === "test";
        const needsAck = alarm.requiresAcknowledgement && !alarm.acknowledged;
        return (
          <div
            key={alarm.id}
            className={cn("rounded-lg border-2 px-4 py-3 shadow-sm", styles)}
            role="alert"
            data-testid={`alarm-${alarm.id}`}
          >
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-6 w-6 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-sm uppercase tracking-wide">{alarm.title}</span>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {alarm.severity}
                  </Badge>
                  {isDrillOrTest && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] uppercase font-bold"
                      data-testid={`alarm-mode-${alarm.id}`}
                    >
                      {alarm.mode}
                    </Badge>
                  )}
                  {alarm.acknowledged && (
                    <Badge variant="outline" className="text-[10px] uppercase">
                      <Check className="h-3 w-3 mr-1" /> Acknowledged
                    </Badge>
                  )}
                </div>
                {alarm.message && <p className="text-sm mt-1 break-words">{alarm.message}</p>}
                <p className="text-[11px] opacity-80 mt-1">
                  {alarm.triggeredByName ? `Triggered by ${alarm.triggeredByName}` : "Triggered"}
                  {alarm.triggeredAt ? ` · ${new Date(alarm.triggeredAt).toLocaleString()}` : ""}
                </p>
              </div>
              {needsAck && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => acknowledge.mutate(alarm.id)}
                  disabled={acknowledge.isPending}
                  data-testid={`button-acknowledge-${alarm.id}`}
                >
                  <BellRing className="h-4 w-4 mr-1" /> Acknowledge
                </Button>
              )}
            </div>
          </div>
        );
      })}
      <p className="flex items-center gap-1 text-[11px] text-muted-foreground px-1">
        <AlertTriangle className="h-3 w-3" />
        {ALARM_SAFETY_NOTE}
      </p>
    </div>
  );
}
