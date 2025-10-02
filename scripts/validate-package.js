const pkg = require('../package.json');

// Validate package.json structure
if (!pkg || typeof pkg !== 'object') {
  console.error('❌ package.json ist ungültig oder leer');
  process.exit(1);
}

// Check 1: Main path consistency
if (!pkg.main || typeof pkg.main !== 'string') {
  console.error('❌ main field fehlt oder ist kein String');
  process.exit(1);
}
if (!pkg.main.startsWith('dist/')) {
  console.error('❌ main path muss in dist/ sein');
  process.exit(1);
}

// Check 2: Electron version ist LTS
const devDeps = pkg.devDependencies || {};
const electronVersionString = (typeof devDeps === 'object' && devDeps.electron) ? devDeps.electron : '';
const cleanedVersion = electronVersionString.replace(/^\D+/, ''); // Strip non-digit prefix (^, ~, etc.)
const electronVersion = parseInt(cleanedVersion, 10);
if (!isNaN(electronVersion) && electronVersion > 30) {
  console.warn('⚠️ Electron > 30 ist experimentell');
}

// Check 3: Native modules in devDeps, nicht deps
const deps = pkg.dependencies || {};
if (typeof deps === 'object' && deps['electron-rebuild']) {
  console.error('❌ electron-rebuild muss in devDependencies');
  process.exit(1);
}

console.log('✅ package.json ist valide');