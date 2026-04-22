import { Clock, Download, Search, Settings, Ship } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type MainView = "risk-queue" | "schedule";

interface FilterOptions {
  vessels: Array<{ id: string; name: string }>;
  equipmentTypes: string[];
}

interface DashboardHeaderProps {
  mainView: MainView;
  onMainViewChange: (view: MainView) => void;
  fleetFilter: string;
  onFleetFilterChange: (value: string) => void;
  equipmentTypeFilter: string;
  onEquipmentTypeFilterChange: (value: string) => void;
  dateRange: string;
  onDateRangeChange: (value: string) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onExportCSV: () => void;
  filterOptions?: FilterOptions;
}

export function DashboardHeader({
  mainView,
  onMainViewChange,
  fleetFilter,
  onFleetFilterChange,
  equipmentTypeFilter,
  onEquipmentTypeFilterChange,
  dateRange,
  onDateRangeChange,
  searchQuery,
  onSearchChange,
  onExportCSV,
  filterOptions,
}: DashboardHeaderProps) {
  return (
    <header className="bg-slate-800 dark:bg-slate-900 text-white">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-1 bg-slate-700/50 rounded-lg p-1">
              <Button
                variant={mainView === "risk-queue" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => onMainViewChange("risk-queue")}
                className={
                  mainView === "risk-queue" ? "bg-slate-600" : "text-slate-300 hover:text-white"
                }
                data-testid="nav-risk-queue"
              >
                Risk Queue
              </Button>
              <Button
                variant={mainView === "schedule" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => onMainViewChange("schedule")}
                className={
                  mainView === "schedule" ? "bg-slate-600" : "text-slate-300 hover:text-white"
                }
                data-testid="nav-schedule"
              >
                Schedule
              </Button>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-3 flex-1 justify-end">
            <Select value={fleetFilter} onValueChange={onFleetFilterChange}>
              <SelectTrigger
                className="w-[160px] bg-slate-700 border-slate-600 text-white"
                data-testid="filter-fleet"
              >
                <Ship className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Fleet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Ships</SelectItem>
                {filterOptions?.vessels.map((vessel) => (
                  <SelectItem key={vessel.id} value={vessel.id}>
                    {vessel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={equipmentTypeFilter} onValueChange={onEquipmentTypeFilterChange}>
              <SelectTrigger
                className="w-[160px] bg-slate-700 border-slate-600 text-white"
                data-testid="filter-equipment"
              >
                <Settings className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Equipment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Equipment</SelectItem>
                {filterOptions?.equipmentTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={dateRange} onValueChange={onDateRangeChange}>
              <SelectTrigger
                className="w-[160px] bg-slate-700 border-slate-600 text-white"
                data-testid="filter-date"
              >
                <Clock className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 Days</SelectItem>
                <SelectItem value="30">Last 30 Days</SelectItem>
                <SelectItem value="90">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative hidden md:block">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="search"
                placeholder="Search asset or tag..."
                className="w-[200px] pl-8 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                data-testid="input-search"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              className="border-slate-600 text-slate-200"
              onClick={onExportCSV}
              data-testid="button-export-csv"
            >
              <Download className="h-4 w-4 mr-1" />
              Export CSV
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-white hover:bg-slate-700"
              data-testid="button-search-mobile"
            >
              <Search className="h-5 w-5 md:hidden" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-white hover:bg-slate-700"
              data-testid="button-export"
            >
              <Download className="h-5 w-5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="text-white hover:bg-slate-700"
              data-testid="button-settings"
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="flex lg:hidden items-center gap-2 mt-3 overflow-x-auto pb-1">
          <div className="flex items-center gap-1 bg-slate-700/50 rounded-md p-0.5 md:hidden">
            <Button
              variant={mainView === "risk-queue" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onMainViewChange("risk-queue")}
              className={`text-xs h-7 ${mainView === "risk-queue" ? "bg-slate-600" : "text-slate-300"}`}
              data-testid="nav-risk-queue-mobile"
            >
              Risk Queue
            </Button>
            <Button
              variant={mainView === "schedule" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onMainViewChange("schedule")}
              className={`text-xs h-7 ${mainView === "schedule" ? "bg-slate-600" : "text-slate-300"}`}
              data-testid="nav-schedule-mobile"
            >
              Schedule
            </Button>
          </div>
          <Select value={fleetFilter} onValueChange={onFleetFilterChange}>
            <SelectTrigger
              className="w-[130px] bg-slate-700 border-slate-600 text-white text-xs"
              data-testid="filter-fleet-mobile"
            >
              <Ship className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Fleet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ships</SelectItem>
              {filterOptions?.vessels.map((vessel) => (
                <SelectItem key={vessel.id} value={vessel.id}>
                  {vessel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={equipmentTypeFilter} onValueChange={onEquipmentTypeFilterChange}>
            <SelectTrigger
              className="w-[130px] bg-slate-700 border-slate-600 text-white text-xs"
              data-testid="filter-equipment-mobile"
            >
              <Settings className="h-3 w-3 mr-1" />
              <SelectValue placeholder="Equipment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Equipment</SelectItem>
              {filterOptions?.equipmentTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </header>
  );
}
