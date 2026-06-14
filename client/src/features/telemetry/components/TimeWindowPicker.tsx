import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface TimeWindowOption {
  label: string;
  value: string;
}

/** Default presets shared by the PdM Overview tab and the Operations streams. */
export const DEFAULT_TIME_WINDOW_OPTIONS: TimeWindowOption[] = [
  { label: "1h", value: "1h" },
  { label: "6h", value: "6h" },
  { label: "24h", value: "24h" },
  { label: "7d", value: "7d" },
];

/** Maps a preset value to the `hours` query window the telemetry APIs expect. */
export const TIME_WINDOW_HOURS: Record<string, number> = {
  "1h": 1,
  "6h": 6,
  "12h": 12,
  "24h": 24,
  "48h": 48,
  "7d": 168,
};

interface TimeWindowPickerProps {
  value: string;
  onChange: (value: string) => void;
  options?: TimeWindowOption[];
  className?: string;
  "data-testid"?: string;
}

/**
 * Small segmented control for picking a telemetry time window. Mirrors the
 * Tabs-based range selector in AccuracyTrendChart so the look is consistent
 * across analytics surfaces. Each trigger exposes a `time-window-<value>`
 * test id so visual/e2e tests can drive the selection.
 */
export function TimeWindowPicker({
  value,
  onChange,
  options = DEFAULT_TIME_WINDOW_OPTIONS,
  className,
  "data-testid": testId = "time-window-picker",
}: TimeWindowPickerProps) {
  return (
    <Tabs value={value} onValueChange={onChange} className={cn("w-auto", className)}>
      <TabsList className="h-8" data-testid={testId}>
        {options.map((option) => (
          <TabsTrigger
            key={option.value}
            value={option.value}
            className="text-xs px-2"
            data-testid={`time-window-${option.value}`}
          >
            {option.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
