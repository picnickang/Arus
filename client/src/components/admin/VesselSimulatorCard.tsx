// @ts-nocheck
/**
 * Vessel Simulator Card Component
 *
 * Admin tool for generating synthetic telemetry data for testing and ML training.
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Ship, Play, AlertCircle, CheckCircle, Waves } from "lucide-react";
import { adminApiRequest } from "@/lib/admin-api";

interface VesselType {
  id: string;
  name: string;
  description: string;
  sensors: string[];
}

interface SimulationResult {
  success: boolean;
  message: string;
  dataPointsGenerated?: number;
  telemetryRecordsCreated?: number;
  vesselType?: string;
  duration?: string;
}

export function VesselSimulatorCard() {
  const { toast } = useToast();
  const [vesselTypes, setVesselTypes] = useState<VesselType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);

  const [selectedVesselType, setSelectedVesselType] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [deviceId, setDeviceId] = useState("simulator-device");
  const [duration, setDuration] = useState(60);
  const [samplingInterval, setSamplingInterval] = useState(1);
  const [seaState, setSeaState] = useState(3);
  const [faultInjection, setFaultInjection] = useState(false);

  const [simulating, setSimulating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastResult, setLastResult] = useState<SimulationResult | null>(null);

  const loadVesselTypes = async () => {
    try {
      setLoadingTypes(true);
      const types = await adminApiRequest<VesselType[]>("GET", "/api/admin/vessel-types");
      setVesselTypes(types ?? []);
    } catch (error) {
      toast({
        title: "Failed to load vessel types",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setLoadingTypes(false);
    }
  };

  const handleSimulate = async () => {
    if (!selectedVesselType) {
      toast({
        title: "Vessel type required",
        description: "Please select a vessel type before generating data",
        variant: "destructive",
      });
      return;
    }

    if (!equipmentId) {
      toast({
        title: "Equipment ID required",
        description: "Please enter an equipment ID to associate with the telemetry",
        variant: "destructive",
      });
      return;
    }

    try {
      setSimulating(true);
      setProgress(10);
      setLastResult(null);

      const payload = {
        vesselType: selectedVesselType,
        equipmentId,
        deviceId,
        durationMinutes: duration,
        samplingIntervalSeconds: samplingInterval,
        seaState,
        faultInjection: faultInjection ? { type: "bearing_wear", severity: 0.3 } : undefined,
        orgId: "default-org-id",
      };

      setProgress(30);

      const result = await adminApiRequest<{
        message?: string;
        dataPoints?: number;
        telemetryRecords?: number;
        vesselType?: string;
        duration?: number;
      }>("POST", "/api/admin/simulate-telemetry", payload);

      setProgress(100);
      setLastResult({
        success: true,
        message: result.message || "Simulation completed successfully",
        dataPointsGenerated: result.dataPoints,
        telemetryRecordsCreated: result.telemetryRecords,
        vesselType: result.vesselType,
        duration: result.duration,
      });

      toast({
        title: "Simulation Complete",
        description: `Generated ${result.telemetryRecords || result.dataPoints} telemetry records`,
      });
    } catch (error) {
      setLastResult({
        success: false,
        message: (error as Error).message || "Simulation failed",
      });
      toast({
        title: "Simulation Failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setSimulating(false);
      setTimeout(() => setProgress(0), 2000);
    }
  };

  return (
    <Card data-testid="card-vessel-simulator">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Ship className="h-5 w-5 text-primary" />
            <CardTitle>Vessel Telemetry Simulator</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadVesselTypes}
            disabled={loadingTypes}
            data-testid="button-load-vessel-types"
          >
            {loadingTypes ? "Loading..." : "Load Vessel Types"}
          </Button>
        </div>
        <CardDescription>
          Generate physics-based synthetic telemetry data for testing and ML training
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="vessel-type">Vessel Type</Label>
            <Select
              value={selectedVesselType}
              onValueChange={setSelectedVesselType}
              disabled={vesselTypes.length === 0}
            >
              <SelectTrigger id="vessel-type" data-testid="select-vessel-type">
                <SelectValue placeholder="Select vessel type" />
              </SelectTrigger>
              <SelectContent>
                {vesselTypes.map((type) => (
                  <SelectItem
                    key={type.id}
                    value={type.id}
                    data-testid={`option-vessel-${type.id}`}
                  >
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {vesselTypes.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Click "Load Vessel Types" to see available options
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="equipment-id">Equipment ID</Label>
            <Input
              id="equipment-id"
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
              placeholder="e.g., main-engine-001"
              data-testid="input-equipment-id"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="device-id">Device ID</Label>
            <Input
              id="device-id"
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder="simulator-device"
              data-testid="input-device-id"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Duration (minutes)</Label>
            <Input
              id="duration"
              type="number"
              min="1"
              max="1440"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              data-testid="input-duration"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sampling">Sampling Interval (seconds)</Label>
            <Input
              id="sampling"
              type="number"
              min="1"
              max="60"
              value={samplingInterval}
              onChange={(e) => setSamplingInterval(Number(e.target.value))}
              data-testid="input-sampling"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sea-state">
              <div className="flex items-center space-x-2">
                <Waves className="h-4 w-4" />
                <span>Sea State (Douglas Scale)</span>
              </div>
            </Label>
            <Select value={seaState.toString()} onValueChange={(v) => setSeaState(Number(v))}>
              <SelectTrigger id="sea-state" data-testid="select-sea-state">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0 - Calm (glassy)</SelectItem>
                <SelectItem value="1">1 - Calm (rippled)</SelectItem>
                <SelectItem value="2">2 - Smooth (wavelets)</SelectItem>
                <SelectItem value="3">3 - Slight (1m waves)</SelectItem>
                <SelectItem value="4">4 - Moderate (2m waves)</SelectItem>
                <SelectItem value="5">5 - Rough (3m waves)</SelectItem>
                <SelectItem value="6">6 - Very rough (5m waves)</SelectItem>
                <SelectItem value="7">7 - High (7m waves)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center space-x-2 pt-2">
          <Switch
            id="fault-injection"
            checked={faultInjection}
            onCheckedChange={setFaultInjection}
            data-testid="switch-fault-injection"
          />
          <Label htmlFor="fault-injection" className="cursor-pointer">
            Enable Fault Injection (bearing wear simulation)
          </Label>
        </div>

        {progress > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Generating telemetry...</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} data-testid="progress-simulation" />
          </div>
        )}

        {lastResult && (
          <Alert
            variant={lastResult.success ? "default" : "destructive"}
            data-testid="alert-result"
          >
            {lastResult.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-medium">{lastResult.message}</p>
                {lastResult.success && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {lastResult.dataPointsGenerated && (
                      <Badge variant="secondary">
                        {lastResult.dataPointsGenerated} data points
                      </Badge>
                    )}
                    {lastResult.telemetryRecordsCreated && (
                      <Badge variant="secondary">
                        {lastResult.telemetryRecordsCreated} DB records
                      </Badge>
                    )}
                    {lastResult.vesselType && (
                      <Badge variant="outline">{lastResult.vesselType}</Badge>
                    )}
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleSimulate}
          disabled={simulating || !selectedVesselType || !equipmentId}
          className="w-full"
          data-testid="button-generate-telemetry"
        >
          <Play className="mr-2 h-4 w-4" />
          {simulating ? "Generating..." : "Generate Telemetry Data"}
        </Button>

        {selectedVesselType && vesselTypes.length > 0 && (
          <div className="text-sm text-muted-foreground pt-2 border-t">
            <p className="font-medium mb-1">Selected Vessel Info:</p>
            <p className="text-xs">
              {vesselTypes.find((v) => v.id === selectedVesselType)?.description}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
