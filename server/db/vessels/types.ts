/**
 * Vessels - Types
 */

export type {
  Vessel,
  InsertVessel,
  PortCall,
  InsertPortCall,
  DrydockWindow,
  InsertDrydockWindow,
} from "@shared/schema-runtime";

export interface FleetOverview {
  totalVessels: number;
  activeVessels: number;
  vesselsByStatus: Record<string, number>;
}
