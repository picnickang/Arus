import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsiveTable } from "@/components/shared/ResponsiveTable";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Equipment, Vessel } from "@shared/schema";

interface EquipmentHealth {
  equipmentId: string;
  healthScore: number;
  status: string;
  [key: string]: unknown;
}
import {
  Plus,
  Pencil,
  Trash2,
  Ship,
  AlertTriangle,
  Eye,
  Wifi,
  WifiOff,
  RefreshCw,
  Download,
  Upload,
  Wrench,
  Heart,
  Activity,
  Server,
  Search,
  ArchiveX,
  RotateCcw,
  History,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { formatPercent } from "@/lib/formatters";
import {
  VESSEL_CLASSES,
  VESSEL_CONDITIONS,
  calculateUtilization,
  useVesselManagementData,
} from "@/features/vessels";
import { useEquipmentHealth } from "@/features/vessels";
import { PermissionGate } from "@/components/PermissionGate";
import {
  EquipmentCreateDialog,
  EquipmentEditDialog,
} from "@/components/equipment/EquipmentFormDialog";
import { SensorSetupWizard } from "@/components/sensors/SensorSetupWizard";
import { EquipmentDecommissionDialog } from "@/components/equipment/EquipmentDecommissionDialog";
import { EquipmentReinstateDialog } from "@/components/equipment/EquipmentReinstateDialog";
import { EquipmentHistoryDialog } from "@/components/equipment/EquipmentHistoryDialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useDeleteMutation } from "@/hooks/useCrudMutations";
import { equipmentKeys } from "@/utils/queryKeys";
import { useToast } from "@/hooks/use-toast";
import { useVesselEquipment } from "@/features/vessels";

const vesselClasses = VESSEL_CLASSES;
const vesselConditions = VESSEL_CONDITIONS;

interface EquipmentWithHealth extends Equipment {
  health?: EquipmentHealth;
}

const Utilization = ({ vessel }: { vessel: Vessel }) => {
  const utilization = calculateUtilization(vessel);
  if (utilization === null) {
    return <>N/A</>;
  }
  return <>{formatPercent(utilization)}</>;
};

const formatVesselClass = (vesselClass: string) =>
  vesselClass
    .replaceAll("_", " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

function HealthBadge({ health }: { health?: EquipmentHealth }) {
  if (!health) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <Activity className="h-3 w-3 mr-1" />
        No data
      </Badge>
    );
  }
  const healthIndex = health.healthIndex ?? 0;
  const status = health.status;
  if (status === "critical" || healthIndex < 30) {
    return (
      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100">
        <AlertTriangle className="h-3 w-3 mr-1" />
        {healthIndex}%
      </Badge>
    );
  }
  if (status === "warning" || healthIndex < 70) {
    return (
      <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 hover:bg-yellow-100">
        <Activity className="h-3 w-3 mr-1" />
        {healthIndex}%
      </Badge>
    );
  }
  return (
    <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100">
      <Heart className="h-3 w-3 mr-1" />
      {healthIndex}%
    </Badge>
  );
}

function VesselEquipmentSheet({
  vessel,
  open,
  onOpenChange,
  getConditionBadge,
  getStatusBadge,
}: {
  vessel: Vessel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getConditionBadge: (vessel: Vessel) => JSX.Element;
  getStatusBadge: (vessel: Vessel) => JSX.Element;
}) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [eqCreateOpen, setEqCreateOpen] = useState(false);
  const [eqEditOpen, setEqEditOpen] = useState(false);
  const [sensorWizardOpen, setSensorWizardOpen] = useState(false);
  const [decommissionOpen, setDecommissionOpen] = useState(false);
  const [reinstateOpen, setReinstateOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentWithHealth | null>(null);

  const {
    data: vesselEquipmentRaw = [],
    isLoading: eqLoading,
    refetch: refetchEquipment,
  } = useVesselEquipment(open ? vessel?.id : undefined);

  const { data: healthResponse = [] } = useEquipmentHealth();

  interface RawHealthItem {
    id: string;
    vesselId?: string;
    vessel?: string;
    name: string;
    type: string;
    healthIndex?: number;
    healthScore?: number;
    predictedDueDays?: number;
    status?: "healthy" | "warning" | "critical";
    condition?: string;
  }
  const healthMap = useMemo(() => {
    const map = new Map<string, EquipmentHealth>();
    if (Array.isArray(healthResponse)) {
      (healthResponse as RawHealthItem[]).forEach((item) => {
        if (item.id) {
          map.set(item.id, {
            id: item.id,
            vessel: item.vesselId || item.vessel || "",
            vesselId: item.vesselId || item.vessel || undefined,
            name: item.name,
            type: item.type,
            healthIndex: item.healthIndex ?? item.healthScore ?? 0,
            predictedDueDays: item.predictedDueDays ?? 30,
            status:
              item.status ||
              (item.condition === "critical" || item.condition === "poor"
                ? ("critical" as const)
                : item.condition === "fair"
                  ? ("warning" as const)
                  : ("healthy" as const)),
          });
        }
      });
    }
    return map;
  }, [healthResponse]);

  const vesselEquipment: EquipmentWithHealth[] = useMemo(
    () => vesselEquipmentRaw.map((eq) => ({ ...eq, health: healthMap.get(eq.id) })),
    [vesselEquipmentRaw, healthMap]
  );

  const filteredEquipment = useMemo(() => {
    if (!searchQuery) {
      return vesselEquipment;
    }
    const q = searchQuery.toLowerCase();
    return vesselEquipment.filter(
      (eq) =>
        eq.name?.toLowerCase().includes(q) ||
        eq.type?.toLowerCase().includes(q) ||
        eq.manufacturer?.toLowerCase().includes(q)
    );
  }, [vesselEquipment, searchQuery]);

  const deleteEquipmentMutation = useDeleteMutation("/api/equipment", {
    successMessage: "Equipment deleted successfully",
    onSuccess: () => refetchEquipment(),
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete",
        variant: "destructive",
      });
    },
  });

  const handleDeleteEquipment = (eq: EquipmentWithHealth) => {
    if (confirm(`Delete "${eq.name}"? This cannot be undone.`)) {
      deleteEquipmentMutation.mutate(eq.id);
    }
  };

  const handleLifecycleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: equipmentKeys.list() });
    queryClient.invalidateQueries({ queryKey: equipmentKeys.decommissioned() });
    refetchEquipment();
  };

  const vessels = vessel ? [vessel] : [];

  if (!vessel) {
    return null;
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[90vw] overflow-y-auto"
          data-testid="vessel-detail-sheet"
        >
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Ship className="h-5 w-5" />
              {vessel.name}
            </SheetTitle>
            <SheetDescription>Vessel details and equipment</SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Vessel Class</p>
                <p className="font-medium">
                  {vessel.vesselClass ? formatVesselClass(vessel.vesselClass) : "Not specified"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Condition</p>
                <div className="mt-1">{getConditionBadge(vessel)}</div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Online Status</p>
                <div className="mt-1">{getStatusBadge(vessel)}</div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Utilization</p>
                <p className="font-medium">
                  <Utilization vessel={vessel} />
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Heartbeat</p>
                <p className="font-medium">
                  {vessel.lastHeartbeat
                    ? formatDistanceToNow(new Date(vessel.lastHeartbeat), { addSuffix: true })
                    : "Never"}
                </p>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-4">
                <h3
                  className="text-lg font-semibold flex items-center gap-2"
                  data-testid="vessel-equipment-heading"
                >
                  <Server className="h-5 w-5" />
                  Equipment ({vesselEquipment.length})
                </h3>
                <PermissionGate resource="equipment" action="create">
                  <Button
                    size="sm"
                    onClick={() => setEqCreateOpen(true)}
                    data-testid="button-add-vessel-equipment"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </PermissionGate>
              </div>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search equipment..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-vessel-equipment-search"
                />
              </div>

              {eqLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading equipment...</div>
              ) : filteredEquipment.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Server className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>
                    {searchQuery
                      ? "No equipment matches your search"
                      : "No equipment assigned to this vessel"}
                  </p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table data-testid="table-vessel-equipment">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Health</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEquipment.map((eq) => (
                        <TableRow key={eq.id} data-testid={`row-vessel-eq-${eq.id}`}>
                          <TableCell>
                            <div className="font-medium">{eq.name}</div>
                            {(eq.manufacturer || eq.model) && (
                              <div className="text-xs text-muted-foreground">
                                {eq.manufacturer}
                                {eq.model && ` • ${eq.model}`}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{eq.type || "Unknown"}</Badge>
                          </TableCell>
                          <TableCell>
                            <HealthBadge health={eq.health} />
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                (eq.isActive ?? true)
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  : ""
                              }
                              variant={(eq.isActive ?? true) ? "default" : "secondary"}
                            >
                              {(eq.isActive ?? true) ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  setSelectedEquipment(eq);
                                  setSensorWizardOpen(true);
                                }}
                                data-testid={`button-vessel-eq-sensors-${eq.id}`}
                              >
                                <Wrench className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  setSelectedEquipment(eq);
                                  setEqEditOpen(true);
                                }}
                                data-testid={`button-vessel-eq-edit-${eq.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {(eq.isActive ?? true) ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => {
                                    setSelectedEquipment(eq);
                                    setDecommissionOpen(true);
                                  }}
                                  data-testid={`button-vessel-eq-decommission-${eq.id}`}
                                >
                                  <ArchiveX className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-green-600"
                                  onClick={() => {
                                    setSelectedEquipment(eq);
                                    setReinstateOpen(true);
                                  }}
                                  data-testid={`button-vessel-eq-reinstate-${eq.id}`}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => {
                                  setSelectedEquipment(eq);
                                  setHistoryOpen(true);
                                }}
                                data-testid={`button-vessel-eq-history-${eq.id}`}
                              >
                                <History className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive"
                                onClick={() => handleDeleteEquipment(eq)}
                                data-testid={`button-vessel-eq-delete-${eq.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div className="pt-2">
              <Button variant="outline" className="w-full" asChild>
                <Link href={`/vessels/${vessel.id}`} data-testid="button-vessel-full-dashboard">
                  View Full Dashboard
                </Link>
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <EquipmentCreateDialog
        open={eqCreateOpen}
        onOpenChange={setEqCreateOpen}
        vessels={vessels}
        onSuccess={() => {
          setEqCreateOpen(false);
          refetchEquipment();
        }}
      />
      {selectedEquipment && (
        <EquipmentEditDialog
          open={eqEditOpen}
          onOpenChange={setEqEditOpen}
          equipment={selectedEquipment}
          vessels={vessels}
          onSuccess={() => {
            setEqEditOpen(false);
            refetchEquipment();
          }}
        />
      )}
      {selectedEquipment && (
        <SensorSetupWizard
          equipment={selectedEquipment}
          open={sensorWizardOpen}
          onClose={() => setSensorWizardOpen(false)}
          onSuccess={() => {
            setSensorWizardOpen(false);
            refetchEquipment();
          }}
        />
      )}
      <EquipmentDecommissionDialog
        open={decommissionOpen}
        onOpenChange={setDecommissionOpen}
        equipment={selectedEquipment as Equipment | null}
        onSubmit={async (data) => {
          try {
            await apiRequest("POST", `/api/equipment/${selectedEquipment?.id}/decommission`, data);
            toast({
              title: "Equipment Decommissioned",
              description: `${selectedEquipment?.name} has been decommissioned.`,
            });
            setDecommissionOpen(false);
            handleLifecycleSuccess();
          } catch {
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
        isOpen={reinstateOpen}
        onOpenChange={setReinstateOpen}
        equipment={selectedEquipment as Equipment | null}
        onSuccess={handleLifecycleSuccess}
      />
      <EquipmentHistoryDialog
        isOpen={historyOpen}
        onOpenChange={setHistoryOpen}
        equipment={selectedEquipment as Equipment | null}
      />
    </>
  );
}

export default function VesselManagement() {
  const v = useVesselManagementData();

  const getStatusBadge = (vessel: Vessel) => {
    const offlineForWO = v.hasActiveDowntime(vessel.name, vessel.id);
    const offline = offlineForWO || vessel.onlineStatus === "offline";
    return offline ? (
      <Badge variant="secondary" className="bg-red-500 text-white">
        <WifiOff className="w-3 h-3 mr-1" />
        Offline
      </Badge>
    ) : (
      <Badge variant="default" className="bg-green-500">
        <Wifi className="w-3 h-3 mr-1" />
        Online
      </Badge>
    );
  };

  const getConditionBadge = (vessel: Vessel) => {
    const all = v.getVesselEquipment(vessel.name);
    if (!all || all.length === 0) {
      const condition = vessel.condition || "good";
      const colors: Record<string, string> = {
        excellent: "bg-green-500",
        good: "bg-blue-500",
        fair: "bg-yellow-500",
        poor: "bg-orange-500",
        critical: "bg-red-500",
      };
      return <Badge className={colors[condition] ?? "bg-gray-500"}>{condition}</Badge>;
    }
    const valid = all.filter((eq) => typeof eq.healthIndex === "number");
    if (valid.length === 0) {
      return <Badge className="bg-gray-500">unknown</Badge>;
    }
    const avg = valid.reduce((s, eq) => s + (eq.healthIndex as number), 0) / valid.length;
    const hasCritical = all.some((eq) => eq.status === "critical");
    const hasWarnings = all.some((eq) => eq.status === "warning");
    const urgent = all.some((eq) => (eq.predictedDueDays ?? Infinity) <= 7);
    if (hasCritical || avg < 50) {
      return <Badge className="bg-red-500">critical</Badge>;
    }
    if (hasWarnings || avg < 75 || urgent) {
      return <Badge className="bg-orange-500">poor</Badge>;
    }
    if (avg < 85) {
      return <Badge className="bg-yellow-500">fair</Badge>;
    }
    if (avg < 95) {
      return <Badge className="bg-blue-500">good</Badge>;
    }
    return <Badge className="bg-green-500">excellent</Badge>;
  };

  if (v.isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-lg">Loading vessels...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-end gap-3">
          <PermissionGate resource="vessels" action="create">
            <Button
              variant="outline"
              className="gap-2"
              onClick={v.handleImport}
              disabled={v.importVesselMutation.isPending}
              data-testid="button-import-vessel"
            >
              <Upload className="h-4 w-4" />
              Import Vessel
            </Button>
          </PermissionGate>
          <PermissionGate resource="vessels" action="create">
            <Dialog open={v.isCreateDialogOpen} onOpenChange={v.setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2" data-testid="button-add-vessel">
                  <Plus className="h-4 w-4" />
                  Add Vessel
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Add New Vessel</DialogTitle>
                  <DialogDescription>Create a new vessel record for your fleet</DialogDescription>
                </DialogHeader>
                <Form {...v.form}>
                  <form onSubmit={v.form.handleSubmit(v.handleCreate)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={v.form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vessel Name</FormLabel>
                            <FormControl>
                              <Input
                                placeholder="MV Atlantic Explorer"
                                {...field}
                                data-testid="input-vessel-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={v.form.control}
                        name="vesselClass"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vessel Class</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-vessel-class">
                                  <SelectValue placeholder="Select class" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {vesselClasses.map((cls) => (
                                  <SelectItem key={cls} value={cls}>
                                    {formatVesselClass(cls)}
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
                        control={v.form.control}
                        name="condition"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Condition</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-vessel-condition">
                                  <SelectValue placeholder="Select condition" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {vesselConditions.map((condition) => (
                                  <SelectItem key={condition} value={condition}>
                                    {condition.charAt(0).toUpperCase() + condition.slice(1)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={v.form.control}
                        name="dayRateSgd"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Day Rate (SGD)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="10000.00"
                                {...field}
                                data-testid="input-day-rate"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => v.setIsCreateDialogOpen(false)}
                        data-testid="button-cancel"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={v.createVesselMutation.isPending}
                        data-testid="button-create-vessel"
                      >
                        {v.createVesselMutation.isPending ? "Creating..." : "Create Vessel"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </PermissionGate>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ship className="h-5 w-5" />
            Fleet Overview
          </CardTitle>
          <CardDescription>{v.vessels.length} vessel(s) in your fleet</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ResponsiveTable
            columns={[
              {
                header: "Vessel Name",
                accessor: (vessel: Vessel) => (
                  <Link
                    href={`/vessels/${vessel.id}`}
                    className="hover:underline text-primary font-medium"
                    data-testid={`text-vessel-name-${vessel.id}`}
                  >
                    {vessel.name}
                  </Link>
                ),
              },
              {
                header: "Class",
                accessor: (vessel: Vessel) => (
                  <span data-testid={`text-vessel-class-${vessel.id}`}>
                    {vessel.vesselClass ? formatVesselClass(vessel.vesselClass) : "Not specified"}
                  </span>
                ),
              },
              {
                header: "Condition",
                accessor: (vessel: Vessel) => (
                  <span data-testid={`badge-vessel-condition-${vessel.id}`}>
                    {getConditionBadge(vessel)}
                  </span>
                ),
              },
              {
                header: "Status",
                accessor: (vessel: Vessel) => (
                  <span data-testid={`badge-vessel-status-${vessel.id}`}>
                    {getStatusBadge(vessel)}
                  </span>
                ),
              },
              {
                header: "Last Heartbeat",
                accessor: (vessel: Vessel) =>
                  vessel.lastHeartbeat ? (
                    <span
                      title={format(new Date(vessel.lastHeartbeat), "PPpp")}
                      data-testid={`text-vessel-heartbeat-${vessel.id}`}
                    >
                      {formatDistanceToNow(new Date(vessel.lastHeartbeat), { addSuffix: true })}
                    </span>
                  ) : (
                    <span
                      className="text-muted-foreground"
                      data-testid={`text-vessel-heartbeat-${vessel.id}`}
                    >
                      Never
                    </span>
                  ),
              },
            ]}
            data={v.vessels}
            keyExtractor={(vessel: Vessel) => vessel.id}
            actions={(vessel: Vessel) => (
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => v.handleRefresh(vessel)}
                  data-testid={`button-refresh-${vessel.id}`}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => v.handleView(vessel)}
                  data-testid={`button-view-${vessel.id}`}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => v.handleExport(vessel)}
                  disabled={v.exportVesselMutation.isPending}
                  data-testid={`button-export-${vessel.id}`}
                >
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => v.handleEdit(vessel)}
                  data-testid={`button-edit-${vessel.id}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => v.handleDelete(vessel)}
                  className="text-destructive hover:text-destructive"
                  data-testid={`button-delete-${vessel.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          />
        </CardContent>
      </Card>

      <VesselEquipmentSheet
        vessel={v.selectedVessel}
        open={v.isViewDialogOpen}
        onOpenChange={v.setIsViewDialogOpen}
        getConditionBadge={getConditionBadge}
        getStatusBadge={getStatusBadge}
      />

      <Dialog open={v.isEditDialogOpen} onOpenChange={v.setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Vessel</DialogTitle>
            <DialogDescription>Update vessel information</DialogDescription>
          </DialogHeader>
          <Form {...v.editForm}>
            <form onSubmit={v.editForm.handleSubmit(v.handleUpdate)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={v.editForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vessel Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="MV Atlantic Explorer"
                          {...field}
                          data-testid="input-edit-vessel-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={v.editForm.control}
                  name="vesselClass"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vessel Class</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-vessel-class">
                            <SelectValue placeholder="Select class" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {vesselClasses.map((cls) => (
                            <SelectItem key={cls} value={cls}>
                              {formatVesselClass(cls)}
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
                  control={v.editForm.control}
                  name="condition"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Condition</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-vessel-condition">
                            <SelectValue placeholder="Select condition" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {vesselConditions.map((condition) => (
                            <SelectItem key={condition} value={condition}>
                              {condition.charAt(0).toUpperCase() + condition.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={v.editForm.control}
                  name="dayRateSgd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Day Rate (SGD)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="10000.00"
                          {...field}
                          data-testid="input-edit-day-rate"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {v.selectedVessel && (
                <div className="pt-4 border-t">
                  <h3 className="text-lg font-medium mb-3 text-destructive">Danger Zone</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg border border-destructive/50">
                      <div>
                        <div className="font-medium">Reset Downtime Counter</div>
                        <div className="text-sm text-muted-foreground">
                          Reset accumulated downtime hours to zero
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => v.resetDowntimeMutation.mutate(v.selectedVessel!.id)}
                        disabled={v.resetDowntimeMutation.isPending}
                        data-testid="button-reset-downtime"
                      >
                        {v.resetDowntimeMutation.isPending ? "Resetting..." : "Reset Downtime"}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border border-destructive/50">
                      <div>
                        <div className="font-medium">Reset Operation Counter</div>
                        <div className="text-sm text-muted-foreground">
                          Reset accumulated operation hours to zero
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => v.resetOperationMutation.mutate(v.selectedVessel!.id)}
                        disabled={v.resetOperationMutation.isPending}
                        data-testid="button-reset-operation"
                      >
                        {v.resetOperationMutation.isPending ? "Resetting..." : "Reset Operation"}
                      </Button>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border-2 border-destructive">
                      <div>
                        <div className="font-medium text-destructive">Wipe All Vessel Data</div>
                        <div className="text-sm text-muted-foreground">
                          Delete all telemetry, DTCs, and insights for this vessel
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={v.handleWipeVesselData}
                        disabled={v.wipeVesselDataMutation.isPending}
                        data-testid="button-wipe-vessel-data"
                      >
                        {v.wipeVesselDataMutation.isPending ? "Wiping..." : "Wipe All Vessel Data"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => v.setIsEditDialogOpen(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={v.updateVesselMutation.isPending}
                  data-testid="button-update-vessel"
                >
                  {v.updateVesselMutation.isPending ? "Updating..." : "Update Vessel"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={v.isDeleteDialogOpen} onOpenChange={v.setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Vessel
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{v.selectedVessel?.name}"?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border p-4 bg-muted/50">
              <p className="text-sm font-medium mb-2">What will be deleted:</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Vessel record and configuration</li>
                <li>All associated equipment and sensors</li>
                <li>All telemetry, work orders, and maintenance data</li>
                <li>Port calls, drydock windows, and schedules</li>
              </ul>
            </div>
            <div className="rounded-lg border border-blue-500/50 bg-blue-500/10 p-3">
              <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                Info: Crew will be unassigned
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Crew members will not be deleted. They will be unassigned from this vessel and
                available for reassignment.
              </p>
            </div>
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm text-destructive font-medium">
                Warning: This action cannot be undone
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                All equipment and related data will be permanently deleted.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                v.setIsDeleteDialogOpen(false);
                v.setSelectedVessel(null);
              }}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={v.confirmDelete}
              disabled={v.deleteVesselMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {v.deleteVesselMutation.isPending ? "Deleting..." : "Delete Vessel"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
