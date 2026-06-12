/**
 * Vitest global setup file
 *
 * Runs once per test file (vitest setupFiles) before that file's tests.
 * Each file gets its OWN freshly-migrated SQLite database in the OS temp dir,
 * so DB-backed tests have a real schema + seed data (incl. job_sources) and
 * never collide with other test files.
 *
 * Feature: 005-job-offer-management
 */

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import dotenv from 'dotenv';
import Knex from 'knex';

// Load environment variables from .env (provides ANTHROPIC_API_KEY locally)
dotenv.config();

// Unique per-file database path — avoids cross-file contamination and SQLite
// file locks without deleting a possibly still-open database file.
const uniqueId = `${process.env.VITEST_WORKER_ID || '0'}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const TEST_DB_PATH = path.join(os.tmpdir(), 'jobmatch-vitest', `test-${uniqueId}.db`);
fs.mkdirSync(path.dirname(TEST_DB_PATH), { recursive: true });

process.env.DB_PATH = TEST_DB_PATH;
process.env.NODE_ENV = 'test';

// Apply all migrations (schema + seed data) so DB-backed services work against
// a real database. Uses the same migrations the app ships with.
const migrationsDir = path.join(__dirname, '../src/main/database/migrations');
const knex = Knex({
  client: 'better-sqlite3',
  connection: { filename: TEST_DB_PATH },
  useNullAsDefault: true,
  migrations: { directory: migrationsDir, extension: 'js' },
});
await knex.migrate.latest();
await knex.destroy();

console.log(`[Test Setup] Migrated test DB at: ${TEST_DB_PATH}`);
console.log(`[Test Setup] ANTHROPIC_API_KEY ${process.env.ANTHROPIC_API_KEY ? 'is set ✓' : 'is NOT set ✗'}`);
