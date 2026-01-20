/**
 * SensorConfigItemRow component
 * Displays a single sensor configuration row with edit/delete actions
 */

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { StatusIndicator } from "@/components/status-indicator";
import { SensorConfiguration } from "@shared/schema";

interface SensorStatus {
  id: string;
  status: "online" | "offline";
  lastTelemetry?: string | null;
  lastValue?: number | null;
}

interface SensorConfigItemRowProps {
  config: SensorConfiguration;
  status: SensorStatus | undefined;
  onEdit: (config: SensorConfiguration) => void;
  onDelete: (config: SensorConfiguration) => void;
}

export function SensorConfigItemRow({
  config,
  status,
  onEdit,
  onDelete,
}: SensorConfigItemRowProps) {
  const isOnline = status?.status === "online";
  const isConfigEnabled = config.enabled;
  const showNoDataWarning = !isOnline && isConfigEnabled;

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 border rounded transition-colors ${
        showNoDataWarning ? "border-orange-500/30 bg-orange-500/5" : ""
      }`}
    >
      <SensorInfo
        config={config}
        status={status}
        isOnline={isOnline}
        showNoDataWarning={showNoDataWarning}
      />
      <SensorActions config={config} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

interface SensorInfoProps {
  config: SensorConfiguration;
  status: SensorStatus | undefined;
  isOnline: boolean;
  showNoDataWarning: boolean;
}

function SensorInfo({ config, status, isOnline, showNoDataWarning }: SensorInfoProps) {
  return (
    <div className="flex flex-col gap-2 flex-1">
      <SensorBadges
        config={config}
        status={status}
        isOnline={isOnline}
        showNoDataWarning={showNoDataWarning}
      />
      <SensorMetadata config={config} status={status} />
    </div>
  );
}

interface SensorBadgesProps {
  config: SensorConfiguration;
  status: SensorStatus | undefined;
  isOnline: boolean;
  showNoDataWarning: boolean;
}

function SensorBadges({ config, status, showNoDataWarning }: SensorBadgesProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={config.enabled ? "default" : "secondary"}>
        {config.sensorType}
      </Badge>
      <div className="flex items-center gap-1">
        <StatusIndicator status={status?.status || "offline"} showLabel={true} />
        {showNoDataWarning && (
          <Badge variant="outline" className="text-orange-600 border-orange-600">
            No Data
          </Badge>
        )}
      </div>
      <span className="text-xs text-muted-foreground">
        Config: {config.enabled ? "Enabled" : "Disabled"}
      </span>
      {config.targetUnit && (
        <span className="text-xs text-muted-foreground">• {config.targetUnit}</span>
      )}
    </div>
  );
}

interface SensorMetadataProps {
  config: SensorConfiguration;
  status: SensorStatus | undefined;
}

function SensorMetadata({ config, status }: SensorMetadataProps) {
  const hasLastTelemetry = status?.lastTelemetry;
  const lastValueText = status?.lastValue !== null && status?.lastValue === undefined ? "" : ` (${status.lastValue.toFixed(2)})`
    ;

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      {hasLastTelemetry ? (
        <span>
          Last: {format(new Date(status.lastTelemetry!), "MMM d, HH:mm:ss")}
          {lastValueText}
        </span>
      ) : (
        <span className="text-orange-600">No telemetry received</span>
      )}
      <span>Gain: {config.gain} | Offset: {config.offset}</span>
    </div>
  );
}

interface SensorActionsProps {
  config: SensorConfiguration;
  onEdit: (config: SensorConfiguration) => void;
  onDelete: (config: SensorConfiguration) => void;
}

function SensorActions({ config, onEdit, onDelete }: SensorActionsProps) {
  return (
    <div className="flex items-center gap-2 self-end sm:self-auto">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onEdit(config)}
        data-testid={`button-edit-sensor-${config.id}`}
      >
        <Pencil className="h-3 w-3" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDelete(config)}
        data-testid={`button-delete-sensor-${config.id}`}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}
