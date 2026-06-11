import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart3, TrendingUp } from "lucide-react";
import { ConsumptionTrendChart } from "./ConsumptionTrendChart";
import type { DailyConsumption, HourlyConsumption } from "./_shared";

export function ConsumptionTab({
  selectedVessel,
  consumption,
  consumptionLoading,
  dailyConsumption,
}: {
  selectedVessel: string;
  consumption: HourlyConsumption[];
  consumptionLoading: boolean;
  dailyConsumption: DailyConsumption[];
}) {
  if (selectedVessel === "all") {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            Select a vessel to view consumption data
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <ConsumptionTrendChart consumption={consumption} loading={consumptionLoading} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Hourly Consumption
          </CardTitle>
          <CardDescription>Fuel flow readings aggregated by hour</CardDescription>
        </CardHeader>
        <CardContent>
          {consumptionLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : consumption.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground">
              No hourly consumption data available
            </p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hour</TableHead>
                    <TableHead className="text-right">Total (kg/h)</TableHead>
                    <TableHead className="text-right">ME Flow</TableHead>
                    <TableHead className="text-right">Port</TableHead>
                    <TableHead className="text-right">Stbd</TableHead>
                    <TableHead className="text-right">Gen</TableHead>
                    <TableHead className="text-right">Boiler</TableHead>
                    <TableHead className="text-right">Shaft kW</TableHead>
                    <TableHead className="text-right">Run Hrs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consumption.map((c, idx) => (
                    <TableRow key={idx} data-testid={`consumption-row-${idx}`}>
                      <TableCell className="font-medium">
                        {c.hour && format(new Date(c.hour), "dd MMM HH:mm")}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {c.avg_flow_kg_per_h ? parseFloat(c.avg_flow_kg_per_h).toFixed(1) : "--"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {c.main_engine_flow ? parseFloat(c.main_engine_flow).toFixed(1) : "--"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {c.port_engine_flow ? parseFloat(c.port_engine_flow).toFixed(1) : "--"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {c.stbd_engine_flow ? parseFloat(c.stbd_engine_flow).toFixed(1) : "--"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {c.generator_flow ? parseFloat(c.generator_flow).toFixed(1) : "--"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {c.boiler_flow ? parseFloat(c.boiler_flow).toFixed(1) : "--"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {c.shaft_power_kw ? parseFloat(c.shaft_power_kw).toFixed(0) : "--"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {c.running_hours ? parseFloat(c.running_hours).toFixed(1) : "--"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-amber-600" />
            Daily Summary
          </CardTitle>
          <CardDescription>Daily consumption, running hours, and voyage data</CardDescription>
        </CardHeader>
        <CardContent>
          {dailyConsumption.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground">
              No daily consumption data available
            </p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Day</TableHead>
                    <TableHead className="text-right">Avg Flow (kg/h)</TableHead>
                    <TableHead className="text-right">Est. Daily (MT)</TableHead>
                    <TableHead className="text-right">Running Hrs</TableHead>
                    <TableHead className="text-right">Distance (NM)</TableHead>
                    <TableHead className="text-right">Avg SOG (kn)</TableHead>
                    <TableHead className="text-right">ME Flow</TableHead>
                    <TableHead className="text-right">Gen Flow</TableHead>
                    <TableHead className="text-right">Density</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyConsumption.map((d, idx) => (
                    <TableRow key={idx} data-testid={`daily-row-${idx}`}>
                      <TableCell className="font-medium">
                        {d.day && format(new Date(d.day), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {d.avg_flow_kg_per_h ? parseFloat(d.avg_flow_kg_per_h).toFixed(1) : "--"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {d.estimated_daily_mt ? parseFloat(d.estimated_daily_mt).toFixed(2) : "--"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {d.running_hours_delta
                          ? parseFloat(d.running_hours_delta).toFixed(1)
                          : "--"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {d.est_distance_nm ? parseFloat(d.est_distance_nm).toFixed(1) : "--"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {d.avg_sog ? parseFloat(d.avg_sog).toFixed(1) : "--"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {d.main_engine_flow ? parseFloat(d.main_engine_flow).toFixed(1) : "--"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {d.generator_flow ? parseFloat(d.generator_flow).toFixed(1) : "--"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {d.avg_density ? parseFloat(d.avg_density).toFixed(4) : "--"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
