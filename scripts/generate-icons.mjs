#!/usr/bin/env node
import sharp        from 'sharp';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname }                       from 'node:path';
import { fileURLToPath }                       from 'node:url';

const __dirname   = dirname(fileURLToPath(import.meta.url));
const root        = join(__dirname, '..');
const svgSource   = join(root, 'client', 'public', 'icon-512.svg');
const iconDir     = join(root, 'src-tauri', 'icons');
const icnsWorkDir = join(root, 'src-tauri', 'icons', 'icon.iconset');

if (!existsSync(svgSource)) {
  console.error(`Source SVG not found: ${svgSource}`);
  console.error('Place a 512×512 SVG at client/public/icon-512.svg and re-run.');
  process.exit(1);
}

mkdirSync(iconDir,     { recursive: true });
mkdirSync(icnsWorkDir, { recursive: true });

const svgBuffer = readFileSync(svgSource);

const PNG_TARGETS = [
  { file: '32x32.png',       size: 32  },
  { file: '128x128.png',     size: 128 },
  { file: '128x128@2x.png',  size: 256 },
  { file: 'icon.png',        size: 512 },
];

const ICNS_TARGETS = [
  { file: 'icon_16x16.png',       size: 16  },
  { file: 'icon_16x16@2x.png',    size: 32  },
  { file: 'icon_32x32.png',       size: 32  },
  { file: 'icon_32x32@2x.png',    size: 64  },
  { file: 'icon_128x128.png',     size: 128 },
  { file: 'icon_128x128@2x.png',  size: 256 },
  { file: 'icon_256x256.png',     size: 256 },
  { file: 'icon_256x256@2x.png',  size: 512 },
  { file: 'icon_512x512.png',     size: 512 },
  { file: 'icon_512x512@2x.png',  size: 1024 },
];

async function renderPng(size, outPath) {
  await sharp(svgBuffer, { density: 300 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outPath);
}

console.log('Generating Tauri PNG icons…\n');

for (const { file, size } of PNG_TARGETS) {
  const out = join(iconDir, file);
  await renderPng(size, out);
  console.log(`  ✅ ${file}  (${size}×${size})`);
}

console.log('\nGenerating macOS iconset for iconutil…\n');

for (const { file, size } of ICNS_TARGETS) {
  const out = join(icnsWorkDir, file);
  await renderPng(size, out);
  console.log(`  ✅ iconset/${file}  (${size}×${size})`);
}

console.log(`
To produce icon.icns (required for macOS builds):
  iconutil -c icns src-tauri/icons/icon.iconset -o src-tauri/icons/icon.icns
`);

console.log('To produce icon.ico (required for Windows builds):');
console.log('  ImageMagick:');
console.log('    convert src-tauri/icons/32x32.png src-tauri/icons/128x128.png \\');
console.log('            src-tauri/icons/icon.png  src-tauri/icons/icon.ico');
console.log('  Or: https://cloudconvert.com/png-to-ico\n');

console.log('✅ Icon generation complete.\n');
