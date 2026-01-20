import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle, Clock, AlertTriangle, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow, format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import type { DtcFault, DtcDefinition } from "@shared/schema";

interface EnrichedDtcFault extends DtcFault {
  definition?: DtcDefinition;
}

interface ActiveDtcsPanelProps {
  equipmentId: string;
  equipmentName?: string;
}

export function ActiveDtcsPanel({ equipmentId, equipmentName }: ActiveDtcsPanelProps) {
  const {
    data: activeDtcs = [],
    isLoading,
    isError,
  } = useQuery<EnrichedDtcFault[]>({
    queryKey: ["/api/equipment", equipmentId, "dtc", "active"],
    queryFn: () => apiRequest("GET", `/api/equipment/${equipmentId}/dtc/active`),
    refetchInterval: 30000,
  });

  const getSeverityColor = (severity?: number) => {
    switch (severity) {
      case 1:
      case 2:
        return "destructive";
      case 3:
        return "default";
      case 4:
        return "secondary";
      default:
        return "outline";
    }
  };

  const getSeverityIcon = (severity?: number) => {
    switch (severity) {
      case 1:
      case 2:
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 3:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSeverityLabel = (severity?: number) => {
    switch (severity) {
      case 1:
        return "critical";
      case 2:
        return "high";
      case 3:
        return "moderate";
      case 4:
        return "low";
      default:
        return "unknown";
    }
  };

  const criticalFaults = activeDtcs.filter(
    (dtc) => dtc.definition?.severity === 1 || dtc.definition?.severity === 2
  ).length;
  const warningFaults = activeDtcs.filter((dtc) => dtc.definition?.severity === 3).length;

  return (
    <Card data-testid={`active-dtcs-panel-${equipmentId}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Active Fault Codes
            </CardTitle>
            <CardDescription>
              {equipmentName
                ? `Diagnostic trouble codes for ${equipmentName}`
                : "Current active DTCs"}
            </CardDescription>
          </div>
          {activeDtcs.length > 0 && (
            <div className="flex items-center gap-2">
              {criticalFaults > 0 && (
                <Badge variant="destructive" data-testid="badge-critical-count">
                  {criticalFaults} Critical
                </Badge>
              )}
              {warningFaults > 0 && (
                <Badge variant="default" data-testid="badge-warning-count">
                  {warningFaults} Warning
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : isError ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 text-destructive" />
            <p>Failed to load fault codes</p>
          </div>
        ) : activeDtcs.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <p className="text-muted-foreground">No active fault codes - system healthy!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeDtcs.map((dtc, index) => (
              <div
                key={`${dtc.spn}-${dtc.fmi}-${index}`}
                className="p-4 bg-muted/50 rounded-lg border border-border hover:border-primary/50 transition-colors"
                data-testid={`dtc-item-${index}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    {getSeverityIcon(dtc.definition?.severity)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="font-mono font-semibold text-foreground whitespace-nowrap">
                          SPN {dtc.spn} / FMI {dtc.fmi}
                        </span>
                        <Badge
                          variant={getSeverityColor(dtc.definition?.severity)}
                          className="capitalize"
                        >
                          {getSeverityLabel(dtc.definition?.severity)}
                        </Badge>
                      </div>
                      <p className="text-sm text-foreground mb-2">
                        {dtc.definition?.description || "No description available"}
                      </p>
                      {dtc.oc && dtc.oc > 1 && (
                        <p className="text-xs font-medium text-yellow-600">{dtc.oc} occurrences</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground whitespace-nowrap">
                    {dtc.firstSeen && (
                      <div className="flex items-center gap-1 justify-end mb-1">
                        <Clock className="h-3 w-3" />
                        <span>
                          {formatDistanceToNow(new Date(dtc.firstSeen), { addSuffix: true })}
                        </span>
                      </div>
                    )}
                    {dtc.lastSeen && (
                      <div className="text-xs">
                        Last: {format(new Date(dtc.lastSeen), "MMM d, HH:mm")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
