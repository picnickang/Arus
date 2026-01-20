/**
 * ML & Testing Tools Tab Component
 * 
 * Administrative tools for ML testing and calibration.
 * Extracted from system-administration.tsx for better maintainability.
 */

import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Beaker, Ship, Settings } from "lucide-react";
import { VesselSimulatorCard } from "./VesselSimulatorCard";
import { ThresholdCalibratorCard } from "./ThresholdCalibratorCard";

function MLTestingToolsTabComponent() {
  return (
    <div className="space-y-6" data-testid="ml-testing-tools-container">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <VesselSimulatorCard />
        <ThresholdCalibratorCard />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Beaker className="h-5 w-5 text-primary" />
            <span>About These Tools</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium flex items-center space-x-2">
                <Ship className="h-4 w-4 text-muted-foreground" />
                <span>Vessel Simulator</span>
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Generate realistic synthetic telemetry data</li>
                <li>11 vessel type presets with physics-based models</li>
                <li>Configurable sea states and fault injection</li>
                <li>Use for ML training data augmentation</li>
                <li>Test system behavior without real vessels</li>
              </ul>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium flex items-center space-x-2">
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span>Threshold Calibrator</span>
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Automatically tune prediction thresholds</li>
                <li>Based on historical performance data</li>
                <li>Reduces false positives and improves accuracy</li>
                <li>Equipment-specific calibration</li>
                <li>Percentile-based threshold selection</li>
              </ul>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Note:</strong> These are advanced administrative
              tools. Generated data and calibrations will affect production predictions and ML
              training. Use with caution and monitor results carefully.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export const MLTestingToolsTab = memo(MLTestingToolsTabComponent);
