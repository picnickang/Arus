import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, AlertTriangle, Mail, Bot } from "lucide-react";
import { PageHeader } from "@/components/navigation";
import { SuggestionPreferences } from "@/components/agent/SuggestionPreferences";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function getTabFromUrl(): string {
  if (typeof window === "undefined") return "ai-suggestions";
  const params = new URLSearchParams(window.location.search);
  return params.get("tab") || "ai-suggestions";
}

function PlaceholderTab({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
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
          <TabsList className="grid w-full max-w-lg grid-cols-4">
            <TabsTrigger value="ai-suggestions" className="flex items-center gap-2" data-testid="tab-ai-suggestions">
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">AI Suggestions</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="flex items-center gap-2" data-testid="tab-preferences">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Preferences</span>
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

          <TabsContent value="ai-suggestions" className="mt-4">
            <SuggestionPreferences />
          </TabsContent>

          <TabsContent value="preferences" className="mt-4">
            <PlaceholderTab
              title="Notification Preferences"
              description="Configure notification channels and delivery preferences. Settings for email, push, and in-app notifications."
            />
          </TabsContent>

          <TabsContent value="alert-rules" className="mt-4">
            <PlaceholderTab
              title="Alert Rules"
              description="Manage alert rules and thresholds for equipment monitoring and compliance alerts."
            />
          </TabsContent>

          <TabsContent value="templates" className="mt-4">
            <PlaceholderTab
              title="Email Templates"
              description="Customize email notification templates for different alert types and reports."
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
