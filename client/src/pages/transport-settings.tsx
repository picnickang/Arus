import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wifi, Server, Database, Activity } from "lucide-react";

interface TransportSettingsProps {
  embedded?: boolean;
}

export default function TransportSettings({ embedded }: TransportSettingsProps) {
  return (
    <div className={embedded ? "" : "p-6"}>
      <div className="space-y-6">
        {!embedded && (
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-transport-title">Data & Transport Settings</h1>
            <p className="text-muted-foreground">Configure data synchronization and transport protocols</p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">MQTT Connection</CardTitle>
              <Wifi className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Disconnected</Badge>
                <span className="text-xs text-muted-foreground">Local broker not configured</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                MQTT is used for real-time telemetry sync between vessels and cloud
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">SQLite Bridge</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Standby</Badge>
                <span className="text-xs text-muted-foreground">Phase A mode</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Local SQLite database for offline telemetry buffering
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Redis Cache</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Fallback Mode</Badge>
                <span className="text-xs text-muted-foreground">Using in-memory cache</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Redis provides distributed caching for analytics and inventory
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Batch Writer</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge>Active</Badge>
                <span className="text-xs text-muted-foreground">500ms flush interval</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Batches telemetry writes to PostgreSQL for performance
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
