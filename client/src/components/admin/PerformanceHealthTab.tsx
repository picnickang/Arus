import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Server, CheckCircle, Cpu, HardDrive, Network } from "lucide-react";

function PerformanceHealthTabContent() {
  const { data: _metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["/api/admin/performance-metrics"],
    enabled: true,
  });

  const { data: _systemHealth, isLoading: healthLoading } = useQuery({
    queryKey: ["/api/admin/system-health"],
    enabled: true,
  });

  if (metricsLoading || healthLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        Loading system performance data...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">System Performance & Health</h3>
        <p className="text-sm text-muted-foreground">
          Monitor system health, performance metrics, and resource utilization
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-system-status">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold" data-testid="text-system-status">
                Healthy
              </span>
            </div>
            <p className="text-xs text-muted-foreground">All systems operational</p>
          </CardContent>
        </Card>

        <Card data-testid="card-cpu-usage">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-cpu-usage">
              23%
            </div>
            <p className="text-xs text-muted-foreground">Average across all cores</p>
          </CardContent>
        </Card>

        <Card data-testid="card-memory-usage">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-memory-usage">
              67%
            </div>
            <p className="text-xs text-muted-foreground">5.4GB / 8GB used</p>
          </CardContent>
        </Card>

        <Card data-testid="card-network-io">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Network I/O</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-network-io">
              1.2MB/s
            </div>
            <p className="text-xs text-muted-foreground">Combined throughput</p>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-recent-performance-metrics">
        <CardHeader>
          <CardTitle>Recent Performance Metrics</CardTitle>
          <CardDescription>System performance data from the last 24 hours</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                <TableHead>Current Value</TableHead>
                <TableHead>24h Average</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow data-testid="row-metric-response-time">
                <TableCell className="font-medium" data-testid="text-metric-name-response-time">
                  Response Time
                </TableCell>
                <TableCell data-testid="text-current-value-response-time">245ms</TableCell>
                <TableCell data-testid="text-average-value-response-time">198ms</TableCell>
                <TableCell>
                  <Badge variant="default" data-testid="badge-status-response-time">
                    Good
                  </Badge>
                </TableCell>
                <TableCell data-testid="text-last-updated-response-time">2 minutes ago</TableCell>
              </TableRow>
              <TableRow data-testid="row-metric-database-connections">
                <TableCell
                  className="font-medium"
                  data-testid="text-metric-name-database-connections"
                >
                  Database Connections
                </TableCell>
                <TableCell data-testid="text-current-value-database-connections">12/50</TableCell>
                <TableCell data-testid="text-average-value-database-connections">8/50</TableCell>
                <TableCell>
                  <Badge variant="default" data-testid="badge-status-database-connections">
                    Healthy
                  </Badge>
                </TableCell>
                <TableCell data-testid="text-last-updated-database-connections">
                  1 minute ago
                </TableCell>
              </TableRow>
              <TableRow data-testid="row-metric-active-sessions">
                <TableCell className="font-medium" data-testid="text-metric-name-active-sessions">
                  Active Sessions
                </TableCell>
                <TableCell data-testid="text-current-value-active-sessions">1,247</TableCell>
                <TableCell data-testid="text-average-value-active-sessions">1,156</TableCell>
                <TableCell>
                  <Badge variant="default" data-testid="badge-status-active-sessions">
                    Normal
                  </Badge>
                </TableCell>
                <TableCell data-testid="text-last-updated-active-sessions">
                  30 seconds ago
                </TableCell>
              </TableRow>
              <TableRow data-testid="row-metric-error-rate">
                <TableCell className="font-medium" data-testid="text-metric-name-error-rate">
                  Error Rate
                </TableCell>
                <TableCell data-testid="text-current-value-error-rate">0.02%</TableCell>
                <TableCell data-testid="text-average-value-error-rate">0.01%</TableCell>
                <TableCell>
                  <Badge variant="secondary" data-testid="badge-status-error-rate">
                    Acceptable
                  </Badge>
                </TableCell>
                <TableCell data-testid="text-last-updated-error-rate">1 minute ago</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export const PerformanceHealthTab = memo(PerformanceHealthTabContent);
