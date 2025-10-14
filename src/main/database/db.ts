import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import * as log from 'electron-log';
import Knex from 'knex';

let db: Database.Database | null = null;
let knex: Knex.Knex | null = null;

/**
 * Get knex configuration (lazy loaded)
 */
function getKnexConfig() {
  // In compiled code: dist/main/index.js -> ../../knexfile.js
  return require(path.join(__dirname, '../../knexfile.js'));
}

/**
 * Get the database file path
 */
export function getDbPath(): string {
  const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/jobmatcher.db');

  // Ensure data directory exists
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    log.info(`Created data directory: ${dataDir}`);
  }

  return dbPath;
}

/**
 * Initialize the database connection
 */
export function initDatabase(): Database.Database {
  if (db) {
    return db;
  }

  const dbPath = getDbPath();
  const isNewDb = !fs.existsSync(dbPath);

  log.info(`Initializing database at: ${dbPath}`);

  db = new Database(dbPath, {
    verbose: process.env.NODE_ENV === 'development' ? log.debug : undefined
  });

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Performance optimizations
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  if (isNewDb) {
    log.info('New database created');
  }

  return db;
}

/**
 * Get Knex instance for migrations
 */
export function getKnex(): Knex.Knex {
  if (knex) {
    return knex;
  }

  const env = process.env.NODE_ENV || 'development';
  const knexConfig = getKnexConfig();
  const config = knexConfig[env];

  knex = Knex(config);

  return knex;
}

/**
 * Run database migrations
 */
export async function runMigrations(): Promise<void> {
  try {
    log.info('Running database migrations...');
    const knexInstance = getKnex();

    const [batchNo, migrations] = await knexInstance.migrate.latest();

    if (migrations.length === 0) {
      log.info('Database is already up to date');
    } else {
      log.info(`Batch ${batchNo} run: ${migrations.length} migrations`);
      migrations.forEach((migration: string) => {
        log.info(`  - ${migration}`);
      });
    }
  } catch (error) {
    log.error('Migration failed:', error);
    throw error;
  }
}

/**
 * Create database backup
 */
export async function backupDatabase(): Promise<string> {
  const dbPath = getDbPath();
  const backupDir = path.join(__dirname, '../../../../backups');

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `backup_${timestamp}.db`);

  log.info(`Creating backup: ${backupPath}`);

  // Copy database file
  fs.copyFileSync(dbPath, backupPath);

  log.info('Backup created successfully');

  return backupPath;
}

/**
 * Restore database from backup
 */
export async function restoreDatabase(backupPath: string): Promise<void> {
  const dbPath = getDbPath();

  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  log.info(`Restoring database from: ${backupPath}`);

  // Close current connection
  if (db) {
    db.close();
    db = null;
  }

  if (knex) {
    await knex.destroy();
    knex = null;
  }

  // Create backup of current database
  if (fs.existsSync(dbPath)) {
    const currentBackup = `${dbPath}.before-restore`;
    fs.copyFileSync(dbPath, currentBackup);
    log.info(`Current database backed up to: ${currentBackup}`);
  }

  // Restore from backup
  fs.copyFileSync(backupPath, dbPath);

  log.info('Database restored successfully');

  // Reinitialize connection
  initDatabase();
}

/**
 * Get the raw database instance
 */
export function getDatabase(): Database.Database {
  if (!db) {
    return initDatabase();
  }
  return db;
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    log.info('Database connection closed');
  }

  if (knex) {
    knex.destroy();
    knex = null;
  }
}
