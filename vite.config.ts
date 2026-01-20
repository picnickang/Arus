import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            if (id.includes("react-dom") || id.includes("react/")) {
              return "vendor-react";
            }
            if (id.includes("@radix-ui") || id.includes("lucide-react") || id.includes("cmdk")) {
              return "vendor-ui";
            }
            if (id.includes("recharts") || id.includes("d3-")) {
              return "vendor-charts";
            }
            if (id.includes("@tanstack")) {
              return "vendor-tanstack";
            }
            if (id.includes("jspdf") || id.includes("xlsx") || id.includes("html2canvas") || id.includes("pdf-lib")) {
              return "vendor-export";
            }
            if (id.includes("zod") || id.includes("drizzle") || id.includes("date-fns")) {
              return "vendor-utils";
            }
          }
          if (id.includes("/features/scheduling/") || id.includes("/components/scheduling/")) {
            return "features-scheduling";
          }
          if (id.includes("/features/crew/") || id.includes("/components/crew/")) {
            return "features-crew";
          }
          if (id.includes("/features/compliance/") || id.includes("/pages/logs-")) {
            return "features-logs";
          }
          if (id.includes("/features/analytics/") || id.includes("/pages/analytics")) {
            return "features-analytics";
          }
          if (id.includes("/features/ml-ai/") || id.includes("/pages/ai-")) {
            return "features-ml-ai";
          }
          if (id.includes("/features/admin/") || id.includes("/pages/admin")) {
            return "features-admin";
          }
          if (id.includes("/features/maintenance/") || id.includes("/pages/maint")) {
            return "features-maintenance";
          }
          return undefined;
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-tabs",
      "@radix-ui/react-select",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-popover",
      "@radix-ui/react-accordion",
      "@radix-ui/react-separator",
      "@radix-ui/react-switch",
      "@radix-ui/react-label",
      "@radix-ui/react-slot",
      "@tanstack/react-query",
      "@tanstack/react-virtual",
      "wouter",
      "lucide-react",
      "clsx",
      "tailwind-merge",
      "class-variance-authority",
      "date-fns",
      "date-fns-tz",
      "zod",
      "react-hook-form",
      "@hookform/resolvers",
      "recharts",
      "framer-motion",
    ],
    exclude: ["jspdf", "xlsx", "html2canvas", "pdf-lib"],
    esbuildOptions: {
      target: "esnext",
    },
  },
  esbuild: {
    target: "esnext",
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
