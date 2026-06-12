import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env['NODE_ENV'] !== "production" &&
    process.env['REPL_ID'] !== undefined
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
    // Restored from ca845eb (removed without explanation in 3447598's
    // vessel-intelligence rollout): without this splitter every vendor lib
    // collapses into the entry bundle (~676 kB gzip) and the size-limit
    // budgets in .size-limit.json have nothing to measure.
    rollupOptions: {
      output: {
        // Distinct entry name: ~22 lazy page chunks are also called
        // "index-*" (their source files are index.tsx), which made the old
        // size-limit glob measure every one of them as "initial". "app-*"
        // matches exactly the real entry.
        entryFileNames: "assets/app-[hash].js",
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
            if (id.includes("jspdf") || id.includes("xlsx") || id.includes("pdf-lib")) {
              return "vendor-export";
            }
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
    ],
    exclude: ["jspdf", "xlsx", "pdf-lib"],
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
