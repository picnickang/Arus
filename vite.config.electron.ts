import { defineConfig } from "vite";
import path from "path";

/**
 * Vite Configuration for Electron Main Process
 *
 * Builds electron/main.ts into a production-ready single-file CJS bundle
 * targeting Electron's Node.js runtime.
 *
 * Output: dist-electron/main.cjs
 */
export default defineConfig({
  build: {
    // Target Electron's Node.js (v20 for Electron 38)
    target: "node20",

    // Output directory for Electron main process
    outDir: "dist-electron",

    // Don't empty the directory (preload.ts might also build here)
    emptyOutDir: false,

    // Library mode for Node.js application
    lib: {
      entry: path.resolve(__dirname, "electron/main.ts"),
      formats: ["cjs"], // CommonJS for Electron compatibility
      fileName: () => "main.cjs",
    },

    // Force single-file bundle
    rollupOptions: {
      // Externalize Node.js built-ins and Electron
      external: [
        "electron",
        "child_process",
        "fs",
        "path",
        "http",
        "https",
        "os",
        "stream",
        "util",
        "events",
        "buffer",
        "crypto",
        "net",
        "tty",
        "zlib",
        "url",
        "process",
        "module",
      ],

      output: {
        // Ensure single-file output
        inlineDynamicImports: true,
      },
    },

    // Source maps
    sourcemap: process.env.NODE_ENV === "development" ? "inline" : false,

    // Minification (only in production)
    minify: process.env.NODE_ENV === "production" ? "esbuild" : false,
  },

  // ESBuild configuration for Node platform
  esbuild: {
    platform: "node",
  },

  // SSR options (for Node.js target)
  ssr: {
    target: "node",
    // Don't externalize dependencies - bundle them
    noExternal: true,
  },

  // Path aliases (match main vite.config.ts)
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
});
