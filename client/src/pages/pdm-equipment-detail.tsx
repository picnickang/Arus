import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MetricCard } from "@/components/shared/MetricCard";
import { SensorSetupWizard } from "@/components/sensors/SensorSetupWizard";
import { SensorHealthDashboard } from "@/components/sensors/SensorHealthDashboard";
import { MultiSensorChart } from "@/components/charts/MultiSensorChart";
import { LoadingState } from "@/components/patterns/LoadingState";
import { ErrorState } from "@/components/patterns/ErrorState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { BulkSelectionBar } from "@/components/ui/bulk-selection-bar";
import { Activity, Gauge, AlertTriangle, Wrench, FileText, Plus, Settings } from "lucide-react";
import { usePdmEquipmentDetailData, useOverviewTabData, useSensorsTabData, useAnomaliesTabData, useMaintenanceHistoryTabData, type EquipmentDetail, type PdmHealthData } from "@/features/analytics";
import { formatDate } from "@/lib/formatters";
import { PageHeader } from "@/components/navigation";

export default function PdmEquipmentDetail() {
  const { equipmentId, equipment, healthData, isLoadingEquipment, isLoadingHealth, equipmentError, healthError, handleBack, handleCreateWorkOrder, handleViewWorkOrders, retryEquipment, retryHealth, healthScore, healthStatus, rul, rulUncertainty, confidence } = usePdmEquipmentDetailData();

  if (isLoadingEquipment || isLoadingHealth) {return <div className="container mx-auto p-6"><LoadingState variant="card" /></div>;}
  if (equipmentError) {return <ErrorState error={equipmentError} title="Failed to load equipment details" variant="page" onRetry={retryEquipment} onBack={handleBack} />;}
  if (healthError) {return <ErrorState error={healthError} title="Failed to load equipment health data" variant="page" onRetry={retryHealth} onBack={handleBack} />;}
  if (!equipment) {return <ErrorState error={new Error("Equipment not found")} title="Equipment not found" variant="page" onBack={handleBack} />;}

  return (
    <div className="min-h-screen" data-testid="pdm-equipment-detail">
      <PageHeader title={equipment?.name || "Equipment Detail"} />
      <div className="container mx-auto p-6 space-y-6">
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-6 border">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3"><h1 className="text-3xl font-bold" data-testid="text-equipment-name">{equipment.name}</h1><Badge variant="outline" data-testid="badge-equipment-type">{equipment.type}</Badge></div>
            {equipment.vesselName && <p className="text-muted-foreground" data-testid="text-vessel-name">Vessel: {equipment.vesselName}</p>}
          </div>
          <div className="flex flex-wrap gap-3">
            <Card className="min-w-[140px]"><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Health Score</p><p className="text-2xl font-bold" data-testid="text-health-score">{healthScore}</p></div><StatusBadge status={healthStatus} /></div></CardContent></Card>
            <Card className="min-w-[140px]"><CardContent className="p-4"><div><p className="text-xs text-muted-foreground">Remaining Life</p>{rul !== null ? (<><p className="text-2xl font-bold" data-testid="text-rul">{rul < 72 ? `${rul}h` : `${Math.round(rul / 24)}d`}</p>{rulUncertainty && <p className="text-xs text-muted-foreground">±{rulUncertainty < 24 ? `${rulUncertainty}h` : `${Math.round(rulUncertainty / 24)}d`}</p>}</>) : <p className="text-2xl font-bold text-muted-foreground" data-testid="text-rul">N/A</p>}<p className="text-xs text-muted-foreground capitalize">{confidence} confidence</p></div></CardContent></Card>
            <div className="flex gap-2"><Button onClick={handleViewWorkOrders} variant="outline" data-testid="button-view-work-orders"><FileText className="h-4 w-4 mr-2" />Work Orders</Button><Button onClick={handleCreateWorkOrder} data-testid="button-create-work-order"><Plus className="h-4 w-4 mr-2" />Create Work Order</Button></div>
          </div>
        </div>
      </div>
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview"><Activity className="h-4 w-4 mr-2" />Overview</TabsTrigger>
          <TabsTrigger value="sensors" data-testid="tab-sensors"><Gauge className="h-4 w-4 mr-2" />Sensors</TabsTrigger>
          <TabsTrigger value="anomalies" data-testid="tab-anomalies"><AlertTriangle className="h-4 w-4 mr-2" />Anomalies & AI</TabsTrigger>
          <TabsTrigger value="maintenance" data-testid="tab-maintenance"><Wrench className="h-4 w-4 mr-2" />Maintenance History</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-6"><OverviewTab equipmentId={equipmentId} equipment={equipment} healthData={healthData} /></TabsContent>
        <TabsContent value="sensors" className="space-y-6"><SensorsTab equipmentId={equipmentId} /></TabsContent>
        <TabsContent value="anomalies" className="space-y-6"><AnomaliesTab equipmentId={equipmentId} /></TabsContent>
        <TabsContent value="maintenance" className="space-y-6"><MaintenanceHistoryTab equipmentId={equipmentId} /></TabsContent>
      </Tabs>
      </div>
    </div>
  );
}

function OverviewTab({ equipmentId, equipment, healthData }: { equipmentId: string; equipment: EquipmentDetail; healthData?: PdmHealthData }) {
  const { timeRange, setTimeRange, sensorData, isLoadingTelemetry, defaultSummary } = useOverviewTabData(equipmentId, healthData);
  return (
    <div className="space-y-6">
      <div><h2 className="text-lg font-semibold mb-4">Sensor Health Overview</h2><SensorHealthDashboard equipmentId={equipmentId} /></div>
      <MultiSensorChart title="Sensor Correlation Analysis" description="Compare multiple sensor readings to identify correlations and anomalies" sensors={sensorData} timeRange={timeRange} onTimeRangeChange={setTimeRange} isLoading={isLoadingTelemetry} data-testid="chart-sensor-correlation" />
      <Card><CardHeader><CardTitle>AI Summary</CardTitle></CardHeader><CardContent><p className="text-muted-foreground" data-testid="text-ai-summary">{defaultSummary}</p>{healthData?.lastUpdated && <p className="text-xs text-muted-foreground mt-2">Last updated: {formatDate(healthData.lastUpdated)}</p>}</CardContent></Card>
      <div><h3 className="text-lg font-semibold mb-4">Key Metrics</h3><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"><MetricCard label="Health Score" value={healthData?.healthScore ?? 0} unit="%" status={healthData?.status ?? "unknown"} normalizedValue={healthData?.healthScore ?? 0} /><MetricCard label="Failure Probability" value={healthData?.pFail30d ?? 0} unit="%" status={(healthData?.pFail30d ?? 0) > 70 ? "critical" : (healthData?.pFail30d ?? 0) > 40 ? "warning" : "normal"} /><MetricCard label="Equipment Type" value={equipment.type} status="normal" /><MetricCard label="Status" value={equipment.isActive ? "Active" : "Inactive"} status={equipment.isActive ? "normal" : "warning"} /></div></div>
      <Card><CardHeader><CardTitle>Risk Factors</CardTitle></CardHeader><CardContent>{healthData?.pFail30d > 40 ? (<div className="space-y-2"><p className="text-sm font-medium">Elevated failure probability detected ({healthData.pFail30d.toFixed(1)}%)</p><ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">{healthData.pFail30d > 70 && <li>Critical failure risk within 30 days</li>}{healthData.healthScore < 50 && <li>Low health score indicates degradation</li>}{healthData.status === "critical" && <li>Equipment requires immediate attention</li>}</ul></div>) : <p className="text-sm text-muted-foreground">No significant risk factors detected at this time.</p>}</CardContent></Card>
    </div>
  );
}

function SensorsTab({ equipmentId }: { equipmentId: string }) {
  const { isWizardOpen, setIsWizardOpen, selectedSensorIds, deleteDialogOpen, setDeleteDialogOpen, sensorConfigs, equipment, isLoading, deleteMutation: _deleteMutation, enableMutation, disableMutation, handleWizardSuccess, handleSelectAll, handleSelectSensor, handleBulkDelete, confirmDelete, selectedSensors, isBulkOperationDisabled } = useSensorsTabData(equipmentId);
  if (isLoading) {return <LoadingState variant="card" />;}
  return (
    <>
      <Card>
        <CardHeader><div className="flex items-center justify-between"><CardTitle>Active Sensors</CardTitle><Button onClick={() => setIsWizardOpen(true)} variant="default" size="sm" data-testid="button-configure-sensors"><Settings className="h-4 w-4 mr-2" />Configure Sensors</Button></div></CardHeader>
        <CardContent>
          {sensorConfigs?.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader><TableRow><TableHead className="w-12"><Checkbox checked={selectedSensorIds.length === sensorConfigs.length && sensorConfigs.length > 0} onCheckedChange={handleSelectAll} disabled={isBulkOperationDisabled} data-testid="checkbox-select-all" /></TableHead><TableHead>Sensor Type</TableHead><TableHead>Target Unit</TableHead><TableHead>Status</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
                <TableBody>{sensorConfigs.map((sensor) => (<TableRow key={sensor.id} data-testid={`sensor-row-${sensor.sensorType}`}><TableCell><Checkbox checked={selectedSensorIds.includes(sensor.id)} onCheckedChange={(checked) => handleSelectSensor(sensor.id, checked as boolean)} disabled={isBulkOperationDisabled} data-testid={`checkbox-sensor-${sensor.sensorType}`} /></TableCell><TableCell className="font-medium">{sensor.sensorType}</TableCell><TableCell>{sensor.targetUnit || sensor.unit || "N/A"}</TableCell><TableCell><StatusBadge status={sensor.enabled === false ? "offline" : "online"} /></TableCell><TableCell className="text-sm text-muted-foreground">{sensor.notes || "-"}</TableCell></TableRow>))}</TableBody>
              </Table>
            </div>
          ) : <div className="text-center py-8"><Gauge className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" /><p className="text-muted-foreground">No sensors configured for this equipment.</p><p className="text-sm text-muted-foreground mt-2">Click "Configure Sensors" to set up sensor monitoring.</p></div>}
        </CardContent>
      </Card>
      {equipment && <SensorSetupWizard open={isWizardOpen} onClose={() => setIsWizardOpen(false)} equipment={{ id: equipment.id, name: equipment.name, type: equipment.type, status: equipment.status || (equipment.isActive ? "active" : "inactive"), location: equipment.location || "Unknown" }} onSuccess={handleWizardSuccess} />}
      <BulkSelectionBar selectedCount={selectedSensorIds.length} onDelete={isBulkOperationDisabled ? undefined : handleBulkDelete} onEnable={isBulkOperationDisabled ? undefined : () => enableMutation.mutate(selectedSensorIds)} onDisable={isBulkOperationDisabled ? undefined : () => disableMutation.mutate(selectedSensorIds)} onClear={() => {}} />
      <ConfirmDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} onConfirm={confirmDelete} title="Delete sensors" description={<div className="space-y-2"><p>Are you sure you want to delete {selectedSensors.length} {selectedSensors.length === 1 ? "sensor" : "sensors"}? This action cannot be undone.</p><div className="mt-3 p-3 bg-muted rounded-md"><p className="text-sm font-medium mb-2">Sensors to be deleted:</p><ul className="text-sm space-y-1">{selectedSensors.map((sensor) => (<li key={sensor.id} className="flex items-center gap-2"><span className="font-mono text-xs">{sensor.sensorType}</span><span className="text-muted-foreground">({sensor.targetUnit || sensor.unit})</span></li>))}</ul></div></div>} confirmText="Delete" cancelText="Cancel" />
    </>
  );
}

function AnomaliesTab({ equipmentId }: { equipmentId: string }) {
  const { anomalies, isLoading } = useAnomaliesTabData(equipmentId);
  if (isLoading) {return <LoadingState variant="card" />;}
  return (
    <Card>
      <CardHeader><CardTitle>Anomaly Detections</CardTitle></CardHeader>
      <CardContent>{anomalies?.length > 0 ? (<div className="space-y-3">{anomalies.map((anomaly) => (<div key={anomaly.id} className="p-4 border rounded-lg space-y-2"><div className="flex items-center justify-between"><p className="font-medium">{anomaly.sensorKind}</p><StatusBadge status={anomaly.severity || "info"} /></div><p className="text-sm text-muted-foreground">{anomaly.description || "Anomaly detected"}</p></div>))}</div>) : <p className="text-muted-foreground">No anomalies detected for this equipment.</p>}</CardContent>
    </Card>
  );
}

function MaintenanceHistoryTab({ equipmentId }: { equipmentId: string }) {
  const { workOrders, isLoading } = useMaintenanceHistoryTabData(equipmentId);
  if (isLoading) {return <LoadingState variant="card" />;}
  return (
    <Card>
      <CardHeader><CardTitle>Work Order History</CardTitle></CardHeader>
      <CardContent>{workOrders?.length > 0 ? (<div className="space-y-3">{workOrders.map((wo) => (<div key={wo.id} className="p-4 border rounded-lg space-y-2"><div className="flex items-center justify-between"><p className="font-medium">{wo.reason || wo.description}</p><StatusBadge status={wo.status || "pending"} /></div><p className="text-sm text-muted-foreground">Type: {wo.maintenanceType}</p></div>))}</div>) : <p className="text-muted-foreground">No maintenance history for this equipment.</p>}</CardContent>
    </Card>
  );
}
