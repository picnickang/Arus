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
