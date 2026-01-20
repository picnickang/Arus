#!/usr/bin/env node

console.log('=== ARUS Standalone Server Test ===\n');

// Test 1: Basic Node.js
console.log('✓ Test 1: Node.js is working');
console.log('  Node version:', process.version);
console.log('  Platform:', process.platform);
console.log('  Arch:', process.arch);

// Test 2: Environment variables
console.log('\n✓ Test 2: Environment check');
console.log('  LOCAL_MODE:', process.env.LOCAL_MODE);
console.log('  DATABASE_PATH:', process.env.DATABASE_PATH);
console.log('  NODE_ENV:', process.env.NODE_ENV);

// Test 3: Can we import the server?
console.log('\n→ Test 3: Attempting to import server...');

try {
  await import('./dist/index.js');
  console.log('✓ Test 3: Server imported successfully!');
} catch (error) {
  console.error('❌ Test 3 FAILED: Server import crashed');
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}
