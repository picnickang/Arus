import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ChevronDown, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EquipmentMultiSelectProps {
  equipment: Array<{ id: string; name: string; type?: string }>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function EquipmentMultiSelect({
  equipment,
  selectedIds,
  onChange,
}: EquipmentMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = equipment
    .filter((e) => e.name.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 20);
  const toggle = (id: string) =>
    onChange(selectedIds.includes(id) ? selectedIds.filter((i) => i !== id) : [...selectedIds, id]);

  return (
    <div>
      <Label>Equipment *</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between"
            data-testid="btn-select-equipment"
          >
            {selectedIds.length > 0
              ? `${selectedIds.length} equipment selected`
              : "Select equipment..."}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search equipment..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>No equipment found.</CommandEmpty>
              <CommandGroup>
                {filtered.map((eq) => (
                  <CommandItem
                    key={eq.id}
                    value={eq.name}
                    onSelect={() => toggle(eq.id)}
                    className="cursor-pointer"
                    data-testid={`option-equipment-${eq.id}`}
                  >
                    <Checkbox checked={selectedIds.includes(eq.id)} className="mr-2" />
                    <div className="flex-1">
                      <div className="font-medium">{eq.name}</div>
                      {eq.type && <div className="text-xs text-muted-foreground">{eq.type}</div>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedIds.map((id) => {
            const eq = equipment.find((e) => e.id === id);
            return (
              eq && (
                <Badge key={id} variant="secondary" className="text-xs">
                  {eq.name}
                  <button className="ml-1" onClick={() => toggle(id)}>
                    &times;
                  </button>
                </Badge>
              )
            );
          })}
        </div>
      )}
    </div>
  );
}

interface DatePickerFieldProps {
  label: string;
  value?: Date;
  onChange: (date?: Date) => void;
  testId: string;
  compact?: boolean;
}

export function DatePickerField({ label, value, onChange, testId, compact }: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      {!compact && <Label className="text-xs">{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground"
            )}
            data-testid={testId}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value ? format(value, "PPP") : compact ? label : "Pick a date"}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(d) => {
              onChange(d);
              setOpen(false);
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
