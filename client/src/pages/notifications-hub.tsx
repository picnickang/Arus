import { lazy, Suspense, useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, AlertTriangle, Mail, Bot } from "lucide-react";
import { PageHeader } from "@/components/navigation";
import { SuggestionPreferences } from "@/components/agent/SuggestionPreferences";

const NotificationSettings = lazy(() => import("./notification-settings"));
const EmailAlertsSettings = lazy(() => import("./email-alerts-settings"));
const EmailTemplatesPage = lazy(() => import("./email-templates"));

function TabLoader() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-[300px] w-full" />
    </div>
  );
}

function getTabFromUrl(): string {
  if (typeof window === "undefined") return "preferences";
  const params = new URLSearchParams(window.location.search);
  return params.get("tab") || "preferences";
}

export default function NotificationsHub() {
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
      <PageHeader title="Notifications" />
      <div className="p-4">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList className="grid w-full max-w-xl grid-cols-4">
            <TabsTrigger value="preferences" className="flex items-center gap-2" data-testid="tab-preferences">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Preferences</span>
            </TabsTrigger>
            <TabsTrigger value="ai-suggestions" className="flex items-center gap-2" data-testid="tab-ai-suggestions">
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">AI Suggestions</span>
            </TabsTrigger>
            <TabsTrigger value="alert-rules" className="flex items-center gap-2" data-testid="tab-alert-rules">
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">Alert Rules</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2" data-testid="tab-templates">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Templates</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="preferences" className="mt-4">
            <Suspense fallback={<TabLoader />}>
              <NotificationSettings />
            </Suspense>
          </TabsContent>

          <TabsContent value="ai-suggestions" className="mt-4">
            <SuggestionPreferences />
          </TabsContent>

          <TabsContent value="alert-rules" className="mt-4">
            <Suspense fallback={<TabLoader />}>
              <EmailAlertsSettings />
            </Suspense>
          </TabsContent>

          <TabsContent value="templates" className="mt-4">
            <Suspense fallback={<TabLoader />}>
              <EmailTemplatesPage />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
