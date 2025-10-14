/**
 * Type definitions for the Backup & Restore System
 *
 * Based on: specs/004-database-backup-restore/contracts/ipc-backup-api.md
 * Feature: #004
 */

// ==================== Core Types ====================

/**
 * Metadata for a single backup file
 */
export interface BackupMetadata {
  /** Filename (e.g., 'backup_2025-10-14_10-30-00.db') */
  filename: string;

  /** Absolute file path */
  path: string;

  /** File size in bytes */
  size: number;

  /** Creation timestamp (ISO 8601 format) */
  created: string;

  /** Backup type indicator */
  type: BackupType;

  /** Database schema version at time of backup */
  schemaVersion: string;

  /** Whether backup passed integrity verification */
  verified: boolean;

  /** Age in days (calculated, optional) */
  age?: number;
}

/**
 * Backup type classification
 */
export type BackupType =
  | 'manual'         // User-initiated backup
  | 'pre-migration'  // Automatic backup before schema migration
  | 'safety';        // Safety backup before restore operation

// ==================== API Request Types ====================

/**
 * Request to create a manual backup
 */
export interface CreateBackupRequest {
  type: 'manual';
}

/**
 * Request to restore a specific backup
 */
export interface RestoreBackupRequest {
  filename: string;
}

/**
 * Request to delete a specific backup
 */
export interface DeleteBackupRequest {
  filename: string;
}

// ==================== API Response Types ====================

/**
 * Generic API response wrapper
 */
export interface BackupApiResponse<T> {
  success: boolean;
  error?: {
    code: BackupErrorCode;
    message: string;
  };
  data?: T;
}

/**
 * Response from CREATE_BACKUP endpoint
 */
export interface CreateBackupResponse {
  success: boolean;
  backup?: BackupMetadata;
  error?: {
    code: BackupErrorCode;
    message: string;
  };
}

/**
 * Response from GET_BACKUPS endpoint
 */
export interface GetBackupsResponse {
  success: boolean;
  backups?: BackupMetadata[];
  lastBackup?: {
    filename: string;
    created: string;
  } | null;
  error?: {
    code: BackupErrorCode;
    message: string;
  };
}

/**
 * Response from RESTORE_BACKUP endpoint
 */
export interface RestoreBackupResponse {
  success: boolean;
  message?: string;
  safetyBackup?: {
    filename: string;
    path: string;
  };
  error?: {
    code: BackupErrorCode;
    message: string;
  };
}

/**
 * Response from DELETE_BACKUP endpoint
 */
export interface DeleteBackupResponse {
  success: boolean;
  message?: string;
  error?: {
    code: BackupErrorCode;
    message: string;
  };
}

/**
 * Response from CLEANUP_OLD_BACKUPS endpoint
 */
export interface CleanupOldBackupsResponse {
  success: boolean;
  deleted?: string[];
  kept?: string[];
  count?: number;
  error?: {
    code: BackupErrorCode;
    message: string;
  };
}

/**
 * Response from CHECK_BACKUP_STATUS endpoint
 */
export interface CheckBackupStatusResponse {
  operationInProgress: boolean;
  operation: 'backup' | 'restore' | 'cleanup' | null;
  progress?: number; // 0-100
}

// ==================== Error Codes ====================

/**
 * Error codes for backup operations
 */
export type BackupErrorCode =
  | 'INSUFFICIENT_SPACE'         // Not enough disk space
  | 'PERMISSION_DENIED'          // File/directory permission error
  | 'VERIFICATION_FAILED'        // Backup verification failed
  | 'FILE_NOT_FOUND'             // Backup file not found
  | 'SCHEMA_TOO_NEW'             // Backup schema version too new
  | 'INTEGRITY_FAILED'           // Backup file corrupted
  | 'OPERATION_IN_PROGRESS'      // Another operation running
  | 'LAST_BACKUP_PROTECTED'      // Cannot delete last backup
  | 'DIRECTORY_NOT_FOUND'        // Backups directory not found
  | 'NOT_SQLITE_DATABASE'        // File is not a valid SQLite database
  | 'MISSING_MIGRATIONS_TABLE'   // knex_migrations table not found
  | 'NO_MIGRATIONS_FOUND'        // knex_migrations table is empty
  | 'UNKNOWN';                   // Unexpected error

// ==================== IPC Channel Names ====================

/**
 * IPC channel names for backup operations
 */
export const BACKUP_CHANNELS = {
  CREATE_BACKUP: 'backup:create',
  GET_BACKUPS: 'backup:list',
  RESTORE_BACKUP: 'backup:restore',
  DELETE_BACKUP: 'backup:delete',
  CLEANUP_OLD_BACKUPS: 'backup:cleanup',
  CHECK_STATUS: 'backup:status'
} as const;

// ==================== Error Messages ====================

/**
 * User-friendly error messages for each error code
 */
export const BACKUP_ERROR_MESSAGES: Record<BackupErrorCode, string> = {
  INSUFFICIENT_SPACE: 'Not enough disk space for backup. Please free up space and try again.',
  PERMISSION_DENIED: 'Cannot access backup directory. Please check file permissions.',
  VERIFICATION_FAILED: 'Backup verification failed. The backup may be corrupted.',
  FILE_NOT_FOUND: 'Backup file not found. It may have been deleted.',
  SCHEMA_TOO_NEW: 'Cannot restore backup from newer version. Please update the app first.',
  INTEGRITY_FAILED: 'Backup file is corrupted and cannot be restored.',
  OPERATION_IN_PROGRESS: 'Another backup/restore operation is already running. Please wait.',
  LAST_BACKUP_PROTECTED: 'Cannot delete the last remaining backup for safety.',
  DIRECTORY_NOT_FOUND: 'Backups directory not found.',
  NOT_SQLITE_DATABASE: 'File is not a valid SQLite database.',
  MISSING_MIGRATIONS_TABLE: 'Backup does not contain migration history table.',
  NO_MIGRATIONS_FOUND: 'Backup has no recorded migrations.',
  UNKNOWN: 'An unexpected error occurred. Please try again.'
};
