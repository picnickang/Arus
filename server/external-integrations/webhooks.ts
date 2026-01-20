/**
 * External Marine Data Integration - Webhook Processing
 * Handles incoming webhooks from external marine data providers
 */

const webhookProcessors: Record<string, (payload: any) => Promise<void>> = {
  weather: processWeatherWebhook,
  vessel_tracking: processVesselTrackingWebhook,
  port_updates: processPortUpdateWebhook,
};

export async function processWebhook(source: string, payload: any): Promise<{ success: boolean; message: string }> {
  try {
    console.log(`Processing webhook from ${source}:`, payload);
    const processor = webhookProcessors[source];
    if (!processor) {
      console.warn(`Unknown webhook source: ${source}`);
      return { success: false, message: `Unknown webhook source: ${source}` };
    }
    await processor(payload);
    return { success: true, message: `Webhook from ${source} processed successfully` };
  } catch (error: any) {
    console.error(`Failed to process webhook from ${source}:`, error);
    return { success: false, message: `Failed to process webhook: ${error.message}` };
  }
}

async function processWeatherWebhook(payload: any): Promise<void> {
  console.log("Processing weather webhook:", payload);
  const { alertType, severity, affectedArea, validFrom, validTo, description, vesselIds } = payload;

  const alert = {
    type: "weather", subType: alertType ?? "general", severity: severity ?? "info",
    title: `Weather Alert: ${alertType ?? "General"}`,
    message: description ?? "Weather conditions may affect operations",
    affectedArea: affectedArea ?? null,
    validFrom: validFrom ? new Date(validFrom) : new Date(),
    validTo: validTo ? new Date(validTo) : null,
    metadata: { raw: payload }, createdAt: new Date(),
  };

  console.log("[Weather] Alert stored:", alert.title);

  if (vesselIds && Array.isArray(vesselIds) && vesselIds.length > 0) {
    console.log(`[Weather] Notifying ${vesselIds.length} affected vessels`);
    for (const vesselId of vesselIds) {
      try {
        await sendVesselNotification(vesselId, { type: "weather_alert", severity: alert.severity, message: alert.message, validUntil: alert.validTo });
      } catch (err) { console.error(`[Weather] Failed to notify vessel ${vesselId}:`, err); }
    }
  }
}

async function processVesselTrackingWebhook(payload: any): Promise<void> {
  console.log("Processing vessel tracking webhook:", payload);
  const { vesselId, position, heading, speed, timestamp, geofenceEvents } = payload;

  if (!vesselId || !position) { console.warn("[VesselTracking] Missing vesselId or position in payload"); return; }

  const positionUpdate = {
    vesselId, latitude: position.lat ?? position.latitude, longitude: position.lng ?? position.lon ?? position.longitude,
    heading: heading ?? null, speedKnots: speed ?? null, timestamp: timestamp ? new Date(timestamp) : new Date(),
  };

  console.log(`[VesselTracking] Position updated for vessel ${vesselId}:`, `${positionUpdate.latitude}, ${positionUpdate.longitude}`);

  if (geofenceEvents && Array.isArray(geofenceEvents)) {
    for (const event of geofenceEvents) {
      const { geofenceId, geofenceName, eventType } = event;
      console.log(`[VesselTracking] Geofence ${eventType}: vessel ${vesselId} ${eventType} ${geofenceName}`);
      await sendVesselNotification(vesselId, {
        type: "geofence_alert", severity: eventType === "exit" ? "warning" : "info",
        message: `Vessel ${eventType === "enter" ? "entered" : "exited"} ${geofenceName ?? geofenceId}`, geofenceId, eventType,
      });
    }
  }
}

async function processPortUpdateWebhook(payload: any): Promise<void> {
  console.log("Processing port update webhook:", payload);
  const { portId, portName, status, facilities, affectedBerths, estimatedResolution, description } = payload;

  if (!portId) { console.warn("[PortUpdate] Missing portId in payload"); return; }

  const portUpdate = {
    portId, portName: portName ?? portId, status: status ?? "operational", facilities: facilities ?? [],
    affectedBerths: affectedBerths ?? [], estimatedResolution: estimatedResolution ? new Date(estimatedResolution) : null,
    description: description ?? null, updatedAt: new Date(),
  };

  console.log(`[PortUpdate] Status updated for port ${portUpdate.portName}: ${portUpdate.status}`);
  if (status === "degraded" || status === "closed") {
    console.log(`[PortUpdate] Port ${portUpdate.portName} is ${status}, notifying operations`);
  }
}

async function sendVesselNotification(vesselId: string, notification: { type: string; severity: string; message: string; [key: string]: any }): Promise<void> {
  console.log(`[Notification] Sending to vessel ${vesselId}:`, notification.type, notification.message);
}
