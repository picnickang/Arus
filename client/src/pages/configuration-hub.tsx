import { TabbedPageLayout, TabDefinition } from "@/components/layouts/TabbedPageLayout";
import { Settings, Wifi, Database, Sliders, TestTube, Shield } from "lucide-react";
import { lazy, Suspense, useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

const SettingsPage = lazy(() => import("./settings"));
const TransportSettings = lazy(() => import("./transport-settings"));
const StorageSettings = lazy(() => import("./storage-settings"));
const OperatingParametersPage = lazy(() => import("./OperatingParametersPage"));
const DiagnosticsDashboard = lazy(() => import("./DiagnosticsDashboard"));
const PermissionsSettings = lazy(() => import("./permissions-settings"));

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

interface ConfigurationHubProps {
  embedded?: boolean;
}

function EmbeddedConfigurationHub() {
  const [location, setLocation] = useLocation();
  
  const tabs: TabDefinition[] = [
    {
      id: "system-settings",
      label: "System Settings",
      icon: Settings,
      component: (
        <Suspense fallback={<PageLoader />}>
          <SettingsPage embedded />
        </Suspense>
      ),
    },
    {
      id: "data-transport",
      label: "Data & Transport",
      icon: Wifi,
      component: (
        <Suspense fallback={<PageLoader />}>
          <TransportSettings embedded />
        </Suspense>
      ),
    },
    {
      id: "storage",
      label: "Storage Settings",
      icon: Database,
      component: (
        <Suspense fallback={<PageLoader />}>
          <StorageSettings />
        </Suspense>
      ),
    },
    {
      id: "operating-parameters",
      label: "Operating Parameters",
      icon: Sliders,
      component: (
        <Suspense fallback={<PageLoader />}>
          <OperatingParametersPage embedded />
        </Suspense>
      ),
    },
    {
      id: "system-diagnostics",
      label: "System Diagnostics",
      icon: TestTube,
      component: (
        <Suspense fallback={<PageLoader />}>
          <DiagnosticsDashboard embedded />
        </Suspense>
      ),
    },
    {
      id: "permissions",
      label: "Permissions & Roles",
      icon: Shield,
      component: (
        <Suspense fallback={<PageLoader />}>
          <PermissionsSettings embedded />
        </Suspense>
      ),
      adminOnly: true,
    },
  ];

  const getSubTabFromUrl = (): string => {
    const params = new URLSearchParams(globalThis.location.search);
    const subTabParam = params.get("subtab");
    return subTabParam || "system-settings";
  };

  const [activeSubTab, setActiveSubTab] = useState(getSubTabFromUrl());

  const handleSubTabChange = (tabId: string) => {
    setActiveSubTab(tabId);
    const params = new URLSearchParams(globalThis.location.search);
    params.set("subtab", tabId);
    const pathname = location.split("?")[0];
    setLocation(`${pathname}?${params.toString()}`);
  };

  useEffect(() => {
    const subTabFromUrl = getSubTabFromUrl();
    if (subTabFromUrl !== activeSubTab) {
      setActiveSubTab(subTabFromUrl);
    }
  }, [location]);

  const visibleTabs = tabs;

  return (
    <div className="h-full flex flex-col">
      <Tabs value={activeSubTab} onValueChange={handleSubTabChange} className="h-full flex flex-col">
        <div className="border-b bg-background px-4 md:px-6">
          <TabsList className="h-auto bg-transparent p-0 flex w-full overflow-x-auto scrollbar-hide">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={cn(
                    "rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent",
                    "px-3 py-2.5 text-sm font-medium transition-all",
                    "hover:text-foreground data-[state=inactive]:text-muted-foreground",
                    "whitespace-nowrap flex-shrink-0"
                  )}
                  data-testid={`subtab-trigger-${tab.id}`}
                >
                  <div className="flex items-center gap-2">
                    {Icon && <Icon className="h-4 w-4" />}
                    <span>{tab.label}</span>
                  </div>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <div className="flex-1 overflow-auto">
          {visibleTabs.map((tab) => (
            <TabsContent
              key={tab.id}
              value={tab.id}
              className="h-full mt-0 focus-visible:outline-none focus-visible:ring-0"
              data-testid={`subtab-content-${tab.id}`}
            >
              {tab.component}
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}

export default function ConfigurationHub({ embedded = false }: ConfigurationHubProps) {
  if (embedded) {
    return <EmbeddedConfigurationHub />;
  }

  const tabs: TabDefinition[] = [
    {
      id: "system-settings",
      label: "System Settings",
      icon: Settings,
      component: (
        <Suspense fallback={<PageLoader />}>
          <SettingsPage />
        </Suspense>
      ),
    },
    {
      id: "data-transport",
      label: "Data & Transport",
      icon: Wifi,
      component: (
        <Suspense fallback={<PageLoader />}>
          <TransportSettings />
        </Suspense>
      ),
    },
    {
      id: "storage",
      label: "Storage Settings",
      icon: Database,
      component: (
        <Suspense fallback={<PageLoader />}>
          <StorageSettings />
        </Suspense>
      ),
    },
    {
      id: "operating-parameters",
      label: "Operating Parameters",
      icon: Sliders,
      component: (
        <Suspense fallback={<PageLoader />}>
          <OperatingParametersPage />
        </Suspense>
      ),
    },
    {
      id: "system-diagnostics",
      label: "System Diagnostics",
      icon: TestTube,
      component: (
        <Suspense fallback={<PageLoader />}>
          <DiagnosticsDashboard />
        </Suspense>
      ),
    },
    {
      id: "permissions",
      label: "Permissions & Roles",
      icon: Shield,
      component: (
        <Suspense fallback={<PageLoader />}>
          <PermissionsSettings />
        </Suspense>
      ),
      adminOnly: true,
    },
  ];

  return (
    <TabbedPageLayout
      title="System Configuration"
      description="Configure system settings, data transport, storage, and operating parameters"
      tabs={tabs}
      defaultTab="system-settings"
    />
  );
}
