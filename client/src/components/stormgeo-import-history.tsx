import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  Check,
  FileJson,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Ship,
  Upload,
  X,
} from "lucide-react";
import type { ImportHistory } from "@/features/settings";
import type { StormGeoSettingsModel } from "./stormgeo-settings-types";

export function StormGeoImportHistory({ model }: { model: StormGeoSettingsModel }) {
  const {
    vessels,
    importHistory,
    loadingHistory,
    uploadDialogOpen,
    setUploadDialogOpen,
    selectedFile,
    selectedVesselForUpload,
    setSelectedVesselForUpload,
    importMutation,
    handleFileChange,
    handleImport,
    handleCancelUpload,
    refetchHistory,
    getVesselName,
  } = model;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Weather Data
          </CardTitle>
          <CardDescription>Upload StormGeo route forecast files (CSV or JSON format)</CardDescription>
        </div>
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-import-stormgeo">
              <Upload className="h-4 w-4 mr-2" />
              Import File
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Import StormGeo Data</DialogTitle>
              <DialogDescription>
                Upload a CSV or JSON file containing weather/routing forecast data
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Select Vessel</Label>
                <Select value={selectedVesselForUpload} onValueChange={setSelectedVesselForUpload}>
                  <SelectTrigger data-testid="select-import-vessel">
                    <SelectValue placeholder="Select vessel for this data" />
                  </SelectTrigger>
                  <SelectContent>
                    {vessels
                      ?.filter((v) => v.id)
                      .map((vessel) => (
                        <SelectItem key={vessel.id} value={vessel.id}>
                          {vessel.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Upload File</Label>
                <Input
                  type="file"
                  accept=".csv,.json"
                  onChange={handleFileChange}
                  data-testid="input-stormgeo-file"
                />
                {selectedFile && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {selectedFile.name.endsWith(".json") ? (
                      <FileJson className="h-4 w-4" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4" />
                    )}
                    {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleCancelUpload}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={!selectedFile || !selectedVesselForUpload || importMutation.isPending}
                  data-testid="button-confirm-import"
                >
                  {importMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Import
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Vessel</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Records</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingHistory ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ) : (importHistory?.length ?? 0) === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No import history. Upload a file to get started.
                  </TableCell>
                </TableRow>
              ) : (
                importHistory?.map((history: ImportHistory) => (
                  <TableRow key={history.id}>
                    <TableCell className="font-mono text-sm">
                      {format(new Date(history.createdAt), "MMM d, HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Ship className="h-3 w-3 text-muted-foreground" />
                        {getVesselName(history.vesselId)}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      {history.fileName || "-"}
                    </TableCell>
                    <TableCell>
                      <span className="text-green-600">{history.recordsCreated || 0}</span>
                      {(history.recordsFailed ?? 0) > 0 && (
                        <span className="text-red-500 ml-1">/ {history.recordsFailed} failed</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          history.status === "success"
                            ? "default"
                            : history.status === "partial"
                              ? "secondary"
                              : "destructive"
                        }
                      >
                        {history.status === "success" && <Check className="h-3 w-3 mr-1" />}
                        {history.status === "failed" && <X className="h-3 w-3 mr-1" />}
                        {history.status === "partial" && <AlertCircle className="h-3 w-3 mr-1" />}
                        {history.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {history.durationMs ? `${(history.durationMs / 1000).toFixed(1)}s` : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex justify-end mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchHistory()}
            data-testid="button-refresh-history"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
