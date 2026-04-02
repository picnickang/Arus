/**
 * Supplier Select With Performance
 *
 * UX FIX #6: Shows supplier performance metrics inline in selection dropdowns.
 * Replaces plain supplier name with: Name ★rating SLA-hours Preferred badge.
 *
 * Usage:
 *   <SupplierPerformanceSelect
 *     value={selectedId}
 *     onValueChange={setSelectedId}
 *     filterType="service_provider"  // or "supplier" or "both" or undefined for all
 *   />
 */

import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, Clock } from "lucide-react";

interface Supplier {
  id: string;
  name: string;
  type?: string;
  qualityRating?: number | null;
  responseSlaHours?: number | null;
  isPreferred?: boolean;
  isActive?: boolean;
}

interface SupplierPerformanceSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  filterType?: "supplier" | "service_provider" | "both";
  includeAll?: boolean;
  allLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
}

export function SupplierPerformanceSelect({
  value,
  onValueChange,
  filterType,
  includeAll = false,
  allLabel = "All Providers",
  placeholder = "Select provider...",
  disabled,
  className,
  "data-testid": testId,
}: SupplierPerformanceSelectProps) {
  const typeParam = filterType
    ? filterType === "both"
      ? "supplier,service_provider,both"
      : `${filterType},both`
    : undefined;

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers", typeParam ? { type: typeParam } : {}],
  });

  // Sort: preferred first, then by quality rating descending
  const sorted = [...(suppliers || [])]
    .filter((s) => s.isActive !== false)
    .sort((a, b) => {
      if (a.isPreferred && !b.isPreferred) return -1;
      if (!a.isPreferred && b.isPreferred) return 1;
      return (b.qualityRating ?? 0) - (a.qualityRating ?? 0);
    });

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className} data-testid={testId}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {includeAll && <SelectItem value="all">{allLabel}</SelectItem>}
        {sorted.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            <span className="flex items-center gap-2 w-full">
              <span className="truncate">{s.name}</span>
              <span className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
                {s.isPreferred && (
                  <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                )}
                {s.qualityRating != null && (
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    ★{s.qualityRating.toFixed(1)}
                  </span>
                )}
                {s.responseSlaHours != null && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {s.responseSlaHours}h
                  </span>
                )}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default SupplierPerformanceSelect;
