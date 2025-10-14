/**
 * Unit tests for BackupVerifier
 *
 * These tests MUST FAIL until BackupVerifier is implemented (Task T012)
 *
 * Feature: #004
 * Task: T005
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { BackupVerifier } from '../../../src/main/backup/BackupVerifier';
import Database from 'better-sqlite3';

describe('BackupVerifier', () => {
  const testBackupDir = path.join(process.cwd(), 'backups', 'test');
  let validBackupPath: string;
  let corruptedBackupPath: string;
  let nonSqliteFilePath: string;

  beforeEach(async () => {
    // Create test backup directory
    await fs.mkdir(testBackupDir, { recursive: true });

    // Create a valid SQLite database for testing
    validBackupPath = path.join(testBackupDir, 'valid_backup.db');
    const db = new Database(validBackupPath);

    // Create knex_migrations table (required for verification)
    db.exec(`
      CREATE TABLE knex_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        batch INTEGER NOT NULL,
        migration_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Insert a migration entry
    db.prepare('INSERT INTO knex_migrations (name, batch) VALUES (?, ?)').run('001_initial.js', 1);

    // Create some example tables
    db.exec(`
      CREATE TABLE user_profile (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      );

      CREATE TABLE skills (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      );
    `);

    db.close();

    // Create a corrupted file (truncated SQLite file)
    corruptedBackupPath = path.join(testBackupDir, 'corrupted_backup.db');
    await fs.writeFile(corruptedBackupPath, Buffer.from('SQLite format 3\x00')); // Incomplete header

    // Create a non-SQLite file
    nonSqliteFilePath = path.join(testBackupDir, 'not_a_database.txt');
    await fs.writeFile(nonSqliteFilePath, 'This is just a text file, not a database');
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rm(testBackupDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('✅ Valid backup verification', () => {
    it('should pass verification for valid SQLite database', async () => {
      // Act
      const result = await BackupVerifier.verifyBackup(validBackupPath);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should read schema version from knex_migrations table', async () => {
      // Act
      const result = await BackupVerifier.verifyBackup(validBackupPath);

      // Assert
      expect(result.schemaVersion).toBeDefined();
      expect(result.schemaVersion).toBe('001_initial.js');
    });

    it('should verify all expected tables exist', async () => {
      // Act
      const result = await BackupVerifier.verifyBackup(validBackupPath);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.tablesFound).toContain('knex_migrations');
      expect(result.tablesFound).toContain('user_profile');
      expect(result.tablesFound).toContain('skills');
    });

    it('should run SQLite integrity check', async () => {
      // Act
      const result = await BackupVerifier.verifyBackup(validBackupPath);

      // Assert
      expect(result.integrityCheckPassed).toBe(true);
    });

    it('should open database in read-only mode', async () => {
      // This test verifies that verification doesn't modify the backup
      const statsBefore = await fs.stat(validBackupPath);

      // Act
      await BackupVerifier.verifyBackup(validBackupPath);

      // Assert - modification time should not change
      const statsAfter = await fs.stat(validBackupPath);
      expect(statsAfter.mtime.getTime()).toBe(statsBefore.mtime.getTime());
    });
  });

  describe('❌ Invalid backup detection', () => {
    it('should fail for corrupted file', async () => {
      // Act
      const result = await BackupVerifier.verifyBackup(corruptedBackupPath);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('INTEGRITY_FAILED');
    });

    it('should fail for non-SQLite file', async () => {
      // Act
      const result = await BackupVerifier.verifyBackup(nonSqliteFilePath);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('NOT_SQLITE_DATABASE');
    });

    it('should fail if knex_migrations table is missing', async () => {
      // Arrange - create DB without knex_migrations
      const noMigrationsPath = path.join(testBackupDir, 'no_migrations.db');
      const db = new Database(noMigrationsPath);
      db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)');
      db.close();

      // Act
      const result = await BackupVerifier.verifyBackup(noMigrationsPath);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('MISSING_MIGRATIONS_TABLE');
    });

    it('should fail if file does not exist', async () => {
      // Arrange
      const nonExistentPath = path.join(testBackupDir, 'does_not_exist.db');

      // Act
      const result = await BackupVerifier.verifyBackup(nonExistentPath);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('FILE_NOT_FOUND');
    });

    it('should fail if SQLite integrity check fails', async () => {
      // Arrange - create a database with integrity issues
      const corruptDbPath = path.join(testBackupDir, 'corrupt_integrity.db');

      // Create valid DB
      const db = new Database(corruptDbPath);
      db.exec(`
        CREATE TABLE knex_migrations (id INTEGER PRIMARY KEY, name TEXT, batch INTEGER);
        INSERT INTO knex_migrations (name, batch) VALUES ('001_initial.js', 1);
        CREATE TABLE test (id INTEGER PRIMARY KEY, data TEXT);
      `);
      db.close();

      // Corrupt the database file by overwriting part of it
      const fileHandle = await fs.open(corruptDbPath, 'r+');
      await fileHandle.write(Buffer.from('CORRUPTED'), 100); // Write garbage at offset 100
      await fileHandle.close();

      // Act
      const result = await BackupVerifier.verifyBackup(corruptDbPath);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('INTEGRITY_FAILED');
    });
  });

  describe('📋 Schema version extraction', () => {
    it('should extract latest migration name as schema version', async () => {
      // Arrange - create DB with multiple migrations
      const multiMigrationPath = path.join(testBackupDir, 'multi_migration.db');
      const db = new Database(multiMigrationPath);
      db.exec(`
        CREATE TABLE knex_migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          batch INTEGER NOT NULL,
          migration_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      db.prepare('INSERT INTO knex_migrations (name, batch) VALUES (?, ?)').run('001_initial.js', 1);
      db.prepare('INSERT INTO knex_migrations (name, batch) VALUES (?, ?)').run('002_add_skills.js', 2);
      db.prepare('INSERT INTO knex_migrations (name, batch) VALUES (?, ?)').run('003_add_jobs.js', 3);
      db.close();

      // Act
      const result = await BackupVerifier.verifyBackup(multiMigrationPath);

      // Assert
      expect(result.schemaVersion).toBe('003_add_jobs.js');
    });

    it('should handle empty migrations table', async () => {
      // Arrange
      const emptyMigrationsPath = path.join(testBackupDir, 'empty_migrations.db');
      const db = new Database(emptyMigrationsPath);
      db.exec(`
        CREATE TABLE knex_migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          batch INTEGER NOT NULL
        );
      `);
      db.close();

      // Act
      const result = await BackupVerifier.verifyBackup(emptyMigrationsPath);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('NO_MIGRATIONS_FOUND');
    });
  });

  describe('🔒 Connection handling', () => {
    it('should close database connection after verification', async () => {
      // Act
      await BackupVerifier.verifyBackup(validBackupPath);

      // Assert - should be able to open the file again without issues
      const db = new Database(validBackupPath, { readonly: true });
      expect(() => db.close()).not.toThrow();
    });

    it('should handle permission errors gracefully', async () => {
      // Skip this test on Windows (chmod doesn't work the same way)
      if (process.platform === 'win32') {
        return;
      }

      // Arrange - make file unreadable
      const unreadablePath = path.join(testBackupDir, 'unreadable.db');
      await fs.copyFile(validBackupPath, unreadablePath);
      await fs.chmod(unreadablePath, 0o000);

      // Act
      const result = await BackupVerifier.verifyBackup(unreadablePath);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('PERMISSION_DENIED');

      // Cleanup - restore permissions
      await fs.chmod(unreadablePath, 0o644);
    });
  });
});
