/**
 * Vessels - Types
 */

export interface FleetOverview {
  totalVessels: number;
  activeVessels: number;
  vesselsByStatus: Record<string, number>;
}
