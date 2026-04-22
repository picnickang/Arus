import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Upload,
  FileText,
  Database,
  CheckCircle,
  AlertCircle,
  Download,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { formatDateTimeSgt } from "@/lib/time-utils";
import { useManualTelemetryUpload, type RawTelemetry } from "@/features/telemetry";
import { PageHeader } from "@/components/navigation";

export default function ManualTelemetryUpload() {
  const {
    csvData,
    setCsvData,
    jsonData,
    setJsonData,
    uploadProgress,
    lastResult,
    telemetryData,
    dataLoading,
    csvImportMutation,
    jsonImportMutation,
    handleCsvImport,
    handleJsonImport,
    downloadSampleCsv,
    downloadSampleJson,
    clearData,
    handleRefresh,
  } = useManualTelemetryUpload();

  return (
    <div className="min-h-screen">
      <PageHeader title="Manual Telemetry Upload" />
      <div className="p-6 space-y-6">
        {uploadProgress > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Import Progress</span>
                    <span className="text-sm text-muted-foreground">{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {lastResult && (
          <Card className={lastResult.ok ? "border-green-500" : "border-destructive"}>
            <CardContent className="pt-6">
              <div className="flex items-start space-x-4">
                {lastResult.ok ? (
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-medium">
                    {lastResult.ok ? "Import Successful" : "Import Failed"}
                  </p>
                  <p className="text-sm text-muted-foreground">{lastResult.message}</p>
                  {lastResult.processed && (
                    <p className="text-sm text-muted-foreground">
                      Processed {lastResult.processed} rows, inserted {lastResult.inserted} records
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="csv" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="csv" data-testid="tab-csv-upload">
              <FileText className="w-4 h-4 mr-2" />
              CSV Upload
            </TabsTrigger>
            <TabsTrigger value="json" data-testid="tab-json-upload">
              <Database className="w-4 h-4 mr-2" />
              JSON Upload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="csv">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  CSV Data Import
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadSampleCsv}
                      data-testid="button-download-csv-sample"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      CSV Template
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => clearData("csv")}
                      data-testid="button-clear-csv"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Clear
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  Upload telemetry data in CSV format. Required columns: ts, vessel, src, sig.
                  Optional: value, unit.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="csv-data" className="text-sm font-medium">
                    CSV Data
                  </Label>
                  <Textarea
                    id="csv-data"
                    placeholder="ts,vessel,src,sig,value,unit&#10;# Enter your telemetry data here"
                    value={csvData}
                    onChange={(e) => setCsvData(e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                    data-testid="textarea-csv-data"
                  />
                </div>
                <Button
                  onClick={handleCsvImport}
                  disabled={!csvData.trim() || csvImportMutation.isPending}
                  className="w-full"
                  data-testid="button-import-csv"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {csvImportMutation.isPending ? "Importing..." : "Import CSV Data"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="json">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  JSON Data Import
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadSampleJson}
                      data-testid="button-download-json-sample"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      JSON Template
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => clearData("json")}
                      data-testid="button-clear-json"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Clear
                    </Button>
                  </div>
                </CardTitle>
                <CardDescription>
                  Upload telemetry data in JSON format. Use the "rows" array with telemetry objects.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="json-data" className="text-sm font-medium">
                    JSON Data
                  </Label>
                  <Textarea
                    id="json-data"
                    placeholder='{"rows": [...]}'
                    value={jsonData}
                    onChange={(e) => setJsonData(e.target.value)}
                    rows={8}
                    className="font-mono text-sm"
                    data-testid="textarea-json-data"
                  />
                </div>
                <Button
                  onClick={handleJsonImport}
                  disabled={!jsonData.trim() || jsonImportMutation.isPending}
                  className="w-full"
                  data-testid="button-import-json"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {jsonImportMutation.isPending ? "Importing..." : "Import JSON Data"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Database className="mr-2 h-5 w-5" />
                Imported Telemetry Data
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                data-testid="button-refresh-data"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </CardTitle>
            <CardDescription>
              Recently imported raw telemetry data. This data can be processed and transformed into
              equipment telemetry.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {dataLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading telemetry data...
              </div>
            ) : telemetryData?.length > 0 ? (
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {telemetryData.slice(0, 50).map((item: RawTelemetry) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-4">
                          <Badge variant="outline">{item.vessel}</Badge>
                          <span className="font-mono text-sm">{item.src}</span>
                          <span className="text-sm text-muted-foreground">{item.sig}</span>
                        </div>
                        <div className="flex items-center space-x-4 mt-1">
                          <span className="text-sm font-medium">
                            {item.value === null ? "N/A" : `${item.value} ${item.unit || ""}`}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTimeSgt(item.ts)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {telemetryData.length > 50 && (
                    <div className="text-center py-4 text-muted-foreground">
                      ... and {telemetryData.length - 50} more records
                    </div>
                  )}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No telemetry data imported yet. Upload some data using the tabs above.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
