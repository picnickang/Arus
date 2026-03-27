#!/usr/bin/env node

import sharp from 'sharp';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

async function generateIcons() {
  console.log('Generating Tauri icon files...\n');

  const svgSource = join(rootDir, 'client/public/icon-512.svg');
  const tauriIconDir = join(rootDir, 'src-tauri/icons');

  if (!existsSync(svgSource)) {
    console.error(`Source SVG not found: ${svgSource}`);
    process.exit(1);
  }

  mkdirSync(tauriIconDir, { recursive: true });

  try {
    const svgBuffer = readFileSync(svgSource);

    const targets = [
      { file: '32x32.png', size: 32 },
      { file: '128x128.png', size: 128 },
      { file: '128x128@2x.png', size: 256 },
      { file: 'icon.png', size: 512 },
    ];

    for (const { file, size } of targets) {
      await sharp(svgBuffer, { density: 300 })
        .resize(size, size)
        .png()
        .toFile(join(tauriIconDir, file));
      console.log(`  Created ${file} (${size}x${size})`);
    }

    console.log('\nIcon generation complete.');
    console.log('\nFor .ico and .icns conversion (needed for Windows/macOS builds):');
    console.log('  macOS: Use iconutil or https://cloudconvert.com/png-to-icns');
    console.log('  Windows: Use https://cloudconvert.com/png-to-ico');
    console.log('  Or install ImageMagick: convert icon.png icon.ico');
  } catch (error) {
    console.error('Error generating icons:', error.message);
    process.exit(1);
  }
}

generateIcons();
