import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Suppress Vite HMR WebSocket unhandled rejections in development
if (import.meta.env.DEV) {
  globalThis.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.message?.includes('string did not match')) {
      event.preventDefault();
    }
  });
}

// Initialize PWA functionality
import { pwaManager } from "./utils/pwa";

// Initialize PWA functionality
pwaManager.initialize().catch((error) => {
  console.error("Failed to initialize PWA:", error);
});

// Setup PWA event handlers
pwaManager.onInstallPrompt((prompt) => {
  console.info("PWA install prompt available");
  // Store prompt for later use in UI
  (window as unknown as { pwaInstallPrompt: BeforeInstallPromptEvent }).pwaInstallPrompt = prompt;
});

pwaManager.onInstalled(() => {
  console.info("PWA installed successfully");
});

pwaManager.onOnlineChange((online) => {
  console.info("Connection status changed:", online ? "online" : "offline");
  // Could show toast notification here
});

pwaManager.onUpdateAvailable(() => {
  console.info("PWA update available");
  // Could show update notification here
});

createRoot(document.getElementById("root")!).render(<App />);
