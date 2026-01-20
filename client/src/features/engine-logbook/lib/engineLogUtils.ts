import { z } from "zod";
import {
  Power, Activity, Zap, Fuel, Droplets, Bell, Wrench, Users,
  Settings, FileText, Thermometer, Gauge, type LucideIcon,
} from "lucide-react";

export interface EngineEventUIConfig {
  label: string;
  icon: LucideIcon;
  color: string;
}

export const ENGINE_EVENT_TYPES_UI: Record<string, EngineEventUIConfig> = {
  ME_START: { label: "ME Start", icon: Power, color: "bg-green-500" },
  ME_STOP: { label: "ME Stop", icon: Power, color: "bg-red-500" },
  ME_LOAD_CHANGE: { label: "ME Load Change", icon: Activity, color: "bg-blue-500" },
  DG_START: { label: "DG Start", icon: Zap, color: "bg-green-400" },
  DG_STOP: { label: "DG Stop", icon: Zap, color: "bg-red-400" },
  DG_LOAD_TRANSFER: { label: "DG Load Transfer", icon: Zap, color: "bg-blue-400" },
  FUEL_TRANSFER: { label: "Fuel Transfer", icon: Fuel, color: "bg-amber-500" },
  BUNKERING: { label: "Bunkering", icon: Fuel, color: "bg-cyan-500" },
  OIL_TRANSFER: { label: "Oil Transfer", icon: Droplets, color: "bg-yellow-500" },
  BILGE_PUMP: { label: "Bilge Pump", icon: Droplets, color: "bg-purple-500" },
  ALARM_TRIGGERED: { label: "Alarm", icon: Bell, color: "bg-red-600" },
  ALARM_CLEARED: { label: "Alarm Cleared", icon: Bell, color: "bg-green-600" },
  WORK_ORDER_ACTION: { label: "Work Order", icon: Wrench, color: "bg-yellow-600" },
  WATCH_CHANGE: { label: "Watch Change", icon: Users, color: "bg-purple-600" },
  MAINTENANCE: { label: "Maintenance", icon: Wrench, color: "bg-orange-500" },
  INSPECTION: { label: "Inspection", icon: Settings, color: "bg-indigo-500" },
  TEMPERATURE_ALERT: { label: "Temp Alert", icon: Thermometer, color: "bg-red-500" },
  PRESSURE_ALERT: { label: "Press Alert", icon: Gauge, color: "bg-orange-600" },
  MANUAL_ENTRY: { label: "Manual Entry", icon: FileText, color: "bg-gray-500" },
  REMARK: { label: "Remark", icon: FileText, color: "bg-gray-400" },
  CUSTOM: { label: "Custom", icon: Settings, color: "bg-slate-500" },
};

export const MANUAL_ENGINE_EVENT_TYPES = [
  { value: "ME_START", label: "Main Engine Start" },
  { value: "ME_STOP", label: "Main Engine Stop" },
  { value: "DG_START", label: "Generator Start" },
  { value: "DG_STOP", label: "Generator Stop" },
  { value: "DG_LOAD_TRANSFER", label: "Generator Load Transfer" },
  { value: "FUEL_TRANSFER", label: "Fuel Transfer" },
  { value: "BUNKERING", label: "Bunkering" },
  { value: "OIL_TRANSFER", label: "Lube Oil Transfer" },
  { value: "BILGE_PUMP", label: "Bilge Pump Operation" },
  { value: "MAINTENANCE", label: "Maintenance Activity" },
  { value: "INSPECTION", label: "Inspection" },
  { value: "REMARK", label: "General Remark" },
  { value: "CUSTOM", label: "Custom Event" },
] as const;

export interface AutoFillResult {
  success: boolean;
  mainEngine: { hoursProcessed: number; totalFieldsPopulated: number; totalAnomalies: number };
  generators: { hoursProcessed: number; generatorsProcessed: number; anomalies: number };
}

export const optionalNumber = () =>
  z.string().optional()
    .transform((val) => (val === "" || val === undefined ? undefined : val))
    .pipe(z.union([z.undefined(), z.coerce.number()]));

export const manualEngineEventFormSchema = z.object({
  eventType: z.enum([
    "ME_START", "ME_STOP", "DG_START", "DG_STOP", "DG_LOAD_TRANSFER",
    "FUEL_TRANSFER", "BUNKERING", "OIL_TRANSFER", "BILGE_PUMP",
    "MAINTENANCE", "INSPECTION", "REMARK", "CUSTOM"
  ], { required_error: "Please select an event type" }),
  summary: z.string().min(5, "Summary must be at least 5 characters").max(500),
  details: z.string().max(2000).optional(),
  equipmentId: z.string().optional(),
  meRpm: optionalNumber(),
  meLoad: optionalNumber(),
});

export type ManualEngineEventFormValues = z.infer<typeof manualEngineEventFormSchema>;

export function getEngineEventTypeConfig(eventType: string): EngineEventUIConfig {
  return ENGINE_EVENT_TYPES_UI[eventType] || ENGINE_EVENT_TYPES_UI.CUSTOM;
}

export function createDefaultManualEventFormValues(): Partial<ManualEngineEventFormValues> {
  return { eventType: undefined, summary: "", details: "", equipmentId: "", meRpm: undefined, meLoad: undefined };
}
