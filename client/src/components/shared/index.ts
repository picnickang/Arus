/**
 * Shared Components - Barrel Export
 * 
 * Unified, reusable components used across the ARUS application.
 * These components ensure consistency in UI/UX across all pages.
 */

export { Breadcrumb } from "./Breadcrumb";
export { CollapsibleSection } from "./CollapsibleSection";
export { ConfirmDialog } from "./ConfirmDialog";
export { EmptyState } from "./EmptyState";
export { EquipmentSelector } from "./EquipmentSelector";
export { NavigationCategory } from "./NavigationCategory";
export { NavigationItem } from "./NavigationItem";
export { ResponsiveTable } from "./ResponsiveTable";
export { StatusBadge, type StatusType } from "./StatusBadge";
export { TableSkeleton } from "./TableSkeleton";
export { VesselSelector } from "./VesselSelector";
export { WebSocketStatus } from "./WebSocketStatus";

export { 
  UnifiedMetricCard, 
  MetricCardGrid,
  type UnifiedMetricCardProps,
  type MetricStatus,
  type MetricVariant,
  type MetricColor,
  type MetricTrend,
  type MetricThresholds,
} from "./UnifiedMetricCard";

export { MetricCard } from "./MetricCard";
