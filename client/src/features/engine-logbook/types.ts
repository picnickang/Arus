export interface EngineLogDaily {
  id: string;
  orgId: string;
  vesselId: string;
  logDate: string;
  status: string;
  signedByCrewId?: string;
  signedByName?: string;
  signedByRank?: string;
  signedAt?: Date;
  lockedAt?: Date;
  lockedByUserId?: string;
  lockedByUserName?: string;
  meRunningHours?: number;
  meRevolutions?: number;
  avgMeRpm?: number;
  avgMeLoad?: number;
  foConsumption?: number;
  doConsumption?: number;
  loConsumption?: number;
  fwProduced?: number;
  fwConsumed?: number;
  chiefEngineerRemarks?: string;
  secondEngineerRemarks?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface EngineLogHourly {
  id: string;
  dailyLogId: string;
  hour: number;
  meRpm?: number;
  meLoad?: number;
  meFuelRackPosition?: number;
  meExhaustTempPort?: number;
  meExhaustTempStbd?: number;
  meScavAirPress?: number;
  meScavAirTemp?: number;
  meTurbochargerRpm?: number;
  meTurbochargerExhaustTemp?: number;
  meCoolantTempIn?: number;
  meCoolantTempOut?: number;
  meLubOilPress?: number;
  meLubOilTemp?: number;
  meFuelOilPress?: number;
  meFuelOilTemp?: number;
  meFuelOilViscosity?: number;
  seaWaterCoolingTemp?: number;
  freshWaterCoolingTemp?: number;
  airCompressorPress?: number;
  startingAirPress?: number;
  controlAirPress?: number;
  engineRoomTemp?: number;
  engineRoomHumidity?: number;
  meRunningHours?: number;
  remarks?: string;
}

export interface EngineLogGenerator {
  id: string;
  dailyLogId: string;
  generatorNumber: number;
  hour: number;
  loadKw?: number;
  voltage?: number;
  frequency?: number;
  exhaustTemp?: number;
  lubOilPress?: number;
  coolantTemp?: number;
  runningHours?: number;
  status?: string;
}

export interface EngineLogWatch {
  id: string;
  dailyLogId: string;
  watchPeriod: string;
  chiefEngineerName?: string;
  secondEngineerName?: string;
  thirdEngineerName?: string;
  electricalOfficerName?: string;
  motormanName?: string;
  oilerName?: string;
}

export interface EngineLogEvent {
  id: string;
  vesselId: string;
  dayId: string;
  timestamp: Date;
  eventType: string;
  source: string;
  summary: string;
  details?: string;
  equipmentType?: string;
  equipmentId?: string;
  meRpm?: number;
  meLoad?: number;
  alarmCode?: string;
  alarmSeverity?: string;
  createdByUserId?: string;
  createdByUserName?: string;
}

export interface EngineLogComplete {
  daily: EngineLogDaily;
  hourlyEntries: EngineLogHourly[];
  generatorEntries: EngineLogGenerator[];
  watches: EngineLogWatch[];
  events: EngineLogEvent[];
}

export const WATCH_PERIODS = ["00-06", "06-12", "12-18", "18-24"] as const;
export const GENERATOR_NUMBERS = [1, 2, 3, 4] as const;

export const ENGINE_EVENT_TYPES = {
  ME_START: { label: "ME Start", color: "bg-green-500" },
  ME_STOP: { label: "ME Stop", color: "bg-red-500" },
  ME_LOAD_CHANGE: { label: "ME Load Change", color: "bg-blue-500" },
  DG_START: { label: "DG Start", color: "bg-green-400" },
  DG_STOP: { label: "DG Stop", color: "bg-red-400" },
  DG_LOAD_TRANSFER: { label: "DG Load Transfer", color: "bg-blue-400" },
  FUEL_TRANSFER: { label: "Fuel Transfer", color: "bg-amber-500" },
  BUNKERING: { label: "Bunkering", color: "bg-cyan-500" },
  OIL_TRANSFER: { label: "Oil Transfer", color: "bg-yellow-500" },
  BILGE_PUMP: { label: "Bilge Pump", color: "bg-purple-500" },
  ALARM_TRIGGERED: { label: "Alarm", color: "bg-red-600" },
  ALARM_CLEARED: { label: "Alarm Cleared", color: "bg-green-600" },
  WORK_ORDER_ACTION: { label: "Work Order", color: "bg-yellow-600" },
  WATCH_CHANGE: { label: "Watch Change", color: "bg-purple-600" },
  MAINTENANCE: { label: "Maintenance", color: "bg-orange-500" },
  INSPECTION: { label: "Inspection", color: "bg-indigo-500" },
  TEMPERATURE_ALERT: { label: "Temp Alert", color: "bg-red-500" },
  PRESSURE_ALERT: { label: "Pressure Alert", color: "bg-orange-600" },
  FW_GENERATION: { label: "FW Generation", color: "bg-blue-600" },
  BOILER_START: { label: "Boiler Start", color: "bg-yellow-600" },
  BOILER_STOP: { label: "Boiler Stop", color: "bg-gray-500" },
  OTHER: { label: "Other", color: "bg-gray-400" },
} as const;

export type EngineEventType = keyof typeof ENGINE_EVENT_TYPES;
