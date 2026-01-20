import type {
  AlertConfiguration,
  InsertAlertConfig,
  AlertNotification,
  InsertAlertNotification,
  AlertSuppression,
  InsertAlertSuppression,
  AlertComment,
  InsertAlertComment,
} from "@shared/schema-runtime";

export interface AlertFilters {
  equipmentId?: string;
  severity?: "critical" | "warning" | "info";
  acknowledged?: boolean;
  startDate?: Date;
  endDate?: Date;
  orgId?: string;
  limit?: number;
  offset?: number;
}

export interface PaginatedAlerts {
  data: AlertNotification[];
  total: number;
  hasMore: boolean;
}

export interface IAlertConfigurationStorage {
  getAlertConfigurations(equipmentId?: string, orgId?: string): Promise<AlertConfiguration[]>;
  getAlertConfiguration(id: string, orgId?: string): Promise<AlertConfiguration | undefined>;
  createAlertConfiguration(config: InsertAlertConfig): Promise<AlertConfiguration>;
  updateAlertConfiguration(
    id: string,
    config: Partial<InsertAlertConfig>,
    orgId?: string
  ): Promise<AlertConfiguration>;
  deleteAlertConfiguration(id: string, orgId?: string): Promise<void>;
  toggleAlertConfiguration(id: string, enabled: boolean, orgId?: string): Promise<AlertConfiguration>;
}

export interface IAlertNotificationStorage {
  getAlertNotifications(acknowledged?: boolean, orgId?: string): Promise<AlertNotification[]>;
  getAlertNotificationsPaginated(filters: AlertFilters): Promise<PaginatedAlerts>;
  getAlertNotification(id: string, orgId?: string): Promise<AlertNotification | undefined>;
  createAlertNotification(notification: InsertAlertNotification): Promise<AlertNotification>;
  acknowledgeAlert(
    id: string,
    acknowledgedBy: string,
    resolution?: string,
    orgId?: string
  ): Promise<AlertNotification>;
  bulkAcknowledgeAlerts(
    ids: string[],
    acknowledgedBy: string,
    orgId?: string
  ): Promise<number>;
  getAlertsByEquipment(equipmentId: string, orgId?: string): Promise<AlertNotification[]>;
  getRecentAlerts(hours?: number, orgId?: string): Promise<AlertNotification[]>;
}

export interface IAlertSuppressionStorage {
  createAlertSuppression(suppression: InsertAlertSuppression): Promise<AlertSuppression>;
  getActiveSuppressions(orgId?: string): Promise<AlertSuppression[]>;
  removeAlertSuppression(id: string, orgId?: string): Promise<void>;
  isAlertSuppressed(
    equipmentId: string,
    sensorType: string,
    orgId?: string
  ): Promise<boolean>;
}

export interface IAlertCommentStorage {
  addAlertComment(comment: InsertAlertComment): Promise<AlertComment>;
  getAlertComments(alertId: string, orgId?: string): Promise<AlertComment[]>;
  deleteAlertComment(id: string, orgId?: string): Promise<void>;
}

export interface IAlertCooldownStorage {
  checkCooldown(
    equipmentId: string,
    sensorType: string,
    alertType: string,
    orgId?: string
  ): Promise<boolean>;
  recordCooldown(
    equipmentId: string,
    sensorType: string,
    alertType: string,
    cooldownMinutes: number,
    orgId?: string
  ): Promise<void>;
  clearCooldown(
    equipmentId: string,
    sensorType: string,
    alertType: string,
    orgId?: string
  ): Promise<void>;
}
