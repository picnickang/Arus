// @ts-nocheck
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
  FileJson,
  Download,
  FileSpreadsheet,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { useTrainingData } from "@/features/ml-ai";

export default function MLTrainingPage() {
  const t = useTrainingData();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Tabs defaultValue="lstm" className="space-y-6">
        <div className="overflow-x-auto pb-2">
          <TabsList className="inline-flex w-full min-w-fit p-1 gap-1">
            <TabsTrigger
              value="lstm"
              data-testid="tab-lstm"
              className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[90px] sm:min-w-[110px] transition-all"
            >
              <Brain className="h-4 w-4 mr-2" />
              <span>LSTM Training</span>
            </TabsTrigger>
            <TabsTrigger
              value="rf"
              data-testid="tab-random-forest"
              className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[90px] sm:min-w-[110px] transition-all"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              <span>Random Forest</span>
            </TabsTrigger>
            <TabsTrigger
              value="acoustic"
              data-testid="tab-acoustic"
              className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[90px] sm:min-w-[110px] transition-all"
            >
              <Radio className="h-4 w-4 mr-2" />
              <span>Acoustic Analysis</span>
            </TabsTrigger>
            <TabsTrigger
              value="models"
              data-testid="tab-models"
              className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[90px] sm:min-w-[110px] transition-all"
            >
              <Database className="h-4 w-4 mr-2" />
              <span>Trained Models</span>
            </TabsTrigger>
            <TabsTrigger
              value="reset"
              data-testid="tab-reset-data"
              className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[90px] sm:min-w-[110px] transition-all text-destructive"
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
                <InfoTooltip content="LSTM (Long Short-Term Memory) - An AI that learns patterns in equipment data over time to predict when failures might happen. Best for detecting trends and patterns that develop gradually." />
              </CardTitle>
              <CardDescription>
                Teach the AI to recognize patterns in equipment data over time to predict failures
                before they happen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert
                className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
                data-testid="alert-adaptive-window"
              >
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-900 dark:text-blue-100">
                  <strong>Smart Adaptive Training:</strong> The system automatically uses optimal
                  training data range based on available history.
                  <div className="mt-2 text-sm space-y-1">
                    <div>
                      🥉 <strong>Bronze (90-180 days):</strong> Basic predictions
                    </div>
                    <div>
                      🥈 <strong>Silver (180-365 days):</strong> Good confidence
                    </div>
                    <div>
                      🥇 <strong>Gold (365-730 days):</strong> High confidence
                    </div>
                    <div>
                      💎 <strong>Platinum (730+ days):</strong> Exceptional confidence
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
              <Alert data-testid="alert-lstm-info">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  LSTM models learn patterns from historical telemetry data to predict equipment
                  failures. Requires at least 10 time-series samples with sequential sensor
                  readings.
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
                      <SelectItem value="all" data-testid="option-all-equipment">
                        All Equipment
                      </SelectItem>
                      {t.uniqueEquipmentTypes.map((type) => (
                        <SelectItem key={type} value={type} data-testid={`option-${type}`}>
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
                <InfoTooltip content="Random Forest - An AI that looks at current equipment conditions to classify health status (Healthy, At Risk, Critical). Best for quick health assessments based on current sensor readings." />
              </CardTitle>
              <CardDescription>
                Teach the AI to assess equipment health by analyzing current sensor data and
                conditions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert
                className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800"
                data-testid="alert-adaptive-window-rf"
              >
                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <AlertDescription className="text-blue-900 dark:text-blue-100">
                  <strong>Smart Adaptive Training:</strong> Uses optimal data range automatically
                  (90-730 days based on availability). Data quality tier affects prediction
                  confidence.
                </AlertDescription>
              </Alert>
              <Alert data-testid="alert-rf-info">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Random Forest models classify equipment health status based on aggregated sensor
                  statistics. Requires equipment with historical sensor data and maintenance
                  records.
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
                      <SelectItem value="all" data-testid="option-rf-all">
                        All Equipment
                      </SelectItem>
                      {t.uniqueEquipmentTypes.map((type) => (
                        <SelectItem key={type} value={type} data-testid={`option-rf-${type}`}>
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
              <Alert data-testid="alert-acoustic-info">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Acoustic analysis uses FFT to extract frequency signatures and detect abnormal
                  sound patterns that may indicate bearing wear, cavitation, or mechanical issues.
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
                <Card className="mt-4 bg-muted/50" data-testid="card-acoustic-results">
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
                        data-testid="badge-severity"
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
                            style={{ width: `${t.acousticResults.healthScore}%` }}
                            data-testid="progress-health-score"
                          />
                        </div>
                        <span className="text-sm font-medium" data-testid="text-health-score">
                          {t.acousticResults.healthScore.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    {t.acousticResults.features && (
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">RMS Level:</span>
                          <span className="ml-2 font-medium" data-testid="text-rms">
                            {t.acousticResults.features.rms?.toFixed(3)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Peak Amplitude:</span>
                          <span className="ml-2 font-medium" data-testid="text-peak">
                            {t.acousticResults.features.peakAmplitude?.toFixed(3)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Dominant Frequency:</span>
                          <span className="ml-2 font-medium" data-testid="text-dominant-freq">
                            {t.acousticResults.features.dominantFrequency?.toFixed(1)} Hz
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">SNR:</span>
                          <span className="ml-2 font-medium" data-testid="text-snr">
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
                              data-testid={`text-issue-${i}`}
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
                              data-testid={`text-rec-${i}`}
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
                <div
                  className="text-center py-8 text-muted-foreground"
                  data-testid="text-no-models"
                >
                  <Database className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>No trained models yet</p>
                  <p className="text-sm mt-1">
                    Train an LSTM or Random Forest model to get started
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Model Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Equipment</TableHead>
                        <TableHead>Performance</TableHead>
                        <TableHead>Data Quality</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {t.mlModels.map((model) => {
                        const tier = model.hyperparameters?.dataQualityTier;
                        return (
                          <TableRow key={model.id} data-testid={`row-model-${model.id}`}>
                            <TableCell className="font-medium">{model.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" data-testid={`badge-type-${model.id}`}>
                                {model.modelType === "failure_prediction"
                                  ? "LSTM"
                                  : model.modelType === "health_classification"
                                    ? "Random Forest"
                                    : model.modelType}
                              </Badge>
                            </TableCell>
                            <TableCell>{model.targetEquipmentType || "All"}</TableCell>
                            <TableCell>
                              {model.performance?.accuracy ? (
                                <span className="text-sm" data-testid={`text-accuracy-${model.id}`}>
                                  {(model.performance.accuracy * 100).toFixed(1)}% accuracy
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-sm">N/A</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {tier ? (
                                <div className="space-y-1">
                                  <Badge
                                    className={t.getTierBadge(tier).className}
                                    data-testid={`badge-tier-${model.id}`}
                                  >
                                    {t.getTierBadge(tier).label}
                                  </Badge>
                                  {model.hyperparameters?.lookbackDays && (
                                    <div className="text-xs text-muted-foreground">
                                      {model.hyperparameters.lookbackDays} days
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">Legacy</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {model.status === "active" ? (
                                <Badge
                                  variant="default"
                                  className="bg-green-600"
                                  data-testid={`badge-status-${model.id}`}
                                >
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Active
                                </Badge>
                              ) : (
                                <Badge variant="secondary" data-testid={`badge-status-${model.id}`}>
                                  {model.status}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(model.createdAt).toLocaleDateString()}
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
        </TabsContent>

        <TabsContent value="reset" className="space-y-4">
          <Alert variant="destructive" className="border-2">
            <AlertTriangle className="h-5 w-5" />
            <AlertDescription className="text-lg font-semibold">
              ⚠️ DESTRUCTIVE OPERATION - ADMIN ONLY
            </AlertDescription>
          </Alert>
          <Card className="border-destructive border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Reset ML Training Data
              </CardTitle>
              <CardDescription>
                Permanently delete synthetic telemetry data and optionally trained models to start
                fresh with real equipment data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-700">
                <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertDescription className="text-amber-900 dark:text-amber-100">
                  <strong>When to use this:</strong> This reset function is designed for development
                  and testing. Use it to clear synthetic/test data before deploying to production
                  with real equipment telemetry.
                </AlertDescription>
              </Alert>
              <div className="space-y-4 p-4 bg-muted rounded-lg">
                <h3 className="font-semibold text-destructive">What will be deleted:</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-destructive">•</span>
                    <span>
                      <strong>All telemetry records</strong> for your organization (
                      {t.mlModels.length > 0 ? "7,369 synthetic records" : "all current data"})
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive">•</span>
                    <span>
                      <strong>All failure predictions</strong> generated by ML models
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive">•</span>
                    <span>
                      <strong>All anomaly detections</strong> from monitoring systems
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-destructive">•</span>
                    <span>
                      <strong>Optionally:</strong> All trained ML models (LSTM, Random Forest,
                      XGBoost)
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
                      <AlertDialogCancel data-testid="button-cancel-reset">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => t.resetMLData.mutate({ deleteModels: false })}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        data-testid="button-confirm-reset-keep-models"
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
                        <p>You will need to retrain all models from scratch. This includes:</p>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          <li>LSTM neural network model</li>
                          <li>Random Forest classifier</li>
                          <li>XGBoost model</li>
                          <li>All telemetry and prediction data</li>
                        </ul>
                        <p className="text-destructive font-bold">
                          This action cannot be undone. Are you absolutely sure?
                        </p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel data-testid="button-cancel-reset-all">
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => t.resetMLData.mutate({ deleteModels: true })}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        data-testid="button-confirm-reset-all"
                      >
                        Yes, Delete Everything
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>Admin Authentication Required:</strong> This operation requires admin
                  privileges and is logged for audit purposes.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
              Azure IoT, SAP PM, or any competing predictive maintenance platform. All exports
              include tier metadata and are compatible with industry-standard tools.
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
              migration or training models in external systems. CSV format contains ML models only
              with full tier metadata - use for spreadsheet analysis in Excel, Pandas, or BI tools.
              Raw telemetry data enables competing platforms to train their own predictive models.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
