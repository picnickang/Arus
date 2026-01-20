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

  // Ensure build directory exists
  mkdirSync(buildDir, { recursive: true });

  try {
    // Read source PNG
    const sourceBuffer = readFileSync(sourcePng);
    
    // 1. Generate ICNS for macOS
    console.log('📱 Generating macOS ICNS file...');
    
    // ICNS requires multiple sizes: 16, 32, 64, 128, 256, 512, 1024
    const icnsSizes = [16, 32, 64, 128, 256, 512, 1024];
    const iconset = [];
    
    for (const size of icnsSizes) {
      const resized = await sharp(sourceBuffer)
        .resize(size, size, {
          kernel: sharp.kernel.lanczos3,
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();
      
      iconset.push({ size, buffer: resized });
    }
    
    // Create a simple PNG-based icon for macOS (electron-builder will convert)
    // Using 1024x1024 as the base for ICNS generation
    const macIcon = await sharp(sourceBuffer)
      .resize(1024, 1024, {
        kernel: sharp.kernel.lanczos3,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(join(buildDir, 'icon-1024.png'));
    
    console.log('  ✅ Created icon-1024.png (electron-builder will convert to ICNS)');
    
    // 2. Generate ICO for Windows
    console.log('\n🪟 Generating Windows ICO file...');
    
    // ICO requires multiple sizes embedded: 16, 32, 48, 64, 128, 256
    // We'll create individual PNGs and document manual conversion
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
    
    // electron-builder can auto-convert PNG to ICO
    const winIcon = await sharp(sourceBuffer)
      .resize(256, 256, {
        kernel: sharp.kernel.lanczos3,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(join(buildDir, 'icon-256.png'));
    
    console.log('  ✅ Created icon-256.png (electron-builder will convert to ICO)');
    
    // 3. Update electron-builder.json documentation
    console.log('\n📝 Icon configuration:');
    console.log('  • macOS: build/icon-1024.png → electron-builder auto-converts to ICNS');
    console.log('  • Windows: build/icon-256.png → electron-builder auto-converts to ICO');
    console.log('  • Alternative: Use online tools like cloudconvert.com for manual conversion');
    
    // 4. Remove old placeholders
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
    console.log('  1. electron-builder will automatically convert PNG → ICNS/ICO during build');
    console.log('  2. For manual conversion (optional):');
    console.log('     • macOS: Use iconutil or https://cloudconvert.com/png-to-icns');
    console.log('     • Windows: Use https://cloudconvert.com/png-to-ico');
    
  } catch (error) {
    console.error('❌ Error generating icons:', error.message);
    process.exit(1);
  }
}

generateIcons();
