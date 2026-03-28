import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusIndicator } from "@/components/status-indicator";
import { HealthIndexTooltip } from "@/components/HealthLegend";
import { Eye, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Device {
  id: string;
  vessel?: string;
  status: string;
  lastHeartbeat?: {
    cpuPct?: number;
    memPct?: number;
    ts?: string;
  };
}

export function DevicesTable({ devices, isLoading }: { devices: Device[]; isLoading: boolean }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Device ID</TableHead>
            <TableHead>Vessel</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>CPU</TableHead>
            <TableHead>Memory</TableHead>
            <TableHead>Last Heartbeat</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Loading devices...
              </TableCell>
            </TableRow>
          ) : (
            devices?.map((device) => (
              <TableRow key={device.id} className="hover:bg-muted">
                <TableCell className="font-mono text-sm" data-testid={`device-id-${device.id}`}>
                  {device.id}
                </TableCell>
                <TableCell data-testid={`device-vessel-${device.id}`}>
                  {device.vessel || "Unknown"}
                </TableCell>
                <TableCell>
                  <StatusIndicator status={device.status} showLabel />
                </TableCell>
                <TableCell data-testid={`device-cpu-${device.id}`}>
                  {device.lastHeartbeat?.cpuPct ? `${device.lastHeartbeat.cpuPct}%` : "–"}
                </TableCell>
                <TableCell data-testid={`device-memory-${device.id}`}>
                  {device.lastHeartbeat?.memPct ? `${device.lastHeartbeat.memPct}%` : "–"}
                </TableCell>
                <TableCell data-testid={`device-heartbeat-${device.id}`}>
                  {device.lastHeartbeat?.ts
                    ? formatDistanceToNow(new Date(device.lastHeartbeat.ts), { addSuffix: true })
                    : "Never"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

interface TelemetryReading {
  equipmentId: string;
  sensorType: string;
  value?: number;
  unit?: string;
  status?: string;
  ts?: string;
}

function getReadingStatusClassName(status?: string): string {
  switch (status?.toLowerCase()) {
    case "normal": return "bg-green-500/10 text-green-500";
    case "warning": return "bg-yellow-500/10 text-yellow-500";
    case "critical": return "bg-destructive/10 text-destructive";
    default: return "bg-muted text-muted-foreground";
  }
}

export function TelemetryTable({
  readings,
  isLoading,
  getEquipmentName,
}: {
  readings: TelemetryReading[];
  isLoading: boolean;
  getEquipmentName: (id: string) => string;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Equipment</TableHead>
            <TableHead>Sensor</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-muted-foreground">
                Loading telemetry...
              </TableCell>
            </TableRow>
          ) : (
            readings?.map((reading, i) => (
              <TableRow key={`${reading.equipmentId}-${reading.sensorType}-${i}`} className="hover:bg-muted">
                <TableCell data-testid={`telemetry-equipment-${i}`}>
                  {getEquipmentName(reading.equipmentId)}
                </TableCell>
                <TableCell data-testid={`telemetry-sensor-${i}`}>
                  {reading.sensorType}
                </TableCell>
                <TableCell data-testid={`telemetry-value-${i}`}>
                  {reading.value != null ? `${reading.value} ${reading.unit || ""}`.trim() : "–"}
                </TableCell>
                <TableCell>
                  <span className={`px-2 py-1 text-xs rounded-full ${getReadingStatusClassName(reading.status)}`}>
                    {reading.status || "Unknown"}
                  </span>
                </TableCell>
                <TableCell data-testid={`telemetry-ts-${i}`}>
                  {reading.ts
                    ? formatDistanceToNow(new Date(reading.ts), { addSuffix: true })
                    : "–"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

interface EquipmentHealth {
  id: string;
  name: string;
  healthIndex?: number;
  status?: string;
  riskLevel?: string;
}

export function EquipmentHealthList({
  equipment,
  isLoading,
  isFocusMode = false,
}: {
  equipment: EquipmentHealth[];
  isLoading: boolean;
  isFocusMode?: boolean;
}) {
  const displayItems = isFocusMode ? equipment?.slice(0, 5) : equipment;

  return (
    <div className="space-y-2">
      {isLoading ? (
        <div className="text-center text-muted-foreground py-4">Loading equipment health...</div>
      ) : (
        displayItems?.map((eq) => (
          <div
            key={eq.id}
            className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted transition-colors"
            data-testid={`equipment-health-${eq.id}`}
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{eq.name}</div>
              <div className="text-xs text-muted-foreground">{eq.status || "Unknown"}</div>
            </div>
            {eq.healthIndex != null && (
              <HealthIndexTooltip value={eq.healthIndex} />
            )}
          </div>
        ))
      )}
    </div>
  );
}

interface WorkOrder {
  id: string;
  workOrderNumber?: string;
  equipmentId: string;
  priority?: number;
  status: string;
  createdAt: string;
}

function getPriorityClassName(priority?: number): string {
  switch (priority) {
    case 1: return "bg-destructive/10 text-destructive";
    case 2: return "bg-yellow-500/10 text-yellow-600";
    case 3: return "bg-blue-500/10 text-blue-600";
    default: return "bg-muted text-muted-foreground";
  }
}

function getPriorityText(priority?: number): string {
  switch (priority) {
    case 1: return "Critical";
    case 2: return "High";
    case 3: return "Medium";
    default: return "Low";
  }
}

export function WorkOrdersTable({
  workOrders,
  isLoading,
  isFocusMode = false,
  getEquipmentName,
}: {
  workOrders: WorkOrder[];
  isLoading: boolean;
  isFocusMode?: boolean;
  getEquipmentName: (id: string) => string;
}) {
  const displayOrders = isFocusMode ? workOrders?.slice(0, 10) : workOrders;

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order ID</TableHead>
            <TableHead>Equipment</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                Loading work orders...
              </TableCell>
            </TableRow>
          ) : (
            displayOrders?.map((order) => (
              <TableRow key={order.id} className="hover:bg-muted">
                <TableCell className="font-mono text-sm" data-testid={`work-order-id-${order.id}`}>
                  {order.workOrderNumber || order.id}
                </TableCell>
                <TableCell data-testid={`work-order-equipment-${order.id}`}>
                  {getEquipmentName(order.equipmentId)}
                </TableCell>
                <TableCell>
                  <span className={`px-2 py-1 text-xs rounded-full ${getPriorityClassName(order.priority)}`}>
                    {getPriorityText(order.priority)}
                  </span>
                </TableCell>
                <TableCell data-testid={`work-order-status-${order.id}`}>
                  {order.status}
                </TableCell>
                <TableCell data-testid={`work-order-created-${order.id}`}>
                  {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
