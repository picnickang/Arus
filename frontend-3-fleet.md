# ARUS Frontend — Part 3: Fleet (Vessels, Equipment)
Generated: 2026-03-26T02:38:14Z

### `client/src/pages/vessel-management.tsx` (182 lines)

```tsx
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ResponsiveTable } from "@/components/shared/ResponsiveTable";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Vessel } from "@shared/schema";
import { Plus, Pencil, Trash2, Ship, AlertTriangle, Eye, Wifi, WifiOff, RefreshCw, Download, Upload } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { formatPercent } from "@/lib/formatters";
import { VESSEL_CLASSES, VESSEL_CONDITIONS, calculateUtilization, useVesselManagementData } from "@/features/vessels";
import { PermissionGate } from "@/components/PermissionGate";
import { usePermissions } from "@/contexts/PermissionsContext";

const vesselClasses = VESSEL_CLASSES;
const vesselConditions = VESSEL_CONDITIONS;

const Utilization = ({ vessel }: { vessel: Vessel }) => {
  const utilization = calculateUtilization(vessel);
  if (utilization === null) { return <>N/A</>; }
  return <>{formatPercent(utilization)}</>;
};

const formatVesselClass = (vesselClass: string) => vesselClass.replaceAll('_', " ").split(" ").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

export default function VesselManagement() {
  const v = useVesselManagementData();

  const getStatusBadge = (vessel: Vessel) => {
    const offlineForWO = v.hasActiveDowntime(vessel.name, vessel.id);
    const offline = offlineForWO || vessel.onlineStatus === "offline";
    return offline ? <Badge variant="secondary" className="bg-red-500 text-white"><WifiOff className="w-3 h-3 mr-1" />Offline</Badge> : <Badge variant="default" className="bg-green-500"><Wifi className="w-3 h-3 mr-1" />Online</Badge>;
  };

  const getConditionBadge = (vessel: Vessel) => {
    const all = v.getVesselEquipment(vessel.name);
    if (!all || all.length === 0) {
      const condition = vessel.condition || "good";
      const colors: Record<string, string> = { excellent: "bg-green-500", good: "bg-blue-500", fair: "bg-yellow-500", poor: "bg-orange-500", critical: "bg-red-500" };
      return <Badge className={colors[condition] ?? "bg-gray-500"}>{condition}</Badge>;
    }
    const valid = all.filter((eq) => typeof eq.healthIndex === "number");
    if (valid.length === 0) { return <Badge className="bg-gray-500">unknown</Badge>; }
    const avg = valid.reduce((s, eq) => s + (eq.healthIndex as number), 0) / valid.length;
    const hasCritical = all.some((eq) => eq.status === "critical");
    const hasWarnings = all.some((eq) => eq.status === "warning");
    const urgent = all.some((eq) => (eq.predictedDueDays ?? Infinity) <= 7);
    if (hasCritical || avg < 50) {return <Badge className="bg-red-500">critical</Badge>;}
    if (hasWarnings || avg < 75 || urgent) {return <Badge className="bg-orange-500">poor</Badge>;}
    if (avg < 85) {return <Badge className="bg-yellow-500">fair</Badge>;}
    if (avg < 95) {return <Badge className="bg-blue-500">good</Badge>;}
    return <Badge className="bg-green-500">excellent</Badge>;
  };

  if (v.isLoading) { return <div className="container mx-auto p-6"><div className="flex items-center justify-center min-h-[400px]"><div className="text-lg">Loading vessels...</div></div></div>; }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <PermissionGate resource="vessels" action="create">
            <Button variant="outline" className="gap-2" onClick={v.handleImport} disabled={v.importVesselMutation.isPending} data-testid="button-import-vessel"><Upload className="h-4 w-4" />Import Vessel</Button>
          </PermissionGate>
          <PermissionGate resource="vessels" action="create">
            <Dialog open={v.isCreateDialogOpen} onOpenChange={v.setIsCreateDialogOpen}>
              <DialogTrigger asChild><Button className="gap-2" data-testid="button-add-vessel"><Plus className="h-4 w-4" />Add Vessel</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Add New Vessel</DialogTitle><DialogDescription>Create a new vessel record for your fleet</DialogDescription></DialogHeader>
              <Form {...v.form}>
                <form onSubmit={v.form.handleSubmit(v.handleCreate)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={v.form.control} name="name" render={({ field }) => <FormItem><FormLabel>Vessel Name</FormLabel><FormControl><Input placeholder="MV Atlantic Explorer" {...field} data-testid="input-vessel-name" /></FormControl><FormMessage /></FormItem>} />
                    <FormField control={v.form.control} name="vesselClass" render={({ field }) => <FormItem><FormLabel>Vessel Class</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger data-testid="select-vessel-class"><SelectValue placeholder="Select class" /></SelectTrigger></FormControl><SelectContent>{vesselClasses.map((cls) => <SelectItem key={cls} value={cls}>{formatVesselClass(cls)}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={v.form.control} name="condition" render={({ field }) => <FormItem><FormLabel>Condition</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger data-testid="select-vessel-condition"><SelectValue placeholder="Select condition" /></SelectTrigger></FormControl><SelectContent>{vesselConditions.map((condition) => <SelectItem key={condition} value={condition}>{condition.charAt(0).toUpperCase() + condition.slice(1)}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
                    <FormField control={v.form.control} name="dayRateSgd" render={({ field }) => <FormItem><FormLabel>Day Rate (SGD)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="10000.00" {...field} data-testid="input-day-rate" /></FormControl><FormMessage /></FormItem>} />
                  </div>
                  <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => v.setIsCreateDialogOpen(false)} data-testid="button-cancel">Cancel</Button><Button type="submit" disabled={v.createVesselMutation.isPending} data-testid="button-create-vessel">{v.createVesselMutation.isPending ? "Creating..." : "Create Vessel"}</Button></div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          </PermissionGate>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Ship className="h-5 w-5" />Fleet Overview</CardTitle><CardDescription>{v.vessels.length} vessel(s) in your fleet</CardDescription></CardHeader>
        <CardContent className="p-0">
          <ResponsiveTable
            columns={[
              { header: "Vessel Name", accessor: (vessel: Vessel) => <Link href={`/vessels/${vessel.id}`} className="hover:underline text-primary font-medium" data-testid={`text-vessel-name-${vessel.id}`}>{vessel.name}</Link> },
              { header: "Class", accessor: (vessel: Vessel) => <span data-testid={`text-vessel-class-${vessel.id}`}>{vessel.vesselClass ? formatVesselClass(vessel.vesselClass) : "Not specified"}</span> },
              { header: "Condition", accessor: (vessel: Vessel) => <span data-testid={`badge-vessel-condition-${vessel.id}`}>{getConditionBadge(vessel)}</span> },
              { header: "Status", accessor: (vessel: Vessel) => <span data-testid={`badge-vessel-status-${vessel.id}`}>{getStatusBadge(vessel)}</span> },
              { header: "Last Heartbeat", accessor: (vessel: Vessel) => vessel.lastHeartbeat ? <span title={format(new Date(vessel.lastHeartbeat), "PPpp")} data-testid={`text-vessel-heartbeat-${vessel.id}`}>{formatDistanceToNow(new Date(vessel.lastHeartbeat), { addSuffix: true })}</span> : <span className="text-muted-foreground" data-testid={`text-vessel-heartbeat-${vessel.id}`}>Never</span> },
            ]}
            data={v.vessels}
            keyExtractor={(vessel: Vessel) => vessel.id}
            actions={(vessel: Vessel) => (
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => v.handleRefresh(vessel)} data-testid={`button-refresh-${vessel.id}`}><RefreshCw className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => v.handleView(vessel)} data-testid={`button-view-${vessel.id}`}><Eye className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => v.handleExport(vessel)} disabled={v.exportVesselMutation.isPending} data-testid={`button-export-${vessel.id}`}><Download className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => v.handleEdit(vessel)} data-testid={`button-edit-${vessel.id}`}><Pencil className="h-4 w-4" /></Button>
                <Button variant="outline" size="sm" onClick={() => v.handleDelete(vessel)} className="text-destructive hover:text-destructive" data-testid={`button-delete-${vessel.id}`}><Trash2 className="h-4 w-4" /></Button>
              </div>
            )}
          />
        </CardContent>
      </Card>

      <Dialog open={v.isViewDialogOpen} onOpenChange={v.setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Ship className="h-5 w-5" />{v.selectedVessel?.name}</DialogTitle><DialogDescription>Vessel details and equipment assignments</DialogDescription></DialogHeader>
          {v.selectedVessel && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-medium">Vessel Class</label><div className="mt-1 text-muted-foreground">{v.selectedVessel.vesselClass ? formatVesselClass(v.selectedVessel.vesselClass) : "Not specified"}</div></div>
                <div><label className="text-sm font-medium">Condition</label><div className="mt-1">{getConditionBadge(v.selectedVessel)}</div></div>
                <div><label className="text-sm font-medium">Online Status</label><div className="mt-1">{getStatusBadge(v.selectedVessel)}</div></div>
                <div><label className="text-sm font-medium">Utilization</label><div className="mt-1 text-muted-foreground"><Utilization vessel={v.selectedVessel} /></div></div>
                <div><label className="text-sm font-medium">Last Heartbeat</label><div className="mt-1 text-muted-foreground">{v.selectedVessel.lastHeartbeat ? formatDistanceToNow(new Date(v.selectedVessel.lastHeartbeat), { addSuffix: true }) : "Never"}</div></div>
              </div>
              {v.vesselEquipment && v.vesselEquipment.length > 0 && (
                <div><h3 className="text-lg font-medium mb-3">Equipment ({v.vesselEquipment.length})</h3><div className="space-y-2">{v.vesselEquipment.map((eq) => <div key={eq.id} className="flex items-center justify-between p-3 rounded-lg border"><div><div className="font-medium">{eq.name}</div><div className="text-sm text-muted-foreground">{eq.category}</div></div><Badge variant="outline">{eq.status}</Badge></div>)}</div></div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={v.isEditDialogOpen} onOpenChange={v.setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Vessel</DialogTitle><DialogDescription>Update vessel information</DialogDescription></DialogHeader>
          <Form {...v.editForm}>
            <form onSubmit={v.editForm.handleSubmit(v.handleUpdate)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={v.editForm.control} name="name" render={({ field }) => <FormItem><FormLabel>Vessel Name</FormLabel><FormControl><Input placeholder="MV Atlantic Explorer" {...field} data-testid="input-edit-vessel-name" /></FormControl><FormMessage /></FormItem>} />
                <FormField control={v.editForm.control} name="vesselClass" render={({ field }) => <FormItem><FormLabel>Vessel Class</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger data-testid="select-edit-vessel-class"><SelectValue placeholder="Select class" /></SelectTrigger></FormControl><SelectContent>{vesselClasses.map((cls) => <SelectItem key={cls} value={cls}>{formatVesselClass(cls)}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={v.editForm.control} name="condition" render={({ field }) => <FormItem><FormLabel>Condition</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger data-testid="select-edit-vessel-condition"><SelectValue placeholder="Select condition" /></SelectTrigger></FormControl><SelectContent>{vesselConditions.map((condition) => <SelectItem key={condition} value={condition}>{condition.charAt(0).toUpperCase() + condition.slice(1)}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
                <FormField control={v.editForm.control} name="dayRateSgd" render={({ field }) => <FormItem><FormLabel>Day Rate (SGD)</FormLabel><FormControl><Input type="number" step="0.01" placeholder="10000.00" {...field} data-testid="input-edit-day-rate" /></FormControl><FormMessage /></FormItem>} />
              </div>
              {v.selectedVessel && (
                <div className="pt-4 border-t">
                  <h3 className="text-lg font-medium mb-3 text-destructive">Danger Zone</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg border border-destructive/50"><div><div className="font-medium">Reset Downtime Counter</div><div className="text-sm text-muted-foreground">Reset accumulated downtime hours to zero</div></div><Button type="button" variant="outline" size="sm" onClick={() => v.resetDowntimeMutation.mutate(v.selectedVessel!.id)} disabled={v.resetDowntimeMutation.isPending} data-testid="button-reset-downtime">{v.resetDowntimeMutation.isPending ? "Resetting..." : "Reset Downtime"}</Button></div>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-destructive/50"><div><div className="font-medium">Reset Operation Counter</div><div className="text-sm text-muted-foreground">Reset accumulated operation hours to zero</div></div><Button type="button" variant="outline" size="sm" onClick={() => v.resetOperationMutation.mutate(v.selectedVessel!.id)} disabled={v.resetOperationMutation.isPending} data-testid="button-reset-operation">{v.resetOperationMutation.isPending ? "Resetting..." : "Reset Operation"}</Button></div>
                    <div className="flex items-center justify-between p-3 rounded-lg border-2 border-destructive"><div><div className="font-medium text-destructive">Wipe All Vessel Data</div><div className="text-sm text-muted-foreground">Delete all telemetry, DTCs, and insights for this vessel</div></div><Button type="button" variant="destructive" size="sm" onClick={v.handleWipeVesselData} disabled={v.wipeVesselDataMutation.isPending} data-testid="button-wipe-vessel-data">{v.wipeVesselDataMutation.isPending ? "Wiping..." : "Wipe All Vessel Data"}</Button></div>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => v.setIsEditDialogOpen(false)} data-testid="button-cancel-edit">Cancel</Button><Button type="submit" disabled={v.updateVesselMutation.isPending} data-testid="button-update-vessel">{v.updateVesselMutation.isPending ? "Updating..." : "Update Vessel"}</Button></div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={v.isDeleteDialogOpen} onOpenChange={v.setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />Delete Vessel</DialogTitle><DialogDescription>Are you sure you want to delete "{v.selectedVessel?.name}"?</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border p-4 bg-muted/50"><p className="text-sm font-medium mb-2">What will be deleted:</p><ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside"><li>Vessel record and configuration</li><li>All associated equipment and sensors</li><li>All telemetry, work orders, and maintenance data</li><li>Port calls, drydock windows, and schedules</li></ul></div>
            <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 p-3"><p className="text-sm text-blue-700 dark:text-blue-300 font-medium">Info: Crew will be unassigned</p><p className="text-xs text-muted-foreground mt-1">Crew members will not be deleted. They will be unassigned from this vessel and available for reassignment.</p></div>
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3"><p className="text-sm text-destructive font-medium">Warning: This action cannot be undone</p><p className="text-xs text-muted-foreground mt-1">All equipment and related data will be permanently deleted.</p></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => { v.setIsDeleteDialogOpen(false); v.setSelectedVessel(null); }} data-testid="button-cancel-delete">Cancel</Button>
            <Button variant="destructive" onClick={v.confirmDelete} disabled={v.deleteVesselMutation.isPending} data-testid="button-confirm-delete">{v.deleteVesselMutation.isPending ? "Deleting..." : "Delete Vessel"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

```

### `client/src/pages/vessel-detail.tsx` (59 lines)

```tsx
import { Link } from "wouter";
import { ArrowLeft, Ship, Server, Wrench, Users, TrendingUp, AlertCircle } from "lucide-react";
import { PowerSTWChart } from "@/components/analytics/PowerSTWChart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { ActiveDtcsPanel } from "@/components/ActiveDtcsPanel";
import { CIIBadge } from "@/components/compliance/CIIBadge";
import { OperatingModeChip } from "@/components/context/OperatingModeChip";
import { NarrativeSummaryCard } from "@/components/analytics/NarrativeSummaryCard";
import { useVesselDetail } from "@/features/vessels";
import { PageHeader } from "@/components/navigation";

export default function VesselDetail() {
  const { match, vesselId, vessel, vesselLoading, equipment, equipmentLoading, workOrdersLoading, crewLoading, schedulesLoading, vesselWorkOrders, vesselCrew, vesselMaintenanceSchedules, activeWorkOrders, completedWorkOrders, utilizationRate, totalCost, powerSTWDateRange } = useVesselDetail();

  if (!match || vesselLoading) {return <div className="p-6 space-y-6"><Skeleton className="h-8 w-64" /><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div></div>;}
  if (!vessel) {return <div className="p-6"><Card><CardContent className="pt-6"><div className="text-center"><AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" /><h3 className="mt-4 text-lg font-semibold">Vessel not found</h3><p className="text-muted-foreground">The vessel you're looking for doesn't exist.</p><Button asChild className="mt-4"><Link href="/vessel-management">Back to Vessels</Link></Button></div></CardContent></Card></div>;}

  return (
    <div className="min-h-screen" data-testid="vessel-detail-page">
      <PageHeader title={vessel.name} />
      <div className="p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge variant={vessel.onlineStatus === "online" ? "default" : "secondary"}>{vessel.onlineStatus?.toUpperCase()}</Badge>
          <CIIBadge vesselId={vesselId!} vesselName={vessel.name} />
          <OperatingModeChip vesselId={vesselId!} />
        </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Equipment</CardTitle><Server className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{equipment.length}</div><p className="text-xs text-muted-foreground">Total registered equipment</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Active Work Orders</CardTitle><Wrench className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{activeWorkOrders.length}</div><p className="text-xs text-muted-foreground">{completedWorkOrders.length} completed</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Crew Assigned</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{vesselCrew.length}</div><p className="text-xs text-muted-foreground">Active crew members</p></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Utilization Rate</CardTitle><TrendingUp className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{utilizationRate}%</div><p className="text-xs text-muted-foreground">{vessel.operationDays || 0} days operational</p></CardContent></Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <div className="overflow-x-auto -mx-6 px-6 lg:mx-0 lg:px-0"><TabsList className="inline-flex w-auto min-w-full lg:w-full"><TabsTrigger value="overview" data-testid="tab-overview" className="whitespace-nowrap">Overview</TabsTrigger><TabsTrigger value="equipment" data-testid="tab-equipment" className="whitespace-nowrap">Equipment ({equipment.length})</TabsTrigger><TabsTrigger value="work-orders" data-testid="tab-work-orders" className="whitespace-nowrap">Work Orders ({activeWorkOrders.length})</TabsTrigger><TabsTrigger value="crew" data-testid="tab-crew" className="whitespace-nowrap">Crew ({vesselCrew.length})</TabsTrigger><TabsTrigger value="maintenance" data-testid="tab-maintenance" className="whitespace-nowrap">Maintenance ({vesselMaintenanceSchedules.length})</TabsTrigger><TabsTrigger value="performance" data-testid="tab-performance" className="whitespace-nowrap">Performance</TabsTrigger></TabsList></div>

        <TabsContent value="overview" className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><Card><CardHeader><CardTitle>Vessel Information</CardTitle></CardHeader><CardContent className="space-y-2"><div className="flex justify-between"><span className="text-muted-foreground">Class:</span><span className="font-medium">{vessel.vesselClass?.replace("_", " ") || "N/A"}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Condition:</span><span className="font-medium">{vessel.condition || "N/A"}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Status:</span><span className="font-medium">{vessel.onlineStatus || "N/A"}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Day Rate:</span><span className="font-medium">SGD {vessel.dayRateSgd || "N/A"}</span></div></CardContent></Card><Card><CardHeader><CardTitle>Financial Summary</CardTitle></CardHeader><CardContent className="space-y-2"><div className="flex justify-between"><span className="text-muted-foreground">Operation Days:</span><span className="font-medium">{vessel.operationDays || 0}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Downtime Days:</span><span className="font-medium">{vessel.downtimeDays || 0}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Total Revenue:</span><span className="font-medium">SGD {totalCost}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Utilization:</span><span className="font-medium">{utilizationRate}%</span></div></CardContent></Card></div></TabsContent>

        <TabsContent value="equipment" className="space-y-6"><Card><CardHeader><CardTitle>Equipment List</CardTitle><CardDescription>All equipment registered to this vessel</CardDescription></CardHeader><CardContent>{equipmentLoading ? <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : equipment.length === 0 ? <div className="text-center py-8 text-muted-foreground">No equipment found for this vessel</div> : <div className="relative"><div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none z-10 lg:hidden" /><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{equipment.map((eq) => <TableRow key={eq.id}><TableCell className="font-mono">{eq.id}</TableCell><TableCell>{eq.name}</TableCell><TableCell>{eq.type || "N/A"}</TableCell><TableCell><Badge variant="outline">{eq.status || "Unknown"}</Badge></TableCell></TableRow>)}</TableBody></Table></div></div>}</CardContent></Card>{!equipmentLoading && equipment.length > 0 && <div className="space-y-4"><h3 className="text-lg font-semibold">Active Diagnostic Codes</h3>{equipment.map((eq) => <ActiveDtcsPanel key={eq.id} equipmentId={eq.id} equipmentName={eq.name || eq.id} />)}</div>}</TabsContent>

        <TabsContent value="work-orders"><Card><CardHeader><CardTitle>Work Orders</CardTitle><CardDescription>Active and completed maintenance work</CardDescription></CardHeader><CardContent>{workOrdersLoading ? <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : vesselWorkOrders.length === 0 ? <div className="text-center py-8 text-muted-foreground">No work orders found for this vessel</div> : <div className="relative"><div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none z-10 lg:hidden" /><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>ID</TableHead><TableHead>Equipment</TableHead><TableHead>Description</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead></TableRow></TableHeader><TableBody>{vesselWorkOrders.map((wo) => <TableRow key={wo.id}><TableCell className="font-mono text-sm">{wo.id.slice(0, 8)}</TableCell><TableCell>{wo.equipmentId}</TableCell><TableCell className="max-w-xs truncate">{wo.description}</TableCell><TableCell><Badge variant={wo.status === "completed" ? "default" : wo.status === "in_progress" ? "secondary" : "outline"}>{wo.status}</Badge></TableCell><TableCell className="text-sm text-muted-foreground">{formatDistanceToNow(new Date(wo.createdAt), { addSuffix: true })}</TableCell></TableRow>)}</TableBody></Table></div></div>}</CardContent></Card></TabsContent>

        <TabsContent value="crew"><Card><CardHeader><CardTitle>Crew Members</CardTitle><CardDescription>Personnel assigned to this vessel</CardDescription></CardHeader><CardContent>{crewLoading ? <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : vesselCrew.length === 0 ? <div className="text-center py-8 text-muted-foreground">No crew members assigned to this vessel</div> : <div className="relative"><div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none z-10 lg:hidden" /><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Rank</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{vesselCrew.map((member) => <TableRow key={member.id}><TableCell className="font-medium">{member.name}</TableCell><TableCell>{member.role || "N/A"}</TableCell><TableCell>{member.rank || "N/A"}</TableCell><TableCell><Badge variant="outline">{member.status || "Active"}</Badge></TableCell></TableRow>)}</TableBody></Table></div></div>}</CardContent></Card></TabsContent>

        <TabsContent value="maintenance"><Card><CardHeader><CardTitle>Maintenance Schedules</CardTitle><CardDescription>Scheduled and predictive maintenance</CardDescription></CardHeader><CardContent>{schedulesLoading ? <div className="space-y-2"><Skeleton className="h-12" /><Skeleton className="h-12" /></div> : vesselMaintenanceSchedules.length === 0 ? <div className="text-center py-8 text-muted-foreground">No maintenance schedules found for this vessel</div> : <div className="relative"><div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none z-10 lg:hidden" /><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Equipment</TableHead><TableHead>Type</TableHead><TableHead>Scheduled Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{vesselMaintenanceSchedules.map((schedule) => <TableRow key={schedule.id}><TableCell>{schedule.equipmentId}</TableCell><TableCell><Badge variant="outline">{schedule.isPredictive ? "Predictive" : "Scheduled"}</Badge></TableCell><TableCell>{new Date(schedule.scheduledDate).toLocaleDateString()}</TableCell><TableCell><Badge variant={schedule.status === "completed" ? "default" : schedule.status === "in_progress" ? "secondary" : "outline"}>{schedule.status}</Badge></TableCell></TableRow>)}</TableBody></Table></div></div>}</CardContent></Card></TabsContent>

        <TabsContent value="performance" className="space-y-6"><div className="grid gap-6 lg:grid-cols-3"><div className="lg:col-span-2"><PowerSTWChart vesselId={vesselId!} startDate={powerSTWDateRange.startDate} endDate={powerSTWDateRange.endDate} /></div><div className="lg:col-span-1"><NarrativeSummaryCard vesselId={vesselId!} vesselName={vessel.name} chartType="power_stw" currentMetrics={{ avgPower: equipment.length > 0 ? 150 : undefined }} /></div></div></TabsContent>
      </Tabs>
      </div>
    </div>
  );
}

```

### `client/src/pages/vessel-track-log.tsx` (51 lines)

```tsx
import { format } from "date-fns";
import { Navigation, Ship, Calendar, RefreshCw, MapPin, Compass, Gauge, Download, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useVesselTrackData, formatCoordinate } from "@/features/deck-logbook";

const NavStatusColors: Record<string, string> = { underway: "bg-green-500", anchored: "bg-blue-500", moored: "bg-purple-500", maneuvering: "bg-yellow-500", not_under_command: "bg-red-500" };
const NavStatusLabels: Record<string, string> = { underway: "Underway", anchored: "At Anchor", moored: "Moored", maneuvering: "Maneuvering", not_under_command: "Not Under Command" };

export default function VesselTrackLogPage() {
  const { vessels, tracks, tracksLoading, stats, statsLoading, lastPosition, selectedVessel, setSelectedVessel, dateRange, setDateRange, activeTab, setActiveTab, navStatusDistribution, processTelemetryMutation, handleProcessTelemetry, exportGpx } = useVesselTrackData();

  return (
    <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-center justify-end gap-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap"><Select value={selectedVessel} onValueChange={setSelectedVessel}><SelectTrigger className="w-[200px]" data-testid="select-vessel"><Ship className="h-4 w-4 mr-2 text-muted-foreground" /><SelectValue placeholder="Select Vessel" /></SelectTrigger><SelectContent>{vessels.filter(v => v.id).map((vessel) => <SelectItem key={vessel.id} value={vessel.id}>{vessel.name}</SelectItem>)}</SelectContent></Select><Select value={dateRange} onValueChange={setDateRange}><SelectTrigger className="w-[150px]" data-testid="select-date-range"><Calendar className="h-4 w-4 mr-2 text-muted-foreground" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1h">Last Hour</SelectItem><SelectItem value="6h">Last 6 Hours</SelectItem><SelectItem value="24h">Last 24 Hours</SelectItem><SelectItem value="7d">Last 7 Days</SelectItem></SelectContent></Select>{selectedVessel && <><Button variant="outline" onClick={() => handleProcessTelemetry(selectedVessel)} disabled={processTelemetryMutation.isPending} data-testid="button-process"><RefreshCw className={`h-4 w-4 mr-2 ${processTelemetryMutation.isPending ? "animate-spin" : ""}`} />Process GPS Data</Button><Button variant="outline" onClick={exportGpx} data-testid="button-export-gpx"><Download className="h-4 w-4 mr-2" />Export GPX</Button></>}</div>
      </div>

      {!selectedVessel ? (<Card className="text-center py-12"><CardContent><Ship className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" /><h3 className="text-lg font-semibold mb-2">Select a Vessel</h3><p className="text-muted-foreground">Choose a vessel from the dropdown to view its track history</p></CardContent></Card>) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Last Position</CardTitle><MapPin className="h-4 w-4 text-red-500" /></CardHeader><CardContent>{lastPosition ? <><div className="text-lg font-bold" data-testid="text-last-position">{formatCoordinate(lastPosition.latitude, "lat")}</div><div className="text-lg font-bold">{formatCoordinate(lastPosition.longitude, "lon")}</div><p className="text-xs text-muted-foreground mt-1">{format(new Date(lastPosition.timestamp), "MMM dd, HH:mm:ss")}</p></> : <p className="text-muted-foreground">No position data</p>}</CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Distance Traveled</CardTitle><Activity className="h-4 w-4 text-green-600" /></CardHeader><CardContent><div className="text-2xl font-bold" data-testid="text-distance">{stats?.totalDistanceNm?.toFixed(2) || "0.00"} NM</div><p className="text-xs text-muted-foreground">{stats?.trackPointCount || 0} track points</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Average Speed</CardTitle><Gauge className="h-4 w-4 text-blue-600" /></CardHeader><CardContent><div className="text-2xl font-bold" data-testid="text-avg-speed">{stats?.avgSpeedKn?.toFixed(1) || "0.0"} kn</div><p className="text-xs text-muted-foreground">Max: {stats?.maxSpeedKn?.toFixed(1) || "0.0"} kn</p></CardContent></Card>
            <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Current Speed</CardTitle><Compass className="h-4 w-4 text-purple-600" /></CardHeader><CardContent><div className="text-2xl font-bold" data-testid="text-current-speed">{lastPosition?.sog?.toFixed(1) || "0.0"} kn</div><p className="text-xs text-muted-foreground">COG: {lastPosition?.cog?.toFixed(0) || "---"}°</p></CardContent></Card>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList><TabsTrigger value="overview" data-testid="tab-overview"><Activity className="h-4 w-4 mr-2" />Overview</TabsTrigger><TabsTrigger value="track" data-testid="tab-track"><Navigation className="h-4 w-4 mr-2" />Track History</TabsTrigger></TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Card><CardHeader><CardTitle>Voyage Summary</CardTitle><CardDescription>From start to end position</CardDescription></CardHeader><CardContent>{statsLoading ? <Skeleton className="h-32 w-full" /> : stats?.startPosition && stats?.endPosition ? <div className="space-y-4"><div className="flex items-start gap-3"><div className="w-2 h-2 rounded-full bg-green-500 mt-2" /><div><p className="font-medium">Start Position</p><p className="text-sm text-muted-foreground">{formatCoordinate(stats.startPosition.lat, "lat")}, {formatCoordinate(stats.startPosition.lon, "lon")}</p></div></div><div className="ml-1 border-l-2 border-dashed h-8 border-muted-foreground/30" /><div className="flex items-start gap-3"><div className="w-2 h-2 rounded-full bg-red-500 mt-2" /><div><p className="font-medium">End Position</p><p className="text-sm text-muted-foreground">{formatCoordinate(stats.endPosition.lat, "lat")}, {formatCoordinate(stats.endPosition.lon, "lon")}</p></div></div></div> : <div className="text-center py-8 text-muted-foreground"><Navigation className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No track data for this period</p><Button variant="outline" className="mt-4" onClick={() => handleProcessTelemetry(selectedVessel)} data-testid="button-process-empty"><RefreshCw className="h-4 w-4 mr-2" />Process GPS Data</Button></div>}</CardContent></Card>
                <Card><CardHeader><CardTitle>Navigation Status Distribution</CardTitle><CardDescription>Time spent in each status</CardDescription></CardHeader><CardContent>{tracksLoading ? <Skeleton className="h-32 w-full" /> : tracks.length > 0 ? <div className="space-y-3">{Object.entries(navStatusDistribution).map(([status, count]) => <div key={status} className="flex items-center gap-3"><div className={`w-3 h-3 rounded-full ${NavStatusColors[status] || "bg-gray-400"}`} /><span className="flex-1">{NavStatusLabels[status] || status}</span><Badge variant="secondary">{count}</Badge></div>)}</div> : <p className="text-center text-muted-foreground py-8">No data available</p>}</CardContent></Card>
              </div>
            </TabsContent>

            <TabsContent value="track" className="space-y-4">
              <Card><CardHeader><CardTitle>Track History</CardTitle><CardDescription>Position log with navigation data</CardDescription></CardHeader><CardContent>{tracksLoading ? <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div> : tracks.length === 0 ? <div className="text-center py-8 text-muted-foreground"><p>No track entries for this period</p></div> : <div className="rounded-md border overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Position</TableHead><TableHead className="text-right">SOG (kn)</TableHead><TableHead className="text-right">COG (°)</TableHead><TableHead className="text-right">Heading (°)</TableHead><TableHead>Status</TableHead><TableHead>Source</TableHead></TableRow></TableHeader><TableBody>{tracks.slice(0, 100).map((track) => <TableRow key={track.id} data-testid={`row-track-${track.id}`}><TableCell className="font-medium">{format(new Date(track.timestamp), "MMM dd HH:mm:ss")}</TableCell><TableCell className="font-mono text-sm">{formatCoordinate(track.latitude, "lat")}<br />{formatCoordinate(track.longitude, "lon")}</TableCell><TableCell className="text-right">{track.sog?.toFixed(1) || "-"}</TableCell><TableCell className="text-right">{track.cog?.toFixed(0) || "-"}</TableCell><TableCell className="text-right">{track.heading?.toFixed(0) || "-"}</TableCell><TableCell><Badge className={NavStatusColors[track.navStatus || ""] || "bg-gray-400"}>{NavStatusLabels[track.navStatus || ""] || track.navStatus}</Badge></TableCell><TableCell><Badge variant="outline">{track.source}</Badge></TableCell></TableRow>)}</TableBody></Table></div>}</CardContent></Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

```

### `client/src/pages/equipment.tsx` (274 lines)

```tsx
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
import { Server, Ship, CheckCircle, Heart, Activity, AlertTriangle, Eye, Pencil, Trash2, Wrench, Plus, Search, X, TrendingUp, Clock, ChevronLeft, ChevronRight, FileText, ArchiveX, RefreshCw, History } from "lucide-react";
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

function EquipmentTableRow({ item, getVesselName, handleView, handleEdit, handleDelete, handleSetupSensors }: { item: EquipmentItem; getVesselName: (id: string | null | undefined) => string; handleView: (item: EquipmentItem) => void; handleEdit: (item: EquipmentItem) => void; handleDelete: (item: EquipmentItem) => void; handleSetupSensors: (item: EquipmentItem) => void }) {
  return (
    <TableRow className="cursor-pointer hover:bg-accent/50" onClick={() => handleView(item)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleView(item); } }} tabIndex={0} data-testid={`row-equipment-${item.id}`}>
      <TableCell><div><div className="font-medium">{item.name}</div>{(item.manufacturer || item.model) && <div className="text-xs text-muted-foreground">{item.manufacturer}{item.model && ` • ${item.model}`}</div>}</div></TableCell>
      <TableCell><Badge variant="outline">{item.type || "Unknown"}</Badge></TableCell>
      <TableCell>{item.vesselId ? <div className="flex items-center gap-1.5"><Ship className="h-3.5 w-3.5 text-blue-600" /><span className="text-sm">{getVesselName(item.vesselId)}</span></div> : <span className="text-muted-foreground text-sm">—</span>}</TableCell>
      <TableCell><HealthBadge health={item.health} /></TableCell>
      <TableCell><StatusBadge isActive={item.isActive ?? true} /></TableCell>
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

  if (isLoading) { return <div className="min-h-screen"><div className="p-6 space-y-6"><div className="flex items-center justify-between"><Skeleton className="h-10 w-48" /><Skeleton className="h-10 w-32" /></div><div className="grid grid-cols-2 md:grid-cols-5 gap-4">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div><div className="space-y-2">{[...Array(10)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div></div></div>; }

  return (
    <div className="min-h-screen">
      <div className="p-6 space-y-6">
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
              <EquipmentTableRow key={item.id} item={item} getVesselName={getVesselName} handleView={handleView} handleEdit={handleEdit} handleDelete={handleDelete} handleSetupSensors={handleSetupSensors} />
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
              <TabsList className="w-full grid grid-cols-3"><TabsTrigger value="details">Details</TabsTrigger><TabsTrigger value="health">Health</TabsTrigger><TabsTrigger value="actions">Actions</TabsTrigger></TabsList>
              <EquipmentDetailsTab equipment={selectedEquipment} getVesselName={getVesselName} />
              <EquipmentHealthTab equipment={selectedEquipment} setLocation={setLocation} />
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

```

### `client/src/pages/equipment-registry.tsx` (460 lines)

```tsx
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useDeleteMutation } from "@/hooks/useCrudMutations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Equipment, Vessel } from "@shared/schema";
import { useState, useMemo, useEffect } from "react";
import { Server, ArchiveX, RefreshCw } from "lucide-react";
import { equipmentKeys, vesselKeys } from "@/utils/queryKeys";
import { useVisibilityPolling } from "@/hooks/useVisibilityPolling";
import { useEquipmentFilters } from "@/hooks/useEquipmentFilters";
import { filterEquipment, calculateEquipmentStats } from "@/utils/equipmentHelpers";
import { EquipmentOverviewStats } from "@/components/equipment/EquipmentOverviewStats";
import { EquipmentFilters } from "@/components/equipment/EquipmentFilters";
import { EquipmentTable } from "@/components/equipment/EquipmentTable";
import { EquipmentCreateDialog, EquipmentEditDialog } from "@/components/equipment/EquipmentFormDialog";
import { EquipmentViewDialog } from "@/components/equipment/EquipmentViewDialog";
import { SensorSetupWizard } from "@/components/sensors/SensorSetupWizard";
import { DecommissionedEquipmentTable } from "@/components/equipment/DecommissionedEquipmentTable";
import { EquipmentDecommissionDialog } from "@/components/equipment/EquipmentDecommissionDialog";
import { EquipmentReinstateDialog } from "@/components/equipment/EquipmentReinstateDialog";
import { EquipmentHistoryDialog } from "@/components/equipment/EquipmentHistoryDialog";
import { LoadingState, TableSkeleton, CardSkeleton } from "@/components/patterns";
import { ErrorState } from "@/components/patterns";
import { normalizeQueryError } from "@/utils/errorHelpers";
import { PageHeader } from "@/components/navigation";
import { useMutation } from "@tanstack/react-query";

export default function EquipmentRegistry() {
  const { toast } = useToast();
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isSensorWizardOpen, setIsSensorWizardOpen] = useState(false);
  const [isDecommissionDialogOpen, setIsDecommissionDialogOpen] = useState(false);
  const [isReinstateDialogOpen, setIsReinstateDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "decommissioned">("active");

  // Filter state using custom hook
  const { filters, updateFilter, clearFilters, hasActiveFilters } = useEquipmentFilters();

  // Pagination state (client-side)
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Single query - fetch ALL equipment (unpaginated)
  const {
    data: allEquipment = [],
    isLoading,
    error: equipmentError,
    refetch: refetchEquipment,
  } = useVisibilityPolling<Equipment[]>({
    queryKey: equipmentKeys.list(),
    queryFn: () => apiRequest("GET", "/api/equipment"),
    interval: 30000,
    staleTime: 20000,
    gcTime: 5 * 60 * 1000,
  });

  // Fetch vessels for dropdowns
  const { data: vessels = [] } = useVisibilityPolling<Vessel[]>({
    queryKey: vesselKeys.lists(),
    queryFn: () => apiRequest("GET", "/api/vessels"),
    interval: 60000,
    staleTime: 45000,
    gcTime: 5 * 60 * 1000,
  });

  // Fetch decommissioned equipment
  const {
    data: decommissionedEquipment = [],
    isLoading: isLoadingDecommissioned,
    error: decommissionedError,
    refetch: refetchDecommissioned,
  } = useVisibilityPolling<Equipment[]>({
    queryKey: equipmentKeys.decommissioned(),
    queryFn: () => apiRequest("GET", "/api/equipment/decommissioned"),
    interval: 60000,
    staleTime: 45000,
    gcTime: 5 * 60 * 1000,
    enabled: activeTab === "decommissioned",
  });

  // Client-side filtering using helper
  const filteredEquipment = useMemo(() => {
    return filterEquipment(allEquipment, filters);
  }, [allEquipment, filters]);

  // Client-side pagination
  const paginatedEquipment = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredEquipment.slice(start, end);
  }, [filteredEquipment, page, pageSize]);

  // Pagination metadata
  const paginationMeta = useMemo(() => {
    const total = filteredEquipment.length;
    const totalPages = Math.ceil(total / pageSize);
    return {
      total,
      page,
      pageSize,
      totalPages,
    };
  }, [filteredEquipment.length, page, pageSize]);

  // Calculate stats from FULL dataset (not filtered)
  const stats = useMemo(() => {
    return calculateEquipmentStats(allEquipment, vessels, filteredEquipment.length);
  }, [allEquipment, vessels, filteredEquipment.length]);

  // Get unique manufacturers and types for filter dropdowns
  const uniqueManufacturers = useMemo(() => {
    const manufacturers = allEquipment.map((eq) => eq.manufacturer).filter((m): m is string => !!m);
    return Array.from(new Set(manufacturers)).sort((a, b) => a.localeCompare(b));
  }, [allEquipment]);

  const uniqueEquipmentTypes = useMemo(() => {
    const types = allEquipment.map((eq) => eq.type).filter((t): t is string => !!t);
    return Array.from(new Set(types)).sort((a, b) => a.localeCompare(b));
  }, [allEquipment]);

  // Equipment mutations
  const deleteEquipmentMutation = useDeleteMutation("/api/equipment", {
    successMessage: "Equipment deleted successfully",
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : "An unexpected error occurred";
      toast({
        title: "Error deleting equipment",
        description: message,
        variant: "destructive",
      });
    },
  });

  // Handlers
  function handleEdit(equipment: Equipment) {
    setSelectedEquipment(equipment);
    setIsEditDialogOpen(true);
  }

  function handleView(equipment: Equipment) {
    setSelectedEquipment(equipment);
    setIsViewDialogOpen(true);
  }

  function handleDelete(equipment: Equipment) {
    const confirmMessage = `⚠️ WARNING: This will permanently delete equipment "${equipment.name}" and ALL associated data including:

• All sensor configurations
• All sensor states and readings
• Telemetry data
• Historical analytics

This action CANNOT be undone. Are you sure you want to proceed?`;

    if (confirm(confirmMessage)) {
      deleteEquipmentMutation.mutate(equipment.id);
    }
  }

  function handleSetupSensors(equipment: Equipment) {
    setSelectedEquipment(equipment);
    setIsSensorWizardOpen(true);
  }

  function handleDecommission(equipment: Equipment) {
    setSelectedEquipment(equipment);
    setIsDecommissionDialogOpen(true);
  }

  function handleReinstate(equipment: Equipment) {
    setSelectedEquipment(equipment);
    setIsReinstateDialogOpen(true);
  }

  function handleViewHistory(equipment: Equipment) {
    setSelectedEquipment(equipment);
    setIsHistoryDialogOpen(true);
  }

  function handlePageChange(newPage: number) {
    setPage(newPage);
  }

  function handleEquipmentUpdated() {
    refetchEquipment();
    refetchDecommissioned();
  }

  function handleLifecycleSuccess() {
    queryClient.invalidateQueries({ queryKey: equipmentKeys.list() });
    queryClient.invalidateQueries({ queryKey: equipmentKeys.decommissioned() });
    refetchEquipment();
    refetchDecommissioned();
  }

  const decommissionMutation = useMutation({
    mutationFn: async ({ equipmentId, data }: { equipmentId: string; data: unknown }) => {
      return apiRequest("POST", `/api/equipment/${equipmentId}/decommission`, data);
    },
    onSuccess: () => {
      toast({
        title: "Equipment Decommissioned",
        description: `${selectedEquipment?.name} has been successfully decommissioned.`,
      });
      setIsDecommissionDialogOpen(false);
      setSelectedEquipment(null);
      handleLifecycleSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to decommission equipment.",
        variant: "destructive",
      });
    },
  });

  function handleDecommissionSubmit(equipmentId: string, data: unknown) {
    decommissionMutation.mutate({ equipmentId, data });
  }

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [filters]);

  // Clamp page when dataset shrinks (e.g., after deletion or filtering)
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredEquipment.length / pageSize));
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [filteredEquipment.length, pageSize, page]);

  // Check for initial loading state
  const isInitialLoading = isLoading && allEquipment.length === 0;

  return (
    <div className="min-h-screen">
      <PageHeader title="Equipment Registry" />
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Equipment
                </CardTitle>
                <CardDescription className="mt-2">
                  Centralized equipment inventory and sensor configuration management
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        <CardContent className="space-y-6">
          {/* Initial Loading State */}
          {isInitialLoading ? (
            <LoadingState variant="custom">
              <div className="space-y-6">
                {/* Stats Skeleton */}
                <div className="grid gap-4 md:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <CardSkeleton key={`stat-${i}`} />
                  ))}
                </div>

                {/* Filters Skeleton */}
                <CardSkeleton />

                {/* Table Skeleton */}
                <TableSkeleton rows={5} cols={6} />
              </div>
            </LoadingState>
          ) : equipmentError ? (
            /* Error State */
            <ErrorState
              error={normalizeQueryError(equipmentError)}
              onRetry={refetchEquipment}
              variant="inline"
            />
          ) : (
            /* Actual Content */
            <>
              {/* Stats Overview */}
              <EquipmentOverviewStats stats={stats} />

              {/* Tabs for Active/Decommissioned */}
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "active" | "decommissioned")}>
                <TabsList className="mb-4">
                  <TabsTrigger value="active" className="flex items-center gap-2" data-testid="tab-active-equipment">
                    <Server className="h-4 w-4" />
                    Active Equipment
                    <Badge variant="secondary" className="ml-1">{allEquipment.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="decommissioned" className="flex items-center gap-2" data-testid="tab-decommissioned-equipment">
                    <ArchiveX className="h-4 w-4" />
                    Decommissioned
                    <Badge variant="secondary" className="ml-1">{decommissionedEquipment.length}</Badge>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="mt-4 space-y-4">
                  {/* Filters */}
                  <EquipmentFilters
                    filters={filters}
                    onFiltersChange={updateFilter}
                    onClearFilters={clearFilters}
                    hasActiveFilters={hasActiveFilters}
                    vessels={vessels}
                    equipmentTypes={uniqueEquipmentTypes}
                    manufacturers={uniqueManufacturers}
                    filteredCount={filteredEquipment.length}
                    totalCount={allEquipment.length}
                    onAddEquipment={() => setIsCreateDialogOpen(true)}
                  />

                  {/* Equipment Table */}
                  <EquipmentTable
                    equipment={paginatedEquipment}
                    vessels={vessels}
                    paginationMeta={paginationMeta}
                    onPageChange={handlePageChange}
                    onView={handleView}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onSetupSensors={handleSetupSensors}
                    onDecommission={handleDecommission}
                    onViewHistory={handleViewHistory}
                  />
                </TabsContent>

                <TabsContent value="decommissioned" className="mt-4 space-y-4">
                  {isLoadingDecommissioned ? (
                    <TableSkeleton rows={5} cols={5} />
                  ) : decommissionedError ? (
                    <ErrorState
                      error={normalizeQueryError(decommissionedError)}
                      onRetry={refetchDecommissioned}
                      variant="inline"
                    />
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
                      onDelete={handleDelete}
                    />
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <EquipmentCreateDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        vessels={vessels}
        onSuccess={handleEquipmentUpdated}
      />

      {/* Edit Dialog */}
      <EquipmentEditDialog
        isOpen={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {setSelectedEquipment(null);}
        }}
        equipment={selectedEquipment}
        vessels={vessels}
        onSuccess={handleEquipmentUpdated}
      />

      {/* View Dialog */}
      <EquipmentViewDialog
        isOpen={isViewDialogOpen}
        onOpenChange={(open) => {
          setIsViewDialogOpen(open);
          if (!open) {setSelectedEquipment(null);}
        }}
        equipment={selectedEquipment}
        onEquipmentUpdated={handleEquipmentUpdated}
      />

      {/* Sensor Setup Wizard */}
      {selectedEquipment && (
        <SensorSetupWizard
          equipment={{
            id: selectedEquipment.id,
            name: selectedEquipment.name,
            type: selectedEquipment.type,
            status: selectedEquipment.isActive ? "active" : "inactive",
            location: selectedEquipment.location || "Unknown",
          }}
          open={isSensorWizardOpen}
          onClose={() => {
            setIsSensorWizardOpen(false);
            setSelectedEquipment(null);
          }}
          onSuccess={handleEquipmentUpdated}
        />
      )}

      {/* Decommission Dialog */}
      <EquipmentDecommissionDialog
        open={isDecommissionDialogOpen}
        onOpenChange={(open) => {
          setIsDecommissionDialogOpen(open);
          if (!open) {setSelectedEquipment(null);}
        }}
        equipment={selectedEquipment}
        onSubmit={handleDecommissionSubmit}
        isPending={decommissionMutation.isPending}
      />

      {/* Reinstate Dialog */}
      <EquipmentReinstateDialog
        isOpen={isReinstateDialogOpen}
        onOpenChange={(open) => {
          setIsReinstateDialogOpen(open);
          if (!open) {setSelectedEquipment(null);}
        }}
        equipment={selectedEquipment}
        onSuccess={handleLifecycleSuccess}
      />

      {/* History Dialog */}
      <EquipmentHistoryDialog
        isOpen={isHistoryDialogOpen}
        onOpenChange={(open) => {
          setIsHistoryDialogOpen(open);
          if (!open) {setSelectedEquipment(null);}
        }}
        equipment={selectedEquipment}
      />
      </div>
    </div>
  );
}

```

### `client/src/pages/OperatingParametersPage.tsx` (208 lines)

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sliders, Save, RotateCcw, Gauge, Thermometer, Droplets, Zap } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface OperatingParameter {
  id: string;
  name: string;
  value: number;
  unit: string;
  minValue: number;
  maxValue: number;
  category: string;
}

interface OperatingParametersPageProps {
  embedded?: boolean;
}

export default function OperatingParametersPage({ embedded }: OperatingParametersPageProps) {
  const { toast } = useToast();
  const [editedValues, setEditedValues] = useState<Record<string, number>>({});

  const { data: parameters, isLoading } = useQuery<OperatingParameter[]>({
    queryKey: ["/api/admin/operating-parameters"],
    retry: 1,
    staleTime: 60000,
  });

  const defaultParameters: OperatingParameter[] = [
    { id: "1", name: "Engine RPM Warning", value: 2200, unit: "RPM", minValue: 1500, maxValue: 3000, category: "engine" },
    { id: "2", name: "Engine RPM Critical", value: 2800, unit: "RPM", minValue: 2000, maxValue: 3500, category: "engine" },
    { id: "3", name: "Oil Temperature Warning", value: 95, unit: "C", minValue: 80, maxValue: 120, category: "temperature" },
    { id: "4", name: "Oil Temperature Critical", value: 110, unit: "C", minValue: 90, maxValue: 130, category: "temperature" },
    { id: "5", name: "Coolant Temperature Warning", value: 90, unit: "C", minValue: 70, maxValue: 100, category: "temperature" },
    { id: "6", name: "Fuel Pressure Min", value: 35, unit: "PSI", minValue: 20, maxValue: 50, category: "fuel" },
    { id: "7", name: "Battery Voltage Min", value: 11.5, unit: "V", minValue: 10, maxValue: 14, category: "electrical" },
    { id: "8", name: "Battery Voltage Max", value: 14.4, unit: "V", minValue: 13, maxValue: 16, category: "electrical" },
  ];

  const params = parameters || defaultParameters;

  const saveMutation = useMutation({
    mutationFn: async (updates: Record<string, number>) => {
      return apiRequest("/api/admin/operating-parameters", {
        method: "PATCH",
        body: JSON.stringify({ updates }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/operating-parameters"] });
      setEditedValues({});
      toast({
        title: "Parameters saved",
        description: "Operating parameters have been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save parameters. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleValueChange = (id: string, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setEditedValues((prev) => ({ ...prev, [id]: numValue }));
    }
  };

  const handleSave = () => {
    if (Object.keys(editedValues).length > 0) {
      saveMutation.mutate(editedValues);
    }
  };

  const handleReset = () => {
    setEditedValues({});
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "engine":
        return <Gauge className="h-4 w-4" />;
      case "temperature":
        return <Thermometer className="h-4 w-4" />;
      case "fuel":
        return <Droplets className="h-4 w-4" />;
      case "electrical":
        return <Zap className="h-4 w-4" />;
      default:
        return <Sliders className="h-4 w-4" />;
    }
  };

  const groupedParams = params.reduce((acc, param) => {
    if (!acc[param.category]) {
      acc[param.category] = [];
    }
    acc[param.category].push(param);
    return acc;
  }, {} as Record<string, OperatingParameter[]>);

  const hasChanges = Object.keys(editedValues).length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-params-title">
            {embedded ? "Operating Parameters" : "Operating Parameters Configuration"}
          </h1>
          <p className="text-muted-foreground">Configure threshold values for equipment monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasChanges}
            data-testid="button-reset-params"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
            data-testid="button-save-params"
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/20">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            You have unsaved changes. Click "Save Changes" to apply them.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Object.entries(groupedParams).map(([category, categoryParams]) => (
          <Card key={category}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <div>
                <CardTitle className="text-base capitalize">{category} Parameters</CardTitle>
                <CardDescription>
                  {categoryParams.length} parameter{categoryParams.length !== 1 ? "s" : ""}
                </CardDescription>
              </div>
              {getCategoryIcon(category)}
            </CardHeader>
            <CardContent className="space-y-4">
              {categoryParams.map((param) => {
                const currentValue = editedValues[param.id] ?? param.value;
                const isEdited = param.id in editedValues;

                return (
                  <div key={param.id} className="space-y-2" data-testid={`param-${param.id}`}>
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`param-${param.id}`} className="text-sm">
                        {param.name}
                      </Label>
                      {isEdited && (
                        <Badge variant="secondary" className="text-xs">
                          Modified
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`param-${param.id}`}
                        type="number"
                        value={currentValue}
                        onChange={(e) => handleValueChange(param.id, e.target.value)}
                        min={param.minValue}
                        max={param.maxValue}
                        step={param.unit === "V" ? 0.1 : 1}
                        className="w-24"
                        data-testid={`input-param-${param.id}`}
                      />
                      <span className="text-sm text-muted-foreground">{param.unit}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        Range: {param.minValue} - {param.maxValue}
                      </span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

```

### `client/src/pages/stormgeo-settings.tsx` (11 lines)

```tsx
import { StormGeoSettingsPanel } from "@/components/stormgeo-settings";

export default function StormGeoSettingsPage() {
  return (
    <div className="min-h-screen">
      <div className="container mx-auto p-6 max-w-4xl">
        <StormGeoSettingsPanel />
      </div>
    </div>
  );
}

```

### `client/src/components/fleet/EquipmentCardVariants.tsx` (113 lines)

```tsx
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Ship, Clock, AlertTriangle, ArrowRight, type LucideIcon } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import type { EquipmentHealthData, StatusConfig } from "./EquipmentHealthCard";

export function getHealthColor(score: number): string {
  if (score >= 75) {return "text-green-600 dark:text-green-400";}
  if (score >= 50) {return "text-yellow-600 dark:text-yellow-400";}
  return "text-red-600 dark:text-red-400";
}

interface CardProps {
  equipment: EquipmentHealthData;
  config: StatusConfig;
  Icon: LucideIcon;
}

export function CompactCard({ equipment, config, Icon, onViewDetails, highlighted }: CardProps & { onViewDetails?: (id: string) => void; highlighted: boolean }) {
  return (
    <div className={cn("flex items-center justify-between p-4 rounded-lg transition-all duration-300", highlighted ? "bg-primary/20 border-2 border-primary shadow-lg" : config.bgLight)} data-testid={`equipment-card-${equipment.id}`}>
      <div className="flex items-center space-x-3 flex-1">
        <div className={cn("w-2 h-2 rounded-full", config.indicator)} />
        <Icon className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="font-medium text-foreground">{equipment.name || equipment.id}</p>
          <p className="text-sm text-muted-foreground">{equipment.type && <span className="mr-2">{equipment.type}</span>}{equipment.vesselName}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right space-y-1">
          <div className="flex items-center space-x-2">
            <Progress value={equipment.healthScore} className="w-20 h-2" />
            <span className={cn("text-sm font-medium", getHealthColor(equipment.healthScore))}>{equipment.healthScore}%</span>
          </div>
          {equipment.predictedDueDays !== undefined && <p className="text-xs text-muted-foreground">Due in {equipment.predictedDueDays} days</p>}
        </div>
        {onViewDetails && <Button variant="ghost" size="sm" onClick={() => onViewDetails(equipment.id)} data-testid={`button-view-${equipment.id}`}><ArrowRight className="h-4 w-4" /></Button>}
      </div>
    </div>
  );
}

export function LightCard({ equipment, config, Icon, detailPath, onViewDetails, showVessel, highlighted }: CardProps & { detailPath: string; onViewDetails?: (id: string) => void; showVessel: boolean; highlighted: boolean }) {
  const content = (
    <Card className={cn("transition-all hover:shadow-md", highlighted && "ring-2 ring-primary shadow-lg", onViewDetails && "cursor-pointer")} onClick={() => onViewDetails?.(equipment.id)} data-testid={`equipment-card-${equipment.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2"><div className={cn("w-3 h-3 rounded-full", config.indicator)} /><Icon className="h-5 w-5 text-muted-foreground" /></div>
          <Badge variant={config.badgeVariant} className="text-xs">{config.label}</Badge>
        </div>
        <h3 className="font-semibold text-foreground truncate mb-1">{equipment.name}</h3>
        {showVessel && equipment.vesselName && <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1"><Ship className="h-3 w-3" />{equipment.vesselName}</p>}
        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Health</span><span className={cn("font-medium", getHealthColor(equipment.healthScore))}>{equipment.healthScore}%</span></div>
            <Progress value={equipment.healthScore} className="h-1.5" />
          </div>
          {equipment.rul !== null && equipment.rul !== undefined && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />RUL: {equipment.rul} days</div>}
          {equipment.pFail30d !== undefined && equipment.pFail30d > 0.1 && <div className="flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400"><AlertTriangle className="h-3 w-3" />{(equipment.pFail30d * 100).toFixed(0)}% failure risk (30d)</div>}
        </div>
      </CardContent>
    </Card>
  );
  return onViewDetails ? content : <Link href={detailPath}>{content}</Link>;
}

export function DarkCard({ equipment, config, Icon, detailPath, showVessel, showTelemetry }: CardProps & { detailPath: string; showVessel: boolean; showTelemetry: boolean }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href={detailPath}>
            <div className={cn("p-4 rounded-lg border-2 transition-all hover:scale-[1.02] cursor-pointer", config.bgDark)} data-testid={`equipment-card-${equipment.id}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2"><div className={cn("w-3 h-3 rounded-full", config.indicator)} /><Icon className="h-5 w-5 text-slate-300" /></div>
                <Badge variant={config.badgeVariant} className="text-xs">{config.label.toUpperCase()}</Badge>
              </div>
              <h3 className="font-semibold text-white truncate mb-1">{equipment.name}</h3>
              {showVessel && equipment.vesselName && <p className="text-xs text-slate-400 mb-3 flex items-center gap-1"><Ship className="h-3 w-3" />{equipment.vesselName}</p>}
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1"><span className="text-slate-400">Health</span><span className="text-white font-medium">{equipment.healthScore}%</span></div>
                  <Progress value={equipment.healthScore} className="h-1.5 bg-slate-700" />
                </div>
                {equipment.rul !== null && equipment.rul !== undefined && <div className="flex items-center gap-1 text-xs text-slate-400"><Clock className="h-3 w-3" />RUL: {equipment.rul} days</div>}
                {equipment.pFail30d !== undefined && equipment.pFail30d > 0.1 && <div className="flex items-center gap-1 text-xs text-orange-400"><AlertTriangle className="h-3 w-3" />{(equipment.pFail30d * 100).toFixed(0)}% failure risk (30d)</div>}
                {showTelemetry && equipment.telemetry && equipment.telemetry.length > 0 && (
                  <div className="pt-2 border-t border-slate-700 mt-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {equipment.telemetry.slice(0, 4).map((t) => <div key={`${t.sensorType}-${t.timestamp}`} className="flex justify-between"><span className="text-slate-500 capitalize">{t.sensorType}:</span><span className="text-slate-300">{t.value.toFixed(1)} {t.unit}</span></div>)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Link>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs bg-slate-800 border-slate-600 text-white">
          <p className="font-semibold">{equipment.name}</p>
          {equipment.type && <p className="text-sm text-slate-300">Type: {equipment.type}</p>}
          <p className="text-sm text-slate-300">Health Score: {equipment.healthScore}%</p>
          {equipment.rul !== null && equipment.rul !== undefined && <p className="text-sm text-slate-300">Remaining Useful Life: {equipment.rul} days</p>}
          <p className="text-xs text-slate-400 mt-2">Click to view details</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

```

### `client/src/components/fleet/EquipmentHealthCard.tsx` (117 lines)

```tsx
/**
 * EquipmentHealthCard Component
 * PURPOSE: Unified equipment card with health metrics, RUL, and status indicator
 * USED BY: Fleet Overview, Bridge View, Health Monitor, Vessel Detail
 */

import { Ship, Zap, Droplets, Wind, Compass, Anchor, Thermometer, Navigation, Gauge, type LucideIcon } from "lucide-react";
import { CompactCard, LightCard, DarkCard } from "./EquipmentCardVariants";

export type EquipmentStatus = "healthy" | "warning" | "critical" | "unknown";

export interface EquipmentHealthData {
  id: string;
  name: string;
  type?: string;
  vesselId?: string;
  vesselName?: string;
  healthScore: number;
  rul?: number | null;
  pFail30d?: number;
  status: EquipmentStatus;
  predictedDueDays?: number;
  telemetry?: Array<{ sensorType: string; value: number; unit: string }>;
}

export interface StatusConfig {
  label: string;
  color: string;
  bgLight: string;
  bgDark: string;
  indicator: string;
  badgeVariant: "secondary" | "default" | "destructive" | "outline";
}

interface EquipmentHealthCardProps {
  equipment: EquipmentHealthData;
  variant?: "light" | "dark" | "compact";
  showVessel?: boolean;
  showTelemetry?: boolean;
  onViewDetails?: (equipmentId: string) => void;
  linkTo?: string;
  highlighted?: boolean;
}

const STATUS_CONFIG: Record<EquipmentStatus, StatusConfig> = {
  healthy: { label: "Healthy", color: "text-green-600 dark:text-green-400", bgLight: "bg-green-50 dark:bg-green-950/50", bgDark: "border-green-500 bg-green-500/10", indicator: "bg-green-500", badgeVariant: "secondary" },
  warning: { label: "Warning", color: "text-yellow-600 dark:text-yellow-400", bgLight: "bg-yellow-50 dark:bg-yellow-950/50", bgDark: "border-yellow-500 bg-yellow-500/10", indicator: "bg-yellow-500", badgeVariant: "default" },
  critical: { label: "Critical", color: "text-red-600 dark:text-red-400", bgLight: "bg-red-50 dark:bg-red-950/50", bgDark: "border-red-500 bg-red-500/10 animate-pulse", indicator: "bg-red-500", badgeVariant: "destructive" },
  unknown: { label: "Unknown", color: "text-gray-600 dark:text-gray-400", bgLight: "bg-gray-50 dark:bg-gray-950/50", bgDark: "border-gray-400 bg-gray-400/10", indicator: "bg-gray-400", badgeVariant: "outline" },
};

const EQUIPMENT_ICONS: Record<string, LucideIcon> = {
  "main engine": Ship, engine: Zap, generator: Zap, pump: Droplets, compressor: Wind,
  thruster: Navigation, steering: Compass, propulsion: Anchor, hvac: Wind, cooling: Thermometer, fuel: Gauge,
};

function getEquipmentIcon(type?: string): LucideIcon {
  if (!type) {return Gauge;}
  const lowerType = type.toLowerCase();
  for (const [key, icon] of Object.entries(EQUIPMENT_ICONS)) {
    if (lowerType.includes(key)) {return icon;}
  }
  return Gauge;
}

export function EquipmentHealthCard({ equipment, variant = "light", showVessel = true, showTelemetry = false, onViewDetails, linkTo, highlighted = false }: EquipmentHealthCardProps) {
  const config = STATUS_CONFIG[equipment.status];
  const Icon = getEquipmentIcon(equipment.type);
  const detailPath = linkTo || `/pdm/equipment/${equipment.id}`;

  if (variant === "compact") {
    return <CompactCard equipment={equipment} config={config} Icon={Icon} onViewDetails={onViewDetails} highlighted={highlighted} />;
  }

  if (variant === "dark") {
    return <DarkCard equipment={equipment} config={config} Icon={Icon} detailPath={detailPath} showVessel={showVessel} showTelemetry={showTelemetry} />;
  }
  return <LightCard equipment={equipment} config={config} Icon={Icon} detailPath={detailPath} onViewDetails={onViewDetails} showVessel={showVessel} highlighted={highlighted} />;
}

export function mapToEquipmentHealthData(equipment: {
  id: string;
  name?: string;
  type?: string;
  vesselId?: string;
  vesselName?: string;
  healthScore?: number;
  healthIndex?: number;
  rul?: number | null;
  pFail30d?: number;
  status?: string;
  predictedDueDays?: number;
}): EquipmentHealthData {
  const healthScore = equipment.healthScore ?? equipment.healthIndex ?? 0;
  let status: EquipmentStatus = "unknown";
  if (equipment.status) {
    status = equipment.status as EquipmentStatus;
  } else if (healthScore >= 75) {
    status = "healthy";
  } else if (healthScore >= 50) {
    status = "warning";
  } else {
    status = "critical";
  }
  return {
    id: equipment.id,
    name: equipment.name || equipment.id,
    type: equipment.type,
    vesselId: equipment.vesselId,
    vesselName: equipment.vesselName,
    healthScore,
    rul: equipment.rul,
    pFail30d: equipment.pFail30d,
    status,
    predictedDueDays: equipment.predictedDueDays,
  };
}

```

### `client/src/components/fleet/index.ts` (9 lines)

```ts
/**
 * Fleet Components
 * 
 * Shared components for fleet monitoring views (Fleet Overview, Bridge View, Health Monitor)
 * These components provide consistent UI patterns across all monitoring screens.
 */

export { EquipmentHealthCard, mapToEquipmentHealthData } from "./EquipmentHealthCard";
export type { EquipmentHealthData, EquipmentStatus } from "./EquipmentHealthCard";

```

### `client/src/components/equipment/BundlePreview.tsx` (51 lines)

```tsx
/**
 * BundlePreview component
 * Displays a preview of a selected sensor bundle
 * Extracted to eliminate inline IIFE (S2004)
 */

import { Layers } from "lucide-react";

interface SensorBundle {
  bundleId: string;
  name: string;
  description?: string | null;
  templateIds: string[];
  isSystemDefault?: boolean;
}

interface BundlePreviewProps {
  bundles: SensorBundle[];
  selectedBundleId: string;
}

export function BundlePreview({ bundles, selectedBundleId }: BundlePreviewProps) {
  const bundle = bundles.find((b) => b.bundleId === selectedBundleId);
  
  if (!bundle) {
    return null;
  }

  return (
    <div className="p-3 bg-muted rounded-lg">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{bundle.name}</span>
        </div>
        
        {bundle.description && (
          <p className="text-xs text-muted-foreground">{bundle.description}</p>
        )}
        
        <div className="text-xs text-muted-foreground">
          Will deploy <strong>{bundle.templateIds.length}</strong> sensor configuration(s)
        </div>
        
        <div className="text-xs text-yellow-600">
          Note: Sensors with duplicate types will be skipped
        </div>
      </div>
    </div>
  );
}

```

### `client/src/components/equipment/DecommissionedEquipmentTable.tsx` (129 lines)

```tsx
import { Equipment, Vessel } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Trash2, Ship, AlertCircle, History, Calendar } from "lucide-react";
import { formatType, formatLocation, getVesselInfo } from "@/utils/equipmentHelpers";
import { format } from "date-fns";

interface DecommissionedEquipmentTableProps {
  equipment: Equipment[];
  vessels: Vessel[];
  onReinstate: (equipment: Equipment) => void;
  onViewHistory: (equipment: Equipment) => void;
  onDelete: (equipment: Equipment) => void;
}

export function DecommissionedEquipmentTable({
  equipment,
  vessels,
  onReinstate,
  onViewHistory,
  onDelete,
}: DecommissionedEquipmentTableProps) {
  return (
    <Table data-testid="table-decommissioned-equipment">
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Vessel</TableHead>
          <TableHead>Decommissioned</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {equipment.map((item: Equipment) => {
          const vesselInfo = getVesselInfo(item, vessels);
          const decommissionedDate = item.decommissionedAt 
            ? format(new Date(item.decommissionedAt), "MMM d, yyyy")
            : "Unknown";
          
          return (
            <TableRow key={item.id} data-testid={`row-decommissioned-${item.id}`}>
              <TableCell className="font-medium" data-testid={`text-name-${item.id}`}>
                <div>
                  <div>{item.name}</div>
                  {(item.manufacturer || item.model) && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {item.manufacturer} {item.model && `| ${item.model}`}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell data-testid={`text-type-${item.id}`}>
                <Badge variant="outline">{formatType(item.type)}</Badge>
              </TableCell>
              <TableCell data-testid={`text-vessel-${item.id}`}>
                {vesselInfo.name ? (
                  <div className="flex items-center gap-2">
                    <Ship className="h-4 w-4 text-muted-foreground" />
                    <span>{vesselInfo.name}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />
                    <span>Not assigned</span>
                  </div>
                )}
              </TableCell>
              <TableCell data-testid={`text-decommissioned-date-${item.id}`}>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>{decommissionedDate}</span>
                </div>
              </TableCell>
              <TableCell data-testid={`text-reason-${item.id}`}>
                <span className="text-sm text-muted-foreground">
                  {item.decommissionReason || "-"}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewHistory(item)}
                    data-testid={`button-history-${item.id}`}
                    aria-label={`View history for ${item.name}`}
                    className="h-8 w-8 p-0"
                  >
                    <History className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onReinstate(item)}
                    data-testid={`button-reinstate-${item.id}`}
                    aria-label={`Reinstate ${item.name}`}
                    className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(item)}
                    data-testid={`button-delete-${item.id}`}
                    aria-label={`Delete ${item.name}`}
                    className="h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

```

### `client/src/components/equipment/EquipmentDecommissionDialog.tsx` (591 lines)

```tsx
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Equipment,
  InsertDecommissionEvent,
  decommissionReasonEnum,
  saleDetailsSchema,
  disposalDetailsSchema,
} from "@shared/schema";
import { AlertTriangle, ChevronDown, DollarSign, Trash2, RefreshCw, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface EquipmentDecommissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment | null;
  replacementOptions?: Equipment[];
  onSubmit: (equipmentId: string, data: InsertDecommissionEvent) => void;
  isPending?: boolean;
}

const decommissionFormSchema = z.object({
  reason: decommissionReasonEnum,
  eventDate: z.string().min(1, "Event date is required"),
  authorizedBy: z.string().optional(),
  finalCondition: z.string().optional(),
  notes: z.string().optional(),
  saleDetails: saleDetailsSchema.optional(),
  disposalDetails: disposalDetailsSchema.optional(),
  replacementEquipmentId: z.string().optional(),
  bookValueAtRemoval: z.number().optional(),
  residualValue: z.number().optional(),
});

type DecommissionFormData = z.infer<typeof decommissionFormSchema>;

const REASON_LABELS: Record<string, string> = {
  sold: "Sold",
  scrapped: "Scrapped / Disposed",
  replaced: "Replaced",
  end_of_life: "End of Life",
  transferred: "Transferred to Another Vessel",
  damaged_beyond_repair: "Damaged Beyond Repair",
};

const CONDITION_OPTIONS = [
  "excellent",
  "good",
  "fair",
  "poor",
  "non_functional",
];

function formatCondition(condition: string): string {
  return condition.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

function calculateDepreciation(purchaseValue: number | null | undefined, purchaseDate: Date | string | null | undefined): { bookValue: number; depreciationYears: number } {
  if (!purchaseValue || !purchaseDate) return { bookValue: 0, depreciationYears: 0 };
  
  const purchaseDateObj = typeof purchaseDate === 'string' ? new Date(purchaseDate) : purchaseDate;
  const now = new Date();
  const yearsOwned = (now.getTime() - purchaseDateObj.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  const usefulLifeYears = 10;
  const depreciationRate = 1 / usefulLifeYears;
  const depreciatedValue = purchaseValue * (1 - Math.min(yearsOwned * depreciationRate, 1));
  
  return {
    bookValue: Math.max(0, depreciatedValue),
    depreciationYears: Math.round(yearsOwned * 10) / 10,
  };
}

export function EquipmentDecommissionDialog({
  open,
  onOpenChange,
  equipment,
  replacementOptions = [],
  onSubmit,
  isPending,
}: EquipmentDecommissionDialogProps) {
  const [saleOpen, setSaleOpen] = useState(false);
  const [disposalOpen, setDisposalOpen] = useState(false);

  const depreciation = equipment ? calculateDepreciation(equipment.purchaseValue, equipment.purchaseDate) : { bookValue: 0, depreciationYears: 0 };

  const form = useForm<DecommissionFormData>({
    resolver: zodResolver(decommissionFormSchema),
    defaultValues: {
      reason: "end_of_life",
      eventDate: new Date().toISOString().split("T")[0],
      authorizedBy: "",
      finalCondition: "",
      notes: "",
      saleDetails: {
        salePrice: undefined,
        currency: "USD",
        buyerName: "",
        buyerContact: "",
      },
      disposalDetails: {
        method: "",
        vendor: "",
        cost: undefined,
        environmentalNotes: "",
      },
      replacementEquipmentId: "",
      bookValueAtRemoval: depreciation.bookValue,
      residualValue: undefined,
    },
  });

  const selectedReason = form.watch("reason");
  const showSaleDetails = selectedReason === "sold";
  const showDisposalDetails = selectedReason === "scrapped" || selectedReason === "damaged_beyond_repair";
  const showReplacementLink = selectedReason === "replaced";

  const handleSubmit = (data: DecommissionFormData) => {
    if (!equipment) return;

    const submissionData: InsertDecommissionEvent = {
      orgId: equipment.orgId,
      equipmentId: equipment.id,
      reason: data.reason,
      eventDate: new Date(data.eventDate),
      authorizedBy: data.authorizedBy || undefined,
      finalCondition: data.finalCondition || undefined,
      notes: data.notes || undefined,
      saleDetails: showSaleDetails ? data.saleDetails : undefined,
      disposalDetails: showDisposalDetails ? data.disposalDetails : undefined,
      replacementEquipmentId: showReplacementLink && data.replacementEquipmentId ? data.replacementEquipmentId : undefined,
      bookValueAtRemoval: data.bookValueAtRemoval ?? depreciation.bookValue,
      residualValue: data.residualValue,
    };

    onSubmit(equipment.id, submissionData);
  };

  if (!equipment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Decommission Equipment
          </DialogTitle>
          <DialogDescription>
            Remove <span className="font-medium">{equipment.name}</span> from active service. This action will mark the equipment as inactive and record the decommission details.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/50 rounded-md p-4 space-y-2">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Equipment:</span>{" "}
              <span className="font-medium">{equipment.name}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Type:</span>{" "}
              <span className="font-medium">{equipment.type}</span>
            </div>
            {equipment.purchaseValue && (
              <>
                <div>
                  <span className="text-muted-foreground">Purchase Value:</span>{" "}
                  <span className="font-medium">{formatCurrency(equipment.purchaseValue)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Est. Book Value:</span>{" "}
                  <span className="font-medium">{formatCurrency(depreciation.bookValue)}</span>
                  <span className="text-xs text-muted-foreground ml-1">({depreciation.depreciationYears} yrs)</span>
                </div>
              </>
            )}
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason for Decommission *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} data-testid="select-decommission-reason">
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select reason" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(REASON_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="eventDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Decommission Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-decommission-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="authorizedBy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Authorized By</FormLabel>
                    <FormControl>
                      <Input placeholder="Chief Engineer" {...field} data-testid="input-authorized-by" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="finalCondition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Final Condition</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""} data-testid="select-final-condition">
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select condition" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CONDITION_OPTIONS.map((condition) => (
                          <SelectItem key={condition} value={condition}>
                            {formatCondition(condition)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {showSaleDetails && (
              <Collapsible open={saleOpen} onOpenChange={setSaleOpen} className="border rounded-md">
                <CollapsibleTrigger className="flex items-center justify-between w-full p-4" data-testid="collapsible-sale-details">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    <span className="font-medium">Sale Details</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${saleOpen ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="px-4 pb-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="saleDetails.salePrice"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sale Price</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="15000"
                              {...field}
                              value={field.value ?? ""}
                              onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                              data-testid="input-sale-price"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="saleDetails.currency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Currency</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "USD"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="USD" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="USD">USD</SelectItem>
                              <SelectItem value="EUR">EUR</SelectItem>
                              <SelectItem value="SGD">SGD</SelectItem>
                              <SelectItem value="GBP">GBP</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="saleDetails.buyerName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Buyer Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Company or individual name" {...field} data-testid="input-buyer-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="saleDetails.buyerContact"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Buyer Contact</FormLabel>
                          <FormControl>
                            <Input placeholder="Email or phone" {...field} data-testid="input-buyer-contact" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {showDisposalDetails && (
              <Collapsible open={disposalOpen} onOpenChange={setDisposalOpen} className="border rounded-md">
                <CollapsibleTrigger className="flex items-center justify-between w-full p-4" data-testid="collapsible-disposal-details">
                  <div className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4" />
                    <span className="font-medium">Disposal Details</span>
                  </div>
                  <ChevronDown className={`h-4 w-4 transition-transform ${disposalOpen ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="px-4 pb-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="disposalDetails.method"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Disposal Method</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select method" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="recycled">Recycled</SelectItem>
                              <SelectItem value="landfill">Landfill</SelectItem>
                              <SelectItem value="hazmat_disposal">Hazmat Disposal</SelectItem>
                              <SelectItem value="parts_salvaged">Parts Salvaged</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="disposalDetails.vendor"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Disposal Vendor</FormLabel>
                          <FormControl>
                            <Input placeholder="Vendor name" {...field} data-testid="input-disposal-vendor" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="disposalDetails.cost"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Disposal Cost</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="500"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                            data-testid="input-disposal-cost"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="disposalDetails.environmentalNotes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Environmental Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Any environmental considerations or certifications..."
                            {...field}
                            data-testid="textarea-environmental-notes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CollapsibleContent>
              </Collapsible>
            )}

            {showReplacementLink && replacementOptions.length > 0 && (
              <div className="border rounded-md p-4">
                <div className="flex items-center gap-2 mb-4">
                  <RefreshCw className="h-4 w-4" />
                  <span className="font-medium">Replacement Equipment</span>
                </div>
                <FormField
                  control={form.control}
                  name="replacementEquipmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Link to Replacement</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""} data-testid="select-replacement">
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select replacement equipment" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {replacementOptions.map((eq) => (
                            <SelectItem key={eq.id} value={eq.id}>
                              {eq.name} ({eq.type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <Separator />

            <div className="border rounded-md p-4">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-4 w-4" />
                <span className="font-medium">Financial Summary</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bookValueAtRemoval"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Book Value at Removal</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder={String(Math.round(depreciation.bookValue))}
                          {...field}
                          value={field.value ?? Math.round(depreciation.bookValue)}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          data-testid="input-book-value"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="residualValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Residual/Salvage Value</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="0"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          data-testid="input-residual-value"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Any additional information about the decommission..."
                      {...field}
                      data-testid="textarea-decommission-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-0 sm:space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-decommission"
              >
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={isPending} data-testid="button-submit-decommission">
                {isPending ? "Processing..." : "Confirm Decommission"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

```

### `client/src/components/equipment/EquipmentFilters.tsx` (156 lines)

```tsx
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

```

### `client/src/components/equipment/EquipmentFormDialog.tsx` (522 lines)

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Equipment, Vessel, InsertEquipment } from "@shared/schema";
import { formatType, formatLocation } from "@/utils/equipmentHelpers";
import { useEquipmentForm, useEquipmentEditForm } from "@/hooks/useEquipmentForm";
import { EQUIPMENT_TYPES, EQUIPMENT_LOCATIONS } from "@/constants/equipment";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { equipmentKeys } from "@/utils/queryKeys";

type FormMode = "create" | "edit";

interface EquipmentFormDialogProps {
  mode: FormMode;
  open?: boolean;
  isOpen?: boolean;
  onOpenChange: (open: boolean) => void;
  vessels: Vessel[];
  equipment?: Equipment | null;
  onSubmit?: (data: InsertEquipment | Partial<InsertEquipment>, id?: string) => void;
  onSuccess?: () => void;
  isPending?: boolean;
  onClose?: () => void;
}

export function EquipmentFormDialog({
  mode,
  open,
  isOpen,
  onOpenChange,
  vessels,
  equipment,
  onSubmit,
  onSuccess,
  isPending: externalPending,
  onClose,
}: EquipmentFormDialogProps) {
  const createForm = useEquipmentForm();
  const editForm = useEquipmentEditForm(equipment);
  const form = mode === "create" ? createForm : editForm;
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const dialogOpen = open ?? isOpen ?? false;

  const createMutation = useMutation({
    mutationFn: (data: InsertEquipment) => apiRequest("POST", "/api/equipment", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipmentKeys.list() });
      toast({ title: "Equipment created", description: "The equipment has been added successfully" });
      form.reset();
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create equipment", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InsertEquipment> }) => 
      apiRequest("PUT", `/api/equipment/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: equipmentKeys.list() });
      toast({ title: "Equipment updated", description: "The equipment has been updated successfully" });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update equipment", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (data: InsertEquipment | Partial<InsertEquipment>) => {
    const submissionData = {
      ...data,
      vesselId: data.vesselId === "unassigned" || data.vesselId === "" ? null : data.vesselId,
    };
    
    if (onSubmit) {
      onSubmit(submissionData, equipment?.id);
    } else if (mode === "create") {
      createMutation.mutate(submissionData as InsertEquipment);
    } else if (equipment) {
      updateMutation.mutate({ id: equipment.id, data: submissionData });
    }
  };

  const isPending = externalPending ?? (mode === "create" ? createMutation.isPending : updateMutation.isPending);

  const handleClose = () => {
    onOpenChange(false);
    onClose?.();
  };

  const isCreate = mode === "create";
  const testIdPrefix = isCreate ? "" : "edit-";
  const dialogTitle = isCreate ? "Add New Equipment" : "Edit Equipment";
  const dialogDescription = isCreate ? "Register new equipment in your fleet inventory" : "Update equipment information";
  const submitLabel = isCreate ? (isPending ? "Creating..." : "Create Equipment") : (isPending ? "Updating..." : "Update Equipment");

  return (
    <Dialog open={dialogOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit as never)}
            className="space-y-4"
            data-testid={`form-${isCreate ? "create" : "edit"}-equipment`}
          >
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Equipment Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Main Engine #1" {...field} data-testid={`input-${testIdPrefix}name`} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      defaultValue={field.value}
                      data-testid={`select-${testIdPrefix}type`}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select equipment type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EQUIPMENT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {formatType(type)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="manufacturer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manufacturer</FormLabel>
                    <FormControl>
                      <Input placeholder="Caterpillar" {...field} data-testid={`input-${testIdPrefix}manufacturer`} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <FormControl>
                      <Input placeholder="3516C" {...field} data-testid={`input-${testIdPrefix}model`} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="serialNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Serial Number</FormLabel>
                    <FormControl>
                      <Input placeholder="ABC123456" {...field} data-testid={`input-${testIdPrefix}serial`} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vesselId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vessel</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      defaultValue={field.value}
                      data-testid={`select-${testIdPrefix}vessel`}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select vessel" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="unassigned">No vessel assigned</SelectItem>
                        {vessels.filter(v => v.id).map((vessel) => (
                          <SelectItem key={vessel.id} value={vessel.id}>
                            {vessel.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    defaultValue={field.value}
                    data-testid={`select-${testIdPrefix}location`}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {EQUIPMENT_LOCATIONS.map((location) => (
                        <SelectItem key={location} value={location}>
                          {formatLocation(location)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="purchaseValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Value</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="25000"
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                        data-testid={`input-${testIdPrefix}purchase-value`}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="purchaseCurrency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || "USD"}
                      data-testid={`select-${testIdPrefix}currency`}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="USD" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="SGD">SGD</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="purchaseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value ? (typeof field.value === 'string' ? field.value.split("T")[0] : new Date(field.value).toISOString().split("T")[0]) : ""}
                        onChange={(e) => field.onChange(e.target.value || undefined)}
                        data-testid={`input-${testIdPrefix}purchase-date`}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t pt-4 mt-2">
              <h4 className="text-sm font-medium mb-3">Depreciation & Service Life</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="serviceLifeHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Life (Hours)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="20000"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          data-testid={`input-${testIdPrefix}service-life-hours`}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="serviceLifeYears"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Life (Years)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.5"
                          placeholder="10"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          data-testid={`input-${testIdPrefix}service-life-years`}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4">
                <FormField
                  control={form.control}
                  name="depreciationMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Depreciation Method</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || "straight_line"}
                        data-testid={`select-${testIdPrefix}depreciation-method`}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="straight_line">Straight Line</SelectItem>
                          <SelectItem value="declining_balance">Declining Balance</SelectItem>
                          <SelectItem value="units_of_production">Units of Production</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="depreciationRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Depreciation Rate (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          placeholder="10"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          data-testid={`input-${testIdPrefix}depreciation-rate`}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="salvageValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Salvage Value</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="2500"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          data-testid={`input-${testIdPrefix}salvage-value`}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Active Equipment</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Equipment is currently in service
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid={`switch-${testIdPrefix}active`}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-0 sm:space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                data-testid={`button-cancel-${isCreate ? "create" : "edit"}`}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid={`button-submit-${isCreate ? "create" : "edit"}`}>
                {submitLabel}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export function EquipmentCreateDialog(props: Omit<EquipmentFormDialogProps, "mode" | "equipment">) {
  return <EquipmentFormDialog mode="create" {...props} />;
}

export function EquipmentEditDialog(props: Omit<EquipmentFormDialogProps, "mode"> & { equipment: Equipment | null }) {
  return <EquipmentFormDialog mode="edit" {...props} />;
}

```

### `client/src/components/equipment/EquipmentHistoryDialog.tsx` (146 lines)

```tsx
import { Equipment } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, Calendar, User, FileText, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { equipmentKeys } from "@/utils/queryKeys";
import { format } from "date-fns";

interface EquipmentHistoryDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment | null;
}

interface LifecycleEvent {
  id: string;
  eventType: string;
  eventDate: string;
  reason?: string;
  notes?: string;
  performedBy?: string;
  createdAt: string;
}

export function EquipmentHistoryDialog({
  isOpen,
  onOpenChange,
  equipment,
}: EquipmentHistoryDialogProps) {
  const { data: history = [], isLoading } = useQuery<LifecycleEvent[]>({
    queryKey: equipmentKeys.history(equipment?.id || ""),
    queryFn: () => apiRequest("GET", `/api/equipment/${equipment?.id}/history`),
    enabled: isOpen && !!equipment?.id,
  });

  if (!equipment) return null;

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case "decommissioned":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "reinstated":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "created":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const formatEventType = (eventType: string) => {
    return eventType.charAt(0).toUpperCase() + eventType.slice(1);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Equipment History
          </DialogTitle>
          <DialogDescription>
            Lifecycle history for {equipment.name}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/50 rounded-md p-4 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-muted-foreground">Equipment:</span>{" "}
              <span className="font-medium">{equipment.name}</span>
            </div>
            <Badge variant={equipment.isActive ? "default" : "secondary"}>
              {equipment.isActive ? "Active" : "Decommissioned"}
            </Badge>
          </div>
          <div>
            <span className="text-muted-foreground">Type:</span>{" "}
            <span className="font-medium">{equipment.type}</span>
          </div>
        </div>

        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <History className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No History Available</p>
              <p className="text-sm">No lifecycle events have been recorded for this equipment.</p>
            </div>
          ) : (
            <div className="relative space-y-0">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
              {history.map((event, index) => (
                <div key={event.id} className="relative pl-10 pb-6">
                  <div className="absolute left-2 w-4 h-4 rounded-full bg-background border-2 border-primary" />
                  <div className="bg-card border rounded-md p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <Badge className={getEventColor(event.eventType)}>
                        {formatEventType(event.eventType)}
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(event.eventDate), "MMM d, yyyy 'at' h:mm a")}
                      </div>
                    </div>
                    {event.reason && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Reason:</span>{" "}
                        <span>{event.reason}</span>
                      </div>
                    )}
                    {event.notes && (
                      <div className="flex items-start gap-2 text-sm text-muted-foreground">
                        <FileText className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>{event.notes}</span>
                      </div>
                    )}
                    {event.performedBy && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>{event.performedBy}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

```

### `client/src/components/equipment/EquipmentOverviewStats.tsx` (97 lines)

```tsx
import { Card, CardContent } from "@/components/ui/card";
import {
  Server,
  CheckCircle,
  AlertTriangle,
  Ship,
  AlertCircle as AlertCircleIcon,
} from "lucide-react";

interface EquipmentStats {
  total: number;
  active: number;
  inactive: number;
  vesselCount: number;
  unassigned: number;
  filtered: number;
}

interface EquipmentOverviewStatsProps {
  stats: EquipmentStats;
}

export function EquipmentOverviewStats({ stats }: EquipmentOverviewStatsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5" data-testid="equipment-stats">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Equipment</p>
              <p className="text-2xl font-bold" data-testid="stat-total">
                {stats.total}
              </p>
            </div>
            <Server className="h-8 w-8 text-primary" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active</p>
              <p className="text-2xl font-bold text-green-600" data-testid="stat-active">
                {stats.active}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Inactive</p>
              <p className="text-2xl font-bold text-muted-foreground" data-testid="stat-inactive">
                {stats.inactive}
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Vessels</p>
              <p className="text-2xl font-bold text-blue-600" data-testid="stat-vessels">
                {stats.vesselCount}
              </p>
            </div>
            <Ship className="h-8 w-8 text-blue-600" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Unassigned</p>
              <p className="text-2xl font-bold text-orange-600" data-testid="stat-unassigned">
                {stats.unassigned}
              </p>
            </div>
            <AlertCircleIcon className="h-8 w-8 text-orange-600" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

```

### `client/src/components/equipment/EquipmentReinstateDialog.tsx` (138 lines)

```tsx
import { Equipment } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RefreshCw, CheckCircle } from "lucide-react";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface EquipmentReinstateDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment | null;
  onSuccess: () => void;
}

export function EquipmentReinstateDialog({
  isOpen,
  onOpenChange,
  equipment,
  onSuccess,
}: EquipmentReinstateDialogProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState("");

  const reinstateMutation = useMutation({
    mutationFn: async (data: { notes: string }) => {
      return apiRequest("POST", `/api/equipment/${equipment?.id}/reinstate`, data);
    },
    onSuccess: () => {
      toast({
        title: "Equipment Reinstated",
        description: `${equipment?.name} has been successfully reinstated to active service.`,
      });
      setNotes("");
      onOpenChange(false);
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reinstate equipment.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!equipment) return;
    reinstateMutation.mutate({ notes });
  };

  const handleClose = () => {
    setNotes("");
    onOpenChange(false);
  };

  if (!equipment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-green-600" />
            Reinstate Equipment
          </DialogTitle>
          <DialogDescription>
            This will restore {equipment.name} to active service. The equipment will be moved back
            to the active roster.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-start gap-3 p-3 rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-green-800 dark:text-green-200">
              <p className="font-medium">Reinstatement</p>
              <p>This equipment was previously decommissioned. Reinstating will return it to active operations.</p>
            </div>
          </div>

          <div className="bg-muted/50 rounded-md p-4 space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">Equipment:</span>{" "}
              <span className="font-medium">{equipment.name}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Type:</span>{" "}
              <span className="font-medium">{equipment.type}</span>
            </div>
            {equipment.decommissionReason && (
              <div>
                <span className="text-muted-foreground">Previous Decommission Reason:</span>{" "}
                <span className="font-medium">{equipment.decommissionReason}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Reinstatement Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Enter any notes about why this equipment is being reinstated..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[100px]"
              data-testid="input-reinstate-notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} data-testid="button-cancel-reinstate">
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={reinstateMutation.isPending}
            className="bg-green-600 hover:bg-green-700 text-white"
            data-testid="button-confirm-reinstate"
          >
            {reinstateMutation.isPending ? "Reinstating..." : "Reinstate Equipment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

```

### `client/src/components/equipment/EquipmentTable.tsx` (266 lines)

```tsx
import { Equipment, Vessel } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Pencil, Trash2, Ship, AlertCircle, CheckCircle, Wrench, Power, History } from "lucide-react";
import { formatType, formatLocation, getVesselInfo } from "@/utils/equipmentHelpers";
import { StatusBadge } from "@/components/shared/StatusBadge";

interface EquipmentTableProps {
  equipment: Equipment[];
  vessels: Vessel[];
  onView: (equipment: Equipment) => void;
  onEdit: (equipment: Equipment) => void;
  onDelete: (equipment: Equipment) => void;
  onSetupSensors?: (equipment: Equipment) => void;
  onDecommission?: (equipment: Equipment) => void;
  onViewHistory?: (equipment: Equipment) => void;
  paginationMeta?: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  } | null;
  onPageChange?: (page: number) => void;
}

function renderVesselCell(equipment: Equipment, vessels: Vessel[]) {
  const vesselInfo = getVesselInfo(equipment, vessels);

  if (!vesselInfo.name) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span>Not assigned</span>
      </div>
    );
  }

  if (!vesselInfo.isLinked) {
    return (
      <div className="flex items-center gap-2 text-orange-600">
        <AlertCircle className="h-4 w-4" />
        <span>{vesselInfo.name}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Ship className="h-4 w-4 text-blue-600" />
      <span>{vesselInfo.name}</span>
      <CheckCircle className="h-3 w-3 text-green-600" />
    </div>
  );
}

export function EquipmentTable({
  equipment,
  vessels,
  onView,
  onEdit,
  onDelete,
  onSetupSensors,
  onDecommission,
  onViewHistory,
  paginationMeta,
  onPageChange,
}: EquipmentTableProps) {
  return (
    <>
      <Table data-testid="table-equipment">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Vessel</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {equipment.map((item: Equipment) => (
            <TableRow key={item.id} data-testid={`row-equipment-${item.id}`}>
              <TableCell className="font-medium" data-testid={`text-name-${item.id}`}>
                <div>
                  <div>{item.name}</div>
                  {(item.manufacturer || item.model) && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {item.manufacturer} {item.model && `• ${item.model}`}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell data-testid={`text-type-${item.id}`}>
                <Badge variant="outline">{formatType(item.type)}</Badge>
              </TableCell>
              <TableCell data-testid={`text-vessel-${item.id}`}>
                {renderVesselCell(item, vessels)}
              </TableCell>
              <TableCell data-testid={`text-location-${item.id}`}>
                {item.location ? (
                  formatLocation(item.location)
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge
                  status={item.isActive ? "active" : "inactive"}
                  dataTestId={`status-${item.isActive ? "active" : "inactive"}-${item.id}`}
                />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onView(item)}
                    data-testid={`button-view-${item.id}`}
                    aria-label={`View ${item.name}`}
                    className="h-8 w-8 p-0"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {onSetupSensors && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSetupSensors(item)}
                      data-testid={`button-setup-sensors-${item.id}`}
                      aria-label={`Setup sensors for ${item.name}`}
                      className="h-8 w-8 p-0"
                    >
                      <Wrench className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(item)}
                    data-testid={`button-edit-${item.id}`}
                    aria-label={`Edit ${item.name}`}
                    className="h-8 w-8 p-0"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {onViewHistory && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewHistory(item)}
                      data-testid={`button-history-${item.id}`}
                      aria-label={`View history for ${item.name}`}
                      className="h-8 w-8 p-0"
                    >
                      <History className="h-4 w-4" />
                    </Button>
                  )}
                  {onDecommission && item.isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDecommission(item)}
                      data-testid={`button-decommission-${item.id}`}
                      aria-label={`Decommission ${item.name}`}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Power className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(item)}
                    data-testid={`button-delete-${item.id}`}
                    aria-label={`Delete ${item.name}`}
                    className="h-8 w-8 p-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {paginationMeta?.totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between px-2 py-4 border-t">
          <div className="text-sm text-muted-foreground" data-testid="text-pagination-info">
            Showing {(paginationMeta.page - 1) * paginationMeta.pageSize + 1} to{" "}
            {Math.min(paginationMeta.page * paginationMeta.pageSize, paginationMeta.total)} of{" "}
            {paginationMeta.total} results
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(paginationMeta.page - 1)}
              disabled={paginationMeta.page === 1}
              data-testid="button-previous-page"
            >
              Previous
            </Button>
            <div className="flex items-center gap-1">
              {(() => {
                const { page, totalPages } = paginationMeta;
                const maxVisible = 5;
                let startPage = 1;
                let endPage = totalPages;

                if (totalPages > maxVisible) {
                  const halfWindow = Math.floor(maxVisible / 2);
                  startPage = Math.max(1, page - halfWindow);
                  endPage = Math.min(totalPages, startPage + maxVisible - 1);

                  if (endPage - startPage < maxVisible - 1) {
                    startPage = Math.max(1, endPage - maxVisible + 1);
                  }
                }

                const pages = Array.from(
                  { length: endPage - startPage + 1 },
                  (_, i) => startPage + i
                );

                return pages.map((pageNumber) => {
                  const isActive = pageNumber === page;
                  return (
                    <Button
                      key={pageNumber}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => onPageChange(pageNumber)}
                      className="w-8"
                      data-testid={`button-page-${pageNumber}`}
                    >
                      {pageNumber}
                    </Button>
                  );
                });
              })()}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(paginationMeta.page + 1)}
              disabled={paginationMeta.page === paginationMeta.totalPages}
              data-testid="button-next-page"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

```

### `client/src/components/equipment/EquipmentViewDialog.tsx` (433 lines)

```tsx
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Equipment, SensorConfiguration } from "@shared/schema";
import { Plus, Ship, Link, Settings, Zap, Activity, AlertTriangle, Package } from "lucide-react";
import { format } from "date-fns";
import { LoadDistributionChart } from "@/components/analytics/LoadDistributionChart";
import { formatType, formatLocation, getVesselInfo, useEquipmentViewData } from "@/features/vessels";
import { OperatingParamStatusCard } from "./OperatingParamStatusCard";
import { SensorConfigItemRow } from "./SensorConfigItemRow";
import { BundlePreview } from "./BundlePreview";
import { countSensorsByStatus, parseNumericInput } from "./equipment-view-helpers";

function getStatusBadge(equipment: Equipment) {
  return (
    <Badge variant={equipment.isActive ? "default" : "secondary"}>
      {equipment.isActive ? "Active" : "Inactive"}
    </Badge>
  );
}

interface EquipmentViewDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment | null;
  onEquipmentUpdated?: () => void;
}

export function EquipmentViewDialog({ isOpen, onOpenChange, equipment, onEquipmentUpdated }: EquipmentViewDialogProps) {
  const d = useEquipmentViewData(equipment, isOpen, onEquipmentUpdated);
  if (!equipment) {return null;}

  const vesselInfo = getVesselInfo(equipment);
  const sensorCounts = countSensorsByStatus(d.sensorStatus);
  const otherSensorConfigs = d.allSensorConfigs.filter((config) => config.equipmentId !== equipment.id);

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>Equipment Details</DialogTitle>
            <DialogDescription>Detailed information for {equipment.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4 overflow-y-auto flex-1" data-testid="equipment-details">
            <EquipmentBasicInfo equipment={equipment} vesselInfo={vesselInfo} />
            <OperatingParamsSection params={d.operatingParams} telemetry={d.equipmentTelemetry} />
            <SensorConfigsSection
              configs={d.sensorConfigs}
              sensorStatus={d.sensorStatus}
              sensorCounts={sensorCounts}
              onAdd={d.handleAddSensor}
              onEdit={d.handleEditSensor}
              onDelete={d.handleDeleteSensor}
              onAssignExisting={d.handleAssignExistingSensor}
              onApplyBundle={() => d.setIsApplyBundleDialogOpen(true)}
            />
            <div className="border-t pt-4">
              <LoadDistributionChart
                equipmentId={equipment.id}
                startDate={d.loadDistributionDateRange.startDate}
                endDate={d.loadDistributionDateRange.endDate}
              />
            </div>
          </div>
          <div className="px-6 pb-6 pt-4 border-t shrink-0">
            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)} data-testid="button-close-view">Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SensorConfigDialog
        isOpen={d.isSensorDialogOpen}
        onOpenChange={d.setIsSensorDialogOpen}
        equipment={equipment}
        editingSensor={d.editingSensor}
        form={d.sensorForm}
        onSubmit={d.onSensorSubmit}
        onCancel={d.closeSensorDialog}
        templates={d.sensorTemplates}
        selectedTemplateId={d.selectedTemplateId}
        onTemplateSelect={d.handleTemplateSelect}
        isCreating={d.createSensorMutation.isPending}
        isUpdating={d.updateSensorMutation.isPending}
      />

      <AssignSensorDialog
        isOpen={d.isAssignSensorDialogOpen}
        onOpenChange={d.setIsAssignSensorDialogOpen}
        otherConfigs={otherSensorConfigs}
        onAssign={d.handleAssignSensor}
        isAssigning={d.assignSensorMutation.isPending}
      />

      <ApplyBundleDialog
        isOpen={d.isApplyBundleDialogOpen}
        onOpenChange={d.setIsApplyBundleDialogOpen}
        equipment={equipment}
        bundles={d.sensorBundles}
        selectedBundleId={d.selectedBundleId}
        onSelectBundle={d.setSelectedBundleId}
        onApply={d.handleApplyBundle}
        onCancel={d.closeApplyBundleDialog}
        isApplying={d.applyBundleMutation.isPending}
      />
    </>
  );
}

interface VesselInfoType { name: string | null; isLinked: boolean; }

function EquipmentBasicInfo({ equipment, vesselInfo }: { equipment: Equipment; vesselInfo: VesselInfoType }) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className="text-sm font-medium text-muted-foreground">Name</label><p className="text-sm" data-testid="detail-name">{equipment.name}</p></div>
        <div><label className="text-sm font-medium text-muted-foreground">Type</label><p className="text-sm" data-testid="detail-type">{formatType(equipment.type)}</p></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className="text-sm font-medium text-muted-foreground">Manufacturer</label><p className="text-sm" data-testid="detail-manufacturer">{equipment.manufacturer || "-"}</p></div>
        <div><label className="text-sm font-medium text-muted-foreground">Model</label><p className="text-sm" data-testid="detail-model">{equipment.model || "-"}</p></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className="text-sm font-medium text-muted-foreground">Serial Number</label><p className="text-sm" data-testid="detail-serial">{equipment.serialNumber || "-"}</p></div>
        <div><label className="text-sm font-medium text-muted-foreground">Vessel Assignment</label><div className="mt-1"><VesselAssignment vesselInfo={vesselInfo} /></div></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className="text-sm font-medium text-muted-foreground">Location</label><p className="text-sm" data-testid="detail-location">{equipment.location ? formatLocation(equipment.location) : "-"}</p></div>
        <div><label className="text-sm font-medium text-muted-foreground">Status</label><div className="mt-1">{getStatusBadge(equipment)}</div></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div><label className="text-sm font-medium text-muted-foreground">Created</label><p className="text-sm" data-testid="detail-created">{format(new Date(equipment.createdAt), "PPP")}</p></div>
        <div><label className="text-sm font-medium text-muted-foreground">Last Updated</label><p className="text-sm" data-testid="detail-updated">{format(new Date(equipment.updatedAt), "PPP")}</p></div>
      </div>
      
      {(equipment.purchaseValue || equipment.salvageValue || equipment.serviceLifeHours || equipment.serviceLifeYears) && (
        <div className="border-t pt-4 mt-4">
          <h4 className="text-sm font-semibold mb-3">Financial & Service Life</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div><label className="text-sm font-medium text-muted-foreground">Purchase Value</label><p className="text-sm" data-testid="detail-purchase-value">{equipment.purchaseValue ? `${equipment.purchaseCurrency || 'USD'} ${equipment.purchaseValue.toLocaleString()}` : "-"}</p></div>
            <div><label className="text-sm font-medium text-muted-foreground">Salvage Value</label><p className="text-sm" data-testid="detail-salvage-value">{equipment.salvageValue ? `${equipment.purchaseCurrency || 'USD'} ${equipment.salvageValue.toLocaleString()}` : "-"}</p></div>
            <div><label className="text-sm font-medium text-muted-foreground">Purchase Date</label><p className="text-sm" data-testid="detail-purchase-date">{equipment.purchaseDate ? format(new Date(equipment.purchaseDate), "PPP") : "-"}</p></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
            <div><label className="text-sm font-medium text-muted-foreground">Service Life (Hours)</label><p className="text-sm" data-testid="detail-service-life-hours">{equipment.serviceLifeHours ? equipment.serviceLifeHours.toLocaleString() : "-"}</p></div>
            <div><label className="text-sm font-medium text-muted-foreground">Service Life (Years)</label><p className="text-sm" data-testid="detail-service-life-years">{equipment.serviceLifeYears || "-"}</p></div>
            <div><label className="text-sm font-medium text-muted-foreground">Depreciation</label><p className="text-sm" data-testid="detail-depreciation">{equipment.depreciationMethod ? equipment.depreciationMethod.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : "-"}{equipment.depreciationRate ? ` (${equipment.depreciationRate}%)` : ""}</p></div>
          </div>
        </div>
      )}
    </>
  );
}

function VesselAssignment({ vesselInfo }: { vesselInfo: VesselInfoType }) {
  if (!vesselInfo.name) {
    return <p className="text-sm text-muted-foreground">Not assigned to any vessel</p>;
  }
  return (
    <div className="flex items-center gap-2">
      <Ship className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm">{vesselInfo.name}</span>
      {!vesselInfo.isLinked && <span className="text-xs text-orange-500" title="Legacy vessel name - not linked to vessel record">(legacy)</span>}
    </div>
  );
}

interface OperatingParam { id: string; parameterName: string; parameterType: string; unit?: string | null; optimalMin?: number | null; optimalMax?: number | null; criticalMin?: number | null; criticalMax?: number | null; lifeImpactDescription?: string | null; recommendedAction?: string | null; }
interface TelemetryReading { sensorType: string; value?: number; }

function OperatingParamsSection({ params, telemetry }: { params: OperatingParam[]; telemetry: TelemetryReading[] }) {
  return (
    <div className="border-t pt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold flex items-center gap-2"><Activity className="h-4 w-4" />Operating Condition Status</h3>
      </div>
      {params.length > 0 ? (
        <div className="space-y-2">
          {params.map((param) => <OperatingParamStatusCard key={param.id} param={param} telemetry={telemetry} />)}
        </div>
      ) : (
        <div className="text-center py-4 border rounded-lg bg-muted/30">
          <Settings className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground text-sm" data-testid="text-no-params">No operating parameters defined for this equipment type</p>
          <p className="text-xs text-muted-foreground mt-1">Add parameters in the Operating Parameters page</p>
        </div>
      )}
    </div>
  );
}

interface SensorStatus { id: string; status: "online" | "offline"; lastTelemetry?: string | null; lastValue?: number | null; }
interface SensorCountsType { online: number; offline: number; }

interface SensorConfigsSectionProps {
  configs: SensorConfiguration[];
  sensorStatus: SensorStatus[];
  sensorCounts: SensorCountsType;
  onAdd: () => void;
  onEdit: (config: SensorConfiguration) => void;
  onDelete: (config: SensorConfiguration) => void;
  onAssignExisting: () => void;
  onApplyBundle: () => void;
}

function SensorConfigsSection({ configs, sensorStatus, sensorCounts, onAdd, onEdit, onDelete, onAssignExisting, onApplyBundle }: SensorConfigsSectionProps) {
  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <h3 className="text-lg font-semibold flex items-center gap-2"><Zap className="h-4 w-4" />Sensor Configurations</h3>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onAssignExisting} data-testid="button-assign-sensor"><Link className="h-4 w-4 mr-2" />Assign Existing</Button>
          <Button size="sm" onClick={onAdd} data-testid="button-add-sensor"><Plus className="h-4 w-4 mr-2" />Create New</Button>
        </div>
      </div>
      {configs.length > 0 ? (
        <>
          <div className="mb-3 p-2 bg-muted/50 rounded-lg flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <span className="text-muted-foreground">Total: <span className="font-semibold text-foreground">{configs.length}</span></span>
              <span className="text-muted-foreground">Online: <span className="font-semibold text-emerald-600 dark:text-emerald-400">{sensorCounts.online}</span></span>
              <span className="text-muted-foreground">Offline: <span className="font-semibold text-red-600 dark:text-red-400">{sensorCounts.offline}</span></span>
            </div>
          </div>
          <div className="space-y-2">
            {configs.map((config) => (
              <SensorConfigItemRow
                key={config.id}
                config={config}
                status={sensorStatus.find((s) => s.id === config.id)}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-4">
          <Zap className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground text-sm mb-2">No sensor configurations found</p>
          <div className="flex gap-2 justify-center">
            <Button size="sm" variant="outline" onClick={onAdd} data-testid="button-add-first-sensor"><Plus className="h-4 w-4 mr-2" />Add First Sensor</Button>
            <Button size="sm" variant="default" onClick={onApplyBundle} data-testid="button-apply-bundle"><Package className="h-4 w-4 mr-2" />Apply Bundle</Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface SensorTemplate { id: string; sensorType: string; description?: string | null; }
interface SensorFormType { control: unknown; handleSubmit: (fn: (data: Record<string, unknown>) => void) => (e?: React.BaseSyntheticEvent) => Promise<void>; }

interface SensorConfigDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment;
  editingSensor: SensorConfiguration | null;
  form: SensorFormType;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
  templates: SensorTemplate[];
  selectedTemplateId: string;
  onTemplateSelect: (value: string) => void;
  isCreating: boolean;
  isUpdating: boolean;
}

function SensorConfigDialog({ isOpen, onOpenChange, equipment, editingSensor, form, onSubmit, onCancel, templates, selectedTemplateId, onTemplateSelect, isCreating, isUpdating }: SensorConfigDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2"><Zap className="h-5 w-5" />{editingSensor ? "Edit Sensor Configuration" : "Add Sensor Configuration"}</DialogTitle>
          <DialogDescription>{editingSensor ? `Edit configuration for ${editingSensor.sensorType} sensor` : `Add a new sensor configuration for "${equipment.name}"`}</DialogDescription>
        </DialogHeader>
        <Form {...(form as Record<string, unknown>)}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0" data-testid="form-sensor-config">
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {!editingSensor && templates.length > 0 && (
                <div className="space-y-2">
                  <Label>Load from Template (Optional)</Label>
                  <Select value={selectedTemplateId} onValueChange={onTemplateSelect}>
                    <SelectTrigger data-testid="select-template"><SelectValue placeholder="Select a template..." /></SelectTrigger>
                    <SelectContent>{templates.map((template) => <SelectItem key={template.id} value={template.id}>{template.sensorType} - {template.description || "No description"}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              <FormField control={form.control as never} name="sensorType" render={({ field }) => <FormItem><FormLabel>Sensor Type</FormLabel><FormControl><Input {...field} placeholder="e.g., temperature, pressure" data-testid="input-sensor-type" /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control as never} name="targetUnit" render={({ field }) => <FormItem><FormLabel>Unit</FormLabel><FormControl><Input {...field} value={field.value || ""} placeholder="e.g., °C, bar, rpm" data-testid="input-target-unit" /></FormControl><FormMessage /></FormItem>} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control as never} name="gain" render={({ field }) => <FormItem><FormLabel>Gain</FormLabel><FormControl><Input type="number" step="0.01" {...field} onChange={(e) => field.onChange(Number.parseFloat(e.target.value))} data-testid="input-gain" /></FormControl><FormDescription className="text-xs">Calibration multiplier</FormDescription><FormMessage /></FormItem>} />
                <FormField control={form.control as never} name="offset" render={({ field }) => <FormItem><FormLabel>Offset</FormLabel><FormControl><Input type="number" step="0.01" {...field} onChange={(e) => field.onChange(Number.parseFloat(e.target.value))} data-testid="input-offset" /></FormControl><FormDescription className="text-xs">Value adjustment</FormDescription><FormMessage /></FormItem>} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control as never} name="warnHi" render={({ field }) => <FormItem><FormLabel>Warning High</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(parseNumericInput(e.target.value))} placeholder="Optional" data-testid="input-warn-hi" /></FormControl><FormMessage /></FormItem>} />
                <FormField control={form.control as never} name="warnLo" render={({ field }) => <FormItem><FormLabel>Warning Low</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(parseNumericInput(e.target.value))} placeholder="Optional" data-testid="input-warn-lo" /></FormControl><FormMessage /></FormItem>} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control as never} name="critHi" render={({ field }) => <FormItem><FormLabel>Critical High</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(parseNumericInput(e.target.value))} placeholder="Optional" data-testid="input-crit-hi" /></FormControl><FormMessage /></FormItem>} />
                <FormField control={form.control as never} name="critLo" render={({ field }) => <FormItem><FormLabel>Critical Low</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ""} onChange={(e) => field.onChange(parseNumericInput(e.target.value))} placeholder="Optional" data-testid="input-crit-lo" /></FormControl><FormMessage /></FormItem>} />
              </div>
              <FormField control={form.control as never} name="enabled" render={({ field }) => <FormItem className="flex items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel className="text-base">Enabled</FormLabel><FormDescription>Enable this sensor configuration for monitoring</FormDescription></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-enabled" /></FormControl></FormItem>} />
              <FormField control={form.control as never} name="notes" render={({ field }) => <FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Textarea {...field} value={field.value || ""} placeholder="Additional notes..." data-testid="textarea-notes" /></FormControl><FormMessage /></FormItem>} />
            </div>
            <div className="px-6 pb-6 pt-4 border-t shrink-0">
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-sensor">Cancel</Button>
                <Button type="submit" disabled={isCreating || isUpdating} data-testid="button-submit-sensor">{editingSensor ? (isUpdating ? "Updating..." : "Update Sensor") : (isCreating ? "Creating..." : "Create Sensor")}</Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

interface AssignSensorDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  otherConfigs: SensorConfiguration[];
  onAssign: (config: SensorConfiguration) => void;
  isAssigning: boolean;
}

function AssignSensorDialog({ isOpen, onOpenChange, otherConfigs, onAssign, isAssigning }: AssignSensorDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2"><Link className="h-5 w-5" />Assign Existing Sensor Configuration</DialogTitle>
          <DialogDescription>Select an existing sensor configuration from another equipment to copy</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {otherConfigs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground"><AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-50" /><p>No other sensor configurations available to assign</p></div>
          ) : (
            <div className="space-y-3">
              {otherConfigs.map((config) => (
                <div key={config.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={config.enabled ? "default" : "secondary"}>{config.sensorType}</Badge>
                      {config.targetUnit && <span className="text-sm text-muted-foreground">Unit: {config.targetUnit}</span>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div><span className="text-muted-foreground">Status: </span><span className={config.enabled ? "text-green-600" : "text-gray-500"}>{config.enabled ? "Enabled" : "Disabled"}</span></div>
                      <div><span className="text-muted-foreground">Gain: </span><span className="font-medium">{config.gain}</span></div>
                      <div><span className="text-muted-foreground">Offset: </span><span className="font-medium">{config.offset}</span></div>
                    </div>
                    {config.notes && <div className="text-xs text-muted-foreground"><span className="font-medium">Notes: </span>{config.notes}</div>}
                  </div>
                  <Button size="sm" onClick={() => onAssign(config)} disabled={isAssigning} data-testid={`button-assign-config-${config.id}`}><Link className="h-4 w-4 mr-2" />Assign</Button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="px-6 pb-6 pt-4 border-t shrink-0">
          <div className="flex justify-end"><Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-assign">Cancel</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SensorBundle { bundleId: string; name: string; description?: string | null; templateIds: string[]; isSystemDefault?: boolean; }

interface ApplyBundleDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment;
  bundles: SensorBundle[];
  selectedBundleId: string;
  onSelectBundle: (value: string) => void;
  onApply: () => void;
  onCancel: () => void;
  isApplying: boolean;
}

function ApplyBundleDialog({ isOpen, onOpenChange, equipment, bundles, selectedBundleId, onSelectBundle, onApply, onCancel, isApplying }: ApplyBundleDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Package className="h-5 w-5" />Apply Sensor Bundle</DialogTitle>
          <DialogDescription>Select a sensor bundle to quickly deploy multiple sensor configurations to "{equipment.name}"</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {bundles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="mb-2">No sensor bundles available</p>
              <p className="text-xs">{equipment.type ? `No bundles found for equipment type: ${equipment.type}` : "Create sensor bundles in Sensor Management"}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <Label>Select Bundle</Label>
              <Select value={selectedBundleId} onValueChange={onSelectBundle}>
                <SelectTrigger data-testid="select-bundle"><SelectValue placeholder="Choose a sensor bundle..." /></SelectTrigger>
                <SelectContent>
                  {bundles.map((bundle) => (
                    <SelectItem key={bundle.bundleId} value={bundle.bundleId}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{bundle.name}</span>
                        <Badge variant="secondary" className="text-xs">{bundle.templateIds.length} sensors</Badge>
                        {bundle.isSystemDefault && <Badge variant="outline" className="text-xs">System</Badge>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedBundleId && <BundlePreview bundles={bundles} selectedBundleId={selectedBundleId} />}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} data-testid="button-cancel-apply-bundle">Cancel</Button>
          <Button onClick={onApply} disabled={!selectedBundleId || isApplying} data-testid="button-confirm-apply-bundle">{isApplying ? "Applying..." : "Apply Bundle"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

```

### `client/src/components/equipment/OperatingParamStatusCard.tsx` (173 lines)

```tsx
/**
 * OperatingParamStatusCard component
 * Displays a single operating parameter with its status
 */

import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertCircle } from "lucide-react";
import {
  OperatingParam,
  TelemetryReading,
  computeOperatingStatus,
  getStatusCardClasses,
  getStatusBadgeVariant,
  getStatusValueClass,
  formatOptimalRange,
  formatCriticalRange,
} from "./equipment-view-helpers";

interface OperatingParamStatusCardProps {
  param: OperatingParam;
  telemetry: TelemetryReading[];
}

export function OperatingParamStatusCard({ param, telemetry }: OperatingParamStatusCardProps) {
  const reading = telemetry.find((t) => t.sensorType === param.parameterType);
  const currentValue = reading?.value;
  const { status, statusMessage } = computeOperatingStatus(param, currentValue);

  const hasOptimalRange = param.optimalMin !== null || param.optimalMax !== null;
  const hasCriticalRange = param.criticalMin !== null || param.criticalMax !== null;
  const hasCurrentValue = currentValue !== undefined;

  return (
    <div
      className={`p-3 border rounded-lg ${getStatusCardClasses(status)}`}
      data-testid={`parameter-${param.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge
              variant={getStatusBadgeVariant(status)}
              data-testid={`badge-status-${param.id}`}
            >
              {status.toUpperCase()}
            </Badge>
            <span className="text-sm font-medium" data-testid={`text-param-name-${param.id}`}>
              {param.parameterName}
            </span>
          </div>

          <div className="text-xs space-y-1.5">
            <CurrentValueRow
              param={param}
              currentValue={currentValue}
              status={status}
            />

            {hasOptimalRange && (
              <RangeRow
                label="Optimal Range:"
                value={formatOptimalRange(param)}
                testId={`text-optimal-${param.id}`}
              />
            )}

            {hasCriticalRange && (
              <RangeRow
                label="Critical Range:"
                value={formatCriticalRange(param)}
                testId={`text-critical-${param.id}`}
                className="text-red-600 dark:text-red-400"
              />
            )}

            {hasCurrentValue && (
              <StatusMessageRow
                statusMessage={statusMessage}
                testId={`text-status-msg-${param.id}`}
              />
            )}

            {param.lifeImpactDescription && (
              <ImpactRow
                icon={<TrendingUp className="h-3 w-3 mt-0.5 flex-shrink-0" />}
                text={param.lifeImpactDescription}
                testId={`text-life-impact-${param.id}`}
              />
            )}

            {param.recommendedAction && (
              <ImpactRow
                icon={<AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />}
                text={param.recommendedAction}
                testId={`text-action-${param.id}`}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface CurrentValueRowProps {
  param: OperatingParam;
  currentValue: number | undefined;
  status: "critical" | "warning" | "normal" | "unknown";
}

function CurrentValueRow({ param, currentValue, status }: CurrentValueRowProps) {
  const valueText = currentValue === undefined ? "No data" : `${currentValue.toFixed(2)} ${param.unit || ""}`
    ;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
      <span className="text-muted-foreground sm:min-w-[100px]">Current Value:</span>
      <span
        className={`font-medium ${getStatusValueClass(status)}`}
        data-testid={`text-current-${param.id}`}
      >
        {valueText}
      </span>
    </div>
  );
}

interface RangeRowProps {
  label: string;
  value: string;
  testId: string;
  className?: string;
}

function RangeRow({ label, value, testId, className = "" }: RangeRowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
      <span className="text-muted-foreground sm:min-w-[100px]">{label}</span>
      <span className={`font-medium ${className}`} data-testid={testId}>
        {value}
      </span>
    </div>
  );
}

interface StatusMessageRowProps {
  statusMessage: string;
  testId: string;
}

function StatusMessageRow({ statusMessage, testId }: StatusMessageRowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 pt-1">
      <span className="text-muted-foreground sm:min-w-[100px]">Status:</span>
      <span className="text-xs" data-testid={testId}>{statusMessage}</span>
    </div>
  );
}

interface ImpactRowProps {
  icon: React.ReactNode;
  text: string;
  testId: string;
}

function ImpactRow({ icon, text, testId }: ImpactRowProps) {
  return (
    <div className="flex items-start gap-2 mt-2 pt-2 border-t border-current/10">
      {icon}
      <span className="text-muted-foreground" data-testid={testId}>{text}</span>
    </div>
  );
}

```

### `client/src/components/equipment/SensorConfigItemRow.tsx` (158 lines)

```tsx
/**
 * SensorConfigItemRow component
 * Displays a single sensor configuration row with edit/delete actions
 */

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { StatusIndicator } from "@/components/status-indicator";
import { SensorConfiguration } from "@shared/schema";

interface SensorStatus {
  id: string;
  status: "online" | "offline";
  lastTelemetry?: string | null;
  lastValue?: number | null;
}

interface SensorConfigItemRowProps {
  config: SensorConfiguration;
  status: SensorStatus | undefined;
  onEdit: (config: SensorConfiguration) => void;
  onDelete: (config: SensorConfiguration) => void;
}

export function SensorConfigItemRow({
  config,
  status,
  onEdit,
  onDelete,
}: SensorConfigItemRowProps) {
  const isOnline = status?.status === "online";
  const isConfigEnabled = config.enabled;
  const showNoDataWarning = !isOnline && isConfigEnabled;

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 border rounded transition-colors ${
        showNoDataWarning ? "border-orange-500/30 bg-orange-500/5" : ""
      }`}
    >
      <SensorInfo
        config={config}
        status={status}
        isOnline={isOnline}
        showNoDataWarning={showNoDataWarning}
      />
      <SensorActions config={config} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
}

interface SensorInfoProps {
  config: SensorConfiguration;
  status: SensorStatus | undefined;
  isOnline: boolean;
  showNoDataWarning: boolean;
}

function SensorInfo({ config, status, isOnline, showNoDataWarning }: SensorInfoProps) {
  return (
    <div className="flex flex-col gap-2 flex-1">
      <SensorBadges
        config={config}
        status={status}
        isOnline={isOnline}
        showNoDataWarning={showNoDataWarning}
      />
      <SensorMetadata config={config} status={status} />
    </div>
  );
}

interface SensorBadgesProps {
  config: SensorConfiguration;
  status: SensorStatus | undefined;
  isOnline: boolean;
  showNoDataWarning: boolean;
}

function SensorBadges({ config, status, showNoDataWarning }: SensorBadgesProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={config.enabled ? "default" : "secondary"}>
        {config.sensorType}
      </Badge>
      <div className="flex items-center gap-1">
        <StatusIndicator status={status?.status || "offline"} showLabel={true} />
        {showNoDataWarning && (
          <Badge variant="outline" className="text-orange-600 border-orange-600">
            No Data
          </Badge>
        )}
      </div>
      <span className="text-xs text-muted-foreground">
        Config: {config.enabled ? "Enabled" : "Disabled"}
      </span>
      {config.targetUnit && (
        <span className="text-xs text-muted-foreground">• {config.targetUnit}</span>
      )}
    </div>
  );
}

interface SensorMetadataProps {
  config: SensorConfiguration;
  status: SensorStatus | undefined;
}

function SensorMetadata({ config, status }: SensorMetadataProps) {
  const hasLastTelemetry = status?.lastTelemetry;
  const lastValueText = status?.lastValue !== null && status?.lastValue === undefined ? "" : ` (${status.lastValue.toFixed(2)})`
    ;

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      {hasLastTelemetry ? (
        <span>
          Last: {format(new Date(status.lastTelemetry!), "MMM d, HH:mm:ss")}
          {lastValueText}
        </span>
      ) : (
        <span className="text-orange-600">No telemetry received</span>
      )}
      <span>Gain: {config.gain} | Offset: {config.offset}</span>
    </div>
  );
}

interface SensorActionsProps {
  config: SensorConfiguration;
  onEdit: (config: SensorConfiguration) => void;
  onDelete: (config: SensorConfiguration) => void;
}

function SensorActions({ config, onEdit, onDelete }: SensorActionsProps) {
  return (
    <div className="flex items-center gap-2 self-end sm:self-auto">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onEdit(config)}
        data-testid={`button-edit-sensor-${config.id}`}
      >
        <Pencil className="h-3 w-3" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onDelete(config)}
        data-testid={`button-delete-sensor-${config.id}`}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  );
}

```

### `client/src/components/equipment/equipment-view-helpers.ts` (166 lines)

```ts
/**
 * Helper functions for EquipmentViewDialog
 * Extracted to reduce cognitive complexity (S3776) and nesting depth (S2004)
 */

export interface OperatingParam {
  id: string;
  parameterName: string;
  parameterType: string;
  unit?: string | null;
  optimalMin?: number | null;
  optimalMax?: number | null;
  criticalMin?: number | null;
  criticalMax?: number | null;
  lifeImpactDescription?: string | null;
  recommendedAction?: string | null;
}

export interface TelemetryReading {
  sensorType: string;
  value?: number;
}

export type OperatingStatus = "critical" | "warning" | "normal" | "unknown";

export interface OperatingStatusResult {
  status: OperatingStatus;
  statusMessage: string;
}

/**
 * Compute the operating status for a parameter based on current value and thresholds
 */
export function computeOperatingStatus(
  param: OperatingParam,
  currentValue: number | undefined
): OperatingStatusResult {
  if (currentValue === undefined) {
    return { status: "unknown", statusMessage: "No data" };
  }

  if (param.criticalMin !== null && currentValue < param.criticalMin) {
    return { status: "critical", statusMessage: `Below critical minimum (${param.criticalMin})` };
  }
  
  if (param.criticalMax !== null && currentValue > param.criticalMax) {
    return { status: "critical", statusMessage: `Above critical maximum (${param.criticalMax})` };
  }
  
  if (param.optimalMin !== null && currentValue < param.optimalMin) {
    return { status: "warning", statusMessage: `Below optimal minimum (${param.optimalMin})` };
  }
  
  if (param.optimalMax !== null && currentValue > param.optimalMax) {
    return { status: "warning", statusMessage: `Above optimal maximum (${param.optimalMax})` };
  }

  return { status: "normal", statusMessage: "Within optimal range" };
}

/**
 * Get the CSS classes for the status card border and background
 */
export function getStatusCardClasses(status: OperatingStatus): string {
  switch (status) {
    case "critical":
      return "border-red-300 bg-red-50 dark:bg-red-950/20";
    case "warning":
      return "border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20";
    case "normal":
      return "border-green-300 bg-green-50 dark:bg-green-950/20";
    default:
      return "border-gray-300 bg-gray-50 dark:bg-gray-950/20";
  }
}

/**
 * Get the badge variant for the status
 */
export function getStatusBadgeVariant(status: OperatingStatus): "destructive" | "default" | "secondary" | "outline" {
  switch (status) {
    case "critical":
      return "destructive";
    case "warning":
      return "default";
    case "normal":
      return "secondary";
    default:
      return "outline";
  }
}

/**
 * Get the text color class for the status value
 */
export function getStatusValueClass(status: OperatingStatus): string {
  switch (status) {
    case "critical":
      return "text-red-600 dark:text-red-400";
    case "warning":
      return "text-yellow-600 dark:text-yellow-400";
    default:
      return "";
  }
}

/**
 * Format the optimal range display string
 */
export function formatOptimalRange(param: OperatingParam): string {
  const unit = param.unit || "";
  if (param.optimalMin !== null && param.optimalMax !== null) {
    return `${param.optimalMin} - ${param.optimalMax} ${unit}`;
  }

  if (param.optimalMin !== null) {
    return `> ${param.optimalMin} ${unit}`;
  }
  return `< ${param.optimalMax} ${unit}`;
}

/**
 * Format the critical range display string
 */
export function formatCriticalRange(param: OperatingParam): string {
  const unit = param.unit || "";
  if (param.criticalMin !== null && param.criticalMax !== null) {
    return `${param.criticalMin} - ${param.criticalMax} ${unit}`;
  }

  if (param.criticalMin !== null) {
    return `< ${param.criticalMin} ${unit}`;
  }
  return `> ${param.criticalMax} ${unit}`;
}

/**
 * Count sensors by status from a status array
 * Only counts explicit "online" and "offline" statuses
 */
export function countSensorsByStatus(
  sensorStatus: Array<{ status: string }>
): { online: number; offline: number } {
  let online = 0;
  let offline = 0;
  for (const s of sensorStatus) {
    if (s.status === "online") {
      online++;
    } else if (s.status === "offline") {
      offline++;
    }
  }
  return { online, offline };
}

/**
 * Safely parse a numeric input value
 * Returns null for empty strings, number otherwise
 */
export function parseNumericInput(value: string): number | null {
  if (value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

```

### `client/src/components/compliance/CIIBadge.tsx` (130 lines)

```tsx
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, AlertTriangle, CheckCircle, Info } from "lucide-react";

interface CIIBadgeProps {
  vesselId: string;
  vesselName?: string;
}

interface CIIRating {
  rating: "A" | "B" | "C" | "D" | "E";
  complianceStatus: "compliant" | "warning" | "non-compliant";
  actualCII: number;
  requiredCII: number;
  percentageVsRequired: number;
  year: number;
}

export function CIIBadge({ vesselId, vesselName }: CIIBadgeProps) {
  const {
    data: ciiData,
    isLoading,
    error,
  } = useQuery<CIIRating>({
    queryKey: ["/api/compliance/cii", vesselId],
    enabled: !!vesselId,
    staleTime: 3600000,
    refetchInterval: 3600000,
  });

  if (isLoading) {
    return (
      <Badge variant="outline" className="gap-1.5" data-testid={`badge-cii-loading-${vesselId}`}>
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>CII</span>
      </Badge>
    );
  }

  if (error || !ciiData) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className="gap-1.5"
              data-testid={`badge-cii-unavailable-${vesselId}`}
            >
              <Info className="h-3 w-3" />
              <span>CII: N/A</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p>
              Insufficient data to calculate CII rating. Ensure fuel consumption and speed telemetry
              is available.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const getRatingColor = (rating: string): string => {
    switch (rating) {
      case "A":
        return "bg-green-600 hover:bg-green-700 text-white dark:bg-green-500 dark:hover:bg-green-600";
      case "B":
        return "bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-500 dark:hover:bg-blue-600";
      case "C":
        return "bg-yellow-600 hover:bg-yellow-700 text-white dark:bg-yellow-500 dark:hover:bg-yellow-600";
      case "D":
        return "bg-orange-600 hover:bg-orange-700 text-white dark:bg-orange-500 dark:hover:bg-orange-600";
      case "E":
        return "bg-red-600 hover:bg-red-700 text-white dark:bg-red-500 dark:hover:bg-red-600";
      default:
        return "bg-gray-600 hover:bg-gray-700 text-white";
    }
  };

  const getIcon = () => {
    if (ciiData.complianceStatus === "compliant") {
      return <CheckCircle className="h-3 w-3" />;
    }

    if (ciiData.complianceStatus === "warning" || ciiData.complianceStatus === "non-compliant") {
      return <AlertTriangle className="h-3 w-3" />;
    }
    return null;
  };

  const tooltipText = `
    Carbon Intensity Indicator (CII) Rating
    
    ${vesselName || "Vessel"} - ${ciiData.year}
    Rating: ${ciiData.rating} (${ciiData.complianceStatus})
    
    Actual CII: ${ciiData.actualCII.toFixed(1)} gCO₂/capacity·nm
    Required CII: ${ciiData.requiredCII.toFixed(1)} gCO₂/capacity·nm
    
    ${
      ciiData.percentageVsRequired < 0
        ? `${Math.abs(ciiData.percentageVsRequired).toFixed(1)}% better than required`
        : `${ciiData.percentageVsRequired.toFixed(1)}% above required`
    }
    
    IMO 2023 Compliance: ${ciiData.rating === "A" || ciiData.rating === "B" || ciiData.rating === "C" ? "✓ Compliant" : "⚠ Action Required"}
  `.trim();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            className={`gap-1.5 ${getRatingColor(ciiData.rating)}`}
            data-testid={`badge-cii-${vesselId}`}
          >
            {getIcon()}
            <span>CII: {ciiData.rating}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs whitespace-pre-line">
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

```

