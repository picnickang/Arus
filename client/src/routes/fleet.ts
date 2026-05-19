import { createElement, lazy } from "react";

const FleetPage = lazy(() => import("@/pages/fleet-hub"));
const VesselDashboard = lazy(() => import("@/pages/vessel-dashboard"));
const Vessel3DPage = lazy(() => import("@/pages/vessel-3d"));
const CertificateRegistry = lazy(() => import("@/pages/certificate-registry"));
const VesselManagement = lazy(() => import("@/pages/vessel-management"));
const EquipmentPage = lazy(() => import("@/pages/equipment"));
const OperatingParametersPage = lazy(() => import("@/pages/OperatingParametersPage"));
const OperatingParametersRoute = () => createElement(OperatingParametersPage);
const EquipmentScanPage = lazy(() => import("@/pages/equipment-scan"));

export const fleetRoutes = [
  { path: "/fleet", component: FleetPage },
  { path: "/vessels/:id", component: VesselDashboard },
  { path: "/vessels/:id/3d", component: Vessel3DPage },
  { path: "/certificates", component: CertificateRegistry },
  { path: "/vessel-management", component: VesselManagement },
  { path: "/equipment", component: EquipmentPage },
  { path: "/equipment-scan", component: EquipmentScanPage },
  { path: "/operating-parameters", component: OperatingParametersRoute },
];
