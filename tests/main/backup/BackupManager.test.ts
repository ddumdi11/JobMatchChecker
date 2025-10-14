/**
 * Unit tests for BackupManager.createBackup()
 *
 * These tests MUST FAIL until BackupManager is implemented (Task T013)
 *
 * Feature: #004
 * Task: T004
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { BackupManager } from '../../../src/main/backup/BackupManager';
import type { BackupMetadata } from '../../../src/types/backup';

describe('BackupManager.createBackup()', () => {
  const testBackupDir = path.join(process.cwd(), 'backups');
  const testDbPath = path.join(process.cwd(), 'data', 'test.db');
  let backupManager: BackupManager;

  beforeEach(async () => {
    // Create test backup directory
    await fs.mkdir(testBackupDir, { recursive: true });

    // Initialize BackupManager (will fail until implemented)
    backupManager = new BackupManager(testDbPath, testBackupDir);
  });

  afterEach(async () => {
    // Clean up test backups
    try {
      const files = await fs.readdir(testBackupDir);
      for (const file of files) {
        if (file.endsWith('.db')) {
          await fs.unlink(path.join(testBackupDir, file));
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('✅ Success cases', () => {
    it('should create backup file with correct naming convention', async () => {
      // Arrange
      const type = 'manual';

      // Act
      const result: BackupMetadata = await backupManager.createBackup(type);

      // Assert
      expect(result.filename).toMatch(/^backup_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.db$/);
      expect(result.type).toBe('manual');

      // Verify file exists
      const backupPath = path.join(testBackupDir, result.filename);
      await expect(fs.access(backupPath)).resolves.toBeUndefined();
    });

    it('should verify backup integrity after creation', async () => {
      // Arrange
      const type = 'manual';

      // Act
      const result: BackupMetadata = await backupManager.createBackup(type);

      // Assert
      expect(result.verified).toBe(true);
      expect(result.size).toBeGreaterThan(0);
    });

    it('should return BackupMetadata with all fields', async () => {
      // Arrange
      const type = 'manual';

      // Act
      const result: BackupMetadata = await backupManager.createBackup(type);

      // Assert - All required fields present
      expect(result).toHaveProperty('filename');
      expect(result).toHaveProperty('path');
      expect(result).toHaveProperty('size');
      expect(result).toHaveProperty('created');
      expect(result).toHaveProperty('type');
      expect(result).toHaveProperty('schemaVersion');
      expect(result).toHaveProperty('verified');

      // Assert - Field types correct
      expect(typeof result.filename).toBe('string');
      expect(typeof result.path).toBe('string');
      expect(typeof result.size).toBe('number');
      expect(typeof result.created).toBe('string');
      expect(result.type).toBe('manual');
      expect(typeof result.schemaVersion).toBe('string');
      expect(typeof result.verified).toBe('boolean');

      // Assert - ISO 8601 date format
      expect(result.created).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should create pre-migration backup with correct type', async () => {
      // Arrange
      const type = 'pre-migration';

      // Act
      const result: BackupMetadata = await backupManager.createBackup(type);

      // Assert
      expect(result.type).toBe('pre-migration');
      expect(result.filename).toContain('pre-migration');
    });

    it('should create safety backup with correct type', async () => {
      // Arrange
      const type = 'safety';

      // Act
      const result: BackupMetadata = await backupManager.createBackup(type);

      // Assert
      expect(result.type).toBe('safety');
      expect(result.filename).toContain('safety');
    });
  });

  describe('❌ Failure cases', () => {
    it('should fail when insufficient disk space', async () => {
      // Arrange
      const type = 'manual';

      // Mock disk space utility to return insufficient space
      vi.mock('../../../src/main/utils/diskSpace', () => ({
        hasSufficientDiskSpace: vi.fn().mockResolvedValue(false)
      }));

      // Act & Assert
      await expect(backupManager.createBackup(type)).rejects.toThrow('INSUFFICIENT_SPACE');
    });

    it('should fail when source DB does not exist', async () => {
      // Arrange
      const type = 'manual';
      const nonExistentDbPath = path.join(process.cwd(), 'data', 'nonexistent.db');
      const managerWithInvalidDb = new BackupManager(nonExistentDbPath, testBackupDir);

      // Act & Assert
      await expect(managerWithInvalidDb.createBackup(type)).rejects.toThrow('FILE_NOT_FOUND');
    });

    it('should fail when backup verification fails', async () => {
      // Arrange
      const type = 'manual';

      // Mock BackupVerifier to fail verification
      vi.mock('../../../src/main/backup/BackupVerifier', () => ({
        BackupVerifier: {
          verifyBackup: vi.fn().mockResolvedValue(false)
        }
      }));

      // Act & Assert
      await expect(backupManager.createBackup(type)).rejects.toThrow('VERIFICATION_FAILED');
    });

    it('should fail when backup directory does not exist', async () => {
      // Arrange
      const type = 'manual';
      const nonExistentDir = path.join(process.cwd(), 'nonexistent_dir');
      const managerWithInvalidDir = new BackupManager(testDbPath, nonExistentDir);

      // Act & Assert
      await expect(managerWithInvalidDir.createBackup(type)).rejects.toThrow('DIRECTORY_NOT_FOUND');
    });

    it('should fail when permission denied', async () => {
      // Arrange
      const type = 'manual';

      // Mock fs.copyFile to throw permission error
      vi.spyOn(fs, 'copyFile').mockRejectedValue(
        Object.assign(new Error('Permission denied'), { code: 'EACCES' })
      );

      // Act & Assert
      await expect(backupManager.createBackup(type)).rejects.toThrow('PERMISSION_DENIED');
    });
  });

  describe('🔒 Concurrency protection', () => {
    it('should reject if another backup operation is in progress', async () => {
      // Arrange
      const type = 'manual';

      // Start first backup (don't await)
      const firstBackup = backupManager.createBackup(type);

      // Act - Try to start second backup immediately
      const secondBackup = backupManager.createBackup(type);

      // Assert
      await expect(secondBackup).rejects.toThrow('OPERATION_IN_PROGRESS');

      // Clean up - wait for first backup to complete
      await firstBackup;
    });
  });
});
