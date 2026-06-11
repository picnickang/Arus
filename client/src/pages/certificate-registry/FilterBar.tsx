import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X } from "lucide-react";
import { CERTIFICATE_TYPES, CERTIFICATE_STATUSES } from "@shared/schema";
import { CERT_TYPE_LABELS, CERT_STATUS_LABELS } from "./constants";

export function FilterBar({
  searchQuery,
  vesselFilter,
  typeFilter,
  statusFilter,
  equipmentFilter,
  vessels,
  equipmentList,
  hasActiveFilters,
  onSearchChange,
  onVesselChange,
  onTypeChange,
  onStatusChange,
  onEquipmentChange,
  onClear,
}: {
  searchQuery: string;
  vesselFilter: string;
  typeFilter: string;
  statusFilter: string;
  equipmentFilter: string;
  vessels: Array<{ id: string; name: string }>;
  equipmentList: Array<{ id: string; name: string }>;
  hasActiveFilters: boolean;
  onSearchChange: (v: string) => void;
  onVesselChange: (v: string) => void;
  onTypeChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onEquipmentChange: (v: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="p-4">
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search certificates..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={vesselFilter} onValueChange={onVesselChange}>
            <SelectTrigger className="w-40" data-testid="select-vessel">
              <SelectValue placeholder="Vessel" />
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
          <Select value={typeFilter} onValueChange={onTypeChange}>
            <SelectTrigger className="w-40" data-testid="select-type">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {CERTIFICATE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {CERT_TYPE_LABELS[t] || t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={onStatusChange}>
            <SelectTrigger className="w-40" data-testid="select-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {CERTIFICATE_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {CERT_STATUS_LABELS[s] || s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={equipmentFilter} onValueChange={onEquipmentChange}>
            <SelectTrigger className="w-44" data-testid="select-equipment">
              <SelectValue placeholder="Equipment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Equipment</SelectItem>
              {equipmentList.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={onClear} data-testid="button-clear-filters">
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
