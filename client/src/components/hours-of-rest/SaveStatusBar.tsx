import { Badge } from "@/components/ui/badge";
import { Save, Clock, AlertTriangle } from "lucide-react";
import { type SaveStatus } from "@/features/crew";

interface SaveStatusBarProps {
  saveStatus: SaveStatus;
}

export function SaveStatusBar({ saveStatus }: SaveStatusBarProps) {
  return (
    <div className="sticky top-0 z-20 flex items-center justify-end gap-2 bg-background/95 backdrop-blur-sm py-1 px-2 rounded" data-testid="save-status-bar">
      {saveStatus === "saved" && (
        <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800" data-testid="badge-save-status-saved">
          <Save className="w-3 h-3 mr-1" />Saved
        </Badge>
      )}
      {saveStatus === "saving" && (
        <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800" data-testid="badge-save-status-saving">
          <Clock className="w-3 h-3 mr-1 animate-spin" />Saving...
        </Badge>
      )}
      {saveStatus === "unsaved" && (
        <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800" data-testid="badge-save-status-unsaved">
          <AlertTriangle className="w-3 h-3 mr-1" />Unsaved changes
        </Badge>
      )}
    </div>
  );
}
