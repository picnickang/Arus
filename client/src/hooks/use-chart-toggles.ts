import { useState, useEffect } from "react";

export interface ChartToggles {
  showBaseline: boolean;
  showFleetAverage: boolean;
  showPercentiles: boolean;
  showAnomalies: boolean;
  showContext: boolean;
}

const defaultToggles: ChartToggles = {
  showBaseline: true,
  showFleetAverage: false,
  showPercentiles: false,
  showAnomalies: true,
  showContext: false,
};

/**
 * Hook for managing chart visualization toggles with localStorage persistence
 * @param chartId Unique identifier for the chart (e.g., 'power-stw', 'load-distribution')
 */
export function useChartToggles(chartId: string) {
  const storageKey = `arus-chart-toggles-${chartId}`;

  const [toggles, setToggles] = useState<ChartToggles>(() => {
    // Try to load from localStorage on mount
    if (typeof globalThis !== "undefined") {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          return { ...defaultToggles, ...JSON.parse(stored) };
        }
      } catch {
        console.error(`Failed to load chart toggles for ${chartId}:`, err);
      }
    }
    return defaultToggles;
  });

  // Persist to localStorage whenever toggles change
  useEffect(() => {
    if (typeof globalThis !== "undefined") {
      try {
        localStorage.setItem(storageKey, JSON.stringify(toggles));
      } catch {
        console.error(`Failed to save chart toggles for ${chartId}:`, err);
      }
    }
  }, [toggles, storageKey]);

  const setToggle = (key: keyof ChartToggles, value: boolean) => {
    setToggles((prev) => ({ ...prev, [key]: value }));
  };

  const resetToDefaults = () => {
    setToggles(defaultToggles);
  };

  return {
    toggles,
    setToggle,
    resetToDefaults,
    setToggles,
  };
}
