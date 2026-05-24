/**
 * MQTT Reliable Sync Service
 *
 * Provides persistent, guaranteed-delivery sync for critical data using MQTT.
 *
 * Why MQTT instead of WebSocket for critical sync:
 * - Message persistence (retained messages)
 * - Quality of Service (QoS) levels for guaranteed delivery
 * - Automatic message replay on reconnect
 * - Durable subscriptions
 * - Better for unreliable networks (common on vessels)
 */

import { EventEmitter } from "node:events";
import mqtt from "mqtt";
import type {
  ReliableSyncConfig,
  MqttMessage,
  MqttMetrics,
  ServiceMetrics,
  HealthStatus,
  PublishOptions,
  DataChangeOperation,
} from "./types.js";
import { createDefaultConfig, topics } from "./config.js";
import { initializeQueueDirectory, loadPersistedQueue, persistQueue } from "./queue-persistence.js";
import { flushMessageQueue } from "./message-queue.js";
import { publishDataChange } from "./publishing.js";
import {
  subscribeToEntity,
  unsubscribeFromEntity,
  resubscribeAll,
  topicMatches,
  type MqttPayloadCallback,
} from "./subscription.js";
import { publishCatchupMessages } from "./catchup.js";
import { setMqttConnectionStatus, incrementMqttReconnectionAttempts } from "../observability";
import { logExpectedLimitation, logger } from "../utils/logger.js";

export class MqttReliableSyncService extends EventEmitter {
  private client: mqtt.MqttClient | null = null;
  private config: ReliableSyncConfig;
  private isConnected: boolean = false;
  private messageQueue: MqttMessage[] = [];
  private subscriptions: Map<string, Set<MqttPayloadCallback>> = new Map();
  private reconnectAttempts: number = 0;
  private metrics: MqttMetrics = {
    messagesPublished: 0,
    messagesQueued: 0,
    messagesDropped: 0,
    publishFailures: 0,
    reconnectionAttempts: 0,
    queueFlushes: 0,
  };

  constructor(config: Partial<ReliableSyncConfig> = {}) {
    super();
    this.config = createDefaultConfig(config);

    logger.info("MqttReliableSync", "Service initialized", {
      broker: this.config.brokerUrl,
      vesselId: this.config.vesselId,
      qosLevel: this.config.qosLevel,
      maxQueueSize: this.config.maxQueueSize,
      queueDir: this.config.queueDir,
      tlsEnabled: this.config.enableTls,
    });
  }

  async start(): Promise<void> {
    logger.info("MqttReliableSync", "Starting...", { broker: this.config.brokerUrl });

    try {
      await initializeQueueDirectory(this.config.queueDir);
      this.messageQueue = await loadPersistedQueue(this.config.queueDir);

      const stableClientId = `${this.config.clientIdPrefix}_${this.config.vesselId}`;
      const connectOptions: mqtt.IClientOptions = {
        clientId: stableClientId,
        clean: false,
        reconnectPeriod: this.config.reconnectPeriod,
        connectTimeout: 10 * 1000,
        keepalive: 60,
        will: {
          topic: `${topics.system}/status`,
          payload: JSON.stringify({
            status: "offline",
            vesselId: this.config.vesselId,
            timestamp: new Date().toISOString(),
          }),
          qos: 1,
          retain: true,
        },
      };

      if (this.config.enableTls) {
        connectOptions.rejectUnauthorized = process.env.MQTT_TLS_REJECT_UNAUTHORIZED !== "false";
      }

      const isEmbeddedMode = process.env.EMBEDDED_MODE === "true";
      const isLocalMode = process.env.LOCAL_MODE === "true";

      this.client = mqtt.connect(this.config.brokerUrl, connectOptions);

      this.client.on("error", (error) => {
        if (!this.isConnected) {
          setMqttConnectionStatus(false);
        }

        if (!isEmbeddedMode && !isLocalMode) {
          logger.error("MqttReliableSync", "Connection error", { message: error.message });
        }
        this.emit("error", error);
      });

      this.setupEventHandlers();

      return new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (isEmbeddedMode || isLocalMode) {
            logExpectedLimitation(
              "MQTT Reliable Sync",
              "⚠ Broker connection timeout - running in offline mode",
              ["Messages will be queued for delivery when broker becomes available"]
            );
          } else {
            logger.warn("MqttReliableSync", "Broker connection timeout - running in offline mode");
          }
          resolve();
        }, 10000);

        this.client?.once("connect", () => {
          clearTimeout(timeout);
          logger.info("MqttReliableSync", "Connected to broker");
          resolve();
        });
      });
    } catch (error) {
      const isEmbeddedMode = process.env.EMBEDDED_MODE === "true";
      const isLocalMode = process.env.LOCAL_MODE === "true";

      if (isEmbeddedMode || isLocalMode) {
        logExpectedLimitation(
          "MQTT Reliable Sync",
          "Failed to start - continuing in offline mode",
          []
        );
      } else {
        logger.error("MqttReliableSync", "Failed to start", error);
      }
    }
  }

  private setupEventHandlers(): void {
    if (!this.client) {
      return;
    }

    this.client.on("connect", () => {
      logger.info("MqttReliableSync", "Connected to broker");
      this.isConnected = true;
      this.reconnectAttempts = 0;
      setMqttConnectionStatus(true);

      this.client?.publish(
        `${topics.system}/status`,
        JSON.stringify({ status: "online", timestamp: new Date().toISOString() }),
        { qos: 1, retain: true }
      );

      resubscribeAll(this.client, this.isConnected, this.subscriptions);
      flushMessageQueue(
        this.messageQueue,
        this.client,
        this.isConnected,
        this.config.maxQueueSize,
        this.metrics,
        this.emit.bind(this)
      );
      this.emit("connected");
    });

    this.client.on("disconnect", () => {
      logger.info("MqttReliableSync", "Disconnected from broker");
      this.isConnected = false;
      setMqttConnectionStatus(false);
      this.emit("disconnected");
    });

    this.client.on("reconnect", () => {
      this.reconnectAttempts++;
      this.metrics.reconnectionAttempts++;
      incrementMqttReconnectionAttempts();

      const shouldLog =
        this.reconnectAttempts <= 10 ||
        (this.reconnectAttempts <= 100 && this.reconnectAttempts % 10 === 0) ||
        this.reconnectAttempts % 100 === 0;

      if (shouldLog) {
        logger.debug("MqttReliableSync", `Reconnecting... (attempt ${this.reconnectAttempts})`);
      }
    });

    this.client.on("message", (topic, payload) => {
      try {
        const message = JSON.parse(payload.toString());
        this.handleIncomingMessage(topic, message);
      } catch (error) {
        logger.error("MqttReliableSync", "Failed to parse message", error);
      }
    });

    this.client.on("offline", () => {
      logger.debug("MqttReliableSync", "Client offline");
      this.isConnected = false;
      setMqttConnectionStatus(false);
    });
  }

  private handleIncomingMessage(topic: string, message: unknown): void {
    const callbacks = this.subscriptions.get(topic);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(message);
        } catch (error) {
          logger.error("MqttReliableSync", "Callback error", error);
        }
      });
    }

    this.subscriptions.forEach((callbacks, subscribedTopic) => {
      if (subscribedTopic.includes("#") || subscribedTopic.includes("+")) {
        if (topicMatches(subscribedTopic, topic)) {
          callbacks.forEach((callback) => {
            try {
              callback(message);
            } catch (error) {
              logger.error("MqttReliableSync", "Callback error", error);
            }
          });
        }
      }
    });

    this.emit("message", { topic, message });
  }

  async stop(): Promise<void> {
    if (this.client) {
      if (this.isConnected) {
        await new Promise<void>((resolve) => {
          this.client?.publish(
            `${topics.system}/status`,
            JSON.stringify({ status: "offline", timestamp: new Date().toISOString() }),
            { qos: 1, retain: true },
            () => resolve()
          );
        });
      }
      await persistQueue(this.config.queueDir, this.messageQueue);
      this.client.end();
      this.isConnected = false;
    }
    logger.info("MqttReliableSync", "Stopped");
  }

  async publishDataChange(
    entityType: string,
    operation: DataChangeOperation,
    data: unknown,
    options: PublishOptions = {}
  ): Promise<void> {
    return publishDataChange(
      {
        client: this.client,
        isConnected: this.isConnected,
        messageQueue: this.messageQueue,
        maxQueueSize: this.config.maxQueueSize,
        metrics: this.metrics,
        queueDir: this.config.queueDir,
        qosLevel: this.config.qosLevel,
        vesselId: this.config.vesselId,
        emit: this.emit.bind(this),
      },
      entityType,
      operation,
      data,
      options
    );
  }

  async subscribe(
    entityType: string,
    callback: MqttPayloadCallback,
    enableCatchup: boolean = true
  ): Promise<void> {
    return subscribeToEntity(
      this.client,
      this.isConnected,
      this.subscriptions,
      entityType,
      callback,
      enableCatchup
    );
  }

  async unsubscribe(entityType: string, callback: MqttPayloadCallback): Promise<void> {
    return unsubscribeFromEntity(
      this.client,
      this.isConnected,
      this.subscriptions,
      entityType,
      callback
    );
  }

  async publishCatchupMessages(
    entityType: string,
    since: Date,
    limit: number = 100
  ): Promise<void> {
    return publishCatchupMessages(
      this.client,
      this.isConnected,
      entityType,
      since,
      limit,
      this.emit.bind(this)
    );
  }

  getMetrics(): ServiceMetrics {
    return {
      ...this.metrics,
      currentQueueSize: this.messageQueue.length,
      maxQueueSize: this.config.maxQueueSize,
      queueUtilization: (this.messageQueue.length / this.config.maxQueueSize) * 100,
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  resetMetrics(): void {
    this.metrics = {
      messagesPublished: 0,
      messagesQueued: 0,
      messagesDropped: 0,
      publishFailures: 0,
      reconnectionAttempts: 0,
      queueFlushes: 0,
    };
    logger.debug("MqttReliableSync", "Metrics reset");
  }

  getHealthStatus(): HealthStatus {
    return {
      status: this.isConnected ? "connected" : "disconnected",
      broker: this.config.brokerUrl,
      qosLevel: this.config.qosLevel,
      queuedMessages: this.messageQueue.length,
      maxQueueSize: this.config.maxQueueSize,
      queueUtilization: `${((this.messageQueue.length / this.config.maxQueueSize) * 100).toFixed(1)}%`,
      activeSubscriptions: this.subscriptions.size,
      topics: Object.keys(topics).length,
      reconnectAttempts: this.reconnectAttempts,
      tlsEnabled: this.config.enableTls,
      metrics: this.getMetrics(),
    };
  }

  async publishWorkOrderChange(operation: DataChangeOperation, workOrder: unknown): Promise<void> {
    return this.publishDataChange("work_orders", operation, workOrder, { qos: 1, retain: true });
  }

  async publishAlertChange(operation: "create" | "update", alert: unknown): Promise<void> {
    return this.publishDataChange("alerts", operation, alert, { qos: 2, retain: true });
  }

  async publishEquipmentChange(operation: DataChangeOperation, equipment: unknown): Promise<void> {
    return this.publishDataChange("equipment", operation, equipment, { qos: 1, retain: true });
  }

  async publishCrewChange(operation: DataChangeOperation, crew: unknown): Promise<void> {
    return this.publishDataChange("crew", operation, crew, { qos: 1, retain: true });
  }

  async publishMaintenanceChange(operation: DataChangeOperation, schedule: unknown): Promise<void> {
    return this.publishDataChange("maintenance_schedules", operation, schedule, {
      qos: 1,
      retain: true,
    });
  }

  async publishVesselChange(operation: DataChangeOperation, vessel: unknown): Promise<void> {
    return this.publishDataChange("vessels", operation, vessel, { qos: 1, retain: true });
  }
}

export const mqttReliableSync = new MqttReliableSyncService();
