import { ChevronLeft, ChevronRight, Filter, Settings, Ship } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { formatWeekLabel } from "./utils";

interface FilterBarProps {
  weekOffset: number;
  onWeekChange: (offset: number) => void;
  vesselId: string;
  onVesselChange: (id: string) => void;
  equipmentType: string;
  onEquipmentTypeChange: (type: string) => void;
  maxTasksPerDay: number;
  onMaxTasksChange: (value: number) => void;
  autoPopulate: boolean;
  onAutoPopulateChange: (enabled: boolean) => void;
  vessels: Array<{ id: string; name: string }>;
  equipmentTypes: string[];
  isLoading: boolean;
}

export function FilterBar({
  weekOffset,
  onWeekChange,
  vesselId,
  onVesselChange,
  equipmentType,
  onEquipmentTypeChange,
  maxTasksPerDay,
  onMaxTasksChange,
  autoPopulate,
  onAutoPopulateChange,
  vessels,
  equipmentTypes,
  isLoading,
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onWeekChange(weekOffset - 1)}
          data-testid="btn-prev-week"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-2 text-sm font-medium min-w-[100px] text-center">
          {formatWeekLabel(weekOffset)}
        </span>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onWeekChange(weekOffset + 1)}
          data-testid="btn-next-week"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Select value={vesselId} onValueChange={onVesselChange} disabled={isLoading}>
        <SelectTrigger className="w-[160px]" data-testid="select-vessel">
          <Ship className="h-4 w-4 mr-2 text-muted-foreground" />
          <SelectValue placeholder="All Vessels" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Vessels</SelectItem>
          {vessels.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {v.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={equipmentType} onValueChange={onEquipmentTypeChange} disabled={isLoading}>
        <SelectTrigger className="w-[160px]" data-testid="select-equipment-type">
          <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
          <SelectValue placeholder="All Equipment" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Equipment</SelectItem>
          {equipmentTypes.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
        <Settings className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-xs text-muted-foreground whitespace-nowrap">Max</span>
        <Slider
          value={[maxTasksPerDay]}
          onValueChange={(vals) => onMaxTasksChange(vals[0])}
          min={1}
          max={5}
          step={1}
          disabled={isLoading}
          className="w-20"
          data-testid="slider-max-tasks"
        />
        <span className="text-sm font-medium w-4 text-center" data-testid="text-max-tasks-value">
          {maxTasksPerDay}
        </span>
      </div>

      <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
        <Switch
          id="auto-populate"
          checked={autoPopulate}
          onCheckedChange={onAutoPopulateChange}
          disabled={isLoading}
          data-testid="switch-auto-populate"
        />
        <Label htmlFor="auto-populate" className="text-xs cursor-pointer whitespace-nowrap">
          Auto-populate
        </Label>
      </div>
    </div>
  );
}
