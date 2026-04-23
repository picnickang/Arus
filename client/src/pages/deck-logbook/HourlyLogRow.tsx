import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  WIND_DIRECTIONS,
  BEAUFORT_SCALE,
  SEA_STATES,
  VISIBILITY_CODES,
} from "@/features/deck-logbook";
import type { HourlyEntry } from "./types";

export function HourlyLogRow({
  hour,
  entry,
  isLocked,
  updateHourlyEntry,
}: {
  hour: number;
  entry: HourlyEntry;
  isLocked: boolean;
  updateHourlyEntry: (hour: number, field: string, value: string | number) => void;
}) {
  return (
    <TableRow className={hour % 2 === 0 ? "bg-muted/30" : ""}>
      <TableCell className="text-center font-mono font-semibold">
        {String(hour).padStart(2, "0")}:00
      </TableCell>
      <TableCell>
        <Input
          value={entry.course || ""}
          onChange={(e) => updateHourlyEntry(hour, "course", e.target.value)}
          placeholder="045°"
          className="h-8 w-16"
          disabled={isLocked}
          data-testid={`input-course-${hour}`}
        />
      </TableCell>
      <TableCell>
        <Select
          value={entry.windDirection || ""}
          onValueChange={(v) => updateHourlyEntry(hour, "windDirection", v)}
          disabled={isLocked}
        >
          <SelectTrigger className="h-8 w-20">
            <SelectValue placeholder="-" />
          </SelectTrigger>
          <SelectContent>
            {WIND_DIRECTIONS.map((dir) => (
              <SelectItem key={dir} value={dir}>
                {dir}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select
          value={entry.windForce || ""}
          onValueChange={(v) => updateHourlyEntry(hour, "windForce", v)}
          disabled={isLocked}
        >
          <SelectTrigger className="h-8 w-16">
            <SelectValue placeholder="-" />
          </SelectTrigger>
          <SelectContent>
            {BEAUFORT_SCALE.map((force) => (
              <SelectItem key={force} value={force}>
                Bf {force}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select
          value={entry.seaState || ""}
          onValueChange={(v) => updateHourlyEntry(hour, "seaState", v)}
          disabled={isLocked}
        >
          <SelectTrigger className="h-8 w-24">
            <SelectValue placeholder="-" />
          </SelectTrigger>
          <SelectContent>
            {SEA_STATES.map((state) => (
              <SelectItem key={state} value={state}>
                {state}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Select
          value={entry.visibility || ""}
          onValueChange={(v) => updateHourlyEntry(hour, "visibility", v)}
          disabled={isLocked}
        >
          <SelectTrigger className="h-8 w-24">
            <SelectValue placeholder="-" />
          </SelectTrigger>
          <SelectContent>
            {VISIBILITY_CODES.map((vis) => (
              <SelectItem key={vis} value={vis}>
                {vis}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={entry.barometer || ""}
          onChange={(e) => updateHourlyEntry(hour, "barometer", Number.parseFloat(e.target.value))}
          placeholder="1013"
          className="h-8 w-20"
          disabled={isLocked}
          data-testid={`input-barometer-${hour}`}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={entry.airTemp || ""}
          onChange={(e) => updateHourlyEntry(hour, "airTemp", Number.parseFloat(e.target.value))}
          placeholder="25"
          className="h-8 w-16"
          disabled={isLocked}
          data-testid={`input-airtemp-${hour}`}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={entry.seaTemp || ""}
          onChange={(e) => updateHourlyEntry(hour, "seaTemp", Number.parseFloat(e.target.value))}
          placeholder="28"
          className="h-8 w-16"
          disabled={isLocked}
          data-testid={`input-seatemp-${hour}`}
        />
      </TableCell>
      <TableCell>
        <Input
          value={entry.remarks || ""}
          onChange={(e) => updateHourlyEntry(hour, "remarks", e.target.value)}
          placeholder="Observations..."
          className="h-8"
          disabled={isLocked}
          data-testid={`input-remarks-${hour}`}
        />
      </TableCell>
    </TableRow>
  );
}
