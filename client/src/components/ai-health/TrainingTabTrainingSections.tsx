import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { InfoTooltip } from "@/components/ui/info-tooltip";
import {
  Activity,
  AlertCircle,
  Brain,
  CheckCircle2,
  Info,
  Loader2,
  Play,
  Radio,
  TrendingUp,
} from "lucide-react";
import type { TrainingDataState } from "./TrainingTabTypes";

interface TrainingSectionProps {
  training: TrainingDataState;
}

export function LstmTrainingSection({ training: t }: TrainingSectionProps) {
  return (
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
            <strong>Smart Adaptive Training:</strong> The system automatically uses optimal training
            data range based on available history.
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="lstm-equipment-type">Equipment Type (Optional)</Label>
            <Select value={t.selectedEquipmentType} onValueChange={t.setSelectedEquipmentType}>
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
  );
}

export function RandomForestTrainingSection({ training: t }: TrainingSectionProps) {
  return (
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
            <strong>Smart Adaptive Training:</strong> Uses optimal data range automatically (90-730
            days based on availability).
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="rf-equipment-type">Equipment Type (Optional)</Label>
            <Select value={t.selectedEquipmentType} onValueChange={t.setSelectedEquipmentType}>
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
  );
}

export function AcousticAnalysisSection({ training: t }: TrainingSectionProps) {
  return (
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
            Acoustic analysis uses FFT to extract frequency signatures and detect abnormal sound
            patterns.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="acoustic-data">Acoustic Waveform Data (comma-separated values)</Label>
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

        {t.acousticResults && <AcousticResults training={t} />}
      </CardContent>
    </Card>
  );
}

function AcousticResults({ training: t }: TrainingSectionProps) {
  const result = t.acousticResults;
  if (!result) {
    return null;
  }

  return (
    <Card className="mt-4 bg-muted/50">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          Analysis Results
          <Badge
            variant={
              result.severity === "critical"
                ? "destructive"
                : result.severity === "warning"
                  ? "default"
                  : "outline"
            }
          >
            {result.severity}
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
                style={{ width: `${result.healthScore ?? 0}%` }}
              />
            </div>
            <span className="text-sm font-medium">{(result.healthScore ?? 0).toFixed(0)}%</span>
          </div>
        </div>

        {result.features && (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">RMS Level:</span>
              <span className="ml-2 font-medium">{result.features.rms?.toFixed(3)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Peak Amplitude:</span>
              <span className="ml-2 font-medium">{result.features.peakAmplitude?.toFixed(3)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Dominant Frequency:</span>
              <span className="ml-2 font-medium">
                {result.features.dominantFrequency?.toFixed(1)} Hz
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">SNR:</span>
              <span className="ml-2 font-medium">{result.features.snr?.toFixed(1)} dB</span>
            </div>
          </div>
        )}

        {result.primaryIssues.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2">Primary Issues</div>
            <ul className="space-y-1">
              {result.primaryIssues.map((issue: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {issue}
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.recommendations.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2">Recommendations</div>
            <ul className="space-y-1">
              {result.recommendations.map((rec: string, i: number) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-600" />
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
