import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertCircle,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Lock,
  Ship,
  Zap,
} from "lucide-react";
import { type EngineLogbookHookReturn } from "@/features/engine-logbook";
import { PermissionGate } from "@/components/PermissionGate";
import { AddEventDialog } from "./AddEventDialog";

export function EngineLogbookHero({ e }: { e: EngineLogbookHookReturn }) {
  return (
    <Card>
      <CardHeader className="pb-3 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Ship className="h-5 w-5 text-muted-foreground" />
              <Select value={e.selectedVesselId} onValueChange={e.setSelectedVesselId}>
                <SelectTrigger className="w-[200px]" data-testid="select-vessel">
                  <SelectValue placeholder="Select vessel" />
                </SelectTrigger>
                <SelectContent>
                  {e.vessels
                    ?.filter((v) => v.orgId === e.orgId && v.id)
                    .map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={e.goToPreviousDay}
                data-testid="button-prev-day"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <Input
                  type="date"
                  value={e.selectedDate}
                  onChange={(ev) => e.setSelectedDate(ev.target.value)}
                  className="w-[160px]"
                  data-testid="input-date"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={e.goToNextDay}
                data-testid="button-next-day"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {e.engineLogComplete?.daily && (
              <>
                <Badge variant={e.isLocked ? "secondary" : e.isSigned ? "default" : "outline"}>
                  {e.isLocked ? (
                    <>
                      <Lock className="h-3 w-3 mr-1" /> Locked
                    </>
                  ) : e.isSigned ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Signed
                    </>
                  ) : (
                    <>
                      <FileText className="h-3 w-3 mr-1" /> Draft
                    </>
                  )}
                </Badge>
                {e.isDirty && (
                  <Badge variant="outline" className="text-yellow-600">
                    <AlertCircle className="h-3 w-3 mr-1" /> Unsaved
                  </Badge>
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AddEventDialog e={e} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => e.autoFillMutation.mutate()}
            disabled={
              !e.selectedVesselId || !e.selectedDate || e.isLocked || e.autoFillMutation.isPending
            }
            data-testid="button-autofill"
          >
            <Zap className="h-4 w-4 mr-2" />
            {e.autoFillMutation.isPending ? "Filling..." : "Auto-Fill from Telemetry"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => e.notifyUnsignedMutation.mutate()}
            disabled={e.notifyUnsignedMutation.isPending}
            data-testid="button-notify-unsigned"
          >
            <Bell className="h-4 w-4 mr-2" />
            {e.notifyUnsignedMutation.isPending ? "Sending..." : "Notify Unsigned"}
          </Button>
          <PermissionGate resource="engine_logbook" action="export">
            <Button
              variant="outline"
              size="sm"
              onClick={e.exportToPDFHandler}
              disabled={!e.engineLogComplete}
              data-testid="button-export-pdf"
            >
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={e.exportToExcelHandler}
              disabled={!e.engineLogComplete}
              data-testid="button-export-excel"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
          </PermissionGate>
        </div>
      </CardHeader>
    </Card>
  );
}
