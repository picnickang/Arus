import client from "prom-client";

// ===== ALERT SYSTEM METRICS =====
export const alertsGeneratedTotal = new client.Counter({
  name: "arus_alerts_generated_total",
  help: "Total alerts generated",
  labelNames: ["type", "equipment_id", "severity"],
});

export const alertsAcknowledgedTotal = new client.Counter({
  name: "arus_alerts_acknowledged_total",
  help: "Total alerts acknowledged",
  labelNames: ["equipment_id"],
});

export const alertConfigurationsTotal = new client.Gauge({
  name: "arus_alert_configurations_active",
  help: "Number of active alert configurations",
});

// Helper functions
export function recordAlertGenerated(type: string, equipmentId: string, severity: string) {
  alertsGeneratedTotal.inc({ type, equipment_id: equipmentId, severity });
}

export function recordAlertAcknowledged(equipmentId: string) {
  alertsAcknowledgedTotal.inc({ equipment_id: equipmentId });
}

export function setAlertConfigurationsCount(count: number) {
  alertConfigurationsTotal.set(count);
}
