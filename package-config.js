/**
 * PKG Configuration for Standalone Executables
 * Creates single-file executables with Node.js bundled
 */

module.exports = {
  // Entry point
  bin: './dist/index.js',
  
  // Output executables
  outputPath: './dist/standalone',
  
  // Target platforms and Node.js versions
  targets: [
    'node20-win-x64',      // Windows 64-bit
    'node20-macos-x64',    // macOS Intel
    'node20-macos-arm64',  // macOS Apple Silicon
    'node20-linux-x64',    // Linux 64-bit
    'node20-linux-arm64',  // Linux ARM (Raspberry Pi)
  ],
  
  // Assets to include (SQLite database, config files, etc.)
  assets: [
    'client/dist/**/*',           // Frontend build
    'shared/**/*',                 // Shared schemas
    'node_modules/@libsql/**/*',  // SQLite client
    'node_modules/better-sqlite3/**/*',
  ],
  
  // Scripts to include
  scripts: [
    'server/**/*.js',
    'dist/**/*.js'
  ],
  
  // Output names
  outputName: {
    win: 'arus-win-${version}.exe',
    macos: 'arus-macos-${version}',
    linux: 'arus-linux-${version}'
  }
};
