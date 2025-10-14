/**
 * Unit tests for BackupManager.restoreBackup()
 *
 * These tests MUST FAIL until BackupManager.restoreBackup() is implemented (Task T015)
 *
 * Feature: #004
 * Task: T006
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { BackupManager } from '../../../src/main/backup/BackupManager';
import Database from 'better-sqlite3';
import type { RestoreBackupResponse } from '../../../src/types/backup';

describe('BackupManager.restoreBackup()', () => {
  const testBackupDir = path.join(process.cwd(), 'backups', 'test-restore');
  const testDbPath = path.join(process.cwd(), 'data', 'test-restore.db');
  let backupManager: BackupManager;
  let validBackupFilename: string;

  beforeEach(async () => {
    // Create test directories
    await fs.mkdir(testBackupDir, { recursive: true });
    await fs.mkdir(path.dirname(testDbPath), { recursive: true });

    // Create a test database
    const db = new Database(testDbPath);
    db.exec(`
      CREATE TABLE knex_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        batch INTEGER NOT NULL
      );
      INSERT INTO knex_migrations (name, batch) VALUES ('001_initial.js', 1);

      CREATE TABLE test_data (
        id INTEGER PRIMARY KEY,
        value TEXT NOT NULL
      );
      INSERT INTO test_data (id, value) VALUES (1, 'original_value');
    `);
    db.close();

    // Create a valid backup file
    validBackupFilename = 'backup_2025-10-14_10-00-00.db';
    const backupPath = path.join(testBackupDir, validBackupFilename);

    const backupDb = new Database(backupPath);
    backupDb.exec(`
      CREATE TABLE knex_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        batch INTEGER NOT NULL
      );
      INSERT INTO knex_migrations (name, batch) VALUES ('001_initial.js', 1);

      CREATE TABLE test_data (
        id INTEGER PRIMARY KEY,
        value TEXT NOT NULL
      );
      INSERT INTO test_data (id, value) VALUES (1, 'backup_value');
    `);
    backupDb.close();

    // Initialize BackupManager
    backupManager = new BackupManager(testDbPath, testBackupDir);
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rm(testBackupDir, { recursive: true, force: true });
      await fs.rm(path.dirname(testDbPath), { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('✅ Successful restore', () => {
    it('should create safety backup before restore', async () => {
      // Act
      await backupManager.restoreBackup(validBackupFilename);

      // Assert - Safety backup should exist
      const backupFiles = await fs.readdir(testBackupDir);
      const safetyBackups = backupFiles.filter(f => f.includes('safety'));

      expect(safetyBackups.length).toBeGreaterThan(0);
      expect(safetyBackups[0]).toMatch(/_safety/);
    });

    it('should restore database successfully', async () => {
      // Arrange - verify original value
      let db = new Database(testDbPath, { readonly: true });
      let row = db.prepare('SELECT value FROM test_data WHERE id = 1').get() as { value: string };
      expect(row.value).toBe('original_value');
      db.close();

      // Act
      await backupManager.restoreBackup(validBackupFilename);

      // Wait a bit for file system sync
      await new Promise(resolve => setTimeout(resolve, 100));

      // Assert - value should be from backup
      db = new Database(testDbPath, { readonly: true });
      row = db.prepare('SELECT value FROM test_data WHERE id = 1').get() as { value: string };
      expect(row.value).toBe('backup_value');
      db.close();
    });

    it('should return success response with safety backup info', async () => {
      // Act
      const result: RestoreBackupResponse = await backupManager.restoreBackup(validBackupFilename);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
      expect(result.safetyBackup).toBeDefined();
      expect(result.safetyBackup?.filename).toMatch(/_safety/);
      expect(result.safetyBackup?.path).toBeDefined();
    });

    it('should trigger app restart after successful restore', async () => {
      // Arrange - mock electron app
      const mockApp = {
        relaunch: vi.fn(),
        exit: vi.fn()
      };
      vi.mock('electron', () => ({
        app: mockApp
      }));

      // Act
      await backupManager.restoreBackup(validBackupFilename);

      // Assert
      expect(mockApp.relaunch).toHaveBeenCalled();
      expect(mockApp.exit).toHaveBeenCalledWith(0);
    });

    it('should close current DB connection before restore', async () => {
      // Arrange - keep database open
      const db = new Database(testDbPath);

      // Mock database close method to verify it's called
      const closeSpy = vi.spyOn(db, 'close');

      // Act
      await backupManager.restoreBackup(validBackupFilename);

      // Assert - close should have been called before file replacement
      expect(closeSpy).toHaveBeenCalled();
    });
  });

  describe('❌ Restore failures', () => {
    it('should fail if backup file not found', async () => {
      // Arrange
      const nonExistentBackup = 'backup_2099-01-01_00-00-00.db';

      // Act & Assert
      await expect(
        backupManager.restoreBackup(nonExistentBackup)
      ).rejects.toThrow('FILE_NOT_FOUND');
    });

    it('should block restore if schema version too new', async () => {
      // Arrange - create backup with newer schema version
      const newerBackupFilename = 'backup_newer_schema.db';
      const newerBackupPath = path.join(testBackupDir, newerBackupFilename);

      const newerDb = new Database(newerBackupPath);
      newerDb.exec(`
        CREATE TABLE knex_migrations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          batch INTEGER NOT NULL
        );
        INSERT INTO knex_migrations (name, batch) VALUES ('001_initial.js', 1);
        INSERT INTO knex_migrations (name, batch) VALUES ('999_future_migration.js', 999);
      `);
      newerDb.close();

      // Act & Assert
      await expect(
        backupManager.restoreBackup(newerBackupFilename)
      ).rejects.toThrow('SCHEMA_TOO_NEW');
    });

    it('should fail if backup verification fails', async () => {
      // Arrange - create corrupted backup
      const corruptedBackup = 'backup_corrupted.db';
      const corruptedPath = path.join(testBackupDir, corruptedBackup);
      await fs.writeFile(corruptedPath, Buffer.from('corrupted data'));

      // Act & Assert
      await expect(
        backupManager.restoreBackup(corruptedBackup)
      ).rejects.toThrow('VERIFICATION_FAILED');
    });

    it('should fail if insufficient disk space for safety backup', async () => {
      // Arrange - mock disk space utility to return insufficient space
      vi.mock('../../../src/main/utils/diskSpace', () => ({
        hasSufficientDiskSpace: vi.fn().mockResolvedValue(false)
      }));

      // Act & Assert
      await expect(
        backupManager.restoreBackup(validBackupFilename)
      ).rejects.toThrow('INSUFFICIENT_SPACE');
    });

    it('should fail if permission denied when creating safety backup', async () => {
      // Arrange - mock fs.copyFile to throw permission error
      vi.spyOn(fs, 'copyFile').mockRejectedValue(
        Object.assign(new Error('Permission denied'), { code: 'EACCES' })
      );

      // Act & Assert
      await expect(
        backupManager.restoreBackup(validBackupFilename)
      ).rejects.toThrow('PERMISSION_DENIED');
    });
  });

  describe('🔄 Restore failure recovery', () => {
    it('should restore from safety backup if main restore fails', async () => {
      // Arrange - force restore to fail after safety backup creation
      let safetyBackupCreated = false;

      const originalRestore = backupManager.restoreBackup.bind(backupManager);
      vi.spyOn(backupManager, 'restoreBackup').mockImplementation(async (filename) => {
        // Create safety backup
        await backupManager.createBackup('safety');
        safetyBackupCreated = true;

        // Simulate failure during file replacement
        throw new Error('File replacement failed');
      });

      // Act & Assert
      await expect(
        backupManager.restoreBackup(validBackupFilename)
      ).rejects.toThrow();

      // Verify safety backup was created
      expect(safetyBackupCreated).toBe(true);

      // Verify database is still intact (restored from safety backup)
      const db = new Database(testDbPath, { readonly: true });
      const row = db.prepare('SELECT value FROM test_data WHERE id = 1').get() as { value: string };
      expect(row.value).toBe('original_value'); // Original value preserved
      db.close();
    });

    it('should log detailed error information on failure', async () => {
      // Arrange - mock console.error
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const corruptedBackup = 'backup_corrupted.db';
      const corruptedPath = path.join(testBackupDir, corruptedBackup);
      await fs.writeFile(corruptedPath, Buffer.from('corrupted'));

      // Act
      try {
        await backupManager.restoreBackup(corruptedBackup);
      } catch {
        // Expected to fail
      }

      // Assert - error should be logged with context
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('restore');

      consoleErrorSpy.mockRestore();
    });
  });

  describe('🔒 Concurrency protection', () => {
    it('should reject if another restore operation is in progress', async () => {
      // Arrange - start first restore (don't await)
      const firstRestore = backupManager.restoreBackup(validBackupFilename);

      // Act - try to start second restore immediately
      const secondRestore = backupManager.restoreBackup(validBackupFilename);

      // Assert
      await expect(secondRestore).rejects.toThrow('OPERATION_IN_PROGRESS');

      // Clean up
      try {
        await firstRestore;
      } catch {
        // Ignore - may fail due to mock
      }
    });

    it('should reject if backup operation is in progress', async () => {
      // Arrange - start backup operation (don't await)
      const backupOperation = backupManager.createBackup('manual');

      // Act - try to restore during backup
      const restoreOperation = backupManager.restoreBackup(validBackupFilename);

      // Assert
      await expect(restoreOperation).rejects.toThrow('OPERATION_IN_PROGRESS');

      // Clean up
      try {
        await backupOperation;
      } catch {
        // Ignore
      }
    });
  });

  describe('⚛️ Atomic file replacement', () => {
    it('should use atomic file operations for database replacement', async () => {
      // Arrange - spy on fs operations
      const renameSpy = vi.spyOn(fs, 'rename');

      // Act
      await backupManager.restoreBackup(validBackupFilename);

      // Assert - should use rename (atomic on same filesystem)
      expect(renameSpy).toHaveBeenCalled();
    });

    it('should not leave partial files on failure', async () => {
      // Arrange - force failure during restore
      vi.spyOn(fs, 'rename').mockRejectedValue(new Error('Disk full'));

      // Act - attempt restore (will fail)
      try {
        await backupManager.restoreBackup(validBackupFilename);
      } catch {
        // Expected
      }

      // Assert - original database should still be intact
      const db = new Database(testDbPath, { readonly: true });
      const row = db.prepare('SELECT value FROM test_data WHERE id = 1').get() as { value: string };
      expect(row.value).toBe('original_value');
      db.close();

      // No temporary/partial files should exist
      const files = await fs.readdir(path.dirname(testDbPath));
      const tempFiles = files.filter(f => f.includes('.tmp') || f.includes('.temp'));
      expect(tempFiles).toHaveLength(0);
    });
  });
});
