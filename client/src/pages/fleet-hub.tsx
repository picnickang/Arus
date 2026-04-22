import { useState, useEffect } from "react";
import { useSearch, useLocation } from "wouter";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Ship, Server } from "lucide-react";
import VesselManagement from "./vessel-management";
import EquipmentPage from "./equipment";

function getTabFromSearch(search: string): "vessels" | "equipment" {
  const params = new URLSearchParams(search.startsWith("?") ? search : search);
  const tab = params.get("tab");
  if (tab === "equipment") {return "equipment";}
  return "vessels";
}

export default function FleetPage() {
  const searchString = useSearch();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"vessels" | "equipment">(() =>
    getTabFromSearch(searchString || window.location.search)
  );

  useEffect(() => {
    setActiveTab(getTabFromSearch(searchString || ""));
  }, [searchString]);

  const handleTabChange = (value: string) => {
    const tab = value as "vessels" | "equipment";
    setActiveTab(tab);
    const url = tab === "vessels" ? "/fleet" : "/fleet?tab=equipment";
    setLocation(url, { replace: true });
  };

  return (
    <div className="min-h-screen">
      <div className="px-6 pt-4">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList data-testid="fleet-tabs">
            <TabsTrigger value="vessels" className="flex items-center gap-2" data-testid="tab-vessels">
              <Ship className="h-4 w-4" />
              Vessels
            </TabsTrigger>
            <TabsTrigger value="equipment" className="flex items-center gap-2" data-testid="tab-equipment">
              <Server className="h-4 w-4" />
              Equipment
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {activeTab === "vessels" ? <VesselManagement /> : <EquipmentPage />}
    </div>
  );
}
