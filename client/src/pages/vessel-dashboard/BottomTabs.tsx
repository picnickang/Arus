import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, AlertCircle, Users, Wrench } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ActiveDtcsPanel } from "@/components/ActiveDtcsPanel";
import type { VesselEquipment } from "@/features/vessels/types";

interface BottomTabWorkOrder {
  id: string;
  description?: string | null;
  status?: string | null;
  createdAt: string | Date | null;
}

interface BottomTabCrewMember {
  id: string;
  name: string;
  status?: string | null;
  role?: string | null;
  rank?: string | null;
}

interface BottomTabSchedule {
  id: string;
  equipmentId: string;
  status?: string | null;
  isPredictive?: boolean | null;
  scheduledDate: string | Date | null;
}

export function BottomTabs({
  bottomTab,
  setBottomTab,
  vesselWorkOrders,
  vesselCrew,
  vesselMaintenanceSchedules,
  activeWorkOrders,
  workOrdersLoading,
  crewLoading,
  schedulesLoading,
  selectedEquipment,
}: {
  bottomTab: string;
  setBottomTab: (t: string) => void;
  vesselWorkOrders: BottomTabWorkOrder[];
  vesselCrew: BottomTabCrewMember[];
  vesselMaintenanceSchedules: BottomTabSchedule[];
  activeWorkOrders: BottomTabWorkOrder[];
  workOrdersLoading: boolean;
  crewLoading: boolean;
  schedulesLoading: boolean;
  selectedEquipment: VesselEquipment | null;
}) {
  return (
    <div className="border-t border-slate-700/15 bg-slate-900/30 shrink-0">
      <Tabs value={bottomTab} onValueChange={setBottomTab}>
        <TabsList className="w-full justify-start rounded-none bg-transparent border-b border-slate-700/10 px-2 sm:px-4 h-10 sm:h-9 overflow-x-auto flex-nowrap">
          <TabsTrigger
            value="work-orders"
            className="text-xs data-[state=active]:text-sky-400 min-h-[36px] px-2 sm:px-3 shrink-0"
            data-testid="tab-work-orders"
          >
            <Wrench className="h-3.5 w-3.5 sm:mr-1" />{" "}
            <span className="hidden sm:inline">Work Orders ({activeWorkOrders.length})</span>
            <span className="sm:hidden text-[10px] ml-1">{activeWorkOrders.length}</span>
          </TabsTrigger>
          <TabsTrigger
            value="crew"
            className="text-xs data-[state=active]:text-sky-400 min-h-[36px] px-2 sm:px-3 shrink-0"
            data-testid="tab-crew"
          >
            <Users className="h-3.5 w-3.5 sm:mr-1" />{" "}
            <span className="hidden sm:inline">Crew ({vesselCrew.length})</span>
            <span className="sm:hidden text-[10px] ml-1">{vesselCrew.length}</span>
          </TabsTrigger>
          <TabsTrigger
            value="maintenance"
            className="text-xs data-[state=active]:text-sky-400 min-h-[36px] px-2 sm:px-3 shrink-0"
            data-testid="tab-maintenance"
          >
            <Activity className="h-3.5 w-3.5 sm:mr-1" />{" "}
            <span className="hidden sm:inline">Maintenance</span>
          </TabsTrigger>
          <TabsTrigger
            value="diagnostics"
            className="text-xs data-[state=active]:text-sky-400 min-h-[36px] px-2 sm:px-3 shrink-0"
            data-testid="tab-diagnostics"
          >
            <AlertCircle className="h-3.5 w-3.5 sm:mr-1" />{" "}
            <span className="hidden sm:inline">DTCs</span>
          </TabsTrigger>
        </TabsList>

        <div className="h-[200px] overflow-y-auto px-3 sm:px-4 py-2">
          <TabsContent value="work-orders" className="mt-0">
            {workOrdersLoading ? (
              <Skeleton className="h-20" />
            ) : vesselWorkOrders.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">
                No work orders for this vessel
              </div>
            ) : (
              <div className="space-y-1.5">
                {vesselWorkOrders.slice(0, 10).map((wo) => (
                  <div
                    key={wo.id}
                    className="p-2.5 rounded-lg bg-white/[0.02] border border-slate-700/10"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-medium text-slate-200 truncate flex-1">
                        {wo.description || wo.id.slice(0, 8)}
                      </span>
                      <Badge
                        variant={wo.status === "completed" ? "default" : "outline"}
                        className="text-[10px] ml-2 shrink-0"
                      >
                        {wo.status}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      {wo.createdAt
                        ? formatDistanceToNow(new Date(wo.createdAt), { addSuffix: true })
                        : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="crew" className="mt-0">
            {crewLoading ? (
              <Skeleton className="h-20" />
            ) : vesselCrew.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">No crew assigned</div>
            ) : (
              <div className="space-y-1.5">
                {vesselCrew.map((member) => (
                  <div
                    key={member.id}
                    className="p-2.5 rounded-lg bg-white/[0.02] border border-slate-700/10"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-medium text-slate-200">{member.name}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {member.status || "Active"}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {member.role || "N/A"} · {member.rank || "N/A"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="maintenance" className="mt-0">
            {schedulesLoading ? (
              <Skeleton className="h-20" />
            ) : vesselMaintenanceSchedules.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">
                No maintenance schedules
              </div>
            ) : (
              <div className="space-y-1.5">
                {vesselMaintenanceSchedules.map((s) => (
                  <div
                    key={s.id}
                    className="p-2.5 rounded-lg bg-white/[0.02] border border-slate-700/10"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-medium text-slate-200 truncate flex-1">
                        {s.equipmentId}
                      </span>
                      <Badge
                        variant={s.status === "completed" ? "default" : "outline"}
                        className="text-[10px] ml-2 shrink-0"
                      >
                        {s.status}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-slate-500">
                      <Badge variant="outline" className="text-[9px] mr-1.5">
                        {s.isPredictive ? "Predictive" : "Scheduled"}
                      </Badge>
                      {s.scheduledDate ? new Date(s.scheduledDate).toLocaleDateString() : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="diagnostics" className="mt-0">
            {selectedEquipment ? (
              <ActiveDtcsPanel
                equipmentId={selectedEquipment.id}
                equipmentName={selectedEquipment.name}
              />
            ) : (
              <div className="text-center py-6 text-slate-500 text-xs">
                Select equipment on the schematic to view diagnostic codes
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
