import { useState, useEffect, useCallback } from "react";

export interface DashboardPreferences {
  defaultView: "overview" | "devices" | "maintenance";
  collapsedSections: string[];
  vesselFilter: string;
  autoRefresh: boolean;
  refreshInterval: number;
  metricsVariant: "default" | "minimal";
}

const DEFAULT_PREFERENCES: DashboardPreferences = {
  defaultView: "overview",
  collapsedSections: [],
  vesselFilter: "all",
  autoRefresh: true,
  refreshInterval: 30000, // 30 seconds
  metricsVariant: "minimal",
};

const STORAGE_KEY = "arus-dashboard-preferences";

function getStoredPreferences(): DashboardPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error("Failed to load dashboard preferences:", error);
  }
  return DEFAULT_PREFERENCES;
}

export function useDashboardPreferences() {
  const [preferences, setPreferences] = useState<DashboardPreferences>(getStoredPreferences);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error("Failed to save dashboard preferences:", error);
    }
  }, [preferences]);

  const updatePreference = useCallback(
    <K extends keyof DashboardPreferences>(key: K, value: DashboardPreferences[K]) => {
      setPreferences((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const toggleSectionCollapsed = useCallback((sectionId: string) => {
    setPreferences((prev) => ({
      ...prev,
      collapsedSections: prev.collapsedSections.includes(sectionId)
        ? prev.collapsedSections.filter((id) => id !== sectionId)
        : [...prev.collapsedSections, sectionId],
    }));
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
  }, []);

  return {
    preferences,
    updatePreference,
    toggleSectionCollapsed,
    resetPreferences,
  };
}
