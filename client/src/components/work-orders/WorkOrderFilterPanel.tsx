import { Filter, X, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  useWorkOrderFilterData,
  WorkOrderFilters,
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  EQUIPMENT_CATEGORIES,
} from "@/features/work-orders/hooks/useWorkOrderFilterData";

interface WorkOrderFilterPanelProps {
  filters: WorkOrderFilters;
  onFiltersChange: (filters: WorkOrderFilters) => void;
  className?: string;
}

export function WorkOrderFilterPanel({
  filters,
  onFiltersChange,
  className,
}: WorkOrderFilterPanelProps) {
  const {
    localFilters,
    vessels,
    engineers,
    activeFilterCount,
    isOpen,
    setIsOpen,
    mobileOpen,
    setMobileOpen,
    updateFilter,
    clearAllFilters,
    removeFilter,
    getStatusLabel,
    getPriorityLabel,
    getVesselName,
    getEngineerName,
  } = useWorkOrderFilterData(filters, onFiltersChange);

  const filterContent = (
    <div className="space-y-4">
      <div>
        <Label htmlFor="search" className="text-sm font-medium">
          Search
        </Label>
        <Input
          id="search"
          placeholder="WO number, equipment, description..."
          value={localFilters.search}
          onChange={(e) => updateFilter("search", e.target.value)}
          className="mt-1.5"
          data-testid="input-wo-search"
        />
      </div>
      <Separator />
      <div>
        <Label className="text-sm font-medium">Status</Label>
        <Select
          value={localFilters.status}
          onValueChange={(value) => updateFilter("status", value)}
        >
          <SelectTrigger className="mt-1.5" data-testid="select-wo-status">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-sm font-medium">Priority</Label>
        <Select
          value={localFilters.priority}
          onValueChange={(value) => updateFilter("priority", value)}
        >
          <SelectTrigger className="mt-1.5" data-testid="select-wo-priority">
            <SelectValue placeholder="Select priority" />
          </SelectTrigger>
          <SelectContent>
            {PRIORITY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Separator />
      <div>
        <Label className="text-sm font-medium">Vessel</Label>
        <Select
          value={localFilters.vesselId}
          onValueChange={(value) => updateFilter("vesselId", value)}
        >
          <SelectTrigger className="mt-1.5" data-testid="select-wo-vessel">
            <SelectValue placeholder="Select vessel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Vessels</SelectItem>
            {vessels
              .filter((v) => v.id)
              .map((vessel) => (
                <SelectItem key={vessel.id} value={vessel.id}>
                  {vessel.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-sm font-medium">Assigned Engineer</Label>
        <Select
          value={localFilters.engineerId}
          onValueChange={(value) => updateFilter("engineerId", value)}
        >
          <SelectTrigger className="mt-1.5" data-testid="select-wo-engineer">
            <SelectValue placeholder="Select engineer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Engineers</SelectItem>
            {engineers.map((engineer) => (
              <SelectItem key={engineer.id} value={engineer.id}>
                {engineer.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-sm font-medium">Equipment Category</Label>
        <Select
          value={localFilters.equipmentCategory}
          onValueChange={(value) => updateFilter("equipmentCategory", value)}
        >
          <SelectTrigger className="mt-1.5" data-testid="select-wo-equipment-category">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {EQUIPMENT_CATEGORIES.map((category) => (
              <SelectItem key={category.value} value={category.value}>
                {category.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Separator />
      <div>
        <Label className="text-sm font-medium flex items-center gap-1.5">
          <Calendar className="h-4 w-4" />
          Due Date Range
        </Label>
        <div className="grid grid-cols-2 gap-2 mt-1.5">
          <div>
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input
              type="date"
              value={localFilters.dueDateFrom}
              onChange={(e) => updateFilter("dueDateFrom", e.target.value)}
              className="mt-1"
              data-testid="input-wo-due-from"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input
              type="date"
              value={localFilters.dueDateTo}
              onChange={(e) => updateFilter("dueDateTo", e.target.value)}
              className="mt-1"
              data-testid="input-wo-due-to"
            />
          </div>
        </div>
      </div>
      {activeFilterCount > 0 && (
        <>
          <Separator />
          <Button
            variant="outline"
            onClick={clearAllFilters}
            className="w-full"
            data-testid="button-clear-wo-filters"
          >
            <X className="h-4 w-4 mr-2" />
            Clear All Filters ({activeFilterCount})
          </Button>
        </>
      )}
    </div>
  );

  const activeFilterBadges = (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {localFilters.search && (
        <Badge variant="secondary" className="text-xs">
          Search: "{localFilters.search}"
          <button onClick={() => removeFilter("search")} className="ml-1">
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
      {localFilters.status !== "all" && (
        <Badge variant="secondary" className="text-xs">
          Status: {getStatusLabel(localFilters.status)}
          <button onClick={() => removeFilter("status")} className="ml-1">
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
      {localFilters.priority !== "all" && (
        <Badge variant="secondary" className="text-xs">
          Priority: {getPriorityLabel(localFilters.priority)}
          <button onClick={() => removeFilter("priority")} className="ml-1">
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
      {localFilters.vesselId !== "all" && (
        <Badge variant="secondary" className="text-xs">
          Vessel: {getVesselName(localFilters.vesselId) || "Selected"}
          <button onClick={() => removeFilter("vesselId")} className="ml-1">
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
      {localFilters.engineerId !== "all" && (
        <Badge variant="secondary" className="text-xs">
          Engineer: {getEngineerName(localFilters.engineerId) || "Selected"}
          <button onClick={() => removeFilter("engineerId")} className="ml-1">
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
      {localFilters.equipmentCategory !== "all" && (
        <Badge variant="secondary" className="text-xs">
          Category: {localFilters.equipmentCategory}
          <button onClick={() => removeFilter("equipmentCategory")} className="ml-1">
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
      {(localFilters.dueDateFrom || localFilters.dueDateTo) && (
        <Badge variant="secondary" className="text-xs">
          Due: {localFilters.dueDateFrom || "∞"} - {localFilters.dueDateTo || "∞"}
          <button
            onClick={() => {
              removeFilter("dueDateFrom");
              removeFilter("dueDateTo");
            }}
            className="ml-1"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
    </div>
  );

  return (
    <>
      <div className={cn("hidden lg:block w-72 shrink-0", className)}>
        <div className="bg-card rounded-lg border p-4 sticky top-4">
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto font-semibold">
                <span className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {activeFilterCount}
                    </Badge>
                  )}
                </span>
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">{filterContent}</CollapsibleContent>
          </Collapsible>
        </div>
      </div>
      <div className="lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="gap-2" data-testid="button-wo-mobile-filters">
              <Filter className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount}</Badge>}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filter Work Orders</SheetTitle>
            </SheetHeader>
            <div className="py-4">{filterContent}</div>
            <SheetFooter>
              <Button onClick={() => setMobileOpen(false)} className="w-full">
                Apply Filters
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
        {activeFilterCount > 0 && activeFilterBadges}
      </div>
    </>
  );
}

export type { WorkOrderFilters };
