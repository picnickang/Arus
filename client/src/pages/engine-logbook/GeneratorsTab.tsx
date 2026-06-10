import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CircleDot, Zap } from "lucide-react";
import { GENERATOR_NUMBERS, type EngineLogbookHookReturn } from "@/features/engine-logbook";
import { GeneratorIntervalRow } from "@/components/engine-logbook/row-components";

export function GeneratorsTab({ e }: { e: EngineLogbookHookReturn }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Diesel Generator Log
        </CardTitle>
        <CardDescription>Record generator performance at key intervals</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          {GENERATOR_NUMBERS.map((genNum) => (
            <div key={genNum} className="mb-6">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <CircleDot className="h-4 w-4" />
                Diesel Generator {genNum}
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Hour</TableHead>
                    <TableHead>Load kW</TableHead>
                    <TableHead>Voltage V</TableHead>
                    <TableHead>Freq Hz</TableHead>
                    <TableHead>Exh.T °C</TableHead>
                    <TableHead>LO Press</TableHead>
                    <TableHead>Cool.T</TableHead>
                    <TableHead>Run Hrs</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[0, 6, 12, 18].map((hour) => (
                    <GeneratorIntervalRow
                      key={`${genNum}-${hour}`}
                      genNum={genNum}
                      hour={hour}
                      entry={e.generatorEntries.get(`${genNum}-${hour}`) ?? {}}
                      isLocked={e.isLocked}
                      updateGeneratorEntry={e.updateGeneratorEntry}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
