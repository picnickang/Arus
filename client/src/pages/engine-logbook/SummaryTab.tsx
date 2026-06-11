import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Droplets, FileText, Fuel, Gauge } from "lucide-react";
import { type EngineLogbookHookReturn } from "@/features/engine-logbook";

export function SummaryTab({ e }: { e: EngineLogbookHookReturn }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Main Engine Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Running Hours</Label>
              <Input
                type="number"
                step="0.1"
                value={e.dailySummary.meRunningHours ?? ""}
                onChange={(ev) =>
                  e.updateDailySummary(
                    "meRunningHours",
                    ev.target.value ? Number(ev.target.value) : undefined
                  )
                }
                disabled={e.isLocked}
                data-testid="input-summary-running-hours"
              />
            </div>
            <div>
              <Label>Revolutions</Label>
              <Input
                type="number"
                value={e.dailySummary.meRevolutions ?? ""}
                onChange={(ev) =>
                  e.updateDailySummary(
                    "meRevolutions",
                    ev.target.value ? Number(ev.target.value) : undefined
                  )
                }
                disabled={e.isLocked}
                data-testid="input-summary-revolutions"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Avg RPM</Label>
              <Input
                type="number"
                value={e.dailySummary.avgMeRpm ?? ""}
                onChange={(ev) =>
                  e.updateDailySummary(
                    "avgMeRpm",
                    ev.target.value ? Number(ev.target.value) : undefined
                  )
                }
                disabled={e.isLocked}
                data-testid="input-summary-avg-rpm"
              />
            </div>
            <div>
              <Label>Avg Load %</Label>
              <Input
                type="number"
                value={e.dailySummary.avgMeLoad ?? ""}
                onChange={(ev) =>
                  e.updateDailySummary(
                    "avgMeLoad",
                    ev.target.value ? Number(ev.target.value) : undefined
                  )
                }
                disabled={e.isLocked}
                data-testid="input-summary-avg-load"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fuel className="h-5 w-5" />
            Fuel & Oil Consumption
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>FO (MT)</Label>
              <Input
                type="number"
                step="0.01"
                value={e.dailySummary.foConsumption ?? ""}
                onChange={(ev) =>
                  e.updateDailySummary(
                    "foConsumption",
                    ev.target.value ? Number(ev.target.value) : undefined
                  )
                }
                disabled={e.isLocked}
                data-testid="input-summary-fo"
              />
            </div>
            <div>
              <Label>DO (MT)</Label>
              <Input
                type="number"
                step="0.01"
                value={e.dailySummary.doConsumption ?? ""}
                onChange={(ev) =>
                  e.updateDailySummary(
                    "doConsumption",
                    ev.target.value ? Number(ev.target.value) : undefined
                  )
                }
                disabled={e.isLocked}
                data-testid="input-summary-do"
              />
            </div>
            <div>
              <Label>LO (L)</Label>
              <Input
                type="number"
                step="0.1"
                value={e.dailySummary.loConsumption ?? ""}
                onChange={(ev) =>
                  e.updateDailySummary(
                    "loConsumption",
                    ev.target.value ? Number(ev.target.value) : undefined
                  )
                }
                disabled={e.isLocked}
                data-testid="input-summary-lo"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5" />
            Fresh Water
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Produced (MT)</Label>
              <Input
                type="number"
                step="0.1"
                value={e.dailySummary.fwProduced ?? ""}
                onChange={(ev) =>
                  e.updateDailySummary(
                    "fwProduced",
                    ev.target.value ? Number(ev.target.value) : undefined
                  )
                }
                disabled={e.isLocked}
                data-testid="input-summary-fw-produced"
              />
            </div>
            <div>
              <Label>Consumed (MT)</Label>
              <Input
                type="number"
                step="0.1"
                value={e.dailySummary.fwConsumed ?? ""}
                onChange={(ev) =>
                  e.updateDailySummary(
                    "fwConsumed",
                    ev.target.value ? Number(ev.target.value) : undefined
                  )
                }
                disabled={e.isLocked}
                data-testid="input-summary-fw-consumed"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Engineering Remarks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Chief Engineer Remarks</Label>
            <Textarea
              value={e.dailySummary.chiefEngineerRemarks ?? ""}
              onChange={(ev) => e.updateDailySummary("chiefEngineerRemarks", ev.target.value)}
              rows={3}
              disabled={e.isLocked}
              data-testid="input-summary-chief-remarks"
            />
          </div>
          <div>
            <Label>Second Engineer Remarks</Label>
            <Textarea
              value={e.dailySummary.secondEngineerRemarks ?? ""}
              onChange={(ev) => e.updateDailySummary("secondEngineerRemarks", ev.target.value)}
              rows={3}
              disabled={e.isLocked}
              data-testid="input-summary-second-remarks"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
