/* global console, navigator, window */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const { hostname, port } = window.location;

    const isStandalone = hostname === "localhost" && port === "31888";
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
    const isReplit = hostname.includes("replit") || port === "5000";
    const isProduction = !isLocalhost && !isReplit;
    const shouldRegister = isProduction || isStandalone;

    if (shouldRegister) {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((registration) => {
          console.log("Service Worker registered:", registration.scope);
          console.log("Mode:", isStandalone ? "Standalone Mac App" : "Production");
        })
        .catch((error) => {
          console.error("Service Worker registration failed:", error);
        });
      return;
    }

    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister();
        console.log("Unregistered service worker in development mode");
      });
    });
  });
}
