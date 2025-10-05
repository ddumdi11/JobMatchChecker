import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import * as log from 'electron-log';
import * as dotenv from 'dotenv';
import { initDatabase, runMigrations, closeDatabase } from './database/db';
import { registerIpcHandlers } from './ipc/handlers';

// Load environment variables
dotenv.config();

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../main/preload.js')
    },
    title: 'Job Match Checker',
    show: false
  });

  // Load the app
  // In development, load from vite dev server. In production, load from built files.
  // electron-vite automatically sets ELECTRON_RENDERER_URL in dev mode
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  log.info('Main window created');
}

// App lifecycle events
app.whenReady().then(async () => {
  try {
    // Initialize database
    initDatabase();
    log.info('Database initialized');

    // Run migrations
    await runMigrations();
    log.info('Migrations completed');

    // Register IPC handlers
    registerIpcHandlers();
    log.info('IPC handlers registered');

    // Create main window
    createWindow();
  } catch (error) {
    log.error('Error during app initialization:', error);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    closeDatabase();
    app.quit();
  }
});

app.on('before-quit', () => {
  closeDatabase();
});

// Error handling
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled Rejection:', reason);
});
