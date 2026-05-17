import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  ArchiveX,
  History,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Server,
  Ship,
  Trash2,
  Wrench,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Equipment, Vessel } from "@shared/schema";
import { PermissionGate } from "@/components/PermissionGate";
import {
  EquipmentCreateDialog,
  EquipmentEditDialog,
} from "@/components/equipment/EquipmentFormDialog";
import { SensorSetupWizard } from "@/components/sensors/SensorSetupWizard";
import { EquipmentDecommissionDialog } from "@/components/equipment/EquipmentDecommissionDialog";
import { EquipmentReinstateDialog } from "@/components/equipment/EquipmentReinstateDialog";
import { EquipmentHistoryDialog } from "@/components/equipment/EquipmentHistoryDialog";
import { useEquipmentHealth, useVesselEquipment } from "@/features/vessels";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useDeleteMutation } from "@/hooks/useCrudMutations";
import { equipmentKeys } from "@/utils/queryKeys";
import { useToast } from "@/hooks/use-toast";
import { HealthBadge } from "./HealthBadge";
import { Utilization, formatVesselClass } from "./utils";
import type { EquipmentHealth, EquipmentWithHealth, RawHealthItem } from "./types";

export function VesselEquipmentSheet({
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
          } as EquipmentHealth);
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
