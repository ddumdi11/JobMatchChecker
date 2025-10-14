/**
 * BackupVerifier - Validates SQLite backup files
 *
 * Feature: #004 Database Backup & Restore
 * Task: T012
 *
 * Responsibilities:
 * - Verify backup file integrity using SQLite's PRAGMA integrity_check
 * - Validate that backup contains required schema (knex_migrations table)
 * - Extract schema version from backup metadata
 * - Detect corrupted or invalid backup files
 * - Provide detailed error information for failed verifications
 */

import Database from 'better-sqlite3';
import * as fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import * as path from 'node:path';
import type { BackupErrorCode } from '../../types/backup';

/**
 * Result of backup verification
 */
export interface VerificationResult {
  isValid: boolean;
  errors: BackupErrorCode[];
  schemaVersion?: string;
  tablesFound?: string[];
  integrityCheckPassed?: boolean;
}

/**
 * BackupVerifier class - validates SQLite backup files
 */
export class BackupVerifier {
  /**
   * Verifies a backup file
   *
   * @param backupPath - Absolute path to the backup file
   * @returns Verification result with details
   */
  static async verifyBackup(backupPath: string): Promise<VerificationResult> {
    const result: VerificationResult = {
      isValid: true,
      errors: [],
      tablesFound: [],
      integrityCheckPassed: false
    };

    let db: Database.Database | null = null;

    try {
      // 1. Check if file exists
      try {
        await fs.access(backupPath, fsConstants.R_OK);
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          result.isValid = false;
          result.errors.push('FILE_NOT_FOUND');
          return result;
        } else if ((error as NodeJS.ErrnoException).code === 'EACCES') {
          result.isValid = false;
          result.errors.push('PERMISSION_DENIED');
          return result;
        }
        throw error;
      }

      // 2. Check if file has SQLite header
      const isLikelySqlite = await BackupVerifier.isLikelySqliteFile(backupPath);
      if (!isLikelySqlite) {
        result.isValid = false;
        result.errors.push('NOT_SQLITE_DATABASE');
        return result;
      }

      // 3. Try to open database in read-only mode
      try {
        db = new Database(backupPath, { readonly: true, fileMustExist: true });
      } catch (error: unknown) {
        const errorMessage = (error as Error).message?.toLowerCase() || '';
        if (errorMessage.includes('not a database') || errorMessage.includes('file is not a database')) {
          result.isValid = false;
          result.errors.push('NOT_SQLITE_DATABASE');
          return result;
        }
        // If database can't be opened, it's likely corrupted
        result.isValid = false;
        result.errors.push('INTEGRITY_FAILED');
        return result;
      }

      // 4. Run SQLite integrity check
      try {
        const integrityResult = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
        result.integrityCheckPassed = integrityResult.integrity_check === 'ok';

        if (!result.integrityCheckPassed) {
          result.isValid = false;
          result.errors.push('INTEGRITY_FAILED');
        }
      } catch (error) {
        result.isValid = false;
        result.errors.push('INTEGRITY_FAILED');
        result.integrityCheckPassed = false;
      }

      // 5. Get list of tables
      try {
        const tables = db
          .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
          .all() as { name: string }[];

        result.tablesFound = tables.map((t) => t.name);
      } catch (error) {
        // If we can't read tables, database is corrupted
        result.isValid = false;
        result.errors.push('INTEGRITY_FAILED');
        return result;
      }

      // 6. Check for knex_migrations table
      if (!result.tablesFound.includes('knex_migrations')) {
        result.isValid = false;
        result.errors.push('MISSING_MIGRATIONS_TABLE');
      }

      // 7. Extract schema version from knex_migrations
      if (result.tablesFound.includes('knex_migrations')) {
        try {
          const migration = db
            .prepare('SELECT name FROM knex_migrations ORDER BY id DESC LIMIT 1')
            .get() as { name: string } | undefined;

          if (!migration) {
            result.isValid = false;
            result.errors.push('NO_MIGRATIONS_FOUND');
          } else {
            result.schemaVersion = migration.name;
          }
        } catch (error) {
          result.isValid = false;
          result.errors.push('INTEGRITY_FAILED');
        }
      }

      return result;
    } catch (error: unknown) {
      // Unexpected error during verification
      const errorCode = (error as NodeJS.ErrnoException).code;

      if (errorCode === 'EACCES' || errorCode === 'EPERM') {
        result.isValid = false;
        result.errors.push('PERMISSION_DENIED');
      } else {
        result.isValid = false;
        result.errors.push('UNKNOWN');
      }

      return result;
    } finally {
      // Always close database connection
      if (db) {
        try {
          db.close();
        } catch {
          // Ignore errors when closing
        }
      }
    }
  }

  /**
   * Quick check if a file appears to be a valid SQLite database
   * (checks file header without full verification)
   *
   * @param filePath - Path to check
   * @returns true if file starts with SQLite magic bytes
   */
  static async isLikelySqliteFile(filePath: string): Promise<boolean> {
    try {
      const fileHandle = await fs.open(filePath, 'r');
      const buffer = Buffer.alloc(16);
      await fileHandle.read(buffer, 0, 16, 0);
      await fileHandle.close();

      // SQLite files start with "SQLite format 3\0"
      const sqliteHeader = 'SQLite format 3\0';
      return buffer.toString('utf8', 0, 16) === sqliteHeader;
    } catch {
      return false;
    }
  }
}
