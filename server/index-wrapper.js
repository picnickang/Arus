#!/usr/bin/env node
/**
 * Wrapper for bundled ESM server
 * 
 * Since package.json has "type": "module", this .js file is treated as ESM
 * and can use top-level await.
 * 
 * CRITICAL: We do NOT exit after import - the HTTP server keeps the process alive
 */

console.log('🚀 Loading ARUS server...');

try {
  // Top-level await is valid in ESM modules (package.json has "type": "module")
  await import('./index.js');
  console.log('✅ Server loaded successfully, HTTP server is running');
  // DO NOT call process.exit() - the HTTP server is listening and keeps the process alive
} catch (error) {
  console.error('❌ Server initialization failed:', error);
  console.error('Error name:', error.name);
  console.error('Error message:', error.message);  
  if (error.stack) {
    console.error('Stack trace:', error.stack);
  }
  process.exit(1);
}
