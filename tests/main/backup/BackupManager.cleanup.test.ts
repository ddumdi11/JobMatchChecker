/**
 * Unit tests for BackupManager.cleanupOldBackups()
 *
 * These tests MUST FAIL until BackupManager.cleanupOldBackups() is implemented (Task T017)
 *
 * Feature: #004
 * Task: T009
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { BackupManager } from '../../../src/main/backup/BackupManager';
import Database from 'better-sqlite3';
import type { CleanupOldBackupsResponse } from '../../../src/types/backup';

describe('BackupManager.cleanupOldBackups()', () => {
  const testBackupDir = path.join(process.cwd(), 'backups', 'test-cleanup');
  const testDbPath = path.join(process.cwd(), 'data', 'test-cleanup.db');
  let backupManager: BackupManager;

  beforeEach(async () => {
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
  async function createTestBackup(
    filename: string,
    daysAgo: number = 0
  ): Promise<void> {
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

    // Set file modification time to simulate age
    if (daysAgo > 0) {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - daysAgo);
      await fs.utimes(backupPath, pastDate, pastDate);
    }

    // Wait for file system to sync
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  describe('✅ Successful cleanup', () => {
    it('should delete backups older than 30 days', async () => {
      // Arrange - create backups at different ages
      await createTestBackup('backup_recent.db', 10);    // 10 days old - keep
      await createTestBackup('backup_old1.db', 35);       // 35 days old - delete
      await createTestBackup('backup_old2.db', 60);       // 60 days old - delete

      // Act
      const result: CleanupOldBackupsResponse = await backupManager.cleanupOldBackups();

      // Assert
      expect(result.success).toBe(true);
      expect(result.deleted).toHaveLength(2);
      expect(result.deleted).toContain('backup_old1.db');
      expect(result.deleted).toContain('backup_old2.db');
      expect(result.kept).toHaveLength(1);
      expect(result.kept).toContain('backup_recent.db');
      expect(result.count).toBe(2);

      // Verify files actually deleted
      const remainingFiles = await fs.readdir(testBackupDir);
      expect(remainingFiles).toHaveLength(1);
      expect(remainingFiles).toContain('backup_recent.db');
    });

    it('should keep pre-migration backups regardless of age', async () => {
      // Arrange - create old pre-migration backup
      await createTestBackup('backup_2025-01-01_10-00-00_pre-migration.db', 90); // 90 days old
      await createTestBackup('backup_recent.db', 10); // Keep at least one other backup

      // Act
      const result: CleanupOldBackupsResponse = await backupManager.cleanupOldBackups();

      // Assert
      expect(result.success).toBe(true);
      expect(result.deleted).toHaveLength(0);
      expect(result.kept).toContain('backup_2025-01-01_10-00-00_pre-migration.db');

      // Verify pre-migration backup still exists
      await fs.access(path.join(testBackupDir, 'backup_2025-01-01_10-00-00_pre-migration.db'));
    });

    it('should always keep at least 1 backup', async () => {
      // Arrange - create only old backups
      await createTestBackup('backup_old1.db', 35);
      await createTestBackup('backup_old2.db', 40);
      await createTestBackup('backup_old3.db', 45);

      // Act
      const result: CleanupOldBackupsResponse = await backupManager.cleanupOldBackups();

      // Assert - should keep the newest one
      expect(result.success).toBe(true);
      expect(result.deleted).toHaveLength(2);
      expect(result.kept).toHaveLength(1);
      expect(result.kept).toContain('backup_old1.db'); // Newest of the old ones

      // Verify at least one backup remains
      const remainingFiles = await fs.readdir(testBackupDir);
      expect(remainingFiles.length).toBeGreaterThanOrEqual(1);
    });

    it('should return list of deleted backups', async () => {
      // Arrange
      await createTestBackup('backup_recent.db', 10);
      await createTestBackup('backup_old1.db', 35);
      await createTestBackup('backup_old2.db', 40);

      // Act
      const result: CleanupOldBackupsResponse = await backupManager.cleanupOldBackups();

      // Assert
      expect(result.deleted).toBeDefined();
      expect(Array.isArray(result.deleted)).toBe(true);
      expect(result.deleted).toHaveLength(2);
      expect(result.deleted).toEqual(
        expect.arrayContaining(['backup_old1.db', 'backup_old2.db'])
      );
    });

    it('should return list of kept backups', async () => {
      // Arrange
      await createTestBackup('backup_recent.db', 10);
      await createTestBackup('backup_old.db', 35);

      // Act
      const result: CleanupOldBackupsResponse = await backupManager.cleanupOldBackups();

      // Assert
      expect(result.kept).toBeDefined();
      expect(Array.isArray(result.kept)).toBe(true);
      expect(result.kept).toContain('backup_recent.db');
    });

    it('should return count of deleted backups', async () => {
      // Arrange
      await createTestBackup('backup_recent.db', 10);
      await createTestBackup('backup_old1.db', 35);
      await createTestBackup('backup_old2.db', 40);
      await createTestBackup('backup_old3.db', 45);

      // Act
      const result: CleanupOldBackupsResponse = await backupManager.cleanupOldBackups();

      // Assert
      expect(result.count).toBe(3); // 3 old backups deleted, 1 recent kept
    });
  });

  describe('✅ Edge cases', () => {
    it('should handle no old backups gracefully', async () => {
      // Arrange - all backups are recent
      await createTestBackup('backup_recent1.db', 5);
      await createTestBackup('backup_recent2.db', 10);
      await createTestBackup('backup_recent3.db', 15);

      // Act
      const result: CleanupOldBackupsResponse = await backupManager.cleanupOldBackups();

      // Assert
      expect(result.success).toBe(true);
      expect(result.deleted).toHaveLength(0);
      expect(result.kept).toHaveLength(3);
      expect(result.count).toBe(0);
    });

    it('should handle no backups present', async () => {
      // Act
      const result: CleanupOldBackupsResponse = await backupManager.cleanupOldBackups();

      // Assert
      expect(result.success).toBe(true);
      expect(result.deleted).toHaveLength(0);
      expect(result.kept).toHaveLength(0);
      expect(result.count).toBe(0);
    });

    it('should handle exactly 30-day-old backup (boundary)', async () => {
      // Arrange - backup exactly 30 days old
      await createTestBackup('backup_30days.db', 30);
      await createTestBackup('backup_recent.db', 10);

      // Act
      const result: CleanupOldBackupsResponse = await backupManager.cleanupOldBackups();

      // Assert - 30 days should be kept (>30 is the rule)
      expect(result.deleted).toHaveLength(0);
      expect(result.kept).toContain('backup_30days.db');
    });

    it('should handle exactly 31-day-old backup (boundary)', async () => {
      // Arrange - backup exactly 31 days old
      await createTestBackup('backup_31days.db', 31);
      await createTestBackup('backup_recent.db', 10);

      // Act
      const result: CleanupOldBackupsResponse = await backupManager.cleanupOldBackups();

      // Assert - 31 days should be deleted (>30 is the rule)
      expect(result.deleted).toContain('backup_31days.db');
      expect(result.kept).not.toContain('backup_31days.db');
    });
  });

  describe('🏷️ Backup type handling', () => {
    it('should delete old manual backups', async () => {
      // Arrange
      await createTestBackup('backup_2025-01-01_10-00-00.db', 35); // Manual, old
      await createTestBackup('backup_recent.db', 10);

      // Act
      const result: CleanupOldBackupsResponse = await backupManager.cleanupOldBackups();

      // Assert
      expect(result.deleted).toContain('backup_2025-01-01_10-00-00.db');
    });

    it('should delete old safety backups', async () => {
      // Arrange
      await createTestBackup('backup_2025-01-01_10-00-00_safety.db', 35); // Safety, old
      await createTestBackup('backup_recent.db', 10);

      // Act
      const result: CleanupOldBackupsResponse = await backupManager.cleanupOldBackups();

      // Assert
      expect(result.deleted).toContain('backup_2025-01-01_10-00-00_safety.db');
    });

    it('should keep old pre-migration backups', async () => {
      // Arrange
      await createTestBackup('backup_2025-01-01_10-00-00_pre-migration.db', 90);
      await createTestBackup('backup_recent.db', 10);

      // Act
      const result: CleanupOldBackupsResponse = await backupManager.cleanupOldBackups();

      // Assert
      expect(result.deleted).not.toContain('backup_2025-01-01_10-00-00_pre-migration.db');
      expect(result.kept).toContain('backup_2025-01-01_10-00-00_pre-migration.db');
    });

    it('should handle mixed backup types correctly', async () => {
      // Arrange - mix of types and ages
      await createTestBackup('backup_old_manual.db', 35);             // Delete
      await createTestBackup('backup_old_safety_safety.db', 40);      // Delete
      await createTestBackup('backup_old_premig_pre-migration.db', 50); // Keep (pre-migration)
      await createTestBackup('backup_recent.db', 10);                  // Keep (recent)

      // Act
      const result: CleanupOldBackupsResponse = await backupManager.cleanupOldBackups();

      // Assert
      expect(result.deleted).toHaveLength(2);
      expect(result.kept).toHaveLength(2);
      expect(result.kept).toContain('backup_old_premig_pre-migration.db');
      expect(result.kept).toContain('backup_recent.db');
    });
  });

  describe('🔒 Last backup protection', () => {
    it('should not delete if only one old backup exists', async () => {
      // Arrange - only one backup, but it's old
      await createTestBackup('backup_only.db', 90);

      // Act
      const result: CleanupOldBackupsResponse = await backupManager.cleanupOldBackups();

      // Assert - should keep it (last backup protection)
      expect(result.deleted).toHaveLength(0);
      expect(result.kept).toContain('backup_only.db');
    });

    it('should keep newest backup even if all are old', async () => {
      // Arrange - all backups old
      await createTestBackup('backup_oldest.db', 90);
      await createTestBackup('backup_older.db', 60);
      await createTestBackup('backup_less_old.db', 35);

      // Act
      const result: CleanupOldBackupsResponse = await backupManager.cleanupOldBackups();

      // Assert - should keep the least old one
      expect(result.deleted).toHaveLength(2);
      expect(result.kept).toContain('backup_less_old.db');
    });

    it('should count pre-migration backups when determining last backup', async () => {
      // Arrange - only one regular backup (old) + one pre-migration backup (old)
      await createTestBackup('backup_old_manual.db', 35);
      await createTestBackup('backup_old_premig_pre-migration.db', 50);

      // Act
      const result: CleanupOldBackupsResponse = await backupManager.cleanupOldBackups();

      // Assert - can delete old manual backup because pre-migration backup exists
      expect(result.deleted).toContain('backup_old_manual.db');
      expect(result.kept).toContain('backup_old_premig_pre-migration.db');
    });
  });

  describe('⚡ Performance', () => {
    it('should handle large number of old backups efficiently', async () => {
      // Arrange - create 100 old backups + 1 recent
      for (let i = 0; i < 100; i++) {
        await createTestBackup(`backup_old_${i}.db`, 35 + i);
      }
      await createTestBackup('backup_recent.db', 10);

      // Act - measure performance
      const startTime = Date.now();
      const result: CleanupOldBackupsResponse = await backupManager.cleanupOldBackups();
      const duration = Date.now() - startTime;

      // Assert
      expect(result.deleted).toHaveLength(100);
      expect(result.kept).toContain('backup_recent.db');
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('❌ Error handling', () => {
    it('should handle permission errors gracefully', async () => {
      // Skip on Windows (chmod doesn't work the same way)
      if (process.platform === 'win32') {
        return;
      }

      // Arrange
      await createTestBackup('backup_protected.db', 35);
      await createTestBackup('backup_recent.db', 10);

      // Make old backup read-only
      const protectedPath = path.join(testBackupDir, 'backup_protected.db');
      await fs.chmod(protectedPath, 0o444);

      // Act & Assert - should handle error and continue
      const result: CleanupOldBackupsResponse = await backupManager.cleanupOldBackups();

      // Cleanup
      await fs.chmod(protectedPath, 0o644);

      // Should report the error but not crash
      expect(result.success).toBeDefined();
    });

    it('should continue cleanup if one file fails to delete', async () => {
      // Arrange
      await createTestBackup('backup_old1.db', 35);
      await createTestBackup('backup_old2.db', 40);
      await createTestBackup('backup_recent.db', 10);

      // Delete one file manually to simulate filesystem issue
      await fs.unlink(path.join(testBackupDir, 'backup_old1.db'));

      // Act - should handle missing file gracefully
      const result: CleanupOldBackupsResponse = await backupManager.cleanupOldBackups();

      // Assert - should still delete the other old backup
      expect(result.success).toBe(true);
      expect(result.deleted).toContain('backup_old2.db');
    });
  });

  describe('📝 Logging and reporting', () => {
    it('should log cleanup operation details', async () => {
      // Arrange - mock console.log
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await createTestBackup('backup_recent.db', 10);
      await createTestBackup('backup_old.db', 35);

      // Act
      await backupManager.cleanupOldBackups();

      // Assert - should have logged cleanup results
      expect(consoleLogSpy).toHaveBeenCalled();
      const logMessages = consoleLogSpy.mock.calls.flat().join(' ');
      expect(logMessages.toLowerCase()).toContain('cleanup') || expect(logMessages.toLowerCase()).toContain('deleted');

      consoleLogSpy.mockRestore();
    });

    it('should return success response even when nothing deleted', async () => {
      // Arrange - all recent backups
      await createTestBackup('backup_recent.db', 10);

      // Act
      const result: CleanupOldBackupsResponse = await backupManager.cleanupOldBackups();

      // Assert
      expect(result.success).toBe(true);
      expect(result.deleted).toHaveLength(0);
      expect(result.count).toBe(0);
    });
  });
});
