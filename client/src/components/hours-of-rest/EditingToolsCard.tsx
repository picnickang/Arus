import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Upload, Download, FileCheck, Palette } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface EditingToolsCardProps {
  isReadyForActions: boolean;
  upload: () => Promise<void>;
  runCheck: () => Promise<void>;
  loadFromProposedPlan: () => void;
  exportPdf: () => Promise<void>;
  exportCSV: () => void;
  importCSV: () => void;
  clearAll: () => void;
}

export function EditingToolsCard({
  isReadyForActions, upload, runCheck, loadFromProposedPlan,
  exportPdf, exportCSV, importCSV, clearAll,
}: EditingToolsCardProps) {
  return (
    <Card className="border shadow-md">
      <CardHeader className="bg-muted/50 border-b">
        <CardTitle className="text-lg font-semibold">Editing Tools</CardTitle>
        <CardDescription>Click cells to toggle, or use paint mode to drag and fill multiple cells</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-6">
          <div className="p-4 bg-muted/50 rounded-lg border">
            <div className="flex items-start gap-3">
              <Palette className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1" />
              <div className="flex-1">
                <Label className="font-semibold block mb-1">Smart Toggle Mode</Label>
                <p className="text-xs text-muted-foreground">
                  Click to toggle individual cells, or click and drag to toggle multiple cells. Cells automatically switch to their opposite state:{" "}
                  <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 bg-emerald-400 rounded-full"></span>REST → WORK</span> or{" "}
                  <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 bg-rose-400 rounded-full"></span>WORK → REST</span>
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Save & Verify</Label>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={upload} size="default" disabled={!isReadyForActions} className={`shadow-md transition-all duration-200 ${!isReadyForActions ? "opacity-50 cursor-not-allowed bg-muted hover:bg-muted text-muted-foreground" : "bg-blue-600 hover:bg-blue-700 text-white hover:shadow-lg"}`} data-testid="button-upload-grid" title={!isReadyForActions ? "Select vessel and crew member first" : "Save rest data to database"}><Upload className="w-4 h-4 mr-2" />Save to Database</Button>
                <Button onClick={runCheck} variant="outline" size="default" disabled={!isReadyForActions} className={`transition-all duration-200 ${!isReadyForActions ? "opacity-50 cursor-not-allowed border-border text-muted-foreground" : "border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 dark:text-amber-400 dark:border-amber-600 dark:hover:bg-amber-950"}`} data-testid="button-check-grid" title={!isReadyForActions ? "Select vessel and crew member first" : "Check STCW compliance"}><FileCheck className="w-4 h-4 mr-2" />Check Compliance</Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Data Management</Label>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={loadFromProposedPlan} variant="outline" size="sm" disabled={!isReadyForActions} className={`transition-all duration-200 ${!isReadyForActions ? "opacity-50 cursor-not-allowed border-border text-muted-foreground" : "border-indigo-300 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-400 dark:text-indigo-400 dark:border-indigo-600 dark:hover:bg-indigo-950"}`} data-testid="button-load-proposed-plan" title={!isReadyForActions ? "Select vessel and crew member first" : "Load from crew schedule"}><FileCheck className="w-4 h-4 mr-2" />Load from Schedule</Button>
                <Button onClick={exportPdf} variant="outline" size="sm" className="border-purple-300 text-purple-700 hover:bg-purple-50 hover:border-purple-400 dark:text-purple-400 dark:border-purple-600 dark:hover:bg-purple-950 transition-all duration-200" data-testid="button-export-pdf-grid" title="Generate PDF report"><Download className="w-4 h-4 mr-2" />Export PDF</Button>
                <Button onClick={exportCSV} variant="outline" size="sm" className="border-cyan-300 text-cyan-700 hover:bg-cyan-50 hover:border-cyan-400 dark:text-cyan-400 dark:border-cyan-600 dark:hover:bg-cyan-950 transition-all duration-200" data-testid="button-export-csv" title="Export to CSV file">Export CSV</Button>
                <Button onClick={importCSV} variant="outline" size="sm" className="border-teal-300 text-teal-700 hover:bg-teal-50 hover:border-teal-400 dark:text-teal-400 dark:border-teal-600 dark:hover:bg-teal-950 transition-all duration-200" data-testid="button-import-csv" title="Import from CSV file">Import CSV</Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="transition-all duration-200" data-testid="button-clear-all" title="Clear all hours in the grid">Clear All</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear all rest data?</AlertDialogTitle>
                      <AlertDialogDescription>This will reset all hours in the grid for the current month. This action cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel data-testid="button-cancel-clear">Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={clearAll} data-testid="button-confirm-clear">Clear All</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-muted rounded-lg border">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"><FileCheck className="w-3 h-3 text-blue-600 dark:text-blue-400" /></div>
            <div>
              <h4 className="font-medium text-sm mb-1">STCW Maritime Compliance Rules</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>• <span className="font-medium">Minimum 10 hours</span> rest in any 24-hour period</li>
                <li>• <span className="font-medium">Minimum 77 hours</span> rest in any 7-day period</li>
                <li>• <span className="font-medium">Maximum 2 rest blocks</span> per day with one ≥6 hours</li>
                <li>• <span className="text-indigo-600 dark:text-indigo-400">Night hours (20:00-06:00)</span> have visual indicators</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
