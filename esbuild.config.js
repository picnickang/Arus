import * as esbuild from 'esbuild';

// Build backend bundle
// server/vite.ts is only loaded in development via dynamic import
// In production, server/index.ts uses express.static directly
await esbuild.build({
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: 'dist',
  // CRITICAL FIX: Use packages: 'external' to mark ALL node_modules as external
  // This prevents native bindings (@tensorflow, @google-ortools, serialport, etc.) from being bundled
  // Native modules MUST be loaded at runtime, not bundled, or they crash in Docker
  packages: 'external'
});
