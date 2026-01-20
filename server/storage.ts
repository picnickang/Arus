/**
 * ARUS Storage Facade - Thin Facade Pattern for Storage Classes
 * 
 * This file serves as the main entry point for storage operations.
 * It imports extracted storage implementations and re-exports them
 * along with initialization functions.
 * 
 * Architecture:
 * - DatabaseStorage: PostgreSQL database storage (server/storage/db-storage.ts)
 * - IStorage: Interface contract (server/storage/interfaces/storage.types.ts)
 */

import { db, isLocalMode } from "./db-config";
import { devices, alertConfigurations } from "@shared/schema-runtime";

// Re-export types from interfaces
export type { WorkOrderFilters, IStorage } from "./storage/interfaces/storage.types";

// Re-export storage implementations
export { DatabaseStorage } from "./storage/db-storage";

// Create storage singleton
import { DatabaseStorage } from "./storage/db-storage";

let storage: DatabaseStorage;

try {
  storage = new DatabaseStorage();
} catch (error) {
  console.error("Failed to initialize database storage:", error);
  if (process.env.EMBEDDED_MODE === "true" || process.env.LOCAL_MODE === "true") {
    console.error("Embedded/local mode: Creating degraded storage instance");
    storage = new DatabaseStorage();
  } else {
    process.exit(1);
  }
}

export { storage };

/**
 * Helper to wrap a promise with a timeout
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Initialize database with required setup
 * Handles PostgreSQL-specific features like TimescaleDB, views, and indexes
 */
export async function initializeDatabase(): Promise<void> {
  const maxRetries = 3;
  const connectionTimeout = 30000; // 30 seconds per attempt
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`  Attempting database connection (attempt ${attempt}/${maxRetries})...`);
      await withTimeout(db.select().from(devices).limit(1), connectionTimeout, "Database connection check");
      console.log("  Database connection verified");
      
      if (!isLocalMode) {
        console.log("PostgreSQL mode: Running TimescaleDB and view setup...");
        const { ensureTimescaleDBSetup } = await import("./timescaledb-bootstrap");
        await withTimeout(ensureTimescaleDBSetup(), 60000, "TimescaleDB setup");
        
        const { createDatabaseViews, verifyDatabaseViews } = await import("./schema-views");
        await withTimeout(createDatabaseViews(), 60000, "Create database views");
        const viewVerification = await withTimeout(verifyDatabaseViews(), 30000, "Verify database views");
        if (!viewVerification.success) {
          console.error("Database view verification failed:", viewVerification.errors);
          throw new Error("Essential database views are not functioning properly");
        }
        
        const storageInstance = new DatabaseStorage();
        await withTimeout(storageInstance.seedStockForParts("default-org-id"), 30000, "Seed stock data");
        
        const { createDatabaseIndexes, analyzeDatabasePerformance } = await import("./db-indexes");
        await withTimeout(createDatabaseIndexes(), 60000, "Create database indexes");
        
        if (process.env.NODE_ENV === "development") {
          await withTimeout(analyzeDatabasePerformance(), 30000, "Analyze database performance");
        }
      } else {
        console.log("SQLite mode: Skipping PostgreSQL-specific setup (TimescaleDB, views, indexes)");
        console.log("Database ready for offline-first operation");
      }
      return; // Success - exit the retry loop
    } catch (error: any) {
      const isLastAttempt = attempt === maxRetries;
      console.warn(`  Database initialization attempt ${attempt} failed:`, error.message);
      
      if (!isLastAttempt) {
        const delay = attempt * 5000; // 5s, 10s, 15s
        console.log(`  Retrying in ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error("Database initialization failed after all retries:", error);
        if (process.env.EMBEDDED_MODE === "true" || process.env.LOCAL_MODE === "true") {
          console.error("Embedded/local mode: Continuing despite initialization error");
          return;
        }
        throw error;
      }
    }
  }
}

/**
 * Initialize sample data for development and testing
 */
export async function initializeSampleData(): Promise<void> {
  try {
    const storageInstance = new DatabaseStorage();
    const existingDevices = await storageInstance.getDevices();
    if (existingDevices.length > 0) {return;}
    
    const sampleDevices = [
      { id: "DEV-001", vessel: "MV Atlantic", buses: JSON.stringify(["CAN1", "CAN2"]), sensors: JSON.stringify([{ id: "ENG1", type: "engine", metrics: ["rpm", "temp", "pressure"] }, { id: "GEN1", type: "generator", metrics: ["voltage", "current", "frequency"] }]), config: JSON.stringify({ sampling_rate: 1000, buffer_size: 10000 }), hmacKey: null },
      { id: "DEV-002", vessel: "MV Pacific", buses: JSON.stringify(["CAN1"]), sensors: JSON.stringify([{ id: "ENG2", type: "engine", metrics: ["rpm", "temp", "pressure"] }]), config: JSON.stringify({ sampling_rate: 500, buffer_size: 5000 }), hmacKey: null },
      { id: "DEV-003", vessel: "MV Arctic", buses: JSON.stringify(["CAN1", "CAN2", "CAN3"]), sensors: JSON.stringify([{ id: "ENG3", type: "engine", metrics: ["rpm", "temp", "pressure"] }, { id: "GEN2", type: "generator", metrics: ["voltage", "current", "frequency"] }, { id: "PUMP1", type: "pump", metrics: ["flow", "pressure", "vibration"] }]), config: JSON.stringify({ sampling_rate: 2000, buffer_size: 20000 }), hmacKey: null }
    ];
    for (const device of sampleDevices) {await db.insert(devices).values(device);}
    
    const sampleAlertConfigurations = [
      { id: "ALERT-001", orgId: "default-org-id", vesselId: "MV Atlantic", equipmentId: "ENG1", sensorType: "temperature", warningThreshold: 80, criticalThreshold: 95, enabled: true, notifyEmail: true, notifyInApp: true },
      { id: "ALERT-002", orgId: "default-org-id", vesselId: "MV Atlantic", equipmentId: "GEN1", sensorType: "voltage", warningThreshold: 390, criticalThreshold: 380, enabled: true, notifyEmail: false, notifyInApp: true },
      { id: "ALERT-003", orgId: "default-org-id", vesselId: "MV Arctic", equipmentId: "PUMP1", sensorType: "vibration", warningThreshold: 2, criticalThreshold: 3, enabled: true, notifyEmail: false, notifyInApp: true }
    ];
    for (const config of sampleAlertConfigurations) {await db.insert(alertConfigurations).values(config);}
  } catch (error) {
    console.error("Failed to initialize sample data:", error);
    throw error;
  }
}
