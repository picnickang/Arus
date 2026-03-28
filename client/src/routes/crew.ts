import { lazy } from "react";

const CrewHub = lazy(() => import("@/pages/crew-hub"));
const CrewManagement = lazy(() => import("@/pages/crew-management"));
const CrewScheduler = lazy(() => import("@/pages/crew-scheduler"));
const SchedulePlanner = lazy(() => import("@/pages/schedule-planner"));
const HoursOfRest = lazy(() => import("@/pages/hours-of-rest"));

export const crewRoutes = [
  { path: "/crew", component: CrewHub },
  { path: "/crew-management", component: CrewManagement },
  { path: "/crew-scheduler", component: CrewScheduler },
  { path: "/schedule-planner", component: SchedulePlanner },
  { path: "/hours-of-rest", component: HoursOfRest },
];
