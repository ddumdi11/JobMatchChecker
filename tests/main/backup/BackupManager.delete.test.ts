/**
 * Unit tests for BackupManager.deleteBackup()
 *
 * These tests MUST FAIL until BackupManager.deleteBackup() is implemented (Task T016)
 *
 * Feature: #004
 * Task: T008
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { BackupManager } from '../../../src/main/backup/BackupManager';
import Database from 'better-sqlite3';
import type { DeleteBackupResponse } from '../../../src/types/backup';

describe('BackupManager.deleteBackup()', () => {
  const testBackupDir = path.join(process.cwd(), 'backups', 'test-delete');
  const testDbPath = path.join(process.cwd(), 'data', 'test-delete.db');
  let backupManager: BackupManager;

  beforeEach(async () => {
    // Clean up any existing test files first
    try {
      await fs.rm(testBackupDir, { recursive: true, force: true });
      await fs.rm(path.dirname(testDbPath), { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    // Create test directories
    await fs.mkdir(testBackupDir, { recursive: true });
    await fs.mkdir(path.dirname(testDbPath), { recursive: true });

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

  /**
   * Helper function to create a test backup file
   */
  async function createTestBackup(filename: string): Promise<void> {
    const backupPath = path.join(testBackupDir, filename);
    const db = new Database(backupPath);

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
      INSERT INTO test_data (id, value) VALUES (1, 'test');
    `);
    db.close();

    // Wait for file system to sync
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  describe('✅ Successful deletion', () => {
    it('should delete backup file successfully', async () => {
      // Arrange - create 2 backups so we can delete one
      const filename = 'backup_2025-10-14_10-00-00.db';
      await createTestBackup(filename);
      await createTestBackup('backup_2025-10-14_11-00-00.db'); // Keep at least one

      const backupPath = path.join(testBackupDir, filename);
      await fs.access(backupPath); // Verify file exists

      // Act
      const result: DeleteBackupResponse = await backupManager.deleteBackup(filename);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toBeDefined();
      expect(result.message).toContain('deleted');

      // Verify file is actually deleted
      await expect(fs.access(backupPath)).rejects.toThrow();
    });

    it('should return success message with backup filename', async () => {
      // Arrange - create 2 backups so we can delete one
      const filename = 'backup_2025-10-14_10-00-00.db';
      await createTestBackup(filename);
      await createTestBackup('backup_2025-10-14_11-00-00.db'); // Keep at least one

      // Act
      const result: DeleteBackupResponse = await backupManager.deleteBackup(filename);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain(filename);
    });

    it('should delete when multiple backups exist', async () => {
      // Arrange - create 3 backups
      await createTestBackup('backup_2025-10-14_09-00-00.db');
      await createTestBackup('backup_2025-10-14_10-00-00.db');
      await createTestBackup('backup_2025-10-14_11-00-00.db');

      const fileToDelete = 'backup_2025-10-14_10-00-00.db';

      // Act
      const result: DeleteBackupResponse = await backupManager.deleteBackup(fileToDelete);

      // Assert
      expect(result.success).toBe(true);

      // Verify only the specified file was deleted
      const remainingFiles = await fs.readdir(testBackupDir);
      expect(remainingFiles).toHaveLength(2);
      expect(remainingFiles).not.toContain(fileToDelete);
      expect(remainingFiles).toContain('backup_2025-10-14_09-00-00.db');
      expect(remainingFiles).toContain('backup_2025-10-14_11-00-00.db');
    });

    it('should delete pre-migration backups', async () => {
      // Arrange
      await createTestBackup('backup_2025-10-14_10-00-00_pre-migration.db');
      await createTestBackup('backup_2025-10-14_11-00-00.db'); // Keep at least one

      const filename = 'backup_2025-10-14_10-00-00_pre-migration.db';

      // Act
      const result: DeleteBackupResponse = await backupManager.deleteBackup(filename);

      // Assert
      expect(result.success).toBe(true);
      await expect(fs.access(path.join(testBackupDir, filename))).rejects.toThrow();
    });

    it('should delete safety backups', async () => {
      // Arrange
      await createTestBackup('backup_2025-10-14_10-00-00_safety.db');
      await createTestBackup('backup_2025-10-14_11-00-00.db'); // Keep at least one

      const filename = 'backup_2025-10-14_10-00-00_safety.db';

      // Act
      const result: DeleteBackupResponse = await backupManager.deleteBackup(filename);

      // Assert
      expect(result.success).toBe(true);
      await expect(fs.access(path.join(testBackupDir, filename))).rejects.toThrow();
    });
  });

  describe('❌ Deletion failures', () => {
    it('should block deletion of last remaining backup', async () => {
      // Arrange - create only one backup
      const filename = 'backup_2025-10-14_10-00-00.db';
      await createTestBackup(filename);

      // Act & Assert
      await expect(
        backupManager.deleteBackup(filename)
      ).rejects.toMatchObject({ code: 'LAST_BACKUP_PROTECTED' });

      // Verify file still exists
      await fs.access(path.join(testBackupDir, filename)); // Should not throw
    });

    it('should fail if file does not exist', async () => {
      // Arrange
      const nonExistentFile = 'backup_2099-01-01_00-00-00.db';

      // Act & Assert
      await expect(
        backupManager.deleteBackup(nonExistentFile)
      ).rejects.toMatchObject({ code: 'FILE_NOT_FOUND' });
    });

    it('should fail if permission denied', async () => {
      // Skip on Windows (chmod doesn't work the same way)
      if (process.platform === 'win32') {
        return;
      }

      // Arrange
      const filename = 'backup_protected.db';
      await createTestBackup(filename);
      await createTestBackup('backup_other.db'); // Ensure not the last backup

      const backupPath = path.join(testBackupDir, filename);

      // Make directory read-only
      await fs.chmod(testBackupDir, 0o444);

      // Act & Assert
      await expect(
        backupManager.deleteBackup(filename)
      ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });

      // Cleanup - restore permissions
      await fs.chmod(testBackupDir, 0o755);
    });

    it('should fail if filename contains path traversal', async () => {
      // Arrange - attempt directory traversal
      const maliciousFilename = '../../../etc/passwd';

      // Act & Assert
      await expect(
        backupManager.deleteBackup(maliciousFilename)
      ).rejects.toThrow(); // Should reject (FILE_NOT_FOUND or validation error)
    });

    it('should fail if filename is empty', async () => {
      // Act & Assert
      await expect(
        backupManager.deleteBackup('')
      ).rejects.toThrow();
    });
  });

  describe('🔒 Last backup protection', () => {
    it('should count all backup types when checking if last backup', async () => {
      // Arrange - create one backup of each type
      await createTestBackup('backup_manual.db');
      await createTestBackup('backup_pre-migration_pre-migration.db');
      await createTestBackup('backup_safety_safety.db');

      // Act - try to delete any of them
      const result1 = await backupManager.deleteBackup('backup_manual.db');
      const result2 = await backupManager.deleteBackup('backup_pre-migration_pre-migration.db');

      // Assert - first two should succeed
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Last one should be protected
      await expect(
        backupManager.deleteBackup('backup_safety_safety.db')
      ).rejects.toMatchObject({ code: 'LAST_BACKUP_PROTECTED' });
    });

    it('should prevent deletion if only one backup remains after deletion', async () => {
      // Arrange - create 2 backups
      await createTestBackup('backup_2025-10-14_10-00-00.db');
      await createTestBackup('backup_2025-10-14_11-00-00.db');

      // Act - delete first backup (should succeed)
      const result1 = await backupManager.deleteBackup('backup_2025-10-14_10-00-00.db');
      expect(result1.success).toBe(true);

      // Assert - deleting second backup should be blocked
      await expect(
        backupManager.deleteBackup('backup_2025-10-14_11-00-00.db')
      ).rejects.toMatchObject({ code: 'LAST_BACKUP_PROTECTED' });
    });

    it('should allow deletion if exactly 2 backups exist', async () => {
      // Arrange
      await createTestBackup('backup_2025-10-14_10-00-00.db');
      await createTestBackup('backup_2025-10-14_11-00-00.db');

      // Act - delete one backup
      const result: DeleteBackupResponse = await backupManager.deleteBackup('backup_2025-10-14_10-00-00.db');

      // Assert
      expect(result.success).toBe(true);

      // Verify one backup remains
      const remainingFiles = await fs.readdir(testBackupDir);
      expect(remainingFiles).toHaveLength(1);
    });
  });

  describe('🧹 File system cleanup', () => {
    it('should not leave partial files on failure', async () => {
      // Arrange
      const filename = 'backup_test.db';
      await createTestBackup(filename);
      await createTestBackup('backup_other.db'); // Ensure not the last

      // Force deletion to fail (file access after deletion attempt)
      // This is a bit contrived, but tests cleanup logic

      // Act - attempt deletion
      try {
        await backupManager.deleteBackup(filename);
      } catch {
        // Expected
      }

      // Assert - no .tmp or .temp files should exist
      const files = await fs.readdir(testBackupDir);
      const tempFiles = files.filter(f => f.includes('.tmp') || f.includes('.temp'));
      expect(tempFiles).toHaveLength(0);
    });

    it('should handle filesystem errors gracefully', async () => {
      // Arrange
      const filename = 'backup_test.db';
      await createTestBackup(filename);
      await createTestBackup('backup_other.db');

      // Delete the file manually to simulate filesystem error
      await fs.unlink(path.join(testBackupDir, filename));

      // Act & Assert - should detect file is already gone
      await expect(
        backupManager.deleteBackup(filename)
      ).rejects.toMatchObject({ code: 'FILE_NOT_FOUND' });
    });
  });

  describe('📝 Error messages', () => {
    it('should provide clear error message for last backup protection', async () => {
      // Arrange
      const filename = 'backup_only.db';
      await createTestBackup(filename);

      // Act & Assert
      try {
        await backupManager.deleteBackup(filename);
        fail('Should have thrown error');
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        const message = (error as Error).message;
        expect(message).toContain('last');
        expect(message).toContain('backup');
        expect(message.toLowerCase()).toContain('cannot delete') || expect(message.toLowerCase()).toContain('protected');
      }
    });

    it('should provide clear error message for file not found', async () => {
      // Act & Assert
      try {
        await backupManager.deleteBackup('nonexistent.db');
        fail('Should have thrown error');
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        const message = (error as Error).message;
        expect(message.toLowerCase()).toContain('not found') || expect(message.toLowerCase()).toContain('does not exist');
      }
    });

    it('should include filename in success message', async () => {
      // Arrange
      const filename = 'backup_2025-10-14_10-00-00.db';
      await createTestBackup(filename);
      await createTestBackup('backup_other.db'); // Ensure not the last

      // Act
      const result: DeleteBackupResponse = await backupManager.deleteBackup(filename);

      // Assert
      expect(result.message).toContain(filename);
      expect(result.message).toMatch(/deleted|removed/i);
    });
  });

  describe('🔒 Concurrency protection', () => {
    it('should reject if backup operation is in progress', async () => {
      // Arrange
      const filename = 'backup_test.db';
      await createTestBackup(filename);
      await createTestBackup('backup_other.db');

      // Start backup operation (don't await)
      const backupOperation = backupManager.createBackup('manual');

      // Act - try to delete during backup
      const deleteOperation = backupManager.deleteBackup(filename);

      // Assert
      await expect(deleteOperation).rejects.toMatchObject({ code: 'OPERATION_IN_PROGRESS' });

      // Cleanup
      try {
        await backupOperation;
      } catch {
        // Ignore
      }
    });

    it('should reject if restore operation is in progress', async () => {
      // Arrange
      const filename = 'backup_to_delete.db';
      await createTestBackup('backup_to_restore.db');
      await createTestBackup(filename);

      // Start restore operation (don't await)
      const restoreOperation = backupManager.restoreBackup('backup_to_restore.db');

      // Act - try to delete during restore
      const deleteOperation = backupManager.deleteBackup(filename);

      // Assert
      await expect(deleteOperation).rejects.toMatchObject({ code: 'OPERATION_IN_PROGRESS' });

      // Cleanup
      try {
        await restoreOperation;
      } catch {
        // Ignore
      }
    });
  });
});
