const pkg = require('../package.json');
const electronPkg = require('electron/package.json');

// Check 1: Main path consistency
if (!pkg.main.startsWith('dist/')) {
  console.error('❌ main path muss in dist/ sein');
  process.exit(1);
}

// Check 2: Electron version ist LTS
const electronVersionString = pkg.devDependencies.electron || '';
const cleanedVersion = electronVersionString.replace(/^\D+/, ''); // Strip non-digit prefix (^, ~, etc.)
const electronVersion = parseInt(cleanedVersion, 10);
if (!isNaN(electronVersion) && electronVersion > 30) {
  console.warn('⚠️ Electron > 30 ist experimentell');
}

// Check 3: Native modules in devDeps, nicht deps
if (pkg.dependencies['electron-rebuild']) {
  console.error('❌ electron-rebuild muss in devDependencies');
  process.exit(1);
}

console.log('✅ package.json ist valide');