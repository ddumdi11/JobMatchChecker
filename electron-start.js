// Simple wrapper to start Electron in development
require('dotenv').config();
const { spawn } = require('child_process');
const path = require('path');

// Set NODE_ENV
process.env.NODE_ENV = 'development';

// Build main process first
console.log('Building main process...');
const tsc = spawn('npx', ['tsc', '-p', 'tsconfig.main.json'], {
  shell: true,
  stdio: 'inherit'
});

tsc.on('close', (code) => {
  if (code !== 0) {
    console.error('TypeScript compilation failed');
    process.exit(code);
  }

  console.log('Starting Electron...');

  // Start Electron with the project root directory
  const electron = spawn('npx', ['electron', '.'], {
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      ELECTRON_ENABLE_LOGGING: '1',
      NODE_ENV: 'development'
    }
  });

  electron.on('close', (code) => {
    process.exit(code);
  });

  electron.on('error', (err) => {
    console.error('Failed to start Electron:', err);
    process.exit(1);
  });
});

tsc.on('error', (err) => {
  console.error('Failed to compile TypeScript:', err);
  process.exit(1);
});
