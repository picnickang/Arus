import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, X } from "lucide-react";
import { MARITIME_RANKS } from "@/features/crew";

export function RosterFilters({ d }: { d: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Search & Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, rank, or skill..."
              value={d.searchTerm}
              onChange={(e) => d.setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-crew"
            />
          </div>
          <Select value={d.selectedVessel} onValueChange={d.setSelectedVessel}>
            <SelectTrigger data-testid="select-vessel-filter">
              <SelectValue placeholder="All Vessels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Vessels</SelectItem>
              {d.vessels
                .filter((v: any) => v.active)
                .map((v: any) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Select value={d.selectedRank} onValueChange={d.setSelectedRank}>
            <SelectTrigger data-testid="select-rank-filter">
              <SelectValue placeholder="All Ranks" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ranks</SelectItem>
              {MARITIME_RANKS.map((rank) => (
                <SelectItem key={rank} value={rank}>
                  {rank}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={d.selectedStatus} onValueChange={d.setSelectedStatus}>
            <SelectTrigger data-testid="select-status-filter">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="inactive">Inactive Only</SelectItem>
              <SelectItem value="on_duty">On Duty</SelectItem>
              <SelectItem value="off_duty">Off Duty</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm text-muted-foreground" data-testid="text-result-count">
            Showing {d.filteredAndSortedCrew.length} of {d.crew.length} crew members
            {d.activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {d.activeFilterCount} filter{d.activeFilterCount > 1 ? "s" : ""}
              </Badge>
            )}
          </p>
          {d.activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={d.clearFilters}>
              <X className="h-4 w-4 mr-1" />
              Clear Filters
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
