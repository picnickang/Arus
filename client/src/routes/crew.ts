import { lazy } from "react";

const CrewManagement = lazy(() => import("@/pages/crew-management"));

export const crewRoutes = [
  { path: "/crew-management", component: CrewManagement },
  { path: "/crew-scheduler", component: CrewManagement },
  { path: "/schedule-planner", component: CrewManagement },
  { path: "/hours-of-rest", component: CrewManagement },
];
