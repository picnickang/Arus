import type { Dispatch, SetStateAction } from "react";
import type { Equipment } from "@shared/schema";
import {
  ArchiveX,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Search,
  Server,
  Ship,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DecommissionedEquipmentTable } from "@/components/equipment/DecommissionedEquipmentTable";
import { CertStatusBadge } from "./CertStatusBadge";
import { EquipmentTableRow } from "./EquipmentTableRow";
import { HealthBadge } from "./HealthBadge";
import { StatusBadge } from "./StatusBadge";
import type { EquipmentPageModel } from "./EquipmentPageTypes";
import type { CertSummary, EquipmentItem } from "./types";

interface EquipmentRegistryTabsProps {
  m: EquipmentPageModel;
  activeTab: "active" | "decommissioned";
  setActiveTab: Dispatch<SetStateAction<"active" | "decommissioned">>;
  decommissionedEquipment: Equipment[];
  isLoadingDecommissioned: boolean;
  allCerts: CertSummary[];
  onReinstate: (item: Equipment) => void;
  onViewHistory: (item: EquipmentItem | Equipment) => void;
}

export function EquipmentRegistryTabs({
  m,
  activeTab,
  setActiveTab,
  decommissionedEquipment,
  isLoadingDecommissioned,
  allCerts,
  onReinstate,
  onViewHistory,
}: EquipmentRegistryTabsProps) {
  return (
    <Tabs
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as "active" | "decommissioned")}
      className="space-y-4"
    >
      <TabsList className="mb-2">
        <TabsTrigger
          value="active"
          className="flex items-center gap-2"
          data-testid="tab-active-equipment"
        >
          <Server className="h-4 w-4" />
          Active Equipment
          <Badge variant="secondary" className="ml-1">
            {m.stats.total}
          </Badge>
        </TabsTrigger>
        <TabsTrigger
          value="decommissioned"
          className="flex items-center gap-2"
          data-testid="tab-decommissioned-equipment"
        >
          <ArchiveX className="h-4 w-4" />
          Decommissioned
          <Badge variant="secondary" className="ml-1">
            {decommissionedEquipment.length}
          </Badge>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="active">
        <Card>
          <div className="p-4 pb-4">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search equipment..."
                  value={m.searchQuery}
                  onChange={(e) => m.setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={m.vesselFilter} onValueChange={m.setVesselFilter}>
                  <SelectTrigger className="w-36" data-testid="select-vessel">
                    <SelectValue placeholder="Vessel" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Vessels</SelectItem>
                    {m.vessels.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={m.typeFilter} onValueChange={m.setTypeFilter}>
                  <SelectTrigger className="w-36" data-testid="select-type">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {m.uniqueTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={m.healthFilter} onValueChange={m.setHealthFilter}>
                  <SelectTrigger className="w-36" data-testid="select-health">
                    <SelectValue placeholder="Health" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Health</SelectItem>
                    <SelectItem value="healthy">Healthy</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="unknown">No Data</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={m.statusFilter} onValueChange={m.setStatusFilter}>
                  <SelectTrigger className="w-36" data-testid="select-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                {m.hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={m.clearFilters}
                    data-testid="button-clear-filters"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div className="p-0">
            <Table data-testid="table-equipment" className="hidden md:table">
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Vessel</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {m.paginatedEquipment.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {m.hasActiveFilters
                        ? "No equipment matches your filters"
                        : "No equipment found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  m.paginatedEquipment.map((item) => (
                    <EquipmentTableRow
                      key={item.id}
                      item={item}
                      getVesselName={m.getVesselName}
                      handleView={m.handleView}
                      handleEdit={m.handleEdit}
                      handleDelete={m.handleDelete}
                      handleSetupSensors={m.handleSetupSensors}
                      allCerts={allCerts}
                    />
                  ))
                )}
              </TableBody>
            </Table>
            <div className="md:hidden divide-y" data-testid="list-equipment-mobile">
              {m.paginatedEquipment.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {m.hasActiveFilters ? "No equipment matches your filters" : "No equipment found"}
                </div>
              ) : (
                m.paginatedEquipment.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => m.handleView(item)}
                    className="w-full text-left p-4 hover:bg-accent/50 active:bg-accent/70 transition-colors"
                    data-testid={`card-equipment-${item.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{item.name}</div>
                        {(item.manufacturer || item.model) && (
                          <div className="text-xs text-muted-foreground truncate">
                            {item.manufacturer}
                            {item.model && ` • ${item.model}`}
                          </div>
                        )}
                      </div>
                      <HealthBadge health={item.health} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline">{item.type || "Unknown"}</Badge>
                      {item.vesselId && (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Ship className="h-3 w-3" />
                          {m.getVesselName(item.vesselId)}
                        </span>
                      )}
                      <StatusBadge isActive={item.isActive ?? true} />
                      <CertStatusBadge equipmentId={item.id} allCerts={allCerts} />
                    </div>
                    <div
                      className="mt-3 flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                      role="presentation"
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          m.handleSetupSensors(item);
                        }}
                        data-testid={`button-sensors-mobile-${item.id}`}
                      >
                        <Wrench className="h-4 w-4 mr-1" />
                        Sensors
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          m.handleEdit(item);
                        }}
                        data-testid={`button-edit-mobile-${item.id}`}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 w-9 p-0 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          m.handleDelete(item);
                        }}
                        data-testid={`button-delete-mobile-${item.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </button>
                ))
              )}
            </div>
            {m.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {(m.page - 1) * m.pageSize + 1}-
                  {Math.min(m.page * m.pageSize, m.filteredEquipment.length)} of{" "}
                  {m.filteredEquipment.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => m.setPage((p) => Math.max(1, p - 1))}
                    disabled={m.page === 1}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Page {m.page} of {m.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => m.setPage((p) => Math.min(m.totalPages, p + 1))}
                    disabled={m.page === m.totalPages}
                    data-testid="button-next-page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      </TabsContent>

      <TabsContent value="decommissioned">
        {isLoadingDecommissioned ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : decommissionedEquipment.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <ArchiveX className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No Decommissioned Equipment</p>
            <p className="text-sm">Equipment that is decommissioned will appear here.</p>
          </div>
        ) : (
          <DecommissionedEquipmentTable
            equipment={decommissionedEquipment}
            vessels={m.vessels}
            onReinstate={onReinstate}
            onViewHistory={onViewHistory}
            onDelete={(item) => m.handleDelete(item as EquipmentItem)}
          />
        )}
      </TabsContent>
    </Tabs>
  );
}
