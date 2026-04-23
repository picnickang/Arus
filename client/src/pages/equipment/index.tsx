import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Equipment } from "@shared/schema";
import {
  Server,
  CheckCircle,
  Heart,
  Activity,
  AlertTriangle,
  Plus,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ArchiveX,
} from "lucide-react";
import {
  EquipmentCreateDialog,
  EquipmentEditDialog,
} from "@/components/equipment/EquipmentFormDialog";
import { SensorSetupWizard } from "@/components/sensors/SensorSetupWizard";
import { DecommissionedEquipmentTable } from "@/components/equipment/DecommissionedEquipmentTable";
import { EquipmentDecommissionDialog } from "@/components/equipment/EquipmentDecommissionDialog";
import { EquipmentReinstateDialog } from "@/components/equipment/EquipmentReinstateDialog";
import { EquipmentHistoryDialog } from "@/components/equipment/EquipmentHistoryDialog";
import { cn } from "@/lib/utils";
import { useEquipmentPageData } from "@/features/vessels";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { equipmentKeys } from "@/utils/queryKeys";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { PermissionGate } from "@/components/PermissionGate";

import { HealthBadge } from "./HealthBadge";
import { StatusBadge } from "./StatusBadge";
import { EquipmentTableRow } from "./EquipmentTableRow";
import { EquipmentDetailsTab } from "./EquipmentDetailsTab";
import { EquipmentHealthTab } from "./EquipmentHealthTab";
import { EquipmentCertificationsTab } from "./EquipmentCertificationsTab";
import { EquipmentActionsTab } from "./EquipmentActionsTab";
import type { CertSummary, EquipmentItem } from "./types";

export default function EquipmentPage() {
  const { toast } = useToast();
  const {
    selectedEquipment,
    setSelectedEquipment: _setSelectedEquipment,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    isEditDialogOpen,
    setIsEditDialogOpen,
    isDetailDrawerOpen,
    setIsDetailDrawerOpen,
    isSensorWizardOpen,
    setIsSensorWizardOpen,
    searchQuery,
    setSearchQuery,
    vesselFilter,
    setVesselFilter,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    healthFilter,
    setHealthFilter,
    page,
    setPage,
    pageSize,
    vessels,
    uniqueTypes,
    paginatedEquipment,
    filteredEquipment,
    totalPages,
    stats,
    isLoading,
    handleView,
    handleEdit,
    handleDelete,
    handleSetupSensors,
    clearFilters,
    hasActiveFilters,
    getVesselName,
    refetchEquipment,
    setLocation,
  } = useEquipmentPageData();

  const [activeTab, setActiveTab] = useState<"active" | "decommissioned">("active");
  const [isDecommissionDialogOpen, setIsDecommissionDialogOpen] = useState(false);
  const [isReinstateDialogOpen, setIsReinstateDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [lifecycleEquipment, setLifecycleEquipment] = useState<Equipment | null>(null);

  const { data: allCerts = [] } = useQuery<CertSummary[]>({
    queryKey: ["/api/certificates"],
  });

  const {
    data: decommissionedEquipment = [],
    isLoading: isLoadingDecommissioned,
  } = useQuery<Equipment[]>({
    queryKey: equipmentKeys.decommissioned(),
    queryFn: () => apiRequest("GET", "/api/equipment/decommissioned"),
    enabled: activeTab === "decommissioned",
  });

  const handleReinstate = (item: Equipment) => {
    setLifecycleEquipment(item);
    setIsReinstateDialogOpen(true);
  };

  const handleViewHistory = (item: EquipmentItem | Equipment) => {
    setLifecycleEquipment(item as Equipment);
    setIsHistoryDialogOpen(true);
  };

  const handleLifecycleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: equipmentKeys.list() });
    queryClient.invalidateQueries({ queryKey: equipmentKeys.decommissioned() });
    refetchEquipment();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <div className="p-4 md:p-6 space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Equipment Registry</h1>
          <PermissionGate resource="equipment" action="create">
            <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-add-equipment">
              <Plus className="h-4 w-4 mr-2" />
              Add Equipment
            </Button>
          </PermissionGate>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Server className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Health</p>
                  <p className="text-2xl font-bold">{stats.avgHealth}%</p>
                </div>
                <Heart
                  className={cn(
                    "h-8 w-8",
                    stats.avgHealth >= 70
                      ? "text-green-500"
                      : stats.avgHealth >= 30
                        ? "text-yellow-500"
                        : "text-red-500"
                  )}
                />
              </div>
            </CardContent>
          </Card>
          <Card
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setHealthFilter("healthy");
              }
            }}
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => setHealthFilter("healthy")}
          >
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Healthy</p>
                  <p className="text-2xl font-bold text-green-600">{stats.healthy}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setHealthFilter("warning");
              }
            }}
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => setHealthFilter("warning")}
          >
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Warning</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.warning}</p>
                </div>
                <Activity className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setHealthFilter("critical");
              }
            }}
            className="cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => setHealthFilter("critical")}
          >
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Critical</p>
                  <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

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
                {stats.total}
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
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                      data-testid="input-search"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Select value={vesselFilter} onValueChange={setVesselFilter}>
                      <SelectTrigger className="w-36" data-testid="select-vessel">
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
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                      <SelectTrigger className="w-36" data-testid="select-type">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {uniqueTypes.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={healthFilter} onValueChange={setHealthFilter}>
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
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-36" data-testid="select-status">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
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
                <Table data-testid="table-equipment">
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
                    {paginatedEquipment.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          {hasActiveFilters
                            ? "No equipment matches your filters"
                            : "No equipment found"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedEquipment.map((item) => (
                        <EquipmentTableRow
                          key={item.id}
                          item={item}
                          getVesselName={getVesselName}
                          handleView={handleView}
                          handleEdit={handleEdit}
                          handleDelete={handleDelete}
                          handleSetupSensors={handleSetupSensors}
                          allCerts={allCerts}
                        />
                      ))
                    )}
                  </TableBody>
                </Table>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t">
                    <p className="text-sm text-muted-foreground">
                      Showing {(page - 1) * pageSize + 1}-
                      {Math.min(page * pageSize, filteredEquipment.length)} of{" "}
                      {filteredEquipment.length}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        data-testid="button-prev-page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">
                        Page {page} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
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
                vessels={vessels}
                onReinstate={handleReinstate}
                onViewHistory={handleViewHistory}
                onDelete={(item) => handleDelete(item as EquipmentItem)}
              />
            )}
          </TabsContent>
        </Tabs>

        <Sheet open={isDetailDrawerOpen} onOpenChange={setIsDetailDrawerOpen}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            {selectedEquipment && (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    {selectedEquipment.name}
                  </SheetTitle>
                  <SheetDescription>
                    {selectedEquipment.manufacturer}
                    {selectedEquipment.model && ` • ${selectedEquipment.model}`}
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <HealthBadge health={selectedEquipment.health} />
                    <StatusBadge isActive={selectedEquipment.isActive ?? true} />
                  </div>
                  <Tabs defaultValue="details">
                    <TabsList className="w-full grid grid-cols-4">
                      <TabsTrigger value="details">Details</TabsTrigger>
                      <TabsTrigger value="health">Health</TabsTrigger>
                      <TabsTrigger value="certs" data-testid="tab-equipment-certs">
                        Certs
                      </TabsTrigger>
                      <TabsTrigger value="actions">Actions</TabsTrigger>
                    </TabsList>
                    <EquipmentDetailsTab
                      equipment={selectedEquipment}
                      getVesselName={getVesselName}
                    />
                    <EquipmentHealthTab equipment={selectedEquipment} setLocation={setLocation} />
                    <EquipmentCertificationsTab
                      equipmentId={selectedEquipment.id}
                      equipmentName={selectedEquipment.name}
                      allCerts={allCerts}
                      setLocation={setLocation}
                    />
                    <EquipmentActionsTab
                      equipment={selectedEquipment}
                      setLocation={setLocation}
                      handleEdit={handleEdit}
                      handleSetupSensors={handleSetupSensors}
                      setIsDetailDrawerOpen={setIsDetailDrawerOpen}
                    />
                  </Tabs>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

        <EquipmentCreateDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          vessels={vessels}
          onSuccess={() => {
            setIsCreateDialogOpen(false);
            refetchEquipment();
          }}
        />
        {selectedEquipment && (
          <EquipmentEditDialog
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            equipment={selectedEquipment}
            vessels={vessels}
            onSuccess={() => {
              setIsEditDialogOpen(false);
              refetchEquipment();
            }}
          />
        )}
        {selectedEquipment && (
          <SensorSetupWizard
            equipment={selectedEquipment}
            open={isSensorWizardOpen}
            onClose={() => setIsSensorWizardOpen(false)}
            onSuccess={() => {
              setIsSensorWizardOpen(false);
              refetchEquipment();
            }}
          />
        )}

        <EquipmentDecommissionDialog
          open={isDecommissionDialogOpen}
          onOpenChange={setIsDecommissionDialogOpen}
          equipment={lifecycleEquipment}
          onSubmit={async (data) => {
            try {
              await apiRequest(
                "POST",
                `/api/equipment/${lifecycleEquipment?.id}/decommission`,
                data
              );
              toast({
                title: "Equipment Decommissioned",
                description: `${lifecycleEquipment?.name} has been decommissioned.`,
              });
              setIsDecommissionDialogOpen(false);
              handleLifecycleSuccess();
            } catch (error) {
              toast({
                title: "Error",
                description: "Failed to decommission equipment.",
                variant: "destructive",
              });
            }
          }}
          isPending={false}
        />

        <EquipmentReinstateDialog
          isOpen={isReinstateDialogOpen}
          onOpenChange={setIsReinstateDialogOpen}
          equipment={lifecycleEquipment}
          onSuccess={handleLifecycleSuccess}
        />

        <EquipmentHistoryDialog
          isOpen={isHistoryDialogOpen}
          onOpenChange={setIsHistoryDialogOpen}
          equipment={lifecycleEquipment}
        />
      </div>
    </div>
  );
}
