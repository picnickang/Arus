export interface SystemSettings {
  id: string;
  orgId: string;
  settingKey: string;
  settingValue: string;
  category: string;
  description?: string;
  isEncrypted?: boolean;
  updatedAt?: Date;
  updatedBy?: string;
}

export interface IntegrationConfig {
  id: string;
  orgId: string;
  integrationType: string;
  name: string;
  isEnabled: boolean;
  config: Record<string, unknown>;
  lastSyncAt?: Date;
  syncStatus?: "success" | "failed" | "pending";
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AuditEvent {
  id: string;
  orgId: string;
  eventType: string;
  entityType: string;
  entityId?: string;
  userId?: string;
  userName?: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
}

export interface TransportSettings {
  id: string;
  vesselId: string;
  mqttBroker?: string;
  mqttPort?: number;
  mqttUsername?: string;
  httpEndpoint?: string;
  syncIntervalSeconds?: number;
  retryAttempts?: number;
  isEnabled: boolean;
}

export interface StorageConfig {
  id: string;
  orgId: string;
  storageType: "local" | "gcs" | "s3";
  bucketName?: string;
  region?: string;
  isEnabled: boolean;
  config?: Record<string, unknown>;
}

export const SETTING_CATEGORIES = [
  "general",
  "notifications",
  "security",
  "integrations",
  "maintenance",
  "analytics",
] as const;

export const INTEGRATION_TYPES = [
  "stormgeo",
  "aquametro_fmcc",
  "openweather",
  "sendgrid",
  "openai",
] as const;

export type SettingCategory = typeof SETTING_CATEGORIES[number];
export type IntegrationType = typeof INTEGRATION_TYPES[number];
