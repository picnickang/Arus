import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  Info,
  Loader2,
  Trash2,
} from "lucide-react";
import type { TrainingDataState } from "./TrainingTabTypes";

interface ManagementSectionProps {
  training: TrainingDataState;
}

export function TrainedModelsSection({ training: t }: ManagementSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Trained ML Models
        </CardTitle>
        <CardDescription>View and manage your trained machine learning models</CardDescription>
      </CardHeader>
      <CardContent>
        {t.isLoadingModels ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : t.mlModels.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Database className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No trained models yet</p>
            <p className="text-sm mt-1">Train an LSTM or Random Forest model to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Equipment</TableHead>
                  <TableHead>Performance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {t.mlModels.map((modelRow) => {
                  const model = modelRow as Record<string, unknown> & {
                    id: string;
                    name?: string;
                    modelType?: string;
                    status?: string;
                    accuracy?: number | null;
                    createdAt?: string | Date | null;
                    hyperparameters?: { dataQualityTier?: string } | null;
                    equipmentType?: string | null;
                    targetEquipmentType?: string | null;
                    performance?: { accuracy?: number } | null;
                  };
                  return (
                    <TableRow key={model.id}>
                      <TableCell className="font-medium">{model.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {model.modelType === "failure_prediction"
                            ? "LSTM"
                            : model.modelType === "health_classification"
                              ? "Random Forest"
                              : model.modelType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(model.targetEquipmentType as string | undefined) || "All"}
                      </TableCell>
                      <TableCell>
                        {model.performance?.accuracy ? (
                          <span className="text-sm">
                            {(model.performance.accuracy * 100).toFixed(1)}% accuracy
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">N/A</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {model.status === "active" ? (
                          <Badge variant="default" className="bg-green-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary">{model.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {model.createdAt ? new Date(model.createdAt).toLocaleDateString() : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DataExportSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Export ML/PDM Data
        </CardTitle>
        <CardDescription>
          Export machine learning models and predictions for external use
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-blue-900 dark:text-blue-100">
            <strong>Data Portability:</strong> Export your ML/PDM data to migrate to IBM Maximo,
            Azure IoT, SAP PM, or other platforms.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

export function ResetTrainingDataSection({ training: t }: ManagementSectionProps) {
  return (
    <>
      <Alert variant="destructive" className="border-2">
        <AlertTriangle className="h-5 w-5" />
        <AlertDescription className="text-lg font-semibold">
          DESTRUCTIVE OPERATION - USE WITH CAUTION
        </AlertDescription>
      </Alert>

      <Card className="border-destructive border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Reset ML Training Data
          </CardTitle>
          <CardDescription>
            Permanently delete synthetic telemetry data and optionally trained models
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-700">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-900 dark:text-amber-100">
              <strong>When to use this:</strong> This reset function is designed for development and
              testing.
            </AlertDescription>
          </Alert>

          <div className="space-y-4 p-4 bg-muted rounded-lg">
            <h3 className="font-semibold text-destructive">What will be deleted:</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-destructive">-</span>
                <span>
                  <strong>All telemetry records</strong> for your organization
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive">-</span>
                <span>
                  <strong>All failure predictions</strong> generated by ML models
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive">-</span>
                <span>
                  <strong>All anomaly detections</strong> from monitoring systems
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-destructive">-</span>
                <span>
                  <strong>Optionally:</strong> All trained ML models
                </span>
              </li>
            </ul>
          </div>

          <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-900 dark:text-blue-100">
              <strong>What is preserved:</strong> Equipment records, sensor configurations, alert
              settings, and maintenance schedules remain intact.
            </AlertDescription>
          </Alert>

          <div className="pt-4 space-y-3">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="lg"
                  className="w-full"
                  disabled={t.resetMLData.isPending}
                  data-testid="button-reset-ml-data-keep-models"
                >
                  {t.resetMLData.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-5 w-5" />
                      Reset Training Data (Keep Models)
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    Confirm ML Data Reset
                  </AlertDialogTitle>
                  <AlertDialogDescription className="space-y-3 pt-2">
                    <p className="font-semibold">
                      This will permanently delete all telemetry, predictions, and anomaly data.
                    </p>
                    <p>Trained ML models will be preserved.</p>
                    <p className="text-destructive font-semibold">This action cannot be undone.</p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => t.resetMLData.mutate({ deleteModels: false })}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, Delete Training Data
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  disabled={t.resetMLData.isPending}
                  data-testid="button-reset-ml-data-delete-models"
                >
                  {t.resetMLData.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-5 w-5" />
                      Reset Everything (Including Models)
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    Confirm Complete Reset
                  </AlertDialogTitle>
                  <AlertDialogDescription className="space-y-3 pt-2">
                    <p className="font-semibold text-destructive">
                      This will permanently delete ALL ML data including trained models.
                    </p>
                    <p className="text-destructive font-bold">
                      This action cannot be undone. Are you absolutely sure?
                    </p>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => t.resetMLData.mutate({ deleteModels: true })}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, Delete Everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
