import { AlertTriangle, Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface Vessel {
  id: string;
  name: string;
  vessel_type?: string;
  online_status?: string;
}

export interface RmsSummary {
  alerts?: { unacknowledged?: number; critical?: number; total24h?: number };
  bunkering?: { last30Days?: number; active?: number };
  efmsConnections?: { polling?: number; total?: number; error?: number };
}

export interface RmsAlert {
  id: string;
  vessel_id: string;
  vessel_name?: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  acknowledged: boolean;
  created_at: string;
}

export interface BunkeringEvent {
  id: string;
  vessel_id: string;
  vessel_name?: string;
  started_at: string;
  ended_at?: string;
  status: string;
  volume_kg?: string;
  avg_flow_kg_per_h?: string;
  fuel_type?: string;
  source?: string;
  supplier?: string;
  port?: string;
}

export interface AlertConfig {
  id: string;
  vessel_id: string;
  vessel_name?: string;
  name: string;
  alert_type: string;
  enabled: boolean;
  cooldown_minutes: number;
  config: Record<string, unknown>;
  last_triggered_at?: string;
}

export interface HourlyConsumption {
  hour: string;
  avg_flow_kg_per_h?: string;
  max_flow_kg_per_h?: string;
  min_flow_kg_per_h?: string;
  avg_density?: string;
  avg_temperature?: string;
  main_engine_flow?: string;
  port_engine_flow?: string;
  stbd_engine_flow?: string;
  generator_flow?: string;
  boiler_flow?: string;
  do_flow?: string;
  shaft_power_kw?: string;
  shaft_rpm?: string;
  running_hours?: string;
  data_points?: number;
}

export interface DailyConsumption {
  day: string;
  avg_flow_kg_per_h?: string;
  estimated_daily_mt?: string;
  running_hours_delta?: string;
  est_distance_nm?: string;
  avg_sog?: string;
  main_engine_flow?: string;
  generator_flow?: string;
  avg_density?: string;
}

export interface TankReading {
  sensor_type: string;
  value: string;
  timestamp?: string;
}

export interface RobEstimate {
  avgConsumptionKgPerH: number;
  tanks?: TankReading[];
  estimatedAt?: string;
}

export interface FleetPosition {
  vessel_id: string;
  vessel_name?: string;
  latitude?: number;
  longitude?: number;
  sog?: number;
  cog?: number;
  heading?: number;
  last_position_at?: string;
}

export interface TrackPoint {
  latitude: number;
  longitude: number;
  sog?: number;
  cog?: number;
  heading?: number;
  timestamp?: string;
}

export function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "critical") {
    return <AlertTriangle className="h-5 w-5 text-red-500" />;
  }
  if (severity === "warning") {
    return <AlertTriangle className="h-5 w-5 text-amber-500" />;
  }
  return <Bell className="h-5 w-5 text-blue-500" />;
}

export function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    warning: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    info: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  };
  return <Badge className={colors[severity] || colors.info}>{severity}</Badge>;
}
