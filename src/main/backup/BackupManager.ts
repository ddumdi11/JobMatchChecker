/**
 * BackupManager - Manages SQLite database backups
 *
 * Feature: #004 Database Backup & Restore
 * Tasks: T013-T018
 *
 * Responsibilities:
 * - Create backups (manual, pre-migration, safety)
 * - Restore backups with safety backup creation
 * - List available backups with metadata
 * - Delete backups with last backup protection
 * - Cleanup old backups (30-day retention)
 * - Prevent concurrent backup/restore operations
 */

import Database from 'better-sqlite3';
import * as fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import * as path from 'node:path';
import { BackupVerifier } from './BackupVerifier';
import { hasSufficientDiskSpace } from '../utils/diskSpace';
import { closeDatabase } from '../database/db';
import type { BackupMetadata, BackupType, BackupErrorCode } from '../../types/backup';

/**
 * Custom error class for backup operations
 */
export class BackupError extends Error {
  constructor(
    public code: BackupErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'BackupError';
  }
}

/**
 * BackupManager class - handles all backup/restore operations
 */
export class BackupManager {
  private sourceDatabasePath: string;
  private backupDirectory: string;
  private operationInProgress: boolean = false;

  constructor(sourceDatabasePath: string, backupDirectory: string) {
    this.sourceDatabasePath = sourceDatabasePath;
    this.backupDirectory = backupDirectory;
  }

  /**
   * Internal method to create a backup without concurrency check
   * Used by both createBackup() and restoreBackup()
   *
   * @param type - Type of backup
   * @returns Backup metadata
   * @throws BackupError if backup fails
   */
  private async createBackupInternal(type: BackupType): Promise<BackupMetadata> {
      // 1. Verify source database exists
      try {
        await fs.access(this.sourceDatabasePath, fsConstants.R_OK);
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          throw new BackupError('FILE_NOT_FOUND', 'Source database file not found');
        }
        throw new BackupError('PERMISSION_DENIED', 'Cannot read source database');
      }

      // 2. Verify backup directory exists
      try {
        await fs.access(this.backupDirectory, fsConstants.W_OK);
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          throw new BackupError('DIRECTORY_NOT_FOUND', 'Backup directory does not exist');
        }
        throw new BackupError('PERMISSION_DENIED', 'Cannot write to backup directory');
      }

      // 3. Check disk space (temporarily commented out for Windows/Cygwin compatibility)
      // TODO: Fix disk space check on Windows
      // const dbStats = await fs.stat(this.sourceDatabasePath);
      // // Use 1.2x safety margin (20% buffer)
      // const hasSpace = await hasSufficientDiskSpace(this.backupDirectory, dbStats.size, 1.2);
      //
      // if (!hasSpace) {
      //   throw new BackupError('INSUFFICIENT_SPACE', 'Not enough disk space for backup');
      // }

      // 4. Generate backup filename with milliseconds to prevent collisions
      const now = new Date();
      const timestamp = now.toISOString().replace(/:/g, '-').replace('T', '_').replace(/\..+/, '');
      const milliseconds = now.getMilliseconds().toString().padStart(3, '0');
      let filename = `backup_${timestamp}-${milliseconds}`;

      if (type === 'pre-migration') {
        filename += '_pre-migration';
      } else if (type === 'safety') {
        filename += '_safety';
      }

      filename += '.db';

      const backupPath = path.join(this.backupDirectory, filename);

      // 5. Create backup using better-sqlite3 backup API
      // This is safer than fs.copyFile because it creates a consistent snapshot
      // and doesn't require closing the database connection
      try {
        const db = new Database(this.sourceDatabasePath, { readonly: true });
        try {
          await db.backup(backupPath);
        } finally {
          db.close();
        }
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code === 'EACCES' ||
            (error as NodeJS.ErrnoException).code === 'EPERM') {
          throw new BackupError('PERMISSION_DENIED', 'Permission denied while creating backup');
        }
        throw new BackupError('UNKNOWN', `Failed to create backup: ${(error as Error).message}`);
      }

      // 6. Verify backup integrity
      const verificationResult = await BackupVerifier.verifyBackup(backupPath);

      if (!verificationResult.isValid) {
        // Delete failed backup
        try {
          await fs.unlink(backupPath);
        } catch {
          // Ignore cleanup errors
        }
        const errors = verificationResult.errors?.join(', ') || 'Unknown verification error';
        throw new BackupError('VERIFICATION_FAILED', `Backup verification failed: ${errors}`);
      }

      // 7. Get file stats
      const backupStats = await fs.stat(backupPath);

      // 8. Build metadata
      const metadata: BackupMetadata = {
        filename,
        path: backupPath,
        size: backupStats.size,
        created: backupStats.birthtime.toISOString(),
        type,
        schemaVersion: verificationResult.schemaVersion || 'unknown',
        verified: true
      };

      return metadata;
  }

  /**
   * Creates a new backup of the database
   *
   * @param type - Type of backup (manual, pre-migration, safety)
   * @returns Metadata about the created backup
   * @throws BackupError if backup fails
   */
  async createBackup(type: BackupType): Promise<BackupMetadata> {
    // Check for concurrent operations
    if (this.operationInProgress) {
      throw new BackupError('OPERATION_IN_PROGRESS', 'Another backup operation is already running');
    }

    this.operationInProgress = true;

    try {
      return await this.createBackupInternal(type);
    } finally {
      this.operationInProgress = false;
    }
  }

  /**
   * Restores a backup file, replacing the current database
   *
   * **Security**: Path traversal protection is implicitly provided by using only
   * the filename (no path components) and joining it with the configured backup directory.
   * The filename is validated by path.join() which normalizes paths.
   *
   * **Important**: This method closes ALL database connections before replacing the file
   * to prevent file locks (especially on Windows).
   *
   * @param filename - Name of the backup file to restore (filename only, no path components)
   * @returns Response with safety backup information
   * @throws BackupError if restore fails
   */
  async restoreBackup(filename: string): Promise<{ success: boolean; message: string; safetyBackup?: { filename: string; path: string } }> {
    // Check for concurrent operations
    if (this.operationInProgress) {
      throw new BackupError('OPERATION_IN_PROGRESS', 'Another backup operation is already running');
    }

    this.operationInProgress = true;
    let safetyBackupPath: string | null = null;
    let safetyBackupFilename: string | null = null;

    try {
      // 1. Validate filename for path traversal attacks
      // SECURITY: Reject any filename containing '..' or path separators
      if (!filename || filename.trim() === '') {
        throw new BackupError('INVALID_FILENAME', 'Filename cannot be empty');
      }

      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        throw new BackupError('INVALID_FILENAME', 'Invalid filename: path traversal not allowed');
      }

      // 2. Verify backup file exists
      // SECURITY: path.join normalizes the path and prevents traversal
      const backupPath = path.join(this.backupDirectory, filename);
      try {
        await fs.access(backupPath, fsConstants.R_OK);
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          throw new BackupError('FILE_NOT_FOUND', `Backup file not found: ${filename}`);
        }
        throw new BackupError('PERMISSION_DENIED', 'Cannot read backup file');
      }

      // 3. Verify backup integrity
      const verificationResult = await BackupVerifier.verifyBackup(backupPath);
      if (!verificationResult.isValid) {
        const errors = verificationResult.errors?.join(', ') || 'Unknown error';
        throw new BackupError('VERIFICATION_FAILED', `Backup verification failed: ${errors}`);
      }

      // 4. Check schema version compatibility
      // Get current database schema version
      let currentSchemaVersion: string | null = null;
      try {
        const currentDb = new Database(this.sourceDatabasePath, { readonly: true });
        try {
          const migration = currentDb
            .prepare('SELECT name FROM knex_migrations ORDER BY id DESC LIMIT 1')
            .get() as { name: string } | undefined;
          currentSchemaVersion = migration?.name || null;
        } finally {
          currentDb.close();
        }
      } catch {
        // If we can't read current schema, allow restore
        currentSchemaVersion = null;
      }

      // Compare schema versions
      const backupSchemaVersion = verificationResult.schemaVersion;
      if (currentSchemaVersion && backupSchemaVersion) {
        // Simple string comparison - assumes migration names are chronologically sortable
        if (backupSchemaVersion > currentSchemaVersion) {
          throw new BackupError('SCHEMA_TOO_NEW', 'Cannot restore backup from newer application version');
        }
      }

      // 5. Create safety backup of current database
      // Use internal method to bypass concurrency check (we're already in an operation)
      const safetyBackupMetadata = await this.createBackupInternal('safety');
      safetyBackupPath = safetyBackupMetadata.path;
      safetyBackupFilename = safetyBackupMetadata.filename;

      // 6. Close all database connections before replacing file
      // This is CRITICAL to prevent file locks on Windows
      closeDatabase();

      // 7. Replace database file atomically
      // Copy backup to temp location first, then atomic rename
      const tempPath = this.sourceDatabasePath + '.restore.tmp';
      try {
        // Copy backup to temp location
        await fs.copyFile(backupPath, tempPath);

        // Atomic rename (overwrites target on most filesystems)
        await fs.rename(tempPath, this.sourceDatabasePath);
      } catch (error: unknown) {
        // Cleanup temp file if it exists
        try {
          await fs.unlink(tempPath);
        } catch {
          // Ignore cleanup errors
        }

        // If rename failed, try to restore safety backup
        if (safetyBackupPath) {
          try {
            await fs.copyFile(safetyBackupPath, this.sourceDatabasePath);
          } catch (restoreError) {
            console.error('CRITICAL: Failed to restore safety backup after failed restore:', restoreError);
          }
        }

        if ((error as NodeJS.ErrnoException).code === 'EACCES' ||
            (error as NodeJS.ErrnoException).code === 'EPERM') {
          throw new BackupError('PERMISSION_DENIED', 'Permission denied during database replacement');
        }
        throw new BackupError('UNKNOWN', `Failed to restore backup: ${(error as Error).message}`);
      }

      // 8. Return success response
      return {
        success: true,
        message: `Database successfully restored from ${filename}`,
        safetyBackup: safetyBackupFilename && safetyBackupPath ? {
          filename: safetyBackupFilename,
          path: safetyBackupPath
        } : undefined
      };

    } catch (error: unknown) {
      // Log error for debugging
      if (error instanceof BackupError) {
        console.error('Restore failed:', error.code, error.message);
      } else {
        console.error('Restore failed with unexpected error:', error);
      }
      throw error;
    } finally {
      this.operationInProgress = false;
    }
  }

  /**
   * Lists all available backups with metadata
   *
   * @returns Array of backup metadata, sorted by creation date (newest first)
   */
  async listBackups(): Promise<BackupMetadata[]> {
    const backups: BackupMetadata[] = [];

    try {
      // 1. Read backup directory
      let files: string[];
      try {
        files = await fs.readdir(this.backupDirectory);
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          // Directory doesn't exist - return empty array
          return [];
        }
        throw error;
      }

      // 2. Filter for .db files (excluding hidden files)
      const dbFiles = files.filter(
        (file) => file.endsWith('.db') && !file.startsWith('.')
      );

      // 3. Process each backup file
      for (const filename of dbFiles) {
        try {
          const backupPath = path.join(this.backupDirectory, filename);

          // Get file stats
          const stats = await fs.stat(backupPath);

          // Determine backup type from filename
          let type: BackupType = 'manual';
          if (filename.includes('_pre-migration')) {
            type = 'pre-migration';
          } else if (filename.includes('_safety')) {
            type = 'safety';
          }

          // Read schema version from backup
          let schemaVersion = 'unknown';
          let verified = false;

          try {
            // Verify backup and extract schema version
            const verificationResult = await BackupVerifier.verifyBackup(backupPath);
            verified = verificationResult.isValid;
            schemaVersion = verificationResult.schemaVersion || 'unknown';

            // Skip invalid/corrupted backups
            if (!verified) {
              continue;
            }
          } catch {
            // Skip backups that can't be verified - don't add to list
            continue;
          }

          // Calculate age in days
          const ageMs = Date.now() - stats.birthtime.getTime();
          const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));

          // Build metadata
          const metadata: BackupMetadata = {
            filename,
            path: backupPath,
            size: stats.size,
            created: stats.birthtime.toISOString(),
            type,
            schemaVersion,
            verified,
            age: ageDays
          };

          backups.push(metadata);
        } catch (error) {
          // Skip files that can't be read
          continue;
        }
      }

      // 4. Sort by creation date (newest first)
      // Sort by filename timestamp to be deterministic (birthtime can vary by filesystem)
      backups.sort((a, b) => {
        // Extract timestamp from filename (format: backup_YYYY-MM-DD_HH-MM-SS-mmm.db)
        const timestampA = a.filename.match(/backup_(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3})/)?.[1] || '';
        const timestampB = b.filename.match(/backup_(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3})/)?.[1] || '';

        // Sort descending (newest first)
        return timestampB.localeCompare(timestampA);
      });

      return backups;
    } catch (error: unknown) {
      console.error('Failed to list backups:', error);
      throw new BackupError('UNKNOWN', `Failed to list backups: ${(error as Error).message}`);
    }
  }

  /**
   * Deletes a specific backup file
   *
   * **Security**: This method implements path traversal protection by rejecting
   * any filename containing '..' or path separators. Only filenames (not paths)
   * are accepted, and they are validated before being joined with the backup directory.
   *
   * @param filename - Name of the backup file to delete (filename only, no path components)
   * @returns Response indicating success
   * @throws BackupError if deletion fails or is blocked
   */
  async deleteBackup(filename: string): Promise<{ success: boolean; message: string }> {
    // Check for concurrent operations
    if (this.operationInProgress) {
      throw new BackupError('OPERATION_IN_PROGRESS', 'Another backup operation is already running');
    }

    this.operationInProgress = true;

    try {
      // Validate filename
      if (!filename || filename.trim() === '') {
        throw new BackupError('UNKNOWN', 'Filename cannot be empty');
      }

      // SECURITY: Prevent path traversal attacks
      // Reject any filename containing '..' or path separators (/ or \)
      // This ensures the file can only be within the backup directory
      if (filename.includes('..') || filename.includes(path.sep)) {
        throw new BackupError('UNKNOWN', 'Invalid filename: path traversal not allowed');
      }
      const backupPath = path.join(this.backupDirectory, filename);

      // 1. Check if file exists
      try {
        await fs.access(backupPath, fsConstants.F_OK);
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          throw new BackupError('FILE_NOT_FOUND', `Backup file not found: ${filename}`);
        }
        throw error;
      }

      // 2. Check last backup protection - must keep at least 1 backup
      const allBackups = await this.listBackups();
      if (allBackups.length <= 1) {
        throw new BackupError('LAST_BACKUP_PROTECTED', 'Cannot delete the last remaining backup');
      }

      // 3. Delete the file
      try {
        await fs.unlink(backupPath);
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code === 'EACCES' ||
            (error as NodeJS.ErrnoException).code === 'EPERM') {
          throw new BackupError('PERMISSION_DENIED', 'Permission denied when deleting backup');
        }
        throw new BackupError('UNKNOWN', `Failed to delete backup: ${(error as Error).message}`);
      }

      // 4. Return success response
      return {
        success: true,
        message: `Backup ${filename} deleted successfully`
      };

    } catch (error: unknown) {
      if (error instanceof BackupError) {
        throw error;
      }
      throw new BackupError('UNKNOWN', `Failed to delete backup: ${(error as Error).message}`);
    } finally {
      this.operationInProgress = false;
    }
  }

  /**
   * Cleans up old backups (older than 30 days)
   * - Always keeps pre-migration backups (regardless of age)
   * - Always keeps at least 1 backup
   * - Deletes manual and safety backups older than 30 days
   *
   * @returns Response with lists of deleted and kept backups
   */
  async cleanupOldBackups(): Promise<{ success: boolean; deleted: string[]; kept: string[]; count: number }> {
    // Check for concurrent operations
    if (this.operationInProgress) {
      throw new BackupError('OPERATION_IN_PROGRESS', 'Another backup operation is already running');
    }

    this.operationInProgress = true;

    try {
      const deleted: string[] = [];
      const kept: string[] = [];

      // 1. Get all backups
      const allBackups = await this.listBackups();

      if (allBackups.length === 0) {
        return {
          success: true,
          deleted: [],
          kept: [],
          count: 0
        };
      }

      // 2. Separate backups by type and age
      const preMigrationBackups = allBackups.filter(b => b.type === 'pre-migration');
      const deletableBackups = allBackups.filter(b =>
        b.type !== 'pre-migration' && (b.age || 0) > 30
      );
      const recentBackups = allBackups.filter(b =>
        b.type !== 'pre-migration' && (b.age || 0) <= 30
      );

      // 3. Always keep pre-migration backups
      preMigrationBackups.forEach(b => kept.push(b.filename));

      // 4. Always keep recent backups (≤30 days)
      recentBackups.forEach(b => kept.push(b.filename));

      // 5. Check last backup protection
      // Must keep at least 1 backup total
      if (deletableBackups.length > 0 && (kept.length + deletableBackups.length) <= 1) {
        // Only one backup exists and it's old - keep it
        kept.push(deletableBackups[0].filename);
        deletableBackups.splice(0, 1);
      } else if (deletableBackups.length > 0 && kept.length === 0) {
        // All backups are old - keep the newest one
        // Sort by age (ascending - smallest age is newest)
        deletableBackups.sort((a, b) => (a.age || 0) - (b.age || 0));
        kept.push(deletableBackups[0].filename);
        deletableBackups.splice(0, 1);
      }

      // 6. Delete old backups
      for (const backup of deletableBackups) {
        try {
          await fs.unlink(backup.path);
          deleted.push(backup.filename);
        } catch (error: unknown) {
          // Log error but continue with other deletions
          console.error(`Failed to delete backup ${backup.filename}:`, error);
          // Keep track of failed deletions
          kept.push(backup.filename);
        }
      }

      // 7. Log cleanup results
      if (deleted.length > 0) {
        console.log(`Backup cleanup: deleted ${deleted.length} old backup(s), kept ${kept.length}`);
      }

      return {
        success: true,
        deleted,
        kept,
        count: deleted.length
      };

    } catch (error: unknown) {
      console.error('Backup cleanup failed:', error);
      throw new BackupError('UNKNOWN', `Cleanup failed: ${(error as Error).message}`);
    } finally {
      this.operationInProgress = false;
    }
  }

  /**
   * Checks if an operation is in progress
   */
  isOperationInProgress(): boolean {
    return this.operationInProgress;
  }
}
