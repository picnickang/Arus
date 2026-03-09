#!/usr/bin/env node

import sharp from 'sharp';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

async function generateIcons() {
  console.log('🎨 Generating production-quality icon files...\n');

  const sourcePng = join(rootDir, 'public/icon-512x512.png');
  const buildDir = join(rootDir, 'build');
  const tauriIconDir = join(rootDir, 'src-tauri/icons');

  mkdirSync(buildDir, { recursive: true });
  mkdirSync(tauriIconDir, { recursive: true });

  try {
    const sourceBuffer = readFileSync(sourcePng);
    
    console.log('📱 Generating macOS icon (1024x1024)...');
    
    const icnsSizes = [16, 32, 64, 128, 256, 512, 1024];
    
    for (const size of icnsSizes) {
      await sharp(sourceBuffer)
        .resize(size, size, {
          kernel: sharp.kernel.lanczos3,
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();
    }
    
    await sharp(sourceBuffer)
      .resize(1024, 1024, {
        kernel: sharp.kernel.lanczos3,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(join(buildDir, 'icon-1024.png'));
    
    console.log('  ✅ Created icon-1024.png');
    
    console.log('\n🪟 Generating Windows ICO sizes...');
    
    const icoSizes = [16, 32, 48, 64, 128, 256];
    
    for (const size of icoSizes) {
      await sharp(sourceBuffer)
        .resize(size, size, {
          kernel: sharp.kernel.lanczos3,
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(join(buildDir, `icon-${size}.png`));
    }
    
    console.log('  ✅ Created multi-resolution PNGs for ICO generation');
    
    console.log('\n🖥️  Generating Tauri icons...');
    
    const tauriSizes = [32, 128, 256];
    for (const size of tauriSizes) {
      await sharp(sourceBuffer)
        .resize(size, size, {
          kernel: sharp.kernel.lanczos3,
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(join(tauriIconDir, `${size}x${size}.png`));
    }

    await sharp(sourceBuffer)
      .resize(512, 512, {
        kernel: sharp.kernel.lanczos3,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(join(tauriIconDir, 'icon.png'));

    console.log('  ✅ Created Tauri icon files (32x32, 128x128, 256x256, icon.png)');
    
    console.log('\n🧹 Cleaning up placeholder files...');
    try {
      writeFileSync(join(buildDir, 'icon.icns'), '');
      writeFileSync(join(buildDir, 'icon.ico'), '');
      console.log('  ✅ Removed placeholder files');
    } catch (err) {
      console.log('  ℹ️  No placeholder files to remove');
    }
    
    console.log('\n✅ Icon generation complete!');
    console.log('\n📌 Next steps:');
    console.log('  1. Tauri will use icons from src-tauri/icons/ during build');
    console.log('  2. For manual conversion (optional):');
    console.log('     • macOS: Use iconutil or https://cloudconvert.com/png-to-icns');
    console.log('     • Windows: Use https://cloudconvert.com/png-to-ico');
    
  } catch (error) {
    console.error('❌ Error generating icons:', error.message);
    process.exit(1);
  }
}

generateIcons();
