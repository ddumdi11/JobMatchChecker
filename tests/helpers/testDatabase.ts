/**
 * Test Database Helper
 *
 * Provides utilities for setting up and tearing down test database.
 * Import this in test files that need database access.
 */

import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';
import Knex from 'knex';

const TEST_DATA_DIR = path.join(__dirname, '../data');
const TEST_DB_PATH = path.join(TEST_DATA_DIR, 'test.db');

let isInitialized = false;

/**
 * Initialize test database with migrations
 * Call this in beforeAll() in your test suite
 */
export async function initTestDatabase(): Promise<void> {
  if (isInitialized) {
    console.log('[Test DB] Already initialized, skipping...');
    return;
  }

  console.log('\n[Test DB] Initializing test database...');
  console.log(`[Test DB] Path: ${TEST_DB_PATH}`);

  // Create data directory if it doesn't exist
  if (!fs.existsSync(TEST_DATA_DIR)) {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
    console.log('[Test DB] Created test data directory');
  }

  // Remove old test database
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
    console.log('[Test DB] Removed old test database');
  }

  // Run migrations
  const knexConfig = {
    client: 'better-sqlite3',
    connection: {
      filename: TEST_DB_PATH
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, '../../src/main/database/migrations'),
      extension: 'js'
    }
  };

  const knex = Knex(knexConfig);

  try {
    console.log('[Test DB] Running migrations...');
    const [batchNo, migrations] = await knex.migrate.latest();

    if (migrations.length === 0) {
      console.log('[Test DB] ✓ Database already up to date');
    } else {
      console.log(`[Test DB] ✓ Ran ${migrations.length} migrations (batch ${batchNo})`);
      migrations.forEach((migration: string) => {
        console.log(`[Test DB]   - ${migration}`);
      });
    }

    // Verify seed data
    const db = new Database(TEST_DB_PATH);
    const sources = db.prepare('SELECT COUNT(*) as count FROM job_sources').get() as { count: number };
    db.close();

    console.log(`[Test DB] ✓ Verified ${sources.count} job sources in database`);
    console.log('[Test DB] ✅ Test database ready!\n');

    isInitialized = true;
  } catch (error) {
    console.error('[Test DB] ❌ Migration failed:', error);
    throw error;
  } finally {
    await knex.destroy();
  }
}

/**
 * Clean up test database
 * Call this in afterAll() in your test suite (optional)
 */
export function cleanupTestDatabase(): void {
  if (fs.existsSync(TEST_DB_PATH)) {
    try {
      fs.unlinkSync(TEST_DB_PATH);
      console.log('[Test DB] Cleaned up test database');
    } catch (error) {
      console.warn('[Test DB] Warning: Could not clean up test database:', error);
    }
  }
}

/**
 * Get test database path
 */
export function getTestDbPath(): string {
  return TEST_DB_PATH;
}
