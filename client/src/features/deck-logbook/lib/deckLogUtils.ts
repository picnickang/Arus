import { z } from "zod";
import {
  Activity,
  Navigation,
  Anchor,
  Users,
  Settings,
  Fuel,
  AlertTriangle,
  Wrench,
  Bell,
  MapPin,
  FileText,
  type LucideIcon,
} from "lucide-react";

export interface DeckEventUIConfig {
  label: string;
  icon: LucideIcon;
  color: string;
}

const CUSTOM_EVENT_CONFIG: DeckEventUIConfig = {
  label: "Custom",
  icon: Settings,
  color: "bg-slate-500",
};

export const EVENT_TYPES_UI: Record<string, DeckEventUIConfig> = {
  ENGINE_START: { label: "Engine Start", icon: Activity, color: "bg-green-500" },
  ENGINE_STOP: { label: "Engine Stop", icon: Activity, color: "bg-red-500" },
  DEPARTURE: { label: "Departure", icon: Navigation, color: "bg-blue-500" },
  ARRIVAL: { label: "Arrival", icon: Anchor, color: "bg-blue-600" },
  ANCHORING: { label: "Anchoring", icon: Anchor, color: "bg-amber-500" },
  ANCHOR_UP: { label: "Anchor Up", icon: Anchor, color: "bg-amber-400" },
  WATCH_CHANGE: { label: "Watch Change", icon: Users, color: "bg-purple-500" },
  CREW_CHANGE: { label: "Crew Change", icon: Users, color: "bg-purple-600" },
  CARGO_OPS: { label: "Cargo Ops", icon: Settings, color: "bg-orange-500" },
  BUNKERING: { label: "Bunkering", icon: Fuel, color: "bg-cyan-500" },
  FUEL_TRANSFER: { label: "Fuel Transfer", icon: Fuel, color: "bg-cyan-400" },
  DRILL: { label: "Drill", icon: AlertTriangle, color: "bg-red-400" },
  WORK_ORDER_ACTION: { label: "Work Order", icon: Wrench, color: "bg-yellow-500" },
  ALARM_TRIGGERED: { label: "Alarm", icon: Bell, color: "bg-red-600" },
  POSITION_FIX: { label: "Position Fix", icon: MapPin, color: "bg-indigo-500" },
  MOVEMENT: { label: "Movement", icon: Navigation, color: "bg-blue-400" },
  MANUAL_ENTRY: { label: "Manual Entry", icon: FileText, color: "bg-gray-500" },
  REMARK: { label: "Remark", icon: FileText, color: "bg-gray-400" },
  CUSTOM: CUSTOM_EVENT_CONFIG,
};

export const optionalCoordinate = (min: number, max: number) =>
  z
    .string()
    .optional()
    .transform((val) => (val === "" || val === undefined ? undefined : val))
    .pipe(z.union([z.undefined(), z.coerce.number().min(min).max(max)]));

export const manualEventFormSchema = z.object({
  eventType: z.enum(
    [
      "DEPARTURE",
      "ARRIVAL",
      "ANCHORING",
      "ANCHOR_UP",
      "CARGO_OPS",
      "BUNKERING",
      "FUEL_TRANSFER",
      "DRILL",
      "POSITION_FIX",
      "MOVEMENT",
      "REMARK",
      "CUSTOM",
    ],
    { required_error: "Please select an event type" }
  ),
  summary: z
    .string()
    .min(5, "Summary must be at least 5 characters")
    .max(500, "Summary must be less than 500 characters"),
  details: z.string().max(2000, "Details must be less than 2000 characters").optional(),
  positionLat: optionalCoordinate(-90, 90),
  positionLon: optionalCoordinate(-180, 180),
});

export type ManualEventFormValues = z.infer<typeof manualEventFormSchema>;

export interface HourlyEntry {
  hour: number;
  course?: string;
  windDirection?: string;
  windForce?: string;
  seaState?: string;
  visibility?: string;
  barometer?: number;
  airTemp?: number;
  seaTemp?: number;
  remarks?: string;
}

export function getEventTypeConfig(eventType: string): DeckEventUIConfig {
  return EVENT_TYPES_UI[eventType] ?? CUSTOM_EVENT_CONFIG;
}

export function createDefaultManualEventFormValues(): Partial<ManualEventFormValues> {
  return {
    summary: "",
    details: "",
  };
}
