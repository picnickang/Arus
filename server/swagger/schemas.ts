/**
 * OpenAPI Spec - Component Schemas
 *
 * Reusable schema definitions for API resources.
 */

export const schemas = {
  Error: {
    type: "object",
    properties: {
      code: { type: "string", example: "VALIDATION_ERROR" },
      message: { type: "string", example: "Invalid request parameters" },
      error: { type: "string", example: "Bad Request" },
    },
  },
  HealthResponse: {
    type: "object",
    properties: {
      ok: { type: "boolean", example: true },
      timestamp: { type: "string", format: "date-time" },
      service: { type: "string", example: "arus-api" },
    },
  },
  Equipment: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      orgId: { type: "string" },
      name: { type: "string", example: "Main Engine 1" },
      type: { type: "string", example: "main_engine" },
      vesselId: { type: "string", format: "uuid" },
      manufacturer: { type: "string" },
      model: { type: "string" },
      serialNumber: { type: "string" },
      installDate: { type: "string", format: "date" },
      status: {
        type: "string",
        enum: ["operational", "maintenance", "critical", "offline"],
      },
      healthScore: { type: "number", minimum: 0, maximum: 100 },
      lastMaintenanceDate: { type: "string", format: "date" },
      nextMaintenanceDate: { type: "string", format: "date" },
    },
  },
  EquipmentCreate: {
    type: "object",
    required: ["name", "type", "vesselId"],
    properties: {
      name: { type: "string", example: "Auxiliary Engine 2" },
      type: { type: "string", example: "auxiliary_engine" },
      vesselId: { type: "string", format: "uuid" },
      manufacturer: { type: "string" },
      model: { type: "string" },
      serialNumber: { type: "string" },
      installDate: { type: "string", format: "date" },
    },
  },
  Vessel: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      orgId: { type: "string" },
      name: { type: "string", example: "MV Pacific Star" },
      imo: { type: "string", example: "9876543" },
      type: { type: "string", example: "container_ship" },
      flag: { type: "string", example: "SG" },
      yearBuilt: { type: "integer", example: 2018 },
      grossTonnage: { type: "number" },
      status: { type: "string", enum: ["active", "maintenance", "laid_up"] },
    },
  },
  TelemetryReading: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      equipmentId: { type: "string", format: "uuid" },
      timestamp: { type: "string", format: "date-time" },
      sensorType: { type: "string", example: "temperature" },
      value: { type: "number" },
      unit: { type: "string", example: "celsius" },
      quality: { type: "string", enum: ["good", "uncertain", "bad"] },
    },
  },
  PdmScore: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      equipmentId: { type: "string", format: "uuid" },
      timestamp: { type: "string", format: "date-time" },
      healthScore: { type: "number", minimum: 0, maximum: 100 },
      riskLevel: { type: "string", enum: ["low", "medium", "high", "critical"] },
      remainingUsefulLife: { type: "number", description: "RUL in days" },
      confidenceScore: { type: "number", minimum: 0, maximum: 1 },
      factors: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            contribution: { type: "number" },
            trend: { type: "string", enum: ["improving", "stable", "degrading"] },
          },
        },
      },
    },
  },
  WorkOrder: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      orgId: { type: "string" },
      workOrderNumber: { type: "string", example: "WO-2024-001" },
      vesselId: { type: "string", format: "uuid" },
      equipmentId: { type: "string", format: "uuid" },
      title: { type: "string" },
      description: { type: "string" },
      priority: { type: "string", enum: ["low", "medium", "high", "critical"] },
      status: { type: "string", enum: ["pending", "in_progress", "completed", "cancelled"] },
      maintenanceType: { type: "string", enum: ["preventive", "corrective", "predictive"] },
      plannedStartDate: { type: "string", format: "date-time" },
      plannedEndDate: { type: "string", format: "date-time" },
      actualStartDate: { type: "string", format: "date-time" },
      actualEndDate: { type: "string", format: "date-time" },
      estimatedHours: { type: "number" },
      actualHours: { type: "number" },
      assignedCrewId: { type: "string", format: "uuid" },
    },
  },
  Part: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      orgId: { type: "string" },
      partNumber: { type: "string" },
      name: { type: "string" },
      description: { type: "string" },
      category: { type: "string" },
      manufacturer: { type: "string" },
      quantityInStock: { type: "integer" },
      reorderLevel: { type: "integer" },
      unitPrice: { type: "number" },
      criticality: { type: "string", enum: ["low", "medium", "high", "critical"] },
    },
  },
  MlModel: {
    type: "object",
    properties: {
      id: { type: "string", format: "uuid" },
      orgId: { type: "string" },
      name: { type: "string" },
      version: { type: "string" },
      type: { type: "string", example: "lstm_rul" },
      status: { type: "string", enum: ["training", "active", "archived", "failed"] },
      accuracy: { type: "number", minimum: 0, maximum: 1 },
      createdAt: { type: "string", format: "date-time" },
      lastTrainedAt: { type: "string", format: "date-time" },
    },
  },
  DashboardData: {
    type: "object",
    properties: {
      fleetHealth: { type: "number", minimum: 0, maximum: 100 },
      totalVessels: { type: "integer" },
      totalEquipment: { type: "integer" },
      activeAlerts: { type: "integer" },
      pendingWorkOrders: { type: "integer" },
      criticalEquipment: { type: "integer" },
      upcomingMaintenance: { type: "integer" },
    },
  },
  Pagination: {
    type: "object",
    properties: {
      page: { type: "integer", minimum: 1 },
      limit: { type: "integer", minimum: 1, maximum: 100 },
      total: { type: "integer" },
      totalPages: { type: "integer" },
    },
  },
};
