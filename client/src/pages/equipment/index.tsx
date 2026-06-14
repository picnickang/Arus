import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Equipment } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { equipmentKeys } from "@/utils/queryKeys";
import { useToast } from "@/hooks/use-toast";
import { useEquipmentPageData } from "@/features/vessels";
import { EquipmentPageDialogs } from "./EquipmentPageDialogs";
import { EquipmentPageStats } from "./EquipmentPageStats";
import { EquipmentRegistryTabs } from "./EquipmentPageTabs";
import type { CertSummary, EquipmentItem } from "./types";

export default function EquipmentPage() {
  const { toast } = useToast();
  const m = useEquipmentPageData();
  const [activeTab, setActiveTab] = useState<"active" | "decommissioned">("active");
  const [isDecommissionDialogOpen, setIsDecommissionDialogOpen] = useState(false);
  const [isReinstateDialogOpen, setIsReinstateDialogOpen] = useState(false);
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [lifecycleEquipment, setLifecycleEquipment] = useState<Equipment | null>(null);

  const { data: allCerts = [] } = useQuery<CertSummary[]>({
    queryKey: ["/api/certificates"],
  });

  const { data: decommissionedEquipment = [], isLoading: isLoadingDecommissioned } = useQuery<
    Equipment[]
  >({
    queryKey: equipmentKeys.decommissioned(),
    queryFn: () => apiRequest<Equipment[]>("GET", "/api/equipment/decommissioned"),
    enabled: activeTab === "decommissioned",
  });

  const handleReinstate = (item: Equipment) => {
    setLifecycleEquipment(item);
    setIsReinstateDialogOpen(true);
  };

  const handleViewHistory = (item: EquipmentItem | Equipment) => {
    setLifecycleEquipment(item as Equipment);
    setIsHistoryDialogOpen(true);
  };

  const handleLifecycleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: equipmentKeys.list() });
    queryClient.invalidateQueries({ queryKey: equipmentKeys.decommissioned() });
    m.refetchEquipment();
  };

  if (m.isLoading) {
    return (
      <div className="min-h-screen">
        <div className="p-4 md:p-6 space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <div className="space-y-2">
            {[...Array(10)].map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="p-4 md:p-6 space-y-6">
        <EquipmentPageStats m={m} />
        <EquipmentRegistryTabs
          m={m}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          decommissionedEquipment={decommissionedEquipment}
          isLoadingDecommissioned={isLoadingDecommissioned}
          allCerts={allCerts}
          onReinstate={handleReinstate}
          onViewHistory={handleViewHistory}
        />
        <EquipmentPageDialogs
          m={m}
          allCerts={allCerts}
          lifecycleEquipment={lifecycleEquipment}
          setLifecycleEquipment={setLifecycleEquipment}
          isDecommissionDialogOpen={isDecommissionDialogOpen}
          setIsDecommissionDialogOpen={setIsDecommissionDialogOpen}
          isReinstateDialogOpen={isReinstateDialogOpen}
          setIsReinstateDialogOpen={setIsReinstateDialogOpen}
          isHistoryDialogOpen={isHistoryDialogOpen}
          setIsHistoryDialogOpen={setIsHistoryDialogOpen}
          onLifecycleSuccess={handleLifecycleSuccess}
          toast={toast}
        />
      </div>
    </div>
  );
}
