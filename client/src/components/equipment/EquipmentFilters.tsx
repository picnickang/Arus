import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, XCircle, Plus } from "lucide-react";
import { Vessel } from "@shared/schema";
import { EquipmentFilters as FiltersType } from "@/hooks/useEquipmentFilters";
import { formatType } from "@/utils/equipmentHelpers";

interface EquipmentFiltersProps {
  filters: FiltersType;
  onFiltersChange: <K extends keyof FiltersType>(key: K, value: FiltersType[K]) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  vessels: Vessel[];
  equipmentTypes: string[];
  manufacturers: string[];
  filteredCount?: number;
  totalCount?: number;
  onAddEquipment?: () => void;
}

export function EquipmentFilters({
  filters,
  onFiltersChange,
  onClearFilters,
  hasActiveFilters,
  vessels,
  equipmentTypes,
  manufacturers,
  filteredCount,
  totalCount,
  onAddEquipment,
}: EquipmentFiltersProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search equipment by name, manufacturer, model, or serial..."
                value={filters.search}
                onChange={(e) => onFiltersChange("search", e.target.value)}
                className="pl-10"
                data-testid="input-search"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {onAddEquipment && (
              <Button onClick={onAddEquipment} data-testid="button-add-equipment">
                <Plus className="h-4 w-4 mr-2" />
                Add Equipment
              </Button>
            )}
            <Select
              value={filters.vessel}
              onValueChange={(value) => onFiltersChange("vessel", value)}
            >
              <SelectTrigger className="w-[180px]" data-testid="select-filter-vessel">
                <SelectValue placeholder="Filter by vessel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vessels</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {vessels.filter(v => v.id).map((vessel) => (
                  <SelectItem key={vessel.id} value={vessel.id}>
                    {vessel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.type} onValueChange={(value) => onFiltersChange("type", value)}>
              <SelectTrigger className="w-[160px]" data-testid="select-filter-type">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {equipmentTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {formatType(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.status}
              onValueChange={(value) => onFiltersChange("status", value)}
            >
              <SelectTrigger className="w-[140px]" data-testid="select-filter-status">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="inactive">Inactive Only</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={filters.manufacturer}
              onValueChange={(value) => onFiltersChange("manufacturer", value)}
            >
              <SelectTrigger className="w-[170px]" data-testid="select-filter-manufacturer">
                <SelectValue placeholder="Filter by manufacturer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Manufacturers</SelectItem>
                {manufacturers.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No manufacturers found
                  </SelectItem>
                ) : (
                  manufacturers.map((manufacturer) => (
                    <SelectItem key={manufacturer} value={manufacturer}>
                      {manufacturer}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                onClick={onClearFilters}
                size="sm"
                data-testid="button-clear-filters"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {hasActiveFilters && filteredCount !== undefined && totalCount !== undefined && (
          <div className="mt-3 text-sm text-muted-foreground" data-testid="text-filter-results">
            Showing {filteredCount} of {totalCount} equipment
          </div>
        )}
      </CardContent>
    </Card>
  );
}
