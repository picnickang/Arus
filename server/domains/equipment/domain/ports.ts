/**
 * Equipment Domain - Lifecycle Ports
 * The concrete adapter (db access over equipment / decommission events) lives in
 * infrastructure/.
 */

import type {
  Equipment,
  EquipmentDecommissionEvent,
  InsertDecommissionEvent,
  DecommissionStatus,
} from "@shared/schema";

export interface IEquipmentLifecycleRepository {
  findEquipmentById(id: string, orgId: string): Promise<Equipment | undefined>;
  findActiveEquipmentById(id: string, orgId: string): Promise<Equipment | undefined>;
  findDecommissionedEquipmentById(id: string, orgId: string): Promise<Equipment | undefined>;
  findDecommissionedEquipment(orgId: string): Promise<Equipment[]>;
  findDecommissionedEquipmentWithHistory(
    orgId: string
  ): Promise<Array<Equipment & { decommissionEvents: EquipmentDecommissionEvent[] }>>;
  decommissionEquipment(
    id: string,
    orgId: string,
    decommissionStatus: DecommissionStatus,
    decommissionedAt: Date,
    decommissionedBy: string,
    decommissionEventId?: string
  ): Promise<Equipment>;
  reinstateEquipment(id: string, orgId: string, reinstatedBy: string): Promise<Equipment>;
  createDecommissionEvent(data: InsertDecommissionEvent): Promise<EquipmentDecommissionEvent>;
  getDecommissionHistory(
    equipmentId: string,
    orgId: string
  ): Promise<EquipmentDecommissionEvent[]>;
  findDecommissionEventById(
    id: string,
    orgId: string
  ): Promise<EquipmentDecommissionEvent | undefined>;
}
