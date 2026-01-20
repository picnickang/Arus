import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  TooltipProps,
} from "recharts";
import { Upload, FileText, Activity, BarChart3, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AcousticData {
  source: 'file' | 'paste';
  data: number[];
  sampleRate: number;
  rpm?: number;
  metadata?: {
    fileName?: string;
    fileSize?: number;
  };
}

export interface AnalysisResult {
  success: boolean;
  healthScore?: number;
  dominantFrequencies?: Array<{ frequency: number; amplitude: number }>;
  anomalyScore?: number;
  recommendations?: string[];
  error?: string;
}

interface AcousticAnalysisPanelProps {
  equipmentId?: string;
  sensorType?: string;
  onAnalyze: (data: AcousticData) => Promise<AnalysisResult>;
  loading?: boolean;
  className?: string;
  'data-testid'?: string;
}

function parseCSV(csvText: string): number[] {
  const lines = csvText.trim().split('\n');
  const values: number[] = [];
  
  for (const line of lines) {
    const parts = line.split(',').map(s => s.trim());
    for (const part of parts) {
      const num = Number.parseFloat(part);
      if (!Number.isNaN(num)) {
        values.push(num);
      }
    }
  }
  
  return values;
}

function WaveformTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) {return null;}
  
  return (
    <div className="bg-popover border rounded-lg shadow-lg p-2 text-xs">
      <p>Sample: {payload[0].payload.index}</p>
      <p>Amplitude: {payload[0].value?.toFixed(3)}</p>
    </div>
  );
}

export function AcousticAnalysisPanel({
  equipmentId: _equipmentId,
  sensorType: _sensorType,
  onAnalyze,
  loading = false,
  className,
  'data-testid': testId,
}: AcousticAnalysisPanelProps) {
  const [inputMode, setInputMode] = useState<'file' | 'paste'>('file');
  const [sampleRate, setSampleRate] = useState<string>('44100');
  const [rpm, setRpm] = useState<string>('');
  const [pasteData, setPasteData] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string>('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {return;}

    setSelectedFile(file);
    setError('');

    if (file.name.endsWith('.csv')) {
      const text = await file.text();
      const data = parseCSV(text);
      setWaveformData(data);
    } else {
      setError('Please upload a CSV file');
    }
  };

  const handlePasteAnalyze = () => {
    const data = parseCSV(pasteData);
    if (data.length === 0) {
      setError('No valid numeric data found');
      return;
    }
    setWaveformData(data);
    setError('');
  };

  const handleAnalyze = async () => {
    if (waveformData.length === 0) {
      setError('No data to analyze');
      return;
    }

    const sampleRateNum = Number.parseInt(sampleRate);
    if (Number.isNaN(sampleRateNum) || sampleRateNum <= 0) {
      setError('Invalid sample rate');
      return;
    }

    setError('');
    
    const acousticData: AcousticData = {
      source: inputMode,
      data: waveformData,
      sampleRate: sampleRateNum,
      rpm: rpm ? Number.parseInt(rpm) : undefined,
      metadata: selectedFile
        ? {
            fileName: selectedFile.name,
            fileSize: selectedFile.size,
          }
        : undefined,
    };

    try {
      const analysisResult = await onAnalyze(acousticData);
      setResult(analysisResult);
    } catch (_err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    }
  };

  // Prepare chart data (subsample if too large)
  const maxPoints = 500;
  const step = Math.max(1, Math.floor(waveformData.length / maxPoints));
  const waveformChartData = waveformData
    .filter((_, i) => i % step === 0)
    .map((value, i) => ({ index: i * step, amplitude: value }));

  // Simple FFT approximation (for visualization only)
  const fftData = waveformData.length > 0 ? waveformData.slice(0, 256).map((val, i) => ({
    frequency: i * (Number.parseInt(sampleRate) / 512),
    magnitude: Math.abs(val),
  })) : [];

  return (
    <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-6", className)} data-testid={testId}>
      {/* Left Panel: Input */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Data Input</CardTitle>
            <CardDescription>
              Upload CSV file or paste acoustic data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={inputMode} onValueChange={(v) => setInputMode(v as "file" | "paste")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="file" data-testid="tab-file-upload">
                  <Upload className="h-4 w-4 mr-2" />
                  File Upload
                </TabsTrigger>
                <TabsTrigger value="paste" data-testid="tab-paste-data">
                  <FileText className="h-4 w-4 mr-2" />
                  Paste Data
                </TabsTrigger>
              </TabsList>

              <TabsContent value="file" className="space-y-4">
                <div>
                  <Label htmlFor="acoustic-file">CSV File</Label>
                  <Input
                    id="acoustic-file"
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="mt-2"
                    data-testid="input-file-upload"
                  />
                  {selectedFile && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="paste" className="space-y-4">
                <div>
                  <Label htmlFor="paste-data">Acoustic Data (CSV format)</Label>
                  <Textarea
                    id="paste-data"
                    placeholder="Paste comma-separated values here..."
                    value={pasteData}
                    onChange={(e) => setPasteData(e.target.value)}
                    className="mt-2 h-32 font-mono text-xs"
                    data-testid="textarea-paste-data"
                  />
                  <Button
                    onClick={handlePasteAnalyze}
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    data-testid="button-parse-paste"
                  >
                    Parse Data
                  </Button>
                </div>
              </TabsContent>
            </Tabs>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="sample-rate">Sample Rate (Hz)</Label>
                <Input
                  id="sample-rate"
                  type="number"
                  value={sampleRate}
                  onChange={(e) => setSampleRate(e.target.value)}
                  className="mt-2"
                  data-testid="input-sample-rate"
                />
              </div>
              <div>
                <Label htmlFor="rpm">RPM (Optional)</Label>
                <Input
                  id="rpm"
                  type="number"
                  value={rpm}
                  onChange={(e) => setRpm(e.target.value)}
                  placeholder="e.g., 1800"
                  className="mt-2"
                  data-testid="input-rpm"
                />
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleAnalyze}
              disabled={loading || waveformData.length === 0}
              className="w-full"
              data-testid="button-analyze"
            >
              {loading ? 'Analyzing...' : 'Analyze Acoustic Data'}
            </Button>

            {waveformData.length > 0 && (
              <p className="text-sm text-muted-foreground text-center">
                {waveformData.length} samples loaded
              </p>
            )}
          </CardContent>
        </Card>

        {/* Results Card */}
        {result && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {result.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                )}
                Analysis Results
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {result.healthScore !== undefined && (
                <div>
                  <Label className="text-sm">Health Score</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all",
                          result.healthScore >= 80 ? "bg-green-500" :
                          result.healthScore >= 60 ? "bg-yellow-500" :
                          "bg-red-500"
                        )}
                        style={{ width: `${result.healthScore}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold" data-testid="health-score">
                      {result.healthScore.toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}

              {result.dominantFrequencies && result.dominantFrequencies.length > 0 && (
                <div>
                  <Label className="text-sm">Dominant Frequencies</Label>
                  <ul className="mt-1 space-y-1">
                    {result.dominantFrequencies.slice(0, 3).map((freq) => (
                      <li key={`freq-${freq.frequency}-${freq.amplitude}`} className="text-sm text-muted-foreground">
                        {freq.frequency.toFixed(1)} Hz (amplitude: {freq.amplitude.toFixed(3)})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.recommendations && result.recommendations.length > 0 && (
                <div>
                  <Label className="text-sm">Recommendations</Label>
                  <ul className="mt-1 space-y-1 list-disc list-inside">
                    {result.recommendations.map((rec, i) => (
                      <li key={`rec-${rec.slice(0, 30)}-${i}`} className="text-sm text-muted-foreground">
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Right Panel: Visualization */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Waveform (Time Domain)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {waveformData.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No data loaded
              </div>
            ) : loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={250} data-testid="waveform-chart">
                <LineChart data={waveformChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="index"
                    tick={{ fontSize: 10 }}
                    label={{ value: 'Sample', position: 'insideBottom', offset: -5, style: { fontSize: 11 } }}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    label={{ value: 'Amplitude', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
                  />
                  <Tooltip content={<WaveformTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="amplitude"
                    stroke="hsl(var(--primary))"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              FFT (Frequency Domain)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {fftData.length === 0 ? (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                No data loaded
              </div>
            ) : loading ? (
              <Skeleton className="h-[250px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={250} data-testid="fft-chart">
                <BarChart data={fftData.slice(0, 128)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="frequency"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(1)}k`}
                    label={{ value: 'Frequency (Hz)', position: 'insideBottom', offset: -5, style: { fontSize: 11 } }}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    label={{ value: 'Magnitude', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
                  />
                  <Tooltip />
                  <Bar
                    dataKey="magnitude"
                    fill="hsl(var(--primary))"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
