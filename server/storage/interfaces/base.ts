import type { 
  Organization, InsertOrganization,
  User, InsertUser,
  Device, InsertDevice,
  Equipment, InsertEquipment,
  Vessel, InsertVessel,
  WorkOrder, InsertWorkOrder,
  MaintenanceSchedule, InsertMaintenanceSchedule,
  PartsInventory, InsertPartsInventory,
  AlertConfiguration, InsertAlertConfig,
  AlertNotification, InsertAlertNotification,
  SensorConfiguration, InsertSensorConfiguration,
  CrewMember, InsertCrew,
  SystemSettings, InsertSettings,
} from "@shared/schema-runtime";

export interface IOrganizationStorage {
  getOrganizations(): Promise<Organization[]>;
  getOrganization(id: string): Promise<Organization | undefined>;
  getOrganizationBySlug(slug: string): Promise<Organization | undefined>;
  createOrganization(org: InsertOrganization): Promise<Organization>;
  updateOrganization(id: string, org: Partial<InsertOrganization>): Promise<Organization>;
  deleteOrganization(id: string): Promise<void>;
}

export interface IUserStorage {
  getUsers(orgId?: string): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string, orgId?: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User>;
  deleteUser(id: string): Promise<void>;
}

export interface IDeviceStorage {
  getDevices(orgId?: string): Promise<Device[]>;
  getDevice(id: string, orgId?: string): Promise<Device | undefined>;
  createDevice(device: InsertDevice): Promise<Device>;
  updateDevice(id: string, device: Partial<InsertDevice>, orgId: string): Promise<Device>;
  deleteDevice(id: string, orgId: string): Promise<void>;
}

export interface IEquipmentStorage {
  getEquipment(orgId: string, equipmentId: string): Promise<Equipment | undefined>;
  getEquipmentRegistry(orgId?: string): Promise<Equipment[]>;
  createEquipment(equipment: InsertEquipment): Promise<Equipment>;
  updateEquipment(id: string, equipment: Partial<InsertEquipment>, orgId?: string): Promise<Equipment>;
  deleteEquipment(id: string, orgId?: string): Promise<void>;
  getEquipmentByVessel(vesselId: string, orgId: string): Promise<Equipment[]>;
}

export interface IVesselStorage {
  getVessels(orgId?: string): Promise<Vessel[]>;
  getVessel(id: string, orgId?: string): Promise<Vessel | undefined>;
  createVessel(vessel: InsertVessel): Promise<Vessel>;
  updateVessel(id: string, vessel: Partial<InsertVessel>, orgId?: string): Promise<Vessel>;
  deleteVessel(id: string, orgId?: string): Promise<void>;
}

export interface IWorkOrderStorage {
  getWorkOrders(equipmentId?: string, orgId?: string, filters?: WorkOrderFilters): Promise<WorkOrder[]>;
  getWorkOrder(orgId: string, workOrderId: string): Promise<WorkOrder | undefined>;
  createWorkOrder(order: InsertWorkOrder & { woNumber?: string }): Promise<WorkOrder>;
  updateWorkOrder(id: string, order: Partial<InsertWorkOrder>): Promise<WorkOrder>;
  deleteWorkOrder(id: string): Promise<void>;
  generateWorkOrderNumber(orgId: string): Promise<string>;
}

export interface IMaintenanceStorage {
  getMaintenanceSchedules(equipmentId?: string, status?: string): Promise<MaintenanceSchedule[]>;
  createMaintenanceSchedule(schedule: InsertMaintenanceSchedule): Promise<MaintenanceSchedule>;
  updateMaintenanceSchedule(id: string, schedule: Partial<InsertMaintenanceSchedule>): Promise<MaintenanceSchedule>;
  deleteMaintenanceSchedule(id: string): Promise<void>;
  getUpcomingSchedules(days?: number): Promise<MaintenanceSchedule[]>;
}

export interface IInventoryStorage {
  getPartsInventory(filters?: InventoryFilters): Promise<PartsInventory[]>;
  getPartById(id: string, orgId?: string): Promise<PartsInventory | undefined>;
  createPart(part: InsertPartsInventory): Promise<PartsInventory>;
  updatePart(id: string, part: Partial<InsertPartsInventory>, orgId?: string): Promise<PartsInventory>;
  deletePart(id: string, orgId: string): Promise<void>;
  getLowStockParts(orgId?: string): Promise<PartsInventory[]>;
}

export interface IAlertStorage {
  getAlertConfigurations(equipmentId?: string): Promise<AlertConfiguration[]>;
  createAlertConfiguration(config: InsertAlertConfig): Promise<AlertConfiguration>;
  updateAlertConfiguration(id: string, config: Partial<InsertAlertConfig>): Promise<AlertConfiguration>;
  deleteAlertConfiguration(id: string): Promise<void>;
  getAlertNotifications(acknowledged?: boolean, orgId?: string): Promise<AlertNotification[]>;
  createAlertNotification(notification: InsertAlertNotification): Promise<AlertNotification>;
}

export interface ISensorStorage {
  getSensorConfigurations(orgId: string, equipmentId?: string, sensorType?: string): Promise<SensorConfiguration[]>;
  getSensorConfiguration(equipmentId: string, sensorType: string, orgId?: string): Promise<SensorConfiguration | undefined>;
  createSensorConfiguration(config: InsertSensorConfiguration): Promise<SensorConfiguration>;
  updateSensorConfiguration(equipmentId: string, sensorType: string, config: Partial<InsertSensorConfiguration>, orgId?: string): Promise<SensorConfiguration>;
  deleteSensorConfiguration(equipmentId: string, sensorType: string, orgId?: string): Promise<void>;
}

export interface ICrewStorage {
  getCrew(orgId?: string): Promise<CrewMember[]>;
  getCrewMember(id: string, orgId?: string): Promise<CrewMember | undefined>;
  createCrewMember(crew: InsertCrew): Promise<CrewMember>;
  updateCrew(id: string, crew: Partial<InsertCrew>, orgId?: string): Promise<CrewMember>;
  deleteCrew(id: string, orgId: string): Promise<void>;
}

export interface ISettingsStorage {
  getSettings(): Promise<SystemSettings>;
  updateSettings(settings: Partial<InsertSettings>): Promise<SystemSettings>;
}

export interface WorkOrderFilters {
  status?: string;
  priority?: string;
  assignedTo?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

export interface InventoryFilters {
  orgId?: string;
  category?: string;
  search?: string;
  lowStock?: boolean;
  limit?: number;
  offset?: number;
}
