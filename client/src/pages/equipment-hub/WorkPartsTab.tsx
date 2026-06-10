import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Wrench } from "lucide-react";
import { AssignmentStatusBadge } from "@/components/work-orders";
import type { EquipmentHubData } from "@/hooks/useEquipmentHub";
import { StatusBadge } from "./shared";

export function WorkPartsTab({ data }: { data: EquipmentHubData }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="work-procurement-section">
      <Card className="bg-white/[0.02] border-slate-700/15">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" /> Work Orders ({data.workOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.workOrders.length > 0 ? (
            <div className="space-y-1.5">
              {data.workOrders.slice(0, 5).map((wo) => (
                <div
                  key={wo.id}
                  className="flex justify-between items-center px-3 py-2 rounded-md bg-white/[0.015] border border-slate-700/8"
                  data-testid={`work-order-${wo.id}`}
                >
                  <div>
                    <div className="text-xs font-medium text-slate-200">{wo.title}</div>
                    <div className="text-[10px] text-slate-500">{wo.createdAt}</div>
                    {wo.assignmentStatus === "declined" && wo.assignmentResponseReason && (
                      <div
                        className="text-[10px] text-red-400"
                        data-testid={`text-assignment-decline-reason-${wo.id}`}
                      >
                        Declined: {wo.assignmentResponseReason}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <AssignmentStatusBadge
                      status={wo.assignmentStatus}
                      assignedTo={wo.assignedCrewId}
                      testId={`badge-assignment-status-${wo.id}`}
                    />
                    <StatusBadge status={wo.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-600 py-3 text-center">No work orders</p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white/[0.02] border-slate-700/15">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <Wrench className="h-3.5 w-3.5" /> Service Orders ({data.serviceOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.serviceOrders.length > 0 ? (
            <div className="space-y-1.5">
              {data.serviceOrders.slice(0, 5).map((so) => (
                <div
                  key={so.id}
                  className="flex justify-between items-center px-3 py-2 rounded-md bg-white/[0.015] border border-slate-700/8"
                  data-testid={`service-order-${so.id}`}
                >
                  <div>
                    <div className="text-xs font-medium text-slate-200">{so.title}</div>
                    <div className="text-[10px] text-slate-500">
                      {so.vendorName || "—"}
                      {so.eta ? ` · ETA: ${so.eta}` : ""}
                    </div>
                  </div>
                  <StatusBadge status={so.status} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-600 py-3 text-center">No service orders</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
