import { Suspense, lazy } from "react";

const ConditionMonitoringLog = lazy(() => import("./condition-monitoring-log"));

const Loading = () => (
  <div className="flex items-center justify-center p-12 text-muted-foreground">Loading...</div>
);

export default function EquipmentLogConsolidated() {
  return (
    <Suspense fallback={<Loading />}>
      <ConditionMonitoringLog />
    </Suspense>
  );
}
