#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { platform, arch } from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const binariesDir = join(root, 'src-tauri', 'binaries');
const serverEntry = join(root, 'server', 'index.ts');
const bundledServer = join(root, 'dist', 'server-bundle.cjs');

const TARGETS = {
  'x86_64-pc-windows-msvc':    { pkg: 'node20-win-x64',   ext: '.exe' },
  'aarch64-apple-darwin':      { pkg: 'node20-macos-arm64', ext: '' },
  'x86_64-apple-darwin':       { pkg: 'node20-macos-x64',  ext: '' },
  'x86_64-unknown-linux-gnu':  { pkg: 'node20-linux-x64',  ext: '' },
};

function currentTriple() {
  if (platform === 'win32') return 'x86_64-pc-windows-msvc';
  if (platform === 'darwin') return arch === 'arm64'
    ? 'aarch64-apple-darwin'
    : 'x86_64-apple-darwin';
  return 'x86_64-unknown-linux-gnu';
}

async function bundleServer() {
  console.log('Bundling Express server with esbuild...');
  execSync(
    `npx esbuild ${serverEntry} ` +
    `--platform=node --target=node20 --bundle --format=cjs ` +
    `--outfile=${bundledServer} --allow-overwrite ` +
    `--external:@libsql/client ` +
    `--external:better-sqlite3 ` +
    `--external:bcrypt ` +
    `--external:sharp`,
    { stdio: 'inherit', cwd: root }
  );
}

async function buildTarget(triple) {
  const target = TARGETS[triple];
  if (!target) {
    console.error(`Unknown triple: ${triple}`);
    process.exit(1);
  }

  const outFile = join(binariesDir, `arus-server-${triple}${target.ext}`);
  console.log(`\nBuilding ${triple}...`);

  mkdirSync(binariesDir, { recursive: true });

  execSync(
    `npx pkg ${bundledServer} ` +
    `--target ${target.pkg} ` +
    `--output ${outFile} ` +
    `--compress GZip`,
    { stdio: 'inherit', cwd: root }
  );

  console.log(`  Done: ${outFile}`);
  return outFile;
}

async function main() {
  const buildAll = process.argv.includes('--all');

  await bundleServer();

  mkdirSync(binariesDir, { recursive: true });

  if (buildAll) {
    for (const triple of Object.keys(TARGETS)) {
      await buildTarget(triple);
    }
  } else {
    const triple = currentTriple();
    const out = await buildTarget(triple);

    const devCopy = join(binariesDir,
      `arus-server${triple.includes('windows') ? '.exe' : ''}`);
    copyFileSync(out, devCopy);
    console.log(`  Dev copy: ${devCopy}`);
  }

  console.log('\nSidecar build complete.');
  console.log('   Run `npm run tauri:build` to package the app.\n');
}

main().catch(e => { console.error(e); process.exit(1); });
