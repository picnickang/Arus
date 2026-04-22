import { Brain, Activity, FileText } from "lucide-react";
import { lazy, Suspense, useState, useEffect, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/navigation";

const SensorOptimization = lazy(() => import("./sensor-optimization"));
const SensorManagement = lazy(() => import("./sensor-management"));
const SensorTemplatesPage = lazy(() => import("./sensor-templates"));

function PageLoader() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-[400px] w-full" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-[200px]" />
        <Skeleton className="h-[200px]" />
      </div>
    </div>
  );
}

function getTabFromUrl(): string {
  if (typeof window === "undefined") {return "optimization";}
  const params = new URLSearchParams(window.location.search);
  return params.get("tab") || "optimization";
}

export default function SensorsHub() {
  const [activeTab, setActiveTab] = useState(() => getTabFromUrl());

  const handleTabChange = useCallback((tabId: string) => {
    setActiveTab(tabId);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tabId);
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(getTabFromUrl());
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Sensors" />
      <div className="p-4">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="optimization" className="flex items-center gap-2" data-testid="tab-optimization">
            <Brain className="h-4 w-4" />
            <span className="hidden sm:inline">AI Optimization</span>
          </TabsTrigger>
          <TabsTrigger value="management" className="flex items-center gap-2" data-testid="tab-management">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Management</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2" data-testid="tab-templates">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Templates</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="optimization" className="mt-4">
          <Suspense fallback={<PageLoader />}>
            <SensorOptimization />
          </Suspense>
        </TabsContent>

        <TabsContent value="management" className="mt-4">
          <Suspense fallback={<PageLoader />}>
            <SensorManagement />
          </Suspense>
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <Suspense fallback={<PageLoader />}>
            <SensorTemplatesPage />
          </Suspense>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
