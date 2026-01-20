/**
 * MQTT Reliable Sync - Types
 * 
 * Core types and interfaces for the MQTT reliable sync service.
 */

export interface MqttMessage {
  topic: string;
  payload: any;
  qos: 0 | 1 | 2; // Quality of Service level
  retain: boolean; // Whether to retain message for late joiners
}

export interface ReliableSyncConfig {
  brokerUrl: string;
  clientIdPrefix: string;
  reconnectPeriod: number;
  qosLevel: 0 | 1 | 2;
  maxQueueSize: number;
  enableTls: boolean;
  queueDir: string; // Directory for JSONL queue persistence
  vesselId: string; // Stable vessel identifier for durable sessions
}

export interface MqttMetrics {
  messagesPublished: number;
  messagesQueued: number;
  messagesDropped: number;
  publishFailures: number;
  reconnectionAttempts: number;
  queueFlushes: number;
}

export interface ServiceMetrics extends MqttMetrics {
  currentQueueSize: number;
  maxQueueSize: number;
  queueUtilization: number;
  isConnected: boolean;
  reconnectAttempts: number;
}

export interface HealthStatus {
  status: "connected" | "disconnected";
  broker: string;
  qosLevel: 0 | 1 | 2;
  queuedMessages: number;
  maxQueueSize: number;
  queueUtilization: string;
  activeSubscriptions: number;
  topics: number;
  reconnectAttempts: number;
  tlsEnabled: boolean;
  metrics: ServiceMetrics;
}

export interface PublishOptions {
  qos?: 0 | 1 | 2;
  retain?: boolean;
}

export type DataChangeOperation = "create" | "update" | "delete";
