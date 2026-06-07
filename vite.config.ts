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
