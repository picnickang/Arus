import { lazy } from "react";

const FleetPage = lazy(() => import("@/pages/fleet-hub"));
const VesselDashboard = lazy(() => import("@/pages/vessel-dashboard"));
const CertificateRegistry = lazy(() => import("@/pages/certificate-registry"));
const VesselManagement = lazy(() => import("@/pages/vessel-management"));
const EquipmentPage = lazy(() => import("@/pages/equipment"));
const OperatingParametersPage = lazy(() => import("@/pages/OperatingParametersPage"));
const EquipmentScanPage = lazy(() => import("@/pages/equipment-scan"));

export const fleetRoutes = [
  { path: "/fleet", component: FleetPage },
  { path: "/vessels/:id", component: VesselDashboard },
  { path: "/certificates", component: CertificateRegistry },
  { path: "/vessel-management", component: VesselManagement },
  { path: "/equipment", component: EquipmentPage },
  { path: "/equipment-scan", component: EquipmentScanPage },
  { path: "/operating-parameters", component: OperatingParametersPage },
];
