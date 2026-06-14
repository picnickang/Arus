import { Link } from "wouter";
import { format, formatDistanceToNow } from "date-fns";
import { Box, Download, Eye, Pencil, RefreshCw, Ship, Trash2 } from "lucide-react";
import type { Vessel } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveTable } from "@/components/shared/ResponsiveTable";
import { formatVesselClass } from "./utils";
import type { VesselManagementModel } from "./VesselManagementTypes";

interface VesselFleetOverviewProps {
  model: VesselManagementModel;
  getConditionBadge: (vessel: Vessel) => JSX.Element;
  getStatusBadge: (vessel: Vessel) => JSX.Element;
}

export function VesselFleetOverview({
  model: v,
  getConditionBadge,
  getStatusBadge,
}: VesselFleetOverviewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ship className="h-5 w-5" />
          Fleet Overview
        </CardTitle>
        <CardDescription>{v.vessels.length} vessel(s) in your fleet</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ResponsiveTable
          columns={[
            {
              header: "Vessel Name",
              accessor: (vessel: Vessel) => (
                <Link
                  href={`/vessels/${vessel.id}`}
                  className="hover:underline text-primary font-medium"
                  data-testid={`text-vessel-name-${vessel.id}`}
                >
                  {vessel.name}
                </Link>
              ),
            },
            {
              header: "Class",
              accessor: (vessel: Vessel) => (
                <span data-testid={`text-vessel-class-${vessel.id}`}>
                  {vessel.vesselClass ? formatVesselClass(vessel.vesselClass) : "Not specified"}
                </span>
              ),
            },
            {
              header: "Condition",
              accessor: (vessel: Vessel) => (
                <span data-testid={`badge-vessel-condition-${vessel.id}`}>
                  {getConditionBadge(vessel)}
                </span>
              ),
            },
            {
              header: "Status",
              accessor: (vessel: Vessel) => (
                <span data-testid={`badge-vessel-status-${vessel.id}`}>
                  {getStatusBadge(vessel)}
                </span>
              ),
            },
            {
              header: "Last Heartbeat",
              accessor: (vessel: Vessel) =>
                vessel.lastHeartbeat ? (
                  <span
                    title={format(new Date(vessel.lastHeartbeat), "PPpp")}
                    data-testid={`text-vessel-heartbeat-${vessel.id}`}
                  >
                    {formatDistanceToNow(new Date(vessel.lastHeartbeat), { addSuffix: true })}
                  </span>
                ) : (
                  <span
                    className="text-muted-foreground"
                    data-testid={`text-vessel-heartbeat-${vessel.id}`}
                  >
                    Never
                  </span>
                ),
            },
          ]}
          data={v.vessels as object as Vessel[]}
          keyExtractor={(vessel: Vessel) => vessel.id}
          actions={(vessel: Vessel) => (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => v.handleRefresh(vessel)}
                data-testid={`button-refresh-${vessel.id}`}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => v.handleView(vessel)}
                data-testid={`button-view-${vessel.id}`}
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Link href={`/vessels/${vessel.id}/3d`}>
                <Button
                  variant="outline"
                  size="sm"
                  data-testid={`button-view-3d-${vessel.id}`}
                  title="Open 3D digital twin"
                >
                  <Box className="h-4 w-4" />
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => v.handleExport(vessel)}
                disabled={v.exportVesselMutation.isPending}
                data-testid={`button-export-${vessel.id}`}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => v.handleEdit(vessel)}
                data-testid={`button-edit-${vessel.id}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => v.handleDelete(vessel)}
                className="text-destructive hover:text-destructive"
                data-testid={`button-delete-${vessel.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        />
      </CardContent>
    </Card>
  );
}
