import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Gauge } from "lucide-react";
import { type EngineLogbookHookReturn } from "@/features/engine-logbook";
import { EngineHourlyRow } from "@/components/engine-logbook/row-components";

export function HourlyTab({ e }: { e: EngineLogbookHookReturn }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="h-5 w-5" />
          Main Engine Hourly Readings
        </CardTitle>
        <CardDescription>Record hourly main engine parameters</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 sticky left-0 bg-background">Hour</TableHead>
                <TableHead className="w-20">RPM</TableHead>
                <TableHead className="w-20">Load %</TableHead>
                <TableHead className="w-20">F.Rack</TableHead>
                <TableHead className="w-24">Exh.T °C</TableHead>
                <TableHead className="w-24">Scav.P</TableHead>
                <TableHead className="w-24">Cool.In</TableHead>
                <TableHead className="w-24">Cool.Out</TableHead>
                <TableHead className="w-24">LO.P</TableHead>
                <TableHead className="w-24">LO.T</TableHead>
                <TableHead className="w-24">TC RPM</TableHead>
                <TableHead className="w-24">FO.T</TableHead>
                <TableHead>Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 24 }, (_, i) => (
                <EngineHourlyRow
                  key={i}
                  hour={i}
                  entry={e.hourlyEntries.get(i) ?? {}}
                  isLocked={e.isLocked}
                  updateHourlyEntry={e.updateHourlyEntry}
                />
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
