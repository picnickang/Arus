import { useState, useEffect } from "react";

/**
 * Hook for managing device ID persistence in the browser.
 * Implements the Hub & Sync device ID management system.
 */

const DEVICE_ID_KEY = "arus-device-id";

// Generate a simple device ID using cryptographically secure random
function generateDeviceId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  return `device-${timestamp}-${random}`;
}

export function useDeviceId() {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load device ID from localStorage on mount
  useEffect(() => {
    try {
      let storedDeviceId = localStorage.getItem(DEVICE_ID_KEY);

      if (!storedDeviceId) {
        // Generate new device ID if none exists
        storedDeviceId = generateDeviceId();
        localStorage.setItem(DEVICE_ID_KEY, storedDeviceId);
      }

      setDeviceId(storedDeviceId);
    } catch (error) {
      console.warn("Failed to load device ID from localStorage:", error);
      // Fallback to session-only device ID
      setDeviceId(generateDeviceId());
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Function to manually set a new device ID
  const setNewDeviceId = (newId?: string) => {
    const id = newId || generateDeviceId();
    try {
      localStorage.setItem(DEVICE_ID_KEY, id);
      setDeviceId(id);
    } catch (error) {
      console.warn("Failed to save device ID to localStorage:", error);
      setDeviceId(id);
    }
  };

  // Function to clear device ID (useful for testing/reset)
  const clearDeviceId = () => {
    try {
      localStorage.removeItem(DEVICE_ID_KEY);
    } catch (error) {
      console.warn("Failed to clear device ID from localStorage:", error);
    }
    setNewDeviceId();
  };

  return {
    deviceId,
    isLoading,
    setNewDeviceId,
    clearDeviceId,
  };
}

// Utility function to get current device ID synchronously (for use in API calls)
// Automatically generates and persists a device ID if none exists to ensure
// all API requests include X-Device-Id headers from the first call
export function getCurrentDeviceId(): string {
  // Guard against non-browser contexts (SSR/tests)
  if (typeof globalThis === "undefined") {
    return "ssr-fallback-id";
  }

  try {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);

    if (!deviceId) {
      // Generate and persist new device ID immediately
      deviceId = generateDeviceId();
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }

    return deviceId;
  } catch (error) {
    console.warn("Failed to access localStorage for device ID:", error);
    // Return a session-only device ID as fallback
    return generateDeviceId();
  }
}
