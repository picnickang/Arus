import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Anchor, Droplets } from "lucide-react";
import type { BunkeringEvent } from "./_shared";

export function BunkeringTab({
  bunkerings,
  bunkeringLoading,
}: {
  bunkerings: BunkeringEvent[];
  bunkeringLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Anchor className="h-5 w-5" />
          Bunkering Events
        </CardTitle>
        <CardDescription>
          Auto-detected and manual bunkering operations (last 30 days)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {bunkeringLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : bunkerings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Droplets className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No bunkering events recorded</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vessel</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Ended</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Volume (MT)</TableHead>
                  <TableHead className="text-right">Avg Flow</TableHead>
                  <TableHead>Fuel</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Port</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bunkerings.map((b) => {
                  const durationMin = b.ended_at
                    ? Math.round(
                        (new Date(b.ended_at).getTime() - new Date(b.started_at).getTime()) / 60000
                      )
                    : null;
                  return (
                    <TableRow key={b.id} data-testid={`bunkering-row-${b.id}`}>
                      <TableCell className="font-medium">{b.vessel_name || b.vessel_id}</TableCell>
                      <TableCell>{format(new Date(b.started_at), "dd MMM HH:mm")}</TableCell>
                      <TableCell>
                        {b.ended_at ? format(new Date(b.ended_at), "dd MMM HH:mm") : "--"}
                      </TableCell>
                      <TableCell>{durationMin != null ? `${durationMin} min` : "--"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            b.status === "completed"
                              ? "secondary"
                              : b.status === "in_progress"
                                ? "default"
                                : "outline"
                          }
                        >
                          {b.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {b.volume_kg ? (parseFloat(b.volume_kg) / 1000).toFixed(2) : "--"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {b.avg_flow_kg_per_h
                          ? `${parseFloat(b.avg_flow_kg_per_h).toFixed(0)} kg/h`
                          : "--"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{b.fuel_type?.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{b.supplier || "--"}</TableCell>
                      <TableCell className="text-sm">{b.port || "--"}</TableCell>
                      <TableCell>
                        <Badge variant={b.source === "auto" ? "default" : "secondary"}>
                          {b.source}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
