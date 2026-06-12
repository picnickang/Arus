import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Activity,
  Brain,
  Database,
  Download,
  FileJson,
  FileSpreadsheet,
  Info,
  TrendingUp,
} from "lucide-react";
import type { MLTrainingData } from "./ml-training-types";

interface MLTrainingExportCardProps {
  training: MLTrainingData;
}

export function MLTrainingExportCard({ training: t }: MLTrainingExportCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Export ML/PDM Data
        </CardTitle>
        <CardDescription>
          Export machine learning models, predictions, and telemetry data in industry-standard
          formats for use in competing applications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-900 dark:text-blue-100">
            <strong>Data Portability:</strong> Export your ML/PDM data to migrate to IBM Maximo,
            Azure IoT, SAP PM, or any competing predictive maintenance platform. All exports include
            tier metadata and are compatible with industry-standard tools.
          </AlertDescription>
        </Alert>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4" />
                Complete ML/PDM Package
              </CardTitle>
              <CardDescription className="text-xs">
                JSON: All datasets. CSV: ML models only
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2">
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={() => t.exportData("complete-json")}
                  data-testid="button-export-complete-json"
                >
                  <FileJson className="h-4 w-4 mr-2" />
                  JSON (All)
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => t.exportData("complete-csv")}
                  data-testid="button-export-complete-csv"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  CSV (Models)
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-4 w-4" />
                ML Models Only
              </CardTitle>
              <CardDescription className="text-xs">
                Trained models with tier metadata and performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2">
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={() => t.exportData("models-json")}
                  data-testid="button-export-models-json"
                >
                  <FileJson className="h-4 w-4 mr-2" />
                  JSON
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => t.exportData("models-csv")}
                  data-testid="button-export-models-csv"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  CSV
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Predictions & History
              </CardTitle>
              <CardDescription className="text-xs">
                Failure predictions, RUL estimates, and historical failures
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2">
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={() => t.exportData("predictions-json")}
                  data-testid="button-export-predictions-json"
                >
                  <FileJson className="h-4 w-4 mr-2" />
                  JSON
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => t.exportData("predictions-csv")}
                  data-testid="button-export-predictions-csv"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  CSV
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Telemetry Data
              </CardTitle>
              <CardDescription className="text-xs">
                Historical sensor data for ML training (up to 50k records)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-2">
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={() => t.exportData("telemetry-json")}
                  data-testid="button-export-telemetry-json"
                >
                  <FileJson className="h-4 w-4 mr-2" />
                  JSON
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => t.exportData("telemetry-csv")}
                  data-testid="button-export-telemetry-csv"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  CSV
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Export Formats:</strong> JSON format includes all datasets (raw telemetry,
            models, predictions, anomalies, thresholds, PDM scores) - use for complete platform
            migration or training models in external systems. CSV format contains ML models only with
            full tier metadata - use for spreadsheet analysis in Excel, Pandas, or BI tools. Raw
            telemetry data enables competing platforms to train their own predictive models.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
