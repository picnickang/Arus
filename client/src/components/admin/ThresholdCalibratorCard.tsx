/**
 * Threshold Calibrator Card Component
 *
 * Admin tool for calibrating prediction thresholds based on historical data.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Settings2, TrendingUp, CheckCircle, AlertCircle, Activity } from "lucide-react";
import { adminApiRequest } from "@/lib/admin-api";
import { formatNumber } from "@/lib/formatters";

interface Equipment {
  id: string;
  name: string;
  type: string;
  vesselId?: string;
}

interface CalibrationResult {
  success: boolean;
  message: string;
  equipmentId?: string | undefined;
  equipmentType?: string | undefined;
  percentile?: number | undefined;
  calibratedThreshold?: number | undefined;
  previousThreshold?: number | undefined;
  samplesAnalyzed?: number | undefined;
}

export function ThresholdCalibratorCard() {
  const { toast } = useToast();
  const [selectedEquipment, setSelectedEquipment] = useState("");
  const [percentile, setPercentile] = useState([95]);
  const [calibrating, setCalibrating] = useState(false);
  const [lastResult, setLastResult] = useState<CalibrationResult | null>(null);

  const { data: equipment = [], isLoading: loadingEquipment } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
    select: (data) => data ?? [],
  });

  const handleCalibrate = async () => {
    if (!selectedEquipment) {
      toast({
        title: "Equipment required",
        description: "Please select equipment to calibrate thresholds",
        variant: "destructive",
      });
      return;
    }

    const selectedEq = equipment.find((e) => e.id === selectedEquipment);
    if (!selectedEq) {
      return;
    }

    try {
      setCalibrating(true);
      setLastResult(null);

      const payload = {
        equipmentId: selectedEquipment,
        equipmentType: selectedEq.type,
        percentile: percentile[0],
        orgId: "default-org-id",
      };

      const result = await adminApiRequest<{
        message?: string;
        equipmentId?: string;
        equipmentType?: string;
        percentile?: number;
        calibratedThreshold?: number;
        previousThreshold?: number;
        samplesAnalyzed?: number;
      }>("POST", "/api/admin/calibrate-threshold", payload);

      setLastResult({
        success: true,
        message: result.message || "Threshold calibrated successfully",
        equipmentId: result.equipmentId,
        equipmentType: result.equipmentType,
        percentile: result.percentile,
        calibratedThreshold: result.calibratedThreshold,
        previousThreshold: result.previousThreshold,
        samplesAnalyzed: result.samplesAnalyzed,
      });

      toast({
        title: "Calibration Complete",
        description: `Threshold set to ${result.calibratedThreshold?.toFixed(3)} (${result.percentile}th percentile)`,
      });
    } catch (error) {
      setLastResult({
        success: false,
        message: (error as Error).message || "Calibration failed",
      });
      toast({
        title: "Calibration Failed",
        description: (error as Error).message,
        variant: "destructive",
      });
    } finally {
      setCalibrating(false);
    }
  };

  const selectedEq = equipment.find((e) => e.id === selectedEquipment);

  return (
    <Card data-testid="card-threshold-calibrator">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Settings2 className="h-5 w-5 text-primary" />
          <CardTitle>ML Threshold Calibrator</CardTitle>
        </div>
        <CardDescription>
          Automatically calibrate prediction thresholds based on historical performance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="equipment-select">Equipment</Label>
          <Select
            value={selectedEquipment}
            onValueChange={setSelectedEquipment}
            disabled={loadingEquipment}
          >
            <SelectTrigger id="equipment-select" data-testid="select-equipment">
              <SelectValue placeholder="Select equipment to calibrate" />
            </SelectTrigger>
            <SelectContent>
              {equipment.map((eq) => (
                <SelectItem key={eq.id} value={eq.id} data-testid={`option-equipment-${eq.id}`}>
                  {eq.name} ({eq.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Percentile Threshold</Label>
            <Badge variant="outline" data-testid="badge-percentile">
              {percentile[0]}th percentile
            </Badge>
          </div>
          <Slider
            value={percentile}
            onValueChange={setPercentile}
            min={80}
            max={99}
            step={1}
            className="w-full"
            data-testid="slider-percentile"
          />
          <p className="text-xs text-muted-foreground">
            Higher percentiles are more conservative (fewer false positives)
          </p>
        </div>

        {selectedEq && (
          <Alert data-testid="alert-equipment-info">
            <Activity className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-medium">Selected Equipment:</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{selectedEq.name}</Badge>
                  <Badge variant="outline">{selectedEq.type}</Badge>
                  {selectedEq.vesselId && (
                    <Badge variant="outline">Vessel: {selectedEq.vesselId}</Badge>
                  )}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {lastResult && (
          <Alert
            variant={lastResult.success ? "default" : "destructive"}
            data-testid="alert-calibration-result"
          >
            {lastResult.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">{lastResult.message}</p>
                {lastResult.success && (
                  <div className="space-y-1 text-sm">
                    {lastResult.previousThreshold !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Previous:</span>
                        <Badge variant="outline">{lastResult.previousThreshold.toFixed(3)}</Badge>
                      </div>
                    )}
                    {lastResult.calibratedThreshold !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">New Threshold:</span>
                        <Badge variant="default">{lastResult.calibratedThreshold.toFixed(3)}</Badge>
                      </div>
                    )}
                    {lastResult.samplesAnalyzed !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Samples Analyzed:</span>
                        <Badge variant="secondary">
                          {formatNumber(lastResult.samplesAnalyzed)}
                        </Badge>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        <Button
          onClick={handleCalibrate}
          disabled={calibrating || !selectedEquipment}
          className="w-full"
          data-testid="button-calibrate"
        >
          <TrendingUp className="mr-2 h-4 w-4" />
          {calibrating ? "Calibrating..." : "Calibrate Threshold"}
        </Button>

        <div className="text-xs text-muted-foreground pt-2 border-t">
          <p className="font-medium mb-1">How It Works:</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Analyzes historical prediction scores for selected equipment</li>
            <li>Calculates threshold at specified percentile (default 95%)</li>
            <li>Stores calibrated threshold in equipment specifications</li>
            <li>Used by real-time prediction engine for more accurate alerts</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
