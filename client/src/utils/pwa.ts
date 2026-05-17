// PWA Service Worker Registration and Management
// Handles service worker registration, updates, and PWA installation

export interface PWAInstallPrompt {
  platforms: string[];
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  prompt(): Promise<void>;
}

export interface PWAInstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
  platforms: string[];
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: PWAInstallEvent;
  }
}

class PWAManager {
  private installPrompt: PWAInstallEvent | null = null;
  private isInstalled = false;
  private isOnline = navigator.onLine;
  private callbacks: {
    onInstallPrompt?: (prompt: PWAInstallEvent) => void;
    onInstalled?: () => void;
    onOnlineChange?: (online: boolean) => void;
    onUpdateAvailable?: () => void;
  } = {};

  constructor() {
    this.setupEventListeners();
    this.checkIfInstalled();
  }

  /**
   * Register service worker and setup PWA functionality
   */
  async initialize(): Promise<void> {
    // In development, unregister any existing service workers to prevent caching issues
    if (import.meta.env.DEV) {
      console.info("⚙️ Service Worker registration skipped in development mode");
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
          console.info("🗑️ Unregistered service worker in development mode");
        }
      }
      return;
    }

    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.register("/service-worker.js", {
          scope: "/",
        });

        console.info("✅ Service Worker registered successfully:", registration.scope);

        // Check for updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                console.info("🔄 Service Worker update available");
                this.callbacks.onUpdateAvailable?.();
              }
            });
          }
        });

        // Handle messages from service worker
        navigator.serviceWorker.addEventListener("message", (event) => {
          console.info("📨 Message from SW:", event.data);
        });

        return registration;
      } catch (error) {
        console.error("❌ Service Worker registration failed:", error);
        throw error;
      }
    } else {
      console.warn("⚠️ Service Workers not supported");
    }
  }

  /**
   * Setup event listeners for PWA functionality
   */
  private setupEventListeners(): void {
    // Listen for install prompt
    globalThis.addEventListener("beforeinstallprompt", (event: PWAInstallEvent) => {
      event.preventDefault();
      this.installPrompt = event;
      console.info("📱 PWA install prompt available");
      this.callbacks.onInstallPrompt?.(event);
    });

    // Listen for app installation
    globalThis.addEventListener("appinstalled", () => {
      console.info("✅ PWA installed successfully");
      this.isInstalled = true;
      this.installPrompt = null;
      this.callbacks.onInstalled?.();
    });

    // Listen for online/offline status
    globalThis.addEventListener("online", () => {
      this.isOnline = true;
      console.info("🌐 Back online");
      this.callbacks.onOnlineChange?.(true);
    });

    globalThis.addEventListener("offline", () => {
      this.isOnline = false;
      console.info("📴 Gone offline");
      this.callbacks.onOnlineChange?.(false);
    });
  }

  /**
   * Check if app is already installed
   */
  private checkIfInstalled(): void {
    // Check if running in standalone mode (PWA)
    if (globalThis.matchMedia("(display-mode: standalone)").matches) {
      this.isInstalled = true;
      console.info("📱 Running as installed PWA");
    }

    // Check for Android TWA
    if ("getInstalledRelatedApps" in navigator) {
      const navWithApps = navigator as Navigator & {
        getInstalledRelatedApps: () => Promise<Array<{ id?: string; platform?: string }>>;
      };
      navWithApps.getInstalledRelatedApps().then((apps) => {
        if (apps.length > 0) {
          this.isInstalled = true;
          console.info("📱 Running as TWA or installed app");
        }
      });
    }
  }

  /**
   * Show PWA install prompt
   */
  async showInstallPrompt(): Promise<"accepted" | "dismissed" | "unavailable"> {
    if (!this.installPrompt) {
      console.warn("⚠️ Install prompt not available");
      return "unavailable";
    }

    try {
      await this.installPrompt.prompt();
      const choice = await this.installPrompt.userChoice;
      console.info("📱 Install prompt result:", choice.outcome);

      if (choice.outcome === "accepted") {
        this.installPrompt = null;
      }

      return choice.outcome;
    } catch (error) {
      console.error("❌ Install prompt failed:", error);
      return "unavailable";
    }
  }

  /**
   * Check if PWA can be installed
   */
  canInstall(): boolean {
    return !!this.installPrompt && !this.isInstalled;
  }

  /**
   * Check if PWA is installed
   */
  isAppInstalled(): boolean {
    return this.isInstalled;
  }

  /**
   * Check if device is online
   */
  isDeviceOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Register callbacks for PWA events
   */
  onInstallPrompt(callback: (prompt: PWAInstallEvent) => void): void {
    this.callbacks.onInstallPrompt = callback;
  }

  onInstalled(callback: () => void): void {
    this.callbacks.onInstalled = callback;
  }

  onOnlineChange(callback: (online: boolean) => void): void {
    this.callbacks.onOnlineChange = callback;
  }

  onUpdateAvailable(callback: () => void): void {
    this.callbacks.onUpdateAvailable = callback;
  }

  /**
   * Request persistent storage for offline data
   */
  async requestPersistentStorage(): Promise<boolean> {
    if ("storage" in navigator && "persist" in navigator.storage) {
      try {
        const persistent = await navigator.storage.persist();
        console.info(`💾 Persistent storage: ${persistent ? "granted" : "denied"}`);
        return persistent;
      } catch (error) {
        console.error("❌ Persistent storage request failed:", error);
        return false;
      }
    }
    return false;
  }

  /**
   * Get storage usage estimate
   */
  async getStorageEstimate(): Promise<StorageEstimate | null> {
    if ("storage" in navigator && "estimate" in navigator.storage) {
      try {
        return await navigator.storage.estimate();
      } catch (error) {
        console.error("❌ Storage estimate failed:", error);
        return null;
      }
    }
    return null;
  }

  /**
   * Force service worker update
   */
  async updateServiceWorker(): Promise<void> {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.update();
        console.info("🔄 Service Worker update forced");
      }
    }
  }

  /**
   * Post message to service worker
   */
  postMessageToSW(message: unknown): void {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(message);
    }
  }

  /**
   * Show notification (if permission granted)
   */
  async showNotification(title: string, options?: NotificationOptions): Promise<void> {
    if ("Notification" in window) {
      if (Notification.permission === "granted") {
        if ("serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.getRegistration();
          if (registration) {
            await registration.showNotification(title, options);
            return;
          }
        }
        new Notification(title, options);
      } else if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
          await this.showNotification(title, options);
        }
      }
    }
  }
}

// Create global PWA manager instance
export const pwaManager = new PWAManager();
