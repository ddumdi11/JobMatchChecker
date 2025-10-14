/**
 * Unit tests for BackupManager.listBackups()
 *
 * These tests MUST FAIL until BackupManager.listBackups() is implemented (Task T014)
 *
 * Feature: #004
 * Task: T007
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { BackupManager } from '../../../src/main/backup/BackupManager';
import Database from 'better-sqlite3';
import type { BackupMetadata } from '../../../src/types/backup';

describe('BackupManager.listBackups()', () => {
  const testBackupDir = path.join(os.tmpdir(), 'jobmatch-test-backups', 'list');
  const testDbPath = path.join(os.tmpdir(), 'jobmatch-test-data', 'list.db');
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
  async function createTestBackup(
    filename: string,
    schemaVersion: string = '001_initial.js'
  ): Promise<void> {
    const backupPath = path.join(testBackupDir, filename);
    const db = new Database(backupPath);

    db.exec(`
      CREATE TABLE knex_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        batch INTEGER NOT NULL
      );

      CREATE TABLE test_data (
        id INTEGER PRIMARY KEY,
        value TEXT NOT NULL
      );
      INSERT INTO test_data (id, value) VALUES (1, 'test');
    `);

    // Insert schema version
    db.prepare('INSERT INTO knex_migrations (name, batch) VALUES (?, 1)').run(schemaVersion);
    db.close();

    // Wait for file system to sync
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  describe('✅ Empty state', () => {
    it('should return empty array when no backups exist', async () => {
      // Act
      const result: BackupMetadata[] = await backupManager.listBackups();

      // Assert
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should not fail when backup directory is empty', async () => {
      // Act & Assert - should not throw
      await expect(backupManager.listBackups()).resolves.toBeDefined();
    });
  });

  describe('✅ Sorting and ordering', () => {
    it('should return all backups sorted by date (newest first)', async () => {
      // Arrange - create backups with different timestamps
      await createTestBackup('backup_2025-10-14_09-00-00-000.db'); // Oldest
      await new Promise(resolve => setTimeout(resolve, 100));

      await createTestBackup('backup_2025-10-14_10-00-00-000.db'); // Middle
      await new Promise(resolve => setTimeout(resolve, 100));

      await createTestBackup('backup_2025-10-14_11-00-00-000.db'); // Newest

      // Act
      const result: BackupMetadata[] = await backupManager.listBackups();

      // Assert - sorted by date (newest first)
      expect(result).toHaveLength(3);
      expect(result[0].filename).toBe('backup_2025-10-14_11-00-00-000.db'); // Newest
      expect(result[1].filename).toBe('backup_2025-10-14_10-00-00-000.db'); // Middle
      expect(result[2].filename).toBe('backup_2025-10-14_09-00-00-000.db'); // Oldest
    });

    it('should sort by creation time, not modification time', async () => {
      // Arrange
      await createTestBackup('backup_2025-10-14_09-00-00-000.db');
      await createTestBackup('backup_2025-10-14_10-00-00-000.db');

      // Touch the older file to change modification time
      const olderFilePath = path.join(testBackupDir, 'backup_2025-10-14_09-00-00-000.db');
      const now = new Date();
      await fs.utimes(olderFilePath, now, now);

      // Act
      const result: BackupMetadata[] = await backupManager.listBackups();

      // Assert - still sorted by creation date from filename
      expect(result[0].filename).toBe('backup_2025-10-14_10-00-00-000.db');
      expect(result[1].filename).toBe('backup_2025-10-14_09-00-00-000.db');
    });
  });

  describe('📅 Age calculation', () => {
    it.skip('should calculate age correctly in days', async () => {
      // TODO: On Windows, fs.utimes() cannot change birthtime (it's read-only)
      // This test is not reliable across platforms
      // Arrange - create backup and manually set creation time to 10 days ago
      await createTestBackup('backup_2025-10-14_10-00-00-000.db');

      const backupPath = path.join(testBackupDir, 'backup_2025-10-14_10-00-00-000.db');
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      await fs.utimes(backupPath, tenDaysAgo, tenDaysAgo);

      // Act
      const result: BackupMetadata[] = await backupManager.listBackups();

      // Assert
      expect(result[0].age).toBeDefined();
      expect(result[0].age).toBeGreaterThanOrEqual(9); // Allow 1 day margin
      expect(result[0].age).toBeLessThanOrEqual(11);
    });

    it('should calculate age as 0 for backups created today', async () => {
      // Arrange
      await createTestBackup('backup_2025-10-14_10-00-00-000.db');

      // Act
      const result: BackupMetadata[] = await backupManager.listBackups();

      // Assert
      expect(result[0].age).toBe(0);
    });

    it.skip('should round age down to nearest whole day', async () => {
      // TODO: On Windows, fs.utimes() cannot change birthtime (it's read-only)
      // Arrange - create backup 2.8 days ago
      await createTestBackup('backup_2025-10-14_10-00-00-000.db');

      const backupPath = path.join(testBackupDir, 'backup_2025-10-14_10-00-00-000.db');
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      twoDaysAgo.setHours(twoDaysAgo.getHours() - 20); // Add 20 hours (2.8 days total)

      await fs.utimes(backupPath, twoDaysAgo, twoDaysAgo);

      // Act
      const result: BackupMetadata[] = await backupManager.listBackups();

      // Assert - should round down to 2 days
      expect(result[0].age).toBe(2);
    });
  });

  describe('🏷️ Backup type identification', () => {
    it('should identify manual backup type from filename', async () => {
      // Arrange
      await createTestBackup('backup_2025-10-14_10-00-00-000.db');

      // Act
      const result: BackupMetadata[] = await backupManager.listBackups();

      // Assert
      expect(result[0].type).toBe('manual');
    });

    it('should identify pre-migration backup type from filename', async () => {
      // Arrange
      await createTestBackup('backup_2025-10-14_10-00-00-000_pre-migration.db');

      // Act
      const result: BackupMetadata[] = await backupManager.listBackups();

      // Assert
      expect(result[0].type).toBe('pre-migration');
    });

    it('should identify safety backup type from filename', async () => {
      // Arrange
      await createTestBackup('backup_2025-10-14_10-00-00-000_safety.db');

      // Act
      const result: BackupMetadata[] = await backupManager.listBackups();

      // Assert
      expect(result[0].type).toBe('safety');
    });

    it('should handle mixed backup types in same directory', async () => {
      // Arrange
      await createTestBackup('backup_2025-10-14_09-00-00-000.db'); // manual
      await createTestBackup('backup_2025-10-14_10-00-00-000_pre-migration.db');
      await createTestBackup('backup_2025-10-14_11-00-00-000_safety.db');

      // Act
      const result: BackupMetadata[] = await backupManager.listBackups();

      // Assert
      expect(result).toHaveLength(3);
      expect(result.find(b => b.type === 'manual')).toBeDefined();
      expect(result.find(b => b.type === 'pre-migration')).toBeDefined();
      expect(result.find(b => b.type === 'safety')).toBeDefined();
    });
  });

  describe('📖 Schema version reading', () => {
    it('should read schema version from each backup', async () => {
      // Arrange
      await createTestBackup('backup_old.db', '001_initial.js');
      await createTestBackup('backup_new.db', '005_add_jobs.js');

      // Act
      const result: BackupMetadata[] = await backupManager.listBackups();

      // Assert
      const oldBackup = result.find(b => b.filename === 'backup_old.db');
      const newBackup = result.find(b => b.filename === 'backup_new.db');

      expect(oldBackup?.schemaVersion).toBe('001_initial.js');
      expect(newBackup?.schemaVersion).toBe('005_add_jobs.js');
    });

    it('should handle backups with different schema versions', async () => {
      // Arrange - create backups with progressive schema versions
      await createTestBackup('backup_v1.db', '001_initial.js');
      await createTestBackup('backup_v2.db', '002_add_skills.js');
      await createTestBackup('backup_v3.db', '003_add_preferences.js');

      // Act
      const result: BackupMetadata[] = await backupManager.listBackups();

      // Assert
      expect(result).toHaveLength(3);
      expect(result.every(b => b.schemaVersion)).toBe(true);
      expect(result.every(b => typeof b.schemaVersion === 'string')).toBe(true);
    });

    it('should open backups in read-only mode', async () => {
      // Arrange
      await createTestBackup('backup_test.db');

      const backupPath = path.join(testBackupDir, 'backup_test.db');
      const statsBefore = await fs.stat(backupPath);

      // Act
      await backupManager.listBackups();

      // Assert - modification time should not change
      const statsAfter = await fs.stat(backupPath);
      expect(statsAfter.mtime.getTime()).toBe(statsBefore.mtime.getTime());
    });
  });

  describe('📊 Metadata completeness', () => {
    it('should return all required metadata fields', async () => {
      // Arrange
      await createTestBackup('backup_2025-10-14_10-00-00-000.db');

      // Act
      const result: BackupMetadata[] = await backupManager.listBackups();

      // Assert - all fields present
      const backup = result[0];
      expect(backup).toHaveProperty('filename');
      expect(backup).toHaveProperty('path');
      expect(backup).toHaveProperty('size');
      expect(backup).toHaveProperty('created');
      expect(backup).toHaveProperty('type');
      expect(backup).toHaveProperty('schemaVersion');
      expect(backup).toHaveProperty('verified');
      expect(backup).toHaveProperty('age');

      // Assert - field types correct
      expect(typeof backup.filename).toBe('string');
      expect(typeof backup.path).toBe('string');
      expect(typeof backup.size).toBe('number');
      expect(typeof backup.created).toBe('string');
      expect(['manual', 'pre-migration', 'safety']).toContain(backup.type);
      expect(typeof backup.schemaVersion).toBe('string');
      expect(typeof backup.verified).toBe('boolean');
      expect(typeof backup.age).toBe('number');
    });

    it('should include absolute file paths', async () => {
      // Arrange
      await createTestBackup('backup_test.db');

      // Act
      const result: BackupMetadata[] = await backupManager.listBackups();

      // Assert
      expect(result[0].path).toContain(testBackupDir);
      expect(path.isAbsolute(result[0].path)).toBe(true);
    });

    it('should calculate file size correctly', async () => {
      // Arrange
      await createTestBackup('backup_test.db');

      // Act
      const result: BackupMetadata[] = await backupManager.listBackups();

      // Assert
      expect(result[0].size).toBeGreaterThan(0);
      expect(result[0].size).toBeGreaterThan(10000); // SQLite header + data > 10KB
    });

    it('should include creation timestamp in ISO 8601 format', async () => {
      // Arrange
      await createTestBackup('backup_test.db');

      // Act
      const result: BackupMetadata[] = await backupManager.listBackups();

      // Assert - ISO 8601 format
      expect(result[0].created).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // Assert - valid date
      const date = new Date(result[0].created);
      expect(date.getTime()).toBeGreaterThan(0);
    });

    it('should include verification status', async () => {
      // Arrange
      await createTestBackup('backup_test.db');

      // Act
      const result: BackupMetadata[] = await backupManager.listBackups();

      // Assert
      expect(result[0].verified).toBe(true); // Valid backup should pass verification
    });
  });

  describe('🔍 File filtering', () => {
    it('should only list .db files', async () => {
      // Arrange - create various files
      await createTestBackup('backup_valid.db');
      await fs.writeFile(path.join(testBackupDir, 'readme.txt'), 'Not a backup');
      await fs.writeFile(path.join(testBackupDir, 'backup.sql'), 'SQL dump');
      await fs.writeFile(path.join(testBackupDir, '.gitkeep'), '');

      // Act
      const result: BackupMetadata[] = await backupManager.listBackups();

      // Assert - only .db file included
      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe('backup_valid.db');
    });

    it('should ignore hidden files and system files', async () => {
      // Arrange
      await createTestBackup('backup_visible.db');
      await createTestBackup('.backup_hidden.db'); // Hidden file

      // Act
      const result: BackupMetadata[] = await backupManager.listBackups();

      // Assert - hidden file excluded
      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe('backup_visible.db');
    });

    it('should skip corrupted database files gracefully', async () => {
      // Arrange - create valid and corrupted backups
      await createTestBackup('backup_valid.db');

      const corruptedPath = path.join(testBackupDir, 'backup_corrupted.db');
      await fs.writeFile(corruptedPath, Buffer.from('corrupted data'));

      // Act
      const result: BackupMetadata[] = await backupManager.listBackups();

      // Assert - only valid backup included
      expect(result).toHaveLength(1);
      expect(result[0].filename).toBe('backup_valid.db');
    });
  });

  describe('⚡ Performance', () => {
    it('should handle large number of backups efficiently', async () => {
      // Arrange - create 50 backups
      for (let i = 0; i < 50; i++) {
        const timestamp = new Date(2025, 9, 1, i, 0, 0).toISOString().replace(/[:.]/g, '-').slice(0, -5);
        await createTestBackup(`backup_${timestamp}.db`);
      }

      // Act - measure performance
      const startTime = Date.now();
      const result: BackupMetadata[] = await backupManager.listBackups();
      const duration = Date.now() - startTime;

      // Assert
      expect(result).toHaveLength(50);
      expect(duration).toBeLessThan(15000); // Should complete within 15 seconds (each backup needs verification)
    }, 20000); // Set test timeout to 20 seconds
  });
});
