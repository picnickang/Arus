import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, X } from "lucide-react";

export interface DocumentFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  fileTypeFilter: string;
  onFileTypeFilterChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onClearFilters: () => void;
}

const FILE_TYPES = [
  { value: "all", label: "All Types" },
  { value: "pdf", label: "PDF" },
  { value: "png", label: "PNG" },
  { value: "jpg", label: "JPG" },
  { value: "docx", label: "DOCX" },
  { value: "xlsx", label: "XLSX" },
  { value: "txt", label: "Text" },
];

const STATUSES = [
  { value: "all", label: "All Status" },
  { value: "completed", label: "Completed" },
  { value: "processing", label: "Processing" },
  { value: "failed", label: "Failed" },
];

export function DocumentFilters({
  search,
  onSearchChange,
  fileTypeFilter,
  onFileTypeFilterChange,
  statusFilter,
  onStatusFilterChange,
  onClearFilters,
}: DocumentFiltersProps) {
  const hasActiveFilters = search || fileTypeFilter !== "all" || statusFilter !== "all";

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="document-filters">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search documents..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
          data-testid="input-document-search"
        />
      </div>

      <Select value={fileTypeFilter} onValueChange={onFileTypeFilterChange}>
        <SelectTrigger className="w-[130px]" data-testid="select-file-type">
          <SelectValue placeholder="File Type" />
        </SelectTrigger>
        <SelectContent>
          {FILE_TYPES.map((type) => (
            <SelectItem key={type.value} value={type.value}>
              {type.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={statusFilter} onValueChange={onStatusFilterChange}>
        <SelectTrigger className="w-[130px]" data-testid="select-status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((status) => (
            <SelectItem key={status.value} value={status.value}>
              {status.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          data-testid="button-clear-filters"
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}
