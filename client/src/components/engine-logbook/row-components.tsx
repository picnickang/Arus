import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { format } from "date-fns";
import {
  checkAnomaly,
  getAnomalyClass,
  getEngineEventTypeConfig,
  type EngineLogEvent,
} from "@/features/engine-logbook";

export interface HourlyEntry {
  meRpm?: number;
  meLoad?: number;
  meFuelRackPosition?: number;
  meExhaustTempPort?: number;
  meScavAirPress?: number;
  meCoolantTempIn?: number;
  meCoolantTempOut?: number;
  meLubOilPress?: number;
  meLubOilTemp?: number;
  meTurbochargerRpm?: number;
  meFuelOilTemp?: number;
  remarks?: string;
}

export interface GeneratorEntry {
  loadKw?: number;
  voltage?: number;
  frequency?: number;
  exhaustTemp?: number;
  lubOilPress?: number;
  coolantTemp?: number;
  runningHours?: number;
  status?: string;
}

export interface WatchData {
  chiefEngineerName?: string;
  secondEngineerName?: string;
  thirdEngineerName?: string;
  motormanName?: string;
}

export function EngineHourlyRow({
  hour,
  entry,
  isLocked,
  updateHourlyEntry,
}: {
  hour: number;
  entry: HourlyEntry;
  isLocked: boolean;
  updateHourlyEntry: (
    hour: number,
    field: string,
    value: string | number | boolean | null | undefined
  ) => void;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium sticky left-0 bg-background">
        {hour.toString().padStart(2, "0")}:00
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={entry.meRpm ?? ""}
          onChange={(ev) =>
            updateHourlyEntry(hour, "meRpm", ev.target.value ? Number(ev.target.value) : undefined)
          }
          className={`w-full h-8 ${getAnomalyClass("meRpm", entry.meRpm)}`}
          disabled={isLocked}
          data-testid={`input-hourly-rpm-${hour}`}
          title={checkAnomaly("meRpm", entry.meRpm).message || undefined}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={entry.meLoad ?? ""}
          onChange={(ev) =>
            updateHourlyEntry(hour, "meLoad", ev.target.value ? Number(ev.target.value) : undefined)
          }
          className={`w-full h-8 ${getAnomalyClass("meLoad", entry.meLoad)}`}
          disabled={isLocked}
          data-testid={`input-hourly-load-${hour}`}
          title={checkAnomaly("meLoad", entry.meLoad).message || undefined}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={entry.meFuelRackPosition ?? ""}
          onChange={(ev) =>
            updateHourlyEntry(
              hour,
              "meFuelRackPosition",
              ev.target.value ? Number(ev.target.value) : undefined
            )
          }
          className={`w-full h-8 ${getAnomalyClass("meFuelRackPosition", entry.meFuelRackPosition)}`}
          disabled={isLocked}
          data-testid={`input-hourly-fuelrack-${hour}`}
          title={checkAnomaly("meFuelRackPosition", entry.meFuelRackPosition).message || undefined}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={entry.meExhaustTempPort ?? ""}
          onChange={(ev) =>
            updateHourlyEntry(
              hour,
              "meExhaustTempPort",
              ev.target.value ? Number(ev.target.value) : undefined
            )
          }
          className={`w-full h-8 ${getAnomalyClass("meExhaustTempPort", entry.meExhaustTempPort)}`}
          disabled={isLocked}
          data-testid={`input-hourly-exhaust-${hour}`}
          title={checkAnomaly("meExhaustTempPort", entry.meExhaustTempPort).message || undefined}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="0.1"
          value={entry.meScavAirPress ?? ""}
          onChange={(ev) =>
            updateHourlyEntry(
              hour,
              "meScavAirPress",
              ev.target.value ? Number(ev.target.value) : undefined
            )
          }
          className={`w-full h-8 ${getAnomalyClass("meScavAirPress", entry.meScavAirPress)}`}
          disabled={isLocked}
          data-testid={`input-hourly-scavair-${hour}`}
          title={checkAnomaly("meScavAirPress", entry.meScavAirPress).message || undefined}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={entry.meCoolantTempIn ?? ""}
          onChange={(ev) =>
            updateHourlyEntry(
              hour,
              "meCoolantTempIn",
              ev.target.value ? Number(ev.target.value) : undefined
            )
          }
          className={`w-full h-8 ${getAnomalyClass("meCoolantTempIn", entry.meCoolantTempIn)}`}
          disabled={isLocked}
          data-testid={`input-hourly-coolant-in-${hour}`}
          title={checkAnomaly("meCoolantTempIn", entry.meCoolantTempIn).message || undefined}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={entry.meCoolantTempOut ?? ""}
          onChange={(ev) =>
            updateHourlyEntry(
              hour,
              "meCoolantTempOut",
              ev.target.value ? Number(ev.target.value) : undefined
            )
          }
          className={`w-full h-8 ${getAnomalyClass("meCoolantTempOut", entry.meCoolantTempOut)}`}
          disabled={isLocked}
          data-testid={`input-hourly-coolant-out-${hour}`}
          title={checkAnomaly("meCoolantTempOut", entry.meCoolantTempOut).message || undefined}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="0.1"
          value={entry.meLubOilPress ?? ""}
          onChange={(ev) =>
            updateHourlyEntry(
              hour,
              "meLubOilPress",
              ev.target.value ? Number(ev.target.value) : undefined
            )
          }
          className={`w-full h-8 ${getAnomalyClass("meLubOilPress", entry.meLubOilPress)}`}
          disabled={isLocked}
          data-testid={`input-hourly-lopress-${hour}`}
          title={checkAnomaly("meLubOilPress", entry.meLubOilPress).message || undefined}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={entry.meLubOilTemp ?? ""}
          onChange={(ev) =>
            updateHourlyEntry(
              hour,
              "meLubOilTemp",
              ev.target.value ? Number(ev.target.value) : undefined
            )
          }
          className={`w-full h-8 ${getAnomalyClass("meLubOilTemp", entry.meLubOilTemp)}`}
          disabled={isLocked}
          data-testid={`input-hourly-lotemp-${hour}`}
          title={checkAnomaly("meLubOilTemp", entry.meLubOilTemp).message || undefined}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={entry.meTurbochargerRpm ?? ""}
          onChange={(ev) =>
            updateHourlyEntry(
              hour,
              "meTurbochargerRpm",
              ev.target.value ? Number(ev.target.value) : undefined
            )
          }
          className={`w-full h-8 ${getAnomalyClass("meTurbochargerRpm", entry.meTurbochargerRpm)}`}
          disabled={isLocked}
          data-testid={`input-hourly-tcrpm-${hour}`}
          title={checkAnomaly("meTurbochargerRpm", entry.meTurbochargerRpm).message || undefined}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={entry.meFuelOilTemp ?? ""}
          onChange={(ev) =>
            updateHourlyEntry(
              hour,
              "meFuelOilTemp",
              ev.target.value ? Number(ev.target.value) : undefined
            )
          }
          className={`w-full h-8 ${getAnomalyClass("meFuelOilTemp", entry.meFuelOilTemp)}`}
          disabled={isLocked}
          data-testid={`input-hourly-fotemp-${hour}`}
          title={checkAnomaly("meFuelOilTemp", entry.meFuelOilTemp).message || undefined}
        />
      </TableCell>
      <TableCell>
        <Input
          type="text"
          value={entry.remarks ?? ""}
          onChange={(ev) => updateHourlyEntry(hour, "remarks", ev.target.value)}
          className="w-full h-8"
          disabled={isLocked}
          data-testid={`input-hourly-remarks-${hour}`}
        />
      </TableCell>
    </TableRow>
  );
}

export function GeneratorIntervalRow({
  genNum,
  hour,
  entry,
  isLocked,
  updateGeneratorEntry,
}: {
  genNum: number;
  hour: number;
  entry: GeneratorEntry;
  isLocked: boolean;
  updateGeneratorEntry: (
    genNum: number,
    hour: number,
    field: string,
    value: string | number | boolean | null | undefined
  ) => void;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium">{hour.toString().padStart(2, "0")}:00</TableCell>
      <TableCell>
        <Input
          type="number"
          value={entry.loadKw ?? ""}
          onChange={(ev) =>
            updateGeneratorEntry(
              genNum,
              hour,
              "loadKw",
              ev.target.value ? Number(ev.target.value) : undefined
            )
          }
          className="w-20 h-8"
          disabled={isLocked}
          data-testid={`input-gen${genNum}-${hour}-load`}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={entry.voltage ?? ""}
          onChange={(ev) =>
            updateGeneratorEntry(
              genNum,
              hour,
              "voltage",
              ev.target.value ? Number(ev.target.value) : undefined
            )
          }
          className="w-20 h-8"
          disabled={isLocked}
          data-testid={`input-gen${genNum}-${hour}-voltage`}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="0.1"
          value={entry.frequency ?? ""}
          onChange={(ev) =>
            updateGeneratorEntry(
              genNum,
              hour,
              "frequency",
              ev.target.value ? Number(ev.target.value) : undefined
            )
          }
          className="w-20 h-8"
          disabled={isLocked}
          data-testid={`input-gen${genNum}-${hour}-freq`}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={entry.exhaustTemp ?? ""}
          onChange={(ev) =>
            updateGeneratorEntry(
              genNum,
              hour,
              "exhaustTemp",
              ev.target.value ? Number(ev.target.value) : undefined
            )
          }
          className="w-20 h-8"
          disabled={isLocked}
          data-testid={`input-gen${genNum}-${hour}-exhaust`}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="0.1"
          value={entry.lubOilPress ?? ""}
          onChange={(ev) =>
            updateGeneratorEntry(
              genNum,
              hour,
              "lubOilPress",
              ev.target.value ? Number(ev.target.value) : undefined
            )
          }
          className="w-20 h-8"
          disabled={isLocked}
          data-testid={`input-gen${genNum}-${hour}-lopress`}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={entry.coolantTemp ?? ""}
          onChange={(ev) =>
            updateGeneratorEntry(
              genNum,
              hour,
              "coolantTemp",
              ev.target.value ? Number(ev.target.value) : undefined
            )
          }
          className="w-20 h-8"
          disabled={isLocked}
          data-testid={`input-gen${genNum}-${hour}-coolant`}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          step="0.1"
          value={entry.runningHours ?? ""}
          onChange={(ev) =>
            updateGeneratorEntry(
              genNum,
              hour,
              "runningHours",
              ev.target.value ? Number(ev.target.value) : undefined
            )
          }
          className="w-20 h-8"
          disabled={isLocked}
          data-testid={`input-gen${genNum}-${hour}-runhrs`}
        />
      </TableCell>
      <TableCell>
        <Select
          value={entry.status || ""}
          onValueChange={(v) => updateGeneratorEntry(genNum, hour, "status", v)}
          disabled={isLocked}
        >
          <SelectTrigger className="w-24 h-8" data-testid={`select-gen${genNum}-${hour}-status`}>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="standby">Standby</SelectItem>
            <SelectItem value="stopped">Stopped</SelectItem>
            <SelectItem value="maintenance">Maint.</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
    </TableRow>
  );
}

export function EngineEventItem({ event }: { event: EngineLogEvent }) {
  const config = getEngineEventTypeConfig(event.eventType);
  const Icon = config.icon;
  return (
    <div
      className="flex items-start gap-3 p-3 rounded-lg border bg-card"
      data-testid={`event-${event.id}`}
    >
      <div className={`p-2 rounded-full ${config.color} text-white`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{config.label}</span>
          <Badge variant="outline" className="text-xs">
            {event.source}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{event.summary}</p>
        {event.details && (
          <p className="text-xs text-muted-foreground mt-1 truncate">{event.details}</p>
        )}
      </div>
      <div className="text-xs text-muted-foreground whitespace-nowrap">
        {format(new Date(event.timestamp), "HH:mm")}
      </div>
    </div>
  );
}

export function EngineWatchCard({
  period,
  watch,
  isLocked,
  updateWatchAssignment,
}: {
  period: string;
  watch: WatchData;
  isLocked: boolean;
  updateWatchAssignment: (period: string, field: string, value: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Watch {period}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>Chief Engineer</Label>
          <Input
            value={watch.chiefEngineerName ?? ""}
            onChange={(ev) => updateWatchAssignment(period, "chiefEngineerName", ev.target.value)}
            placeholder="Name"
            disabled={isLocked}
            data-testid={`input-watch-${period}-chief`}
          />
        </div>
        <div>
          <Label>Second Engineer</Label>
          <Input
            value={watch.secondEngineerName ?? ""}
            onChange={(ev) => updateWatchAssignment(period, "secondEngineerName", ev.target.value)}
            placeholder="Name"
            disabled={isLocked}
            data-testid={`input-watch-${period}-second`}
          />
        </div>
        <div>
          <Label>Third Engineer</Label>
          <Input
            value={watch.thirdEngineerName ?? ""}
            onChange={(ev) => updateWatchAssignment(period, "thirdEngineerName", ev.target.value)}
            placeholder="Name"
            disabled={isLocked}
            data-testid={`input-watch-${period}-third`}
          />
        </div>
        <div>
          <Label>Motorman/Oiler</Label>
          <Input
            value={watch.motormanName ?? ""}
            onChange={(ev) => updateWatchAssignment(period, "motormanName", ev.target.value)}
            placeholder="Name"
            disabled={isLocked}
            data-testid={`input-watch-${period}-motorman`}
          />
        </div>
      </CardContent>
    </Card>
  );
}
