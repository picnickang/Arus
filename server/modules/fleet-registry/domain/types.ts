export type {
  Vessel,
  InsertVessel,
  SelectVessel,
  PortCall,
  InsertPortCall,
  DrydockWindow,
  InsertDrydockWindow,
} from "@shared/schema-runtime";

export type {
  Organization,
  InsertOrganization,
  User,
  InsertUser,
  UpdateUser,
  SystemSettings,
  InsertSystemSettings,
} from "@shared/schema/core";

export interface FleetOverview {
  totalVessels: number;
  activeVessels: number;
  vesselsByStatus: Record<string, number>;
}
