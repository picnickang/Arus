/**
 * OperatingParamStatusCard component
 * Displays a single operating parameter with its status
 */

import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertCircle } from "lucide-react";
import {
  OperatingParam,
  TelemetryReading,
  computeOperatingStatus,
  getStatusCardClasses,
  getStatusBadgeVariant,
  getStatusValueClass,
  formatOptimalRange,
  formatCriticalRange,
} from "./equipment-view-helpers";

interface OperatingParamStatusCardProps {
  param: OperatingParam;
  telemetry: TelemetryReading[];
}

export function OperatingParamStatusCard({ param, telemetry }: OperatingParamStatusCardProps) {
  const reading = telemetry.find((t) => t.sensorType === param.parameterType);
  const currentValue = reading?.value;
  const { status, statusMessage } = computeOperatingStatus(param, currentValue);

  const hasOptimalRange = param.optimalMin !== null || param.optimalMax !== null;
  const hasCriticalRange = param.criticalMin !== null || param.criticalMax !== null;
  const hasCurrentValue = currentValue !== undefined;

  return (
    <div
      className={`p-3 border rounded-lg ${getStatusCardClasses(status)}`}
      data-testid={`parameter-${param.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge
              variant={getStatusBadgeVariant(status)}
              data-testid={`badge-status-${param.id}`}
            >
              {status.toUpperCase()}
            </Badge>
            <span className="text-sm font-medium" data-testid={`text-param-name-${param.id}`}>
              {param.parameterName}
            </span>
          </div>

          <div className="text-xs space-y-1.5">
            <CurrentValueRow
              param={param}
              currentValue={currentValue}
              status={status}
            />

            {hasOptimalRange && (
              <RangeRow
                label="Optimal Range:"
                value={formatOptimalRange(param)}
                testId={`text-optimal-${param.id}`}
              />
            )}

            {hasCriticalRange && (
              <RangeRow
                label="Critical Range:"
                value={formatCriticalRange(param)}
                testId={`text-critical-${param.id}`}
                className="text-red-600 dark:text-red-400"
              />
            )}

            {hasCurrentValue && (
              <StatusMessageRow
                statusMessage={statusMessage}
                testId={`text-status-msg-${param.id}`}
              />
            )}

            {param.lifeImpactDescription && (
              <ImpactRow
                icon={<TrendingUp className="h-3 w-3 mt-0.5 flex-shrink-0" />}
                text={param.lifeImpactDescription}
                testId={`text-life-impact-${param.id}`}
              />
            )}

            {param.recommendedAction && (
              <ImpactRow
                icon={<AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />}
                text={param.recommendedAction}
                testId={`text-action-${param.id}`}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface CurrentValueRowProps {
  param: OperatingParam;
  currentValue: number | undefined;
  status: "critical" | "warning" | "normal" | "unknown";
}

function CurrentValueRow({ param, currentValue, status }: CurrentValueRowProps) {
  const valueText = currentValue === undefined ? "No data" : `${currentValue.toFixed(2)} ${param.unit || ""}`
    ;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
      <span className="text-muted-foreground sm:min-w-[100px]">Current Value:</span>
      <span
        className={`font-medium ${getStatusValueClass(status)}`}
        data-testid={`text-current-${param.id}`}
      >
        {valueText}
      </span>
    </div>
  );
}

interface RangeRowProps {
  label: string;
  value: string;
  testId: string;
  className?: string;
}

function RangeRow({ label, value, testId, className = "" }: RangeRowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
      <span className="text-muted-foreground sm:min-w-[100px]">{label}</span>
      <span className={`font-medium ${className}`} data-testid={testId}>
        {value}
      </span>
    </div>
  );
}

interface StatusMessageRowProps {
  statusMessage: string;
  testId: string;
}

function StatusMessageRow({ statusMessage, testId }: StatusMessageRowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 pt-1">
      <span className="text-muted-foreground sm:min-w-[100px]">Status:</span>
      <span className="text-xs" data-testid={testId}>{statusMessage}</span>
    </div>
  );
}

interface ImpactRowProps {
  icon: React.ReactNode;
  text: string;
  testId: string;
}

function ImpactRow({ icon, text, testId }: ImpactRowProps) {
  return (
    <div className="flex items-start gap-2 mt-2 pt-2 border-t border-current/10">
      {icon}
      <span className="text-muted-foreground" data-testid={testId}>{text}</span>
    </div>
  );
}
