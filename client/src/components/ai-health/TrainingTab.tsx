/**
 * Training Tab
 *
 * ML model training interface with admin controls.
 * Includes LSTM, Random Forest, Acoustic analysis, and data management.
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
import { InfoTooltip } from "@/components/ui/info-tooltip";
import {
  Brain,
  Loader2,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Activity,
  Radio,
  Play,
  Database,
  Info,
  Download,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { useTrainingData } from "@/features/ml-ai";

export default function TrainingTab() {
  const t = useTrainingData();

  return (
    <div className="space-y-6">
      <Tabs defaultValue="lstm" className="space-y-4">
        <div className="overflow-x-auto pb-2">
          <TabsList className="inline-flex w-full min-w-fit p-1 gap-1">
            <TabsTrigger
              value="lstm"
              className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px]"
              data-testid="tab-lstm"
            >
              <Brain className="h-4 w-4 mr-2" />
              <span>LSTM Training</span>
            </TabsTrigger>
            <TabsTrigger
              value="rf"
              className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px]"
              data-testid="tab-random-forest"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              <span>Random Forest</span>
            </TabsTrigger>
            <TabsTrigger
              value="acoustic"
              className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px]"
              data-testid="tab-acoustic"
            >
              <Radio className="h-4 w-4 mr-2" />
              <span>Acoustic Analysis</span>
            </TabsTrigger>
            <TabsTrigger
              value="models"
              className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px]"
              data-testid="tab-models"
            >
              <Database className="h-4 w-4 mr-2" />
              <span>Trained Models</span>
            </TabsTrigger>
            <TabsTrigger
              value="reset"
              className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] text-destructive"
              data-testid="tab-reset-data"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              <span>Reset Data</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="lstm" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                LSTM Training
                <InfoTooltip content="LSTM (Long Short-Term Memory) - An AI that learns patterns in equipment data over time to predict failures." />
              </CardTitle>
              <CardDescription>
                Teach the AI to recognize patterns in equipment data over time
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-900 dark:text-blue-100">
                  <strong>Smart Adaptive Training:</strong> The system automatically uses optimal
                  training data range based on available history.
                </AlertDescription>
              </Alert>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="lstm-equipment-type">Equipment Type (Optional)</Label>
                  <Select
                    value={t.selectedEquipmentType}
                    onValueChange={t.setSelectedEquipmentType}
                  >
                    <SelectTrigger id="lstm-equipment-type" data-testid="select-lstm-equipment">
                      <SelectValue placeholder="All Equipment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Equipment</SelectItem>
                      {t.uniqueEquipmentTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lstm-epochs">Training Epochs</Label>
                  <Input
                    id="lstm-epochs"
                    type="number"
                    defaultValue="50"
                    min="10"
                    max="200"
                    data-testid="input-lstm-epochs"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lstm-sequence">Sequence Length</Label>
                  <Input
                    id="lstm-sequence"
                    type="number"
                    defaultValue="10"
                    min="5"
                    max="50"
                    data-testid="input-lstm-sequence"
                  />
                </div>
              </div>

              <Button
                onClick={t.handleTrainLSTM}
                disabled={t.trainLSTM.isPending}
                className="w-full"
                data-testid="button-train-lstm"
              >
                {t.trainLSTM.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Training LSTM Model...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Train LSTM Model
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rf" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Random Forest Training
                <InfoTooltip content="Random Forest - An AI that classifies equipment health status based on current sensor readings." />
              </CardTitle>
              <CardDescription>
                Teach the AI to assess equipment health by analyzing current sensor data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-900 dark:text-blue-100">
                  <strong>Smart Adaptive Training:</strong> Uses optimal data range automatically
                  (90-730 days based on availability).
                </AlertDescription>
              </Alert>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="rf-equipment-type">Equipment Type (Optional)</Label>
                  <Select
                    value={t.selectedEquipmentType}
                    onValueChange={t.setSelectedEquipmentType}
                  >
                    <SelectTrigger id="rf-equipment-type" data-testid="select-rf-equipment">
                      <SelectValue placeholder="All Equipment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Equipment</SelectItem>
                      {t.uniqueEquipmentTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rf-trees">Number of Trees</Label>
                  <Input
                    id="rf-trees"
                    type="number"
                    defaultValue="50"
                    min="10"
                    max="200"
                    data-testid="input-rf-trees"
                  />
                </div>
              </div>

              <Button
                onClick={t.handleTrainRandomForest}
                disabled={t.trainRandomForest.isPending}
                className="w-full"
                data-testid="button-train-rf"
              >
                {t.trainRandomForest.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Training Random Forest...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Train Random Forest Model
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="acoustic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Radio className="h-5 w-5" />
                Acoustic Monitoring Analysis
              </CardTitle>
              <CardDescription>
                Analyze acoustic waveforms for frequency signatures and anomaly detection
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Acoustic analysis uses FFT to extract frequency signatures and detect abnormal
                  sound patterns.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="acoustic-data">
                  Acoustic Waveform Data (comma-separated values)
                </Label>
                <Textarea
                  id="acoustic-data"
                  placeholder="0.1, 0.2, -0.1, 0.3, -0.2, 0.15, -0.05, 0.25..."
                  value={t.acousticData}
                  onChange={(e) => t.setAcousticData(e.target.value)}
                  rows={4}
                  data-testid="input-acoustic-data"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sample-rate">Sample Rate (Hz)</Label>
                  <Input
                    id="sample-rate"
                    type="number"
                    value={t.sampleRate}
                    onChange={(e) => t.setSampleRate(e.target.value)}
                    data-testid="input-sample-rate"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rpm">RPM (Optional)</Label>
                  <Input
                    id="rpm"
                    type="number"
                    value={t.rpm}
                    onChange={(e) => t.setRpm(e.target.value)}
                    placeholder="e.g., 1800"
                    data-testid="input-rpm"
                  />
                </div>
              </div>

              <Button
                onClick={() => t.analyzeAcoustic.mutate()}
                disabled={t.analyzeAcoustic.isPending || !t.acousticData}
                className="w-full"
                data-testid="button-analyze-acoustic"
              >
                {t.analyzeAcoustic.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Activity className="h-4 w-4 mr-2" />
                    Analyze Acoustic Data
                  </>
                )}
              </Button>

              {t.acousticResults && (
                <Card className="mt-4 bg-muted/50">
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      Analysis Results
                      <Badge
                        variant={
                          t.acousticResults.severity === "critical"
                            ? "destructive"
                            : t.acousticResults.severity === "warning"
                              ? "default"
                              : "outline"
                        }
                      >
                        {t.acousticResults.severity}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="text-sm font-medium mb-2">Health Score</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-muted rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${t.acousticResults.healthScore ?? 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium">
                          {(t.acousticResults.healthScore ?? 0).toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    {t.acousticResults.features && (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">RMS Level:</span>
                          <span className="ml-2 font-medium">
                            {t.acousticResults.features.rms?.toFixed(3)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Peak Amplitude:</span>
                          <span className="ml-2 font-medium">
                            {t.acousticResults.features.peakAmplitude?.toFixed(3)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Dominant Frequency:</span>
                          <span className="ml-2 font-medium">
                            {t.acousticResults.features.dominantFrequency?.toFixed(1)} Hz
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">SNR:</span>
                          <span className="ml-2 font-medium">
                            {t.acousticResults.features.snr?.toFixed(1)} dB
                          </span>
                        </div>
                      </div>
                    )}

                    {t.acousticResults.primaryIssues?.length > 0 && (
                      <div>
                        <div className="text-sm font-medium mb-2">Primary Issues</div>
                        <ul className="space-y-1">
                          {t.acousticResults.primaryIssues.map((issue: string, i: number) => (
                            <li
                              key={i}
                              className="text-sm text-muted-foreground flex items-start gap-2"
                            >
                              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                              {issue}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {t.acousticResults.recommendations?.length > 0 && (
                      <div>
                        <div className="text-sm font-medium mb-2">Recommendations</div>
                        <ul className="space-y-1">
                          {t.acousticResults.recommendations.map((rec: string, i: number) => (
                            <li
                              key={i}
                              className="text-sm text-muted-foreground flex items-start gap-2"
                            >
                              <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-600" />
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Trained ML Models
              </CardTitle>
              <CardDescription>
                View and manage your trained machine learning models
              </CardDescription>
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
                  <p className="text-sm mt-1">
                    Train an LSTM or Random Forest model to get started
                  </p>
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
                        const tier = model.hyperparameters?.dataQualityTier;
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
                            <TableCell>{(model.targetEquipmentType as string | undefined) || "All"}</TableCell>
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
                  <strong>Data Portability:</strong> Export your ML/PDM data to migrate to IBM
                  Maximo, Azure IoT, SAP PM, or other platforms.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reset" className="space-y-4">
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
                  <strong>When to use this:</strong> This reset function is designed for development
                  and testing.
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
                  <strong>What is preserved:</strong> Equipment records, sensor configurations,
                  alert settings, and maintenance schedules remain intact.
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
                        <p className="text-destructive font-semibold">
                          This action cannot be undone.
                        </p>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
