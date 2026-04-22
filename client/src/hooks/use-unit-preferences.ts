import { useState, useEffect } from "react";
import {
  UnitPreferences,
  defaultUnitPreferences,
  PowerUnit,
  SpeedUnit,
  WeightUnit,
  TemperatureUnit,
} from "@/lib/unit-conversions";

const STORAGE_KEY = "arus-unit-preferences";

/**
 * Hook for managing user unit preferences with localStorage persistence
 */
export function useUnitPreferences() {
  const [preferences, setPreferences] = useState<UnitPreferences>(() => {
    // Try to load from localStorage on mount
    if (typeof globalThis !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          return { ...defaultUnitPreferences, ...JSON.parse(stored) };
        }
      } catch {
        console.error("Failed to load unit preferences from localStorage:", err);
      }
    }
    return defaultUnitPreferences;
  });

  // Persist to localStorage whenever preferences change
  useEffect(() => {
    if (typeof globalThis !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      } catch {
        console.error("Failed to save unit preferences to localStorage:", err);
      }
    }
  }, [preferences]);

  const setPowerUnit = (unit: PowerUnit) => {
    setPreferences((prev) => ({ ...prev, power: unit }));
  };

  const setSpeedUnit = (unit: SpeedUnit) => {
    setPreferences((prev) => ({ ...prev, speed: unit }));
  };

  const setWeightUnit = (unit: WeightUnit) => {
    setPreferences((prev) => ({ ...prev, weight: unit }));
  };

  const setTemperatureUnit = (unit: TemperatureUnit) => {
    setPreferences((prev) => ({ ...prev, temperature: unit }));
  };

  const resetToDefaults = () => {
    setPreferences(defaultUnitPreferences);
  };

  return {
    preferences,
    setPowerUnit,
    setSpeedUnit,
    setWeightUnit,
    setTemperatureUnit,
    resetToDefaults,
    setPreferences,
  };
}
