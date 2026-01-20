import { readFileSync, writeFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

// Add Electron entry point
pkg.main = 'electron/main.js';
pkg.description = 'Marine Predictive Maintenance & Scheduling System';
pkg.author = 'ARUS Team';

// Move electron to devDependencies and pin to exact version
if (pkg.dependencies?.electron) {
  delete pkg.dependencies.electron;
  pkg.devDependencies.electron = '38.3.0';
}

if (pkg.dependencies?.['electron-builder']) {
  const version = pkg.dependencies['electron-builder'];
  delete pkg.dependencies['electron-builder'];
  pkg.devDependencies['electron-builder'] = version;
}

writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');

console.log('✅ package.json fixed on Replit');
console.log('  • Added main: electron/main.js');
console.log('  • Added description and author');
console.log('  • Moved electron to devDependencies (pinned to 38.3.0)');
console.log('  • Moved electron-builder to devDependencies');
