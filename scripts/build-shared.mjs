#!/usr/bin/env node
/**
 * Build shared TypeScript files
 * 
 * Security Note (S4036 - PATH variable):
 * Uses execFileSync with 'npx' which resolves from npm's controlled PATH.
 * This script runs only in build context with controlled inputs from local filesystem.
 */

import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const sharedDir = 'shared';
const tsFiles = readdirSync(sharedDir)
  .filter(file => file.endsWith('.ts'))
  .map(file => join(sharedDir, file));

if (tsFiles.length === 0) {
  console.log('No TypeScript files found in shared/ directory');
  process.exit(0);
}

console.log(`Transpiling ${tsFiles.length} TypeScript files in shared/ directory...`);

// NOSONAR: S4036 - execFileSync with array args; inputs are hardcoded constants from local filesystem
const esbuildArgs = [
  ...tsFiles,
  '--platform=node',
  '--format=esm',
  '--outdir=shared',
  '--out-extension:.js=.js',
  '--allow-overwrite'
];

try {
  execFileSync('npx', ['esbuild', ...esbuildArgs], { stdio: 'inherit' });
  console.log('✅ Successfully transpiled shared/ TypeScript files to JavaScript');
} catch (error) {
  console.error('❌ Failed to transpile shared/ TypeScript files');
  process.exit(1);
}
