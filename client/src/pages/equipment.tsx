import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Equipment, EquipmentHealth } from "@shared/schema";
import { Server, Ship, CheckCircle, Heart, Activity, AlertTriangle, Eye, Pencil, Trash2, Wrench, Plus, Search, X, TrendingUp, Clock, ChevronLeft, ChevronRight, FileText, ArchiveX, RefreshCw, History, Shield, ExternalLink } from "lucide-react";
import { CERT_TYPE_LABELS, getCertExpiryStatus } from "@/pages/certificate-registry";
import { EquipmentCreateDialog, EquipmentEditDialog } from "@/components/equipment/EquipmentFormDialog";
import { SensorSetupWizard } from "@/components/sensors/SensorSetupWizard";
import { DecommissionedEquipmentTable } from "@/components/equipment/DecommissionedEquipmentTable";
import { EquipmentDecommissionDialog } from "@/components/equipment/EquipmentDecommissionDialog";
import { EquipmentReinstateDialog } from "@/components/equipment/EquipmentReinstateDialog";
import { EquipmentHistoryDialog } from "@/components/equipment/EquipmentHistoryDialog";
import { cn } from "@/lib/utils";
import { useEquipmentPageData } from "@/features/vessels";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { equipmentKeys } from "@/utils/queryKeys";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { PermissionGate } from "@/components/PermissionGate";

interface EquipmentItem { id: string; name: string; manufacturer?: string; model?: string; type?: string | null; vesselId?: string | null; location?: string | null; serialNumber?: string | null; installDate?: Date | string | null; lastMaintenanceDate?: Date | string | null; notes?: string | null; isActive?: boolean | null; health?: EquipmentHealth; }

function HealthBadge({ health }: { health?: EquipmentHealth }) {
  if (!health) { return <Badge variant="outline" className="text-muted-foreground"><Activity className="h-3 w-3 mr-1" />No data</Badge>; }
  const healthIndex = health.healthIndex ?? 0; const status = health.status;
  if (status === "critical" || healthIndex < 30) { return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100"><AlertTriangle className="h-3 w-3 mr-1" />{healthIndex}%</Badge>; }
  if (status === "warning" || healthIndex < 70) { return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 hover:bg-yellow-100"><Activity className="h-3 w-3 mr-1" />{healthIndex}%</Badge>; }
  return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100"><Heart className="h-3 w-3 mr-1" />{healthIndex}%</Badge>;
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  if (isActive) { return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Active</Badge>; }
  return <Badge variant="secondary" className="text-muted-foreground">Inactive</Badge>;
}

function CertStatusBadge({ equipmentId, allCerts }: { equipmentId: string; allCerts: Array<{ equipmentId?: string | null; status?: string; expiryDate?: string | Date | null }> }) {
  const eqCerts = allCerts.filter((c) => c.equipmentId === equipmentId);
  if (eqCerts.length === 0) return <Badge variant="outline" className="text-muted-foreground text-xs"><Shield className="h-3 w-3 mr-1" />No certs</Badge>;
  const now = new Date();
  const in90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  const nonValidStatuses = ["expired", "suspended", "withdrawn"];
  const hasNonValid = eqCerts.some((c) => nonValidStatuses.includes(c.status || "") || (c.expiryDate && new Date(c.expiryDate) <= now));
  const hasPendingRenewal = eqCerts.some((c) => c.status === "pending_renewal");
  const hasExpiring = eqCerts.some((c) => c.expiryDate && new Date(c.expiryDate) > now && new Date(c.expiryDate) <= in90);
  if (hasNonValid) return <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs"><Shield className="h-3 w-3 mr-1" />Non-compliant</Badge>;
  if (hasPendingRenewal || hasExpiring) return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs"><Shield className="h-3 w-3 mr-1" />Expiring</Badge>;
  return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs"><Shield className="h-3 w-3 mr-1" />Current</Badge>;
}

function EquipmentCertificationsTab({ equipmentId, equipmentName, allCerts, setLocation }: { equipmentId: string; equipmentName: string; allCerts: Array<{ id: string; equipmentId?: string | null; certificateName?: string; certificateType?: string; status?: string; expiryDate?: string | Date | null; issuingAuthority?: string; certificateNumber?: string }>; setLocation: (path: string) => void }) {
  const eqCerts = allCerts.filter((c) => c.equipmentId === equipmentId);
  return (
    <TabsContent value="certs" className="space-y-4 mt-4">
      {eqCerts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No certificates linked to this equipment</p>
          <p className="text-sm mt-1">Add certificates from the Certificate Registry</p>
          <Button variant="outline" className="mt-4" onClick={() => setLocation("/certificates")} data-testid="link-cert-registry">
            <ExternalLink className="h-4 w-4 mr-2" />Open Certificate Registry
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {eqCerts.map((cert) => {
              const expiryStatus = getCertExpiryStatus(cert.expiryDate);
              return (
                <div key={cert.id} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors" data-testid={`cert-row-${cert.id}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-sm">{cert.certificateName}</p>
                      <p className="text-xs text-muted-foreground">{CERT_TYPE_LABELS[cert.certificateType || ""] || cert.certificateType}{cert.certificateNumber && ` • ${cert.certificateNumber}`}</p>
                      {cert.issuingAuthority && <p className="text-xs text-muted-foreground">Issued by: {cert.issuingAuthority}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {expiryStatus && (
                        <Badge variant="secondary" className={`text-xs ${expiryStatus.badgeClass}`}>
                          {expiryStatus.label}
                        </Badge>
                      )}
                      {cert.status && cert.status !== "valid" && (
                        <Badge variant="outline" className="text-xs capitalize">{cert.status}</Badge>
                      )}
                    </div>
                  </div>
                  {cert.expiryDate && <p className="text-xs text-muted-foreground mt-1">Expires: {new Date(cert.expiryDate).toLocaleDateString()}</p>}
                </div>
              );
            })}
          </div>
          <Button variant="outline" className="w-full" onClick={() => setLocation(`/certificates?equipmentId=${equipmentId}`)} data-testid="link-cert-registry-filtered">
            <ExternalLink className="h-4 w-4 mr-2" />View in Certificate Registry
          </Button>
        </>
      )}
    </TabsContent>
  );
}

function EquipmentTableRow({ item, getVesselName, handleView, handleEdit, handleDelete, handleSetupSensors, allCerts }: { item: EquipmentItem; getVesselName: (id: string | null | undefined) => string; handleView: (item: EquipmentItem) => void; handleEdit: (item: EquipmentItem) => void; handleDelete: (item: EquipmentItem) => void; handleSetupSensors: (item: EquipmentItem) => void; allCerts: Array<{ equipmentId?: string | null; status?: string; expiryDate?: string | Date | null }> }) {
  return (
    <TableRow className="cursor-pointer hover:bg-accent/50" onClick={() => handleView(item)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleView(item); } }} tabIndex={0} data-testid={`row-equipment-${item.id}`}>
      <TableCell><div><div className="font-medium">{item.name}</div>{(item.manufacturer || item.model) && <div className="text-xs text-muted-foreground">{item.manufacturer}{item.model && ` • ${item.model}`}</div>}</div></TableCell>
      <TableCell><Badge variant="outline">{item.type || "Unknown"}</Badge></TableCell>
      <TableCell>{item.vesselId ? <div className="flex items-center gap-1.5"><Ship className="h-3.5 w-3.5 text-blue-600" /><span className="text-sm">{getVesselName(item.vesselId)}</span></div> : <span className="text-muted-foreground text-sm">—</span>}</TableCell>
      <TableCell><HealthBadge health={item.health} /></TableCell>
      <TableCell><div className="flex flex-col gap-1"><StatusBadge isActive={item.isActive ?? true} /><CertStatusBadge equipmentId={item.id} allCerts={allCerts} /></div></TableCell>
      <TableCell className="text-right"><div className="flex items-center justify-end gap-1" onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="presentation">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); handleView(item); }} data-testid={`button-view-${item.id}`}><Eye className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); handleSetupSensors(item); }} data-testid={`button-sensors-${item.id}`}><Wrench className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); handleEdit(item); }} data-testid={`button-edit-${item.id}`}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(item); }} data-testid={`button-delete-${item.id}`}><Trash2 className="h-4 w-4" /></Button>
      </div></TableCell>
    </TableRow>
  );
}

function EquipmentDetailsTab({ equipment, getVesselName }: { equipment: EquipmentItem; getVesselName: (id: string | null | undefined) => string }) {
  return (
    <TabsContent value="details" className="space-y-4 mt-4">
      <div className="grid grid-cols-2 gap-4">
        <div><p className="text-sm text-muted-foreground">Type</p><p className="font-medium">{equipment.type || "—"}</p></div>
        <div><p className="text-sm text-muted-foreground">Vessel</p><p className="font-medium">{getVesselName(equipment.vesselId) || "—"}</p></div>
        <div><p className="text-sm text-muted-foreground">Location</p><p className="font-medium">{equipment.location || "—"}</p></div>
        <div><p className="text-sm text-muted-foreground">Serial Number</p><p className="font-medium">{equipment.serialNumber || "—"}</p></div>
        {equipment.installDate && <div><p className="text-sm text-muted-foreground">Install Date</p><p className="font-medium">{new Date(equipment.installDate).toLocaleDateString()}</p></div>}
        {equipment.lastMaintenanceDate && <div><p className="text-sm text-muted-foreground">Last Maintenance</p><p className="font-medium">{new Date(equipment.lastMaintenanceDate).toLocaleDateString()}</p></div>}
      </div>
      {equipment.notes && <div><p className="text-sm text-muted-foreground">Notes</p><p className="mt-1">{equipment.notes}</p></div>}
    </TabsContent>
  );
}

function EquipmentHealthTab({ equipment, setLocation }: { equipment: EquipmentItem; setLocation: (path: string) => void }) {
  if (!equipment.health) {
    return <TabsContent value="health" className="mt-4"><div className="text-center py-8 text-muted-foreground"><Activity className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No health data available</p><p className="text-sm mt-1">Configure sensors to start monitoring</p></div></TabsContent>;
  }
  const healthIndex = equipment.health.healthIndex || 0;
  const statusColor = equipment.health.status === "healthy" ? "text-green-600" : equipment.health.status === "warning" ? "text-yellow-600" : "text-red-600";
  const progressColor = healthIndex >= 70 ? "[&>div]:bg-green-500" : healthIndex >= 30 ? "[&>div]:bg-yellow-500" : "[&>div]:bg-red-500";
  return (
    <TabsContent value="health" className="space-y-4 mt-4">
      <div className="grid grid-cols-2 gap-4">
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Health Index</p><p className={cn("text-2xl font-bold", healthIndex >= 70 ? "text-green-600" : healthIndex >= 30 ? "text-yellow-600" : "text-red-600")}>{healthIndex}%</p></CardContent></Card>
        <Card><CardContent className="pt-4"><p className="text-sm text-muted-foreground">Status</p><p className={cn("text-2xl font-bold capitalize", statusColor)}>{equipment.health.status}</p></CardContent></Card>
      </div>
      <Card><CardContent className="pt-4"><div className="flex items-center justify-between mb-2"><p className="text-sm text-muted-foreground">Health Progress</p><span className="text-sm font-medium">{healthIndex}%</span></div><Progress value={healthIndex} className={cn("h-3", progressColor)} /></CardContent></Card>
      {equipment.health.predictedDueDays !== undefined && <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg"><Clock className="h-5 w-5 text-muted-foreground" /><div><p className="font-medium">Predicted Maintenance</p><p className="text-sm text-muted-foreground">In approximately {equipment.health.predictedDueDays} days</p></div></div>}
      <Button variant="outline" className="w-full" onClick={() => setLocation(`/pdm/equipment/${equipment.id}`)}><TrendingUp className="h-4 w-4 mr-2" />View Full Analytics</Button>
    </TabsContent>
  );
}

function EquipmentActionsTab({ equipment, setLocation, handleEdit, handleSetupSensors, setIsDetailDrawerOpen }: { equipment: EquipmentItem; setLocation: (path: string) => void; handleEdit: (item: EquipmentItem) => void; handleSetupSensors: (item: EquipmentItem) => void; setIsDetailDrawerOpen: (open: boolean) => void }) {
  return (
    <TabsContent value="actions" className="space-y-3 mt-4">
      <Button variant="outline" className="w-full justify-start" onClick={() => { setIsDetailDrawerOpen(false); handleSetupSensors(equipment); }}><Wrench className="h-4 w-4 mr-2" />Configure Sensors</Button>
      <Button variant="outline" className="w-full justify-start" onClick={() => { setIsDetailDrawerOpen(false); handleEdit(equipment); }}><Pencil className="h-4 w-4 mr-2" />Edit Equipment</Button>
      <Button variant="outline" className="w-full justify-start" onClick={() => setLocation(`/pdm/equipment/${equipment.id}`)}><TrendingUp className="h-4 w-4 mr-2" />View Analytics</Button>
      <Button variant="outline" className="w-full justify-start" onClick={() => setLocation(`/work-orders?action=create&equipmentId=${equipment.id}`)}><FileText className="h-4 w-4 mr-2" />Create Work Order</Button>
    </TabsContent>
  );
}

export default function EquipmentPage() {
  const { toast } = useToast();
  const { selectedEquipment, setSelectedEquipment: _setSelectedEquipment, isCreateDialogOpen, setIsCreateDialogOpen, isEditDialogOpen, setIsEditDialogOpen, isDetailDrawerOpen, setIsDetailDrawerOpen, isSensorWizardOpen, setIsSensorWizardOpen, searchQuery, setSearchQuery, vesselFilter, setVesselFilter, typeFilter, setTypeFilter, statusFilter, setStatusFilter, healthFilter, setHealthFilter, page, setPage, pageSize, vessels, uniqueTypes, paginatedEquipment, filteredEquipment, totalPages, stats, isLoading, handleView, handleEdit, handleDelete, handleSetupSensors, clearFilters, hasActiveFilters, getVesselName, refetchEquipment, setLocation } = useEquipmentPageData();
  
  const [activeTab, setActiveTab] = useState<"active" | "decommissioned">("active");
  const [isDecommissionDialogOpen, setIsDecommissionDialogOpen] = useState(false);
  const [isReinstateDialogOpen, setIsReinstateDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [lifecycleEquipment, setLifecycleEquipment] = useState<Equipment | null>(null);

  const { data: allCerts = [] } = useQuery<Array<{ id: string; equipmentId?: string | null; certificateName?: string; certificateType?: string; status?: string; expiryDate?: string | Date | null; issuingAuthority?: string; certificateNumber?: string }>>({
    queryKey: ["/api/certificates"],
  });

  const { data: decommissionedEquipment = [], isLoading: isLoadingDecommissioned, refetch: refetchDecommissioned } = useQuery<Equipment[]>({
    queryKey: equipmentKeys.decommissioned(),
    queryFn: () => apiRequest("GET", "/api/equipment/decommissioned"),
    enabled: activeTab === "decommissioned",
  });

  const handleDecommission = (item: EquipmentItem) => {
    setLifecycleEquipment(item as unknown as Equipment);
    setIsDecommissionDialogOpen(true);
  };

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

  if (isLoading) { return <div className="min-h-screen"><div className="p-4 md:p-6 space-y-6"><div className="flex items-center justify-between"><Skeleton className="h-10 w-48" /><Skeleton className="h-10 w-32" /></div><div className="grid grid-cols-2 md:grid-cols-5 gap-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div><div className="space-y-2">{[...Array(10)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div></div></div>; }

  return (
    <div className="min-h-screen">
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Equipment Registry</h1>
          <PermissionGate resource="equipment" action="create">
            <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-add-equipment"><Plus className="h-4 w-4 mr-2" />Add Equipment</Button>
          </PermissionGate>
        </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="pt-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Total</p><p className="text-2xl font-bold">{stats.total}</p></div><Server className="h-8 w-8 text-muted-foreground" /></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Avg Health</p><p className="text-2xl font-bold">{stats.avgHealth}%</p></div><Heart className={cn("h-8 w-8", stats.avgHealth >= 70 ? "text-green-500" : stats.avgHealth >= 30 ? "text-yellow-500" : "text-red-500")} /></div></CardContent></Card>
        <Card role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setHealthFilter("healthy"); } }} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setHealthFilter("healthy")}><CardContent className="pt-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Healthy</p><p className="text-2xl font-bold text-green-600">{stats.healthy}</p></div><CheckCircle className="h-8 w-8 text-green-500" /></div></CardContent></Card>
        <Card role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setHealthFilter("warning"); } }} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setHealthFilter("warning")}><CardContent className="pt-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Warning</p><p className="text-2xl font-bold text-yellow-600">{stats.warning}</p></div><Activity className="h-8 w-8 text-yellow-500" /></div></CardContent></Card>
        <Card role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setHealthFilter("critical"); } }} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setHealthFilter("critical")}><CardContent className="pt-4"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">Critical</p><p className="text-2xl font-bold text-red-600">{stats.critical}</p></div><AlertTriangle className="h-8 w-8 text-red-500" /></div></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "active" | "decommissioned")} className="space-y-4">
        <TabsList className="mb-2">
          <TabsTrigger value="active" className="flex items-center gap-2" data-testid="tab-active-equipment">
            <Server className="h-4 w-4" />
            Active Equipment
            <Badge variant="secondary" className="ml-1">{stats.total}</Badge>
          </TabsTrigger>
          <TabsTrigger value="decommissioned" className="flex items-center gap-2" data-testid="tab-decommissioned-equipment">
            <ArchiveX className="h-4 w-4" />
            Decommissioned
            <Badge variant="secondary" className="ml-1">{decommissionedEquipment.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card>
        <div className="p-4 pb-4"><div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Search equipment..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" data-testid="input-search" /></div>
          <div className="flex flex-wrap gap-2">
            <Select value={vesselFilter} onValueChange={setVesselFilter}><SelectTrigger className="w-36" data-testid="select-vessel"><SelectValue placeholder="Vessel" /></SelectTrigger><SelectContent><SelectItem value="all">All Vessels</SelectItem>{vessels.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent></Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger className="w-36" data-testid="select-type"><SelectValue placeholder="Type" /></SelectTrigger><SelectContent><SelectItem value="all">All Types</SelectItem>{uniqueTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
            <Select value={healthFilter} onValueChange={setHealthFilter}><SelectTrigger className="w-36" data-testid="select-health"><SelectValue placeholder="Health" /></SelectTrigger><SelectContent><SelectItem value="all">All Health</SelectItem><SelectItem value="healthy">Healthy</SelectItem><SelectItem value="warning">Warning</SelectItem><SelectItem value="critical">Critical</SelectItem><SelectItem value="unknown">No Data</SelectItem></SelectContent></Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-36" data-testid="select-status"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Status</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent></Select>
            {hasActiveFilters && <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters"><X className="h-4 w-4 mr-1" />Clear</Button>}
          </div>
        </div></div>
        <div className="p-0">
          <Table data-testid="table-equipment"><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Vessel</TableHead><TableHead>Health</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
            {paginatedEquipment.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{hasActiveFilters ? "No equipment matches your filters" : "No equipment found"}</TableCell></TableRow> : paginatedEquipment.map((item) => (
              <EquipmentTableRow key={item.id} item={item} getVesselName={getVesselName} handleView={handleView} handleEdit={handleEdit} handleDelete={handleDelete} handleSetupSensors={handleSetupSensors} allCerts={allCerts} />
            ))}
          </TableBody></Table>
          {totalPages > 1 && <div className="flex items-center justify-between px-4 py-3 border-t"><p className="text-sm text-muted-foreground">Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredEquipment.length)} of {filteredEquipment.length}</p><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} data-testid="button-prev-page"><ChevronLeft className="h-4 w-4" /></Button><span className="text-sm">Page {page} of {totalPages}</span><Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} data-testid="button-next-page"><ChevronRight className="h-4 w-4" /></Button></div></div>}
        </div>
          </Card>
        </TabsContent>

        <TabsContent value="decommissioned">
          {isLoadingDecommissioned ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
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

      <Sheet open={isDetailDrawerOpen} onOpenChange={setIsDetailDrawerOpen}><SheetContent className="w-full sm:max-w-lg overflow-y-auto">{selectedEquipment && (
        <>
          <SheetHeader><SheetTitle className="flex items-center gap-2"><Server className="h-5 w-5" />{selectedEquipment.name}</SheetTitle><SheetDescription>{selectedEquipment.manufacturer}{selectedEquipment.model && ` • ${selectedEquipment.model}`}</SheetDescription></SheetHeader>
          <div className="mt-6 space-y-6">
            <div className="flex items-center justify-between"><HealthBadge health={selectedEquipment.health} /><StatusBadge isActive={selectedEquipment.isActive ?? true} /></div>
            <Tabs defaultValue="details">
              <TabsList className="w-full grid grid-cols-4"><TabsTrigger value="details">Details</TabsTrigger><TabsTrigger value="health">Health</TabsTrigger><TabsTrigger value="certs" data-testid="tab-equipment-certs">Certs</TabsTrigger><TabsTrigger value="actions">Actions</TabsTrigger></TabsList>
              <EquipmentDetailsTab equipment={selectedEquipment} getVesselName={getVesselName} />
              <EquipmentHealthTab equipment={selectedEquipment} setLocation={setLocation} />
              <EquipmentCertificationsTab equipmentId={selectedEquipment.id} equipmentName={selectedEquipment.name} allCerts={allCerts} setLocation={setLocation} />
              <EquipmentActionsTab equipment={selectedEquipment} setLocation={setLocation} handleEdit={handleEdit} handleSetupSensors={handleSetupSensors} setIsDetailDrawerOpen={setIsDetailDrawerOpen} />
            </Tabs>
          </div>
        </>
      )}</SheetContent></Sheet>

      <EquipmentCreateDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} vessels={vessels} onSuccess={() => { setIsCreateDialogOpen(false); refetchEquipment(); }} />
      {selectedEquipment && <EquipmentEditDialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} equipment={selectedEquipment} vessels={vessels} onSuccess={() => { setIsEditDialogOpen(false); refetchEquipment(); }} />}
      {selectedEquipment && <SensorSetupWizard equipment={selectedEquipment} open={isSensorWizardOpen} onClose={() => setIsSensorWizardOpen(false)} onSuccess={() => { setIsSensorWizardOpen(false); refetchEquipment(); }} />}
      
      <EquipmentDecommissionDialog
        open={isDecommissionDialogOpen}
        onOpenChange={setIsDecommissionDialogOpen}
        equipment={lifecycleEquipment}
        onSubmit={async (data) => {
          try {
            await apiRequest("POST", `/api/equipment/${lifecycleEquipment?.id}/decommission`, data);
            toast({ title: "Equipment Decommissioned", description: `${lifecycleEquipment?.name} has been decommissioned.` });
            setIsDecommissionDialogOpen(false);
            handleLifecycleSuccess();
          } catch (error) {
            toast({ title: "Error", description: "Failed to decommission equipment.", variant: "destructive" });
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
