# IPC API Contract: Backup & Restore

**Feature**: 004-database-backup-restore
**Protocol**: Electron IPC (ipcMain ↔ ipcRenderer)
**Date**: 2025-10-14

## Overview

This document defines the IPC communication contract between the renderer process (UI) and main process (backup logic) for the backup and restore feature.

---

## API Endpoints

### 1. CREATE_BACKUP

**Purpose**: Create a manual backup of the current database

**Direction**: Renderer → Main → Renderer

**Request**:
```typescript
{
  type: 'manual' // Always manual for user-initiated backups
}
```

**Response (Success)**:
```typescript
{
  success: true,
  backup: {
    filename: 'backup_2025-10-14_10-30-00.db',
    path: '/absolute/path/to/backups/backup_2025-10-14_10-30-00.db',
    size: 15728640, // bytes
    created: '2025-10-14T10:30:00.000Z', // ISO 8601
    type: 'manual',
    schemaVersion: '20251002000001',
    verified: true
  }
}
```

**Response (Error)**:
```typescript
{
  success: false,
  error: {
    code: 'INSUFFICIENT_SPACE' | 'PERMISSION_DENIED' | 'VERIFICATION_FAILED' | 'UNKNOWN',
    message: 'Insufficient disk space. Required: 30 MB, Available: 10 MB'
  }
}
```

**Functional Requirements**: FR-002, FR-003, FR-004, FR-005, FR-006

**Test Scenarios**:
- ✅ Happy path: Backup created and verified
- ❌ Disk full error
- ❌ Permission denied
- ❌ Verification fails

---

### 2. GET_BACKUPS

**Purpose**: List all available backups

**Direction**: Renderer → Main → Renderer

**Request**: No payload

**Response (Success)**:
```typescript
{
  success: true,
  backups: [
    {
      filename: 'backup_2025-10-14_10-30-00.db',
      path: '/absolute/path/to/backups/backup_2025-10-14_10-30-00.db',
      size: 15728640,
      created: '2025-10-14T10:30:00.000Z',
      type: 'manual',
      schemaVersion: '20251002000001',
      verified: true,
      age: 0 // days
    },
    {
      filename: 'backup_2025-10-13_09-15-30_pre-migration.db',
      path: '/absolute/path/to/backups/backup_2025-10-13_09-15-30_pre-migration.db',
      size: 15680000,
      created: '2025-10-13T09:15:30.000Z',
      type: 'pre-migration',
      schemaVersion: '20251001000001',
      verified: true,
      age: 1
    }
  ],
  lastBackup: {
    // Most recent backup (or null if none exist)
    filename: 'backup_2025-10-14_10-30-00.db',
    created: '2025-10-14T10:30:00.000Z'
  }
}
```

**Response (Error)**:
```typescript
{
  success: false,
  error: {
    code: 'DIRECTORY_NOT_FOUND' | 'PERMISSION_DENIED' | 'UNKNOWN',
    message: 'Backups directory not accessible'
  }
}
```

**Functional Requirements**: FR-008, FR-009, FR-010, FR-011, FR-012

**Test Scenarios**:
- ✅ No backups exist (empty array)
- ✅ Multiple backups returned sorted by date
- ✅ Old backups (>30d) flagged
- ❌ Directory permission error

---

### 3. RESTORE_BACKUP

**Purpose**: Restore a backup and restart the application

**Direction**: Renderer → Main → Renderer

**Request**:
```typescript
{
  filename: 'backup_2025-10-13_09-15-30_pre-migration.db'
}
```

**Response (Success)**:
```typescript
{
  success: true,
  message: 'Backup restored successfully. Application will restart...',
  safetyBackup: {
    filename: 'safety_backup_2025-10-14_10-35-00.db',
    path: '/absolute/path/to/backups/safety_backup_2025-10-14_10-35-00.db'
  }
}
```

**Note**: App restarts immediately after this response (FR-017)

**Response (Error)**:
```typescript
{
  success: false,
  error: {
    code: 'FILE_NOT_FOUND' | 'SCHEMA_TOO_NEW' | 'INTEGRITY_FAILED' | 'OPERATION_IN_PROGRESS' | 'UNKNOWN',
    message: 'Cannot restore: backup schema version (20251010000001) is newer than current (20251002000001)'
  }
}
```

**Functional Requirements**: FR-013, FR-014, FR-015, FR-017, FR-018, FR-026, FR-028, FR-029

**Test Scenarios**:
- ✅ Happy path: Restore succeeds, app restarts
- ❌ Backup file not found
- ❌ Schema too new (blocked)
- ❌ Integrity check fails (corrupted file)
- ❌ Another operation in progress

---

### 4. DELETE_BACKUP

**Purpose**: Delete a specific backup file

**Direction**: Renderer → Main → Renderer

**Request**:
```typescript
{
  filename: 'backup_2025-10-01_08-00-00.db'
}
```

**Response (Success)**:
```typescript
{
  success: true,
  message: 'Backup deleted successfully'
}
```

**Response (Error)**:
```typescript
{
  success: false,
  error: {
    code: 'FILE_NOT_FOUND' | 'LAST_BACKUP_PROTECTED' | 'PERMISSION_DENIED' | 'UNKNOWN',
    message: 'Cannot delete the last remaining backup'
  }
}
```

**Functional Requirements**: FR-020, FR-021, FR-023

**Test Scenarios**:
- ✅ Happy path: Backup deleted
- ❌ Trying to delete last backup (blocked)
- ❌ File doesn't exist
- ❌ Permission denied

---

### 5. CLEANUP_OLD_BACKUPS

**Purpose**: Manually trigger cleanup of backups older than 30 days

**Direction**: Renderer → Main → Renderer

**Request**: No payload

**Response (Success)**:
```typescript
{
  success: true,
  deleted: [
    'backup_2025-09-01_10-00-00.db',
    'backup_2025-09-05_14-30-00.db'
  ],
  kept: [
    'backup_2025-10-14_10-30-00_pre-migration.db' // Migration backups kept
  ],
  count: 2 // Number of backups deleted
}
```

**Response (Error)**:
```typescript
{
  success: false,
  error: {
    code: 'PERMISSION_DENIED' | 'UNKNOWN',
    message: 'Failed to delete some backups'
  }
}
```

**Functional Requirements**: FR-019, FR-020, FR-022, FR-023, FR-024

**Test Scenarios**:
- ✅ No old backups (nothing deleted)
- ✅ Some old backups deleted, migration backups kept
- ✅ At least 1 backup always kept
- ❌ Permission errors

---

### 6. CHECK_BACKUP_STATUS

**Purpose**: Check if a backup/restore operation is currently running

**Direction**: Renderer → Main → Renderer

**Request**: No payload

**Response**:
```typescript
{
  operationInProgress: boolean,
  operation: 'backup' | 'restore' | 'cleanup' | null,
  progress?: number // 0-100 (optional, if available)
}
```

**Functional Requirements**: FR-026

**Test Scenarios**:
- ✅ No operation running (operationInProgress: false)
- ✅ Backup in progress
- ✅ Restore in progress

---

## Type Definitions

```typescript
// Shared types between main and renderer

export interface BackupMetadata {
  filename: string;
  path: string;
  size: number; // bytes
  created: string; // ISO 8601
  type: 'manual' | 'pre-migration' | 'safety';
  schemaVersion: string;
  verified: boolean;
  age?: number; // days (calculated)
}

export interface BackupApiResponse<T> {
  success: boolean;
  error?: {
    code: string;
    message: string;
  };
  data?: T;
}

export interface CreateBackupRequest {
  type: 'manual';
}

export interface RestoreBackupRequest {
  filename: string;
}

export interface DeleteBackupRequest {
  filename: string;
}

export type BackupErrorCode =
  | 'INSUFFICIENT_SPACE'
  | 'PERMISSION_DENIED'
  | 'VERIFICATION_FAILED'
  | 'FILE_NOT_FOUND'
  | 'SCHEMA_TOO_NEW'
  | 'INTEGRITY_FAILED'
  | 'OPERATION_IN_PROGRESS'
  | 'LAST_BACKUP_PROTECTED'
  | 'DIRECTORY_NOT_FOUND'
  | 'UNKNOWN';
```

---

## IPC Channel Names

```typescript
// Main process (ipcMain)
export const BACKUP_CHANNELS = {
  CREATE_BACKUP: 'backup:create',
  GET_BACKUPS: 'backup:list',
  RESTORE_BACKUP: 'backup:restore',
  DELETE_BACKUP: 'backup:delete',
  CLEANUP_OLD_BACKUPS: 'backup:cleanup',
  CHECK_STATUS: 'backup:status'
} as const;
```

---

## Error Codes & User Messages

| Code | User-Friendly Message |
|------|----------------------|
| `INSUFFICIENT_SPACE` | Not enough disk space for backup. Please free up space and try again. |
| `PERMISSION_DENIED` | Cannot access backup directory. Please check file permissions. |
| `VERIFICATION_FAILED` | Backup verification failed. The backup may be corrupted. |
| `FILE_NOT_FOUND` | Backup file not found. It may have been deleted. |
| `SCHEMA_TOO_NEW` | Cannot restore backup from newer version. Please update the app first. |
| `INTEGRITY_FAILED` | Backup file is corrupted and cannot be restored. |
| `OPERATION_IN_PROGRESS` | Another backup/restore operation is already running. Please wait. |
| `LAST_BACKUP_PROTECTED` | Cannot delete the last remaining backup for safety. |
| `DIRECTORY_NOT_FOUND` | Backups directory not found. |
| `UNKNOWN` | An unexpected error occurred. Please try again. |

---

## Security Considerations

- **Path validation**: All file paths must be validated to prevent directory traversal
- **Filename sanitization**: Backup filenames from user input must be sanitized
- **Permission checks**: Verify read/write permissions before operations
- **Operation locking**: Prevent concurrent backup/restore operations (FR-026)

---

## Performance Targets

- **CREATE_BACKUP**: <5 seconds for 50MB DB
- **GET_BACKUPS**: <500ms for 20 backups
- **RESTORE_BACKUP**: <10 seconds for 50MB DB
- **DELETE_BACKUP**: <100ms
- **CLEANUP_OLD_BACKUPS**: <1 second for 10 old backups
- **CHECK_STATUS**: <10ms

---

## Versioning

**API Version**: 1.0.0

Future versions may add:
- Progress callbacks for long operations
- Backup compression
- Backup encryption
- Cloud sync integration

Changes will be backward compatible or require major version bump.
