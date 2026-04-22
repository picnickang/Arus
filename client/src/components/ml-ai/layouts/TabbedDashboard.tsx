import { Suspense, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
  icon: LucideIcon;
  component:
    | React.LazyExoticComponent<React.ComponentType<Record<string, unknown>>>
    | React.ComponentType<Record<string, unknown>>;
  props?: Record<string, unknown>;
}

interface TabbedDashboardProps {
  title: string;
  description?: string;
  tabs: Tab[];
  defaultTab?: string;
  header?: React.ReactNode;
  className?: string;
  "data-testid"?: string;
}

function TabLoadingFallback() {
  return (
    <div className="space-y-4 py-6">
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export function TabbedDashboard({
  title: _title,
  description: _description,
  tabs,
  defaultTab,
  header,
  className,
  "data-testid": testId,
}: TabbedDashboardProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || "");

  return (
    <div className={cn("space-y-6", className)} data-testid={testId}>
      {/* Header */}
      {header}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Tab Navigation - Horizontally scrollable on mobile */}
        <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-full min-w-fit p-1 gap-1 sm:w-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex-shrink-0 text-xs sm:text-sm px-3 py-2 min-h-[44px] min-w-[90px] sm:min-w-[110px] gap-2"
                  data-testid={`tab-${tab.id}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* Tab Content */}
        {tabs.map((tab) => {
          const Component = tab.component;

          return (
            <TabsContent
              key={tab.id}
              value={tab.id}
              className="mt-6"
              data-testid={`tab-content-${tab.id}`}
            >
              <Suspense fallback={<TabLoadingFallback />}>
                <Component {...(tab.props ?? {})} />
              </Suspense>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
