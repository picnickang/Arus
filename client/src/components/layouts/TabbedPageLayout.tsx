import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/components/MobileTouchControls";
import { ChevronLeft, Home } from "lucide-react";

export interface TabDefinition {
  id: string;
  label: string;
  icon?: React.ElementType;
  component: React.ReactNode;
  adminOnly?: boolean;
}

interface TabbedPageLayoutProps {
  title: string;
  description?: string;
  tabs: TabDefinition[];
  defaultTab?: string;
  headerAction?: React.ReactNode;
  isAdminUnlocked?: boolean;
}

export function TabbedPageLayout({
  title,
  description,
  tabs,
  defaultTab,
  headerAction,
  isAdminUnlocked = true,
}: TabbedPageLayoutProps) {
  const [location, setLocation] = useLocation();
  const isMobile = useIsMobile();

  // Parse tab from URL query params
  const getTabFromUrl = (): string => {
    const params = new URLSearchParams(globalThis.location.search);
    const tabParam = params.get("tab");
    return tabParam || defaultTab || tabs[0]?.id || "";
  };

  const [activeTab, setActiveTab] = useState(getTabFromUrl());

  // Update URL when tab changes using wouter's setLocation
  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    const pathname = location.split("?")[0];
    const newUrl = `${pathname}?tab=${tabId}`;
    setLocation(newUrl);
  };

  // Sync tab with URL on mount and when URL changes (including browser back/forward)
  useEffect(() => {
    const tabFromUrl = getTabFromUrl();
    if (tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [location]);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const tabFromUrl = getTabFromUrl();
      setActiveTab(tabFromUrl);
    };

    globalThis.addEventListener("popstate", handlePopState);
    return () => globalThis.removeEventListener("popstate", handlePopState);
  }, []);

  // Filter tabs based on admin access
  const visibleTabs = tabs.filter((tab) => !tab.adminOnly || (tab.adminOnly && isAdminUnlocked));

  return (
    <div className="h-full flex flex-col">
      <div
        className={cn(
          "border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
          isMobile ? "px-4 py-4" : "px-8 py-6"
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-9 w-9" data-testid="button-home">
                <Home className="h-5 w-5" />
                <span className="sr-only">Home</span>
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => {
                if (window.history.length > 1) {
                  window.history.back();
                } else {
                  setLocation("/");
                }
              }}
              data-testid="button-back"
            >
              <ChevronLeft className="h-5 w-5" />
              <span className="sr-only">Back</span>
            </Button>
          </div>
          <div className="flex-1 min-w-0">
            <h1
              className={cn("font-bold tracking-tight", isMobile ? "text-2xl" : "text-3xl")}
              data-testid="page-title"
            >
              {title}
            </h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-1" data-testid="page-description">
                {description}
              </p>
            )}
          </div>
          {headerAction && <div className={isMobile ? "flex-shrink-0" : ""}>{headerAction}</div>}
        </div>
      </div>

      {/* Tabbed Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="h-full flex flex-col">
          {/* Tab List - Scrollable on mobile */}
          <div className={cn("border-b bg-background", isMobile ? "px-2" : "px-8")}>
            <TabsList
              className={cn(
                "h-auto bg-transparent p-0",
                isMobile && "flex w-full overflow-x-auto scrollbar-hide"
              )}
            >
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    className={cn(
                      "rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent",
                      "px-4 py-3 text-sm font-medium transition-all",
                      "hover:text-foreground data-[state=inactive]:text-muted-foreground",
                      isMobile && "whitespace-nowrap flex-shrink-0"
                    )}
                    data-testid={`tab-trigger-${tab.id}`}
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

          {/* Tab Content - Scrollable */}
          <div className="flex-1 overflow-auto">
            {visibleTabs.map((tab) => (
              <TabsContent
                key={tab.id}
                value={tab.id}
                className="h-full mt-0 focus-visible:outline-none focus-visible:ring-0"
                data-testid={`tab-content-${tab.id}`}
              >
                {tab.component}
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </div>
    </div>
  );
}
