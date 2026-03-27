#!/usr/bin/env node
import { execSync }                            from 'node:child_process';
import { mkdirSync, copyFileSync,
         writeFileSync, existsSync,
         readdirSync }                         from 'node:fs';
import { join, dirname, relative, extname }    from 'node:path';
import { fileURLToPath }                       from 'node:url';
import { platform, arch }                      from 'node:process';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const root       = join(__dirname, '..');
const binDir     = join(root, 'src-tauri', 'binaries');
const bundleOut  = join(root, 'dist', 'server-bundle.cjs');
const assetsJson = join(root, 'dist', 'pkg-assets.json');

const TARGETS = {
  'x86_64-pc-windows-msvc':   { pkg: 'node20-win-x64',    ext: '.exe' },
  'aarch64-apple-darwin':     { pkg: 'node20-macos-arm64', ext: ''     },
  'x86_64-apple-darwin':      { pkg: 'node20-macos-x64',  ext: ''     },
  'x86_64-unknown-linux-gnu': { pkg: 'node20-linux-x64',  ext: ''     },
};

function currentTriple() {
  if (platform === 'win32')   return 'x86_64-pc-windows-msvc';
  if (platform === 'darwin')  return arch === 'arm64'
    ? 'aarch64-apple-darwin'
    : 'x86_64-apple-darwin';
  return 'x86_64-unknown-linux-gnu';
}

function findNativeAddons(searchRoot) {
  const results = [];

  function walk(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); }
    catch { return; }

    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (['test', 'tests', 'example', 'examples', '.bin'].includes(entry.name)) continue;
        walk(full);
      } else if (entry.isFile() && extname(entry.name) === '.node') {
        results.push(full);
      }
    }
  }

  walk(searchRoot);
  return results;
}

function buildAssetsManifest() {
  const nmDir    = join(root, 'node_modules');
  const addons   = findNativeAddons(nmDir);
  const assets   = {};

  for (const addonPath of addons) {
    const rel = relative(dirname(bundleOut), addonPath).replace(/\\/g, '/');
    assets[rel] = { isAsset: true };
  }

  writeFileSync(assetsJson, JSON.stringify({ assets }, null, 2));
  console.log(`  Asset manifest: ${addons.length} native addon(s) indexed`);
  return addons.length;
}

function bundleServer() {
  console.log('\nStage 1 — Bundling with esbuild...');
  mkdirSync(dirname(bundleOut), { recursive: true });

  const externals = [
    '@libsql/client',
    '@libsql/darwin-arm64',
    '@libsql/darwin-x64',
    '@libsql/linux-x64-gnu',
    '@libsql/win32-x64-msvc',
    'better-sqlite3',
    'bcrypt',
    'sharp',
    'cpu-features',
    'ssh2',
  ].map(p => `--external:${p}`).join(' ');

  execSync(
    `npx esbuild server/index.ts ` +
    `--platform=node --target=node20 --bundle --format=cjs ` +
    `--outfile=${bundleOut} --allow-overwrite ` +
    externals,
    { stdio: 'inherit', cwd: root }
  );

  console.log(`  Done: ${bundleOut}`);
}

function compileTarget(triple) {
  const t = TARGETS[triple];
  if (!t) { console.error(`Unknown triple: ${triple}`); process.exit(1); }

  const outFile = join(binDir, `arus-server-${triple}${t.ext}`);
  console.log(`\nStage 2 — Compiling ${triple}...`);
  mkdirSync(binDir, { recursive: true });

  execSync(
    `npx pkg ${bundleOut} ` +
    `--target ${t.pkg} ` +
    `--config ${assetsJson} ` +
    `--output ${outFile} ` +
    `--compress GZip`,
    { stdio: 'inherit', cwd: root }
  );

  console.log(`  Done: ${outFile}`);
  return outFile;
}

async function main() {
  const buildAll = process.argv.includes('--all');

  bundleServer();
  buildAssetsManifest();
  mkdirSync(binDir, { recursive: true });

  if (buildAll) {
    for (const triple of Object.keys(TARGETS)) {
      compileTarget(triple);
    }
  } else {
    const triple  = currentTriple();
    const outFile = compileTarget(triple);

    const devCopy = join(binDir, `arus-server${TARGETS[triple].ext}`);
    copyFileSync(outFile, devCopy);
    console.log(`  Dev copy: ${devCopy}`);
  }

  console.log('\nSidecar build complete.\n');
}

main().catch(e => { console.error(e); process.exit(1); });
