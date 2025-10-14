/**
 * Integration test for automatic pre-migration backup
 *
 * These tests MUST FAIL until pre-migration backup hook is implemented (Task T019)
 *
 * Feature: #004
 * Task: T011
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { BackupManager } from '../../../../src/main/backup/BackupManager';
import Database from 'better-sqlite3';
import Knex from 'knex';

describe('Integration: Pre-Migration Backup', () => {
  const testBackupDir = path.join(process.cwd(), 'backups', 'test-migration');
  const testDbPath = path.join(process.cwd(), 'data', 'test-migration.db');
  let backupManager: BackupManager;
  let knex: Knex.Knex;

  beforeEach(async () => {
    // Create test directories
    await fs.mkdir(testBackupDir, { recursive: true });
    await fs.mkdir(path.dirname(testDbPath), { recursive: true });

    // Create initial database with knex_migrations table
    const db = new Database(testDbPath);
    db.exec(`
      CREATE TABLE knex_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        batch INTEGER NOT NULL,
        migration_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO knex_migrations (name, batch) VALUES ('001_initial.js', 1);

      CREATE TABLE knex_migrations_lock (
        index INTEGER PRIMARY KEY,
        is_locked INTEGER
      );
      INSERT INTO knex_migrations_lock (index, is_locked) VALUES (1, 0);

      CREATE TABLE user_profile (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      );
      INSERT INTO user_profile (id, name) VALUES (1, 'Test User');
    `);
    db.close();

    // Initialize Knex with test database
    knex = Knex({
      client: 'better-sqlite3',
      connection: {
        filename: testDbPath
      },
      useNullAsDefault: true,
      migrations: {
        directory: path.join(process.cwd(), 'tests', 'fixtures', 'migrations')
      }
    });

    // Initialize BackupManager
    backupManager = new BackupManager(testDbPath, testBackupDir);
  });

  afterEach(async () => {
    // Clean up Knex connection
    if (knex) {
      await knex.destroy();
    }

    // Clean up test files
    try {
      await fs.rm(testBackupDir, { recursive: true, force: true });
      await fs.rm(path.dirname(testDbPath), { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  /**
   * Helper to create a test migration file
   */
  async function createTestMigration(name: string, content: string): Promise<void> {
    const migrationsDir = path.join(process.cwd(), 'tests', 'fixtures', 'migrations');
    await fs.mkdir(migrationsDir, { recursive: true });

    const timestamp = Date.now();
    const filename = path.join(migrationsDir, `${timestamp}_${name}.js`);

    await fs.writeFile(filename, content);
  }

  describe('✅ Automatic pre-migration backup', () => {
    it('should detect pending migration', async () => {
      // Create a new migration file
      await createTestMigration('add_column', `
        exports.up = function(knex) {
          return knex.schema.table('user_profile', function(table) {
            table.string('email');
          });
        };

        exports.down = function(knex) {
          return knex.schema.table('user_profile', function(table) {
            table.dropColumn('email');
          });
        };
      `);

      // Check for pending migrations
      const pending = await knex.migrate.list();

      // Assert - should detect pending migration
      expect(pending[1]).toBeDefined(); // [1] is pending migrations array
      expect(pending[1].length).toBeGreaterThan(0);
    });

    it('should create backup before migration', async () => {
      // Create a migration
      await createTestMigration('test_migration', `
        exports.up = function(knex) {
          return knex.schema.createTable('test_table', function(table) {
            table.increments('id');
            table.string('name');
          });
        };

        exports.down = function(knex) {
          return knex.schema.dropTable('test_table');
        };
      `);

      // Get initial backup count
      const initialBackups = await backupManager.listBackups();
      const initialCount = initialBackups.length;

      // Run migration (should trigger pre-migration backup via hook)
      await knex.migrate.latest();

      // Verify backup was created
      const finalBackups = await backupManager.listBackups();
      expect(finalBackups.length).toBeGreaterThan(initialCount);

      // Find the pre-migration backup
      const preMigrationBackup = finalBackups.find(b => b.type === 'pre-migration');
      expect(preMigrationBackup).toBeDefined();
    });

    it('should name backup with _pre-migration suffix', async () => {
      // Create a migration
      await createTestMigration('test_suffix', `
        exports.up = function(knex) {
          return knex.raw('SELECT 1');
        };
        exports.down = function(knex) {
          return knex.raw('SELECT 1');
        };
      `);

      // Run migration
      await knex.migrate.latest();

      // Check backup filename
      const backups = await backupManager.listBackups();
      const preMigrationBackup = backups.find(b => b.type === 'pre-migration');

      expect(preMigrationBackup).toBeDefined();
      expect(preMigrationBackup?.filename).toMatch(/_pre-migration\.db$/);
    });

    it('should allow migration to proceed after successful backup', async () => {
      // Create a migration that modifies the schema
      await createTestMigration('proceed_test', `
        exports.up = function(knex) {
          return knex.schema.createTable('migration_test', function(table) {
            table.increments('id');
          });
        };
        exports.down = function(knex) {
          return knex.schema.dropTable('migration_test');
        };
      `);

      // Run migration
      await knex.migrate.latest();

      // Verify migration succeeded (table should exist)
      const db = new Database(testDbPath, { readonly: true });
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='migration_test'").all();
      expect(tables.length).toBe(1);
      db.close();

      // Verify migration recorded in knex_migrations
      const migrated = await knex('knex_migrations').where('name', 'like', '%proceed_test%');
      expect(migrated.length).toBeGreaterThan(0);
    });
  });

  describe('❌ Backup failure handling', () => {
    it('should block migration if backup fails', async () => {
      // Mock BackupManager to fail backup
      const originalCreateBackup = backupManager.createBackup.bind(backupManager);
      vi.spyOn(backupManager, 'createBackup').mockRejectedValue(new Error('INSUFFICIENT_SPACE'));

      // Create a migration
      await createTestMigration('blocked_test', `
        exports.up = function(knex) {
          return knex.schema.createTable('should_not_exist', function(table) {
            table.increments('id');
          });
        };
        exports.down = function(knex) {
          return knex.schema.dropTable('should_not_exist');
        };
      `);

      // Attempt migration (should fail)
      await expect(knex.migrate.latest()).rejects.toThrow();

      // Verify migration did NOT proceed (table should not exist)
      const db = new Database(testDbPath, { readonly: true });
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='should_not_exist'").all();
      expect(tables.length).toBe(0);
      db.close();

      // Restore mock
      vi.restoreAllMocks();
    });

    it('should log error message when backup fails', async () => {
      // Mock console.error
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock backup failure
      vi.spyOn(backupManager, 'createBackup').mockRejectedValue(new Error('PERMISSION_DENIED'));

      // Create migration
      await createTestMigration('log_test', `
        exports.up = function(knex) {
          return knex.raw('SELECT 1');
        };
        exports.down = function(knex) {
          return knex.raw('SELECT 1');
        };
      `);

      // Attempt migration
      try {
        await knex.migrate.latest();
      } catch {
        // Expected
      }

      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorLogs = consoleErrorSpy.mock.calls.flat().join(' ');
      expect(errorLogs.toLowerCase()).toContain('backup') || expect(errorLogs.toLowerCase()).toContain('migration');

      // Restore mocks
      consoleErrorSpy.mockRestore();
      vi.restoreAllMocks();
    });
  });

  describe('🔄 Multiple migrations', () => {
    it('should create backup before each migration batch', async () => {
      // Create first migration
      await createTestMigration('first', `
        exports.up = function(knex) {
          return knex.schema.createTable('table1', function(table) {
            table.increments('id');
          });
        };
        exports.down = function(knex) {
          return knex.schema.dropTable('table1');
        };
      `);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Create second migration
      await createTestMigration('second', `
        exports.up = function(knex) {
          return knex.schema.createTable('table2', function(table) {
            table.increments('id');
          });
        };
        exports.down = function(knex) {
          return knex.schema.dropTable('table2');
        };
      `);

      // Run migrations
      const initialBackupCount = (await backupManager.listBackups()).length;

      await knex.migrate.latest();

      // Verify backup(s) created
      const finalBackupCount = (await backupManager.listBackups()).length;
      expect(finalBackupCount).toBeGreaterThan(initialBackupCount);

      // Verify both migrations ran
      const db = new Database(testDbPath, { readonly: true });
      const table1Exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='table1'").all();
      const table2Exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='table2'").all();
      expect(table1Exists.length).toBe(1);
      expect(table2Exists.length).toBe(1);
      db.close();
    });

    it('should create distinct backup for each migration run', async () => {
      // Create and run first migration
      await createTestMigration('run1', `
        exports.up = function(knex) {
          return knex.schema.createTable('run1_table', function(table) {
            table.increments('id');
          });
        };
        exports.down = function(knex) {
          return knex.schema.dropTable('run1_table');
        };
      `);

      await knex.migrate.latest();
      const backupsAfterFirst = await backupManager.listBackups();

      await new Promise(resolve => setTimeout(resolve, 1000)); // Ensure different timestamp

      // Create and run second migration
      await createTestMigration('run2', `
        exports.up = function(knex) {
          return knex.schema.createTable('run2_table', function(table) {
            table.increments('id');
          });
        };
        exports.down = function(knex) {
          return knex.schema.dropTable('run2_table');
        };
      `);

      await knex.migrate.latest();
      const backupsAfterSecond = await backupManager.listBackups();

      // Verify distinct backups created
      expect(backupsAfterSecond.length).toBeGreaterThan(backupsAfterFirst.length);

      // Verify different filenames
      const firstBackupFilenames = backupsAfterFirst.map(b => b.filename);
      const secondBackupFilenames = backupsAfterSecond.map(b => b.filename);

      const newBackups = secondBackupFilenames.filter(f => !firstBackupFilenames.includes(f));
      expect(newBackups.length).toBeGreaterThan(0);
    });
  });

  describe('🔍 Backup verification', () => {
    it('should verify pre-migration backup contains correct schema', async () => {
      // Get current schema version
      const db = new Database(testDbPath, { readonly: true });
      const currentMigrations = db.prepare('SELECT name FROM knex_migrations ORDER BY id DESC LIMIT 1').all();
      db.close();

      // Create and run migration
      await createTestMigration('schema_test', `
        exports.up = function(knex) {
          return knex.schema.createTable('new_table', function(table) {
            table.increments('id');
          });
        };
        exports.down = function(knex) {
          return knex.schema.dropTable('new_table');
        };
      `);

      await knex.migrate.latest();

      // Get pre-migration backup
      const backups = await backupManager.listBackups();
      const preMigrationBackup = backups.find(b => b.type === 'pre-migration');

      expect(preMigrationBackup).toBeDefined();
      expect(preMigrationBackup?.verified).toBe(true);

      // Verify backup has OLD schema (without new_table)
      const backupDb = new Database(path.join(testBackupDir, preMigrationBackup!.filename), { readonly: true });
      const tablesInBackup = backupDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='new_table'").all();
      expect(tablesInBackup.length).toBe(0); // Table should NOT exist in backup
      backupDb.close();
    });

    it('should include pre-migration backup in cleanup exemption list', async () => {
      // Create old pre-migration backup (simulate 90 days ago)
      await createTestMigration('old_migration', `
        exports.up = function(knex) {
          return knex.raw('SELECT 1');
        };
        exports.down = function(knex) {
          return knex.raw('SELECT 1');
        };
      `);

      await knex.migrate.latest();

      // Get the pre-migration backup
      const backups = await backupManager.listBackups();
      const preMigrationBackup = backups.find(b => b.type === 'pre-migration');

      expect(preMigrationBackup).toBeDefined();

      // Simulate old age by modifying file timestamp
      const backupPath = path.join(testBackupDir, preMigrationBackup!.filename);
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 90);
      await fs.utimes(backupPath, oldDate, oldDate);

      // Create a recent manual backup to ensure we have multiple backups
      await backupManager.createBackup('manual');

      // Run cleanup
      const cleanupResult = await backupManager.cleanupOldBackups();

      // Verify pre-migration backup was NOT deleted
      expect(cleanupResult.kept).toContain(preMigrationBackup!.filename);
      expect(cleanupResult.deleted).not.toContain(preMigrationBackup!.filename);
    });
  });
});
