# Data Model: Database Backup & Restore System

**Feature**: 004-database-backup-restore
**Date**: 2025-10-14

## Overview

This feature primarily deals with file-based backups rather than database-stored metadata. However, we may optionally track backup metadata in the database for UI display and management.

## Entities

### BackupFile (File System Entity)

**Purpose**: Physical SQLite database backup stored in `backups/` directory

**Location**: `backups/backup_YYYY-MM-DD_HH-MM-SS.db`

**Attributes**:
- `filename`: String (e.g., `backup_2025-10-14_10-30-00.db`)
- `path`: String (absolute path to backup file)
- `size`: Number (bytes)
- `created`: Date (file creation timestamp from filesystem)
- `type`: Enum (`'manual'`, `'pre-migration'`, `'safety'`)

**Derived Attributes**:
- `age`: Number (days since creation, calculated)
- `isOld`: Boolean (age > 30 days, calculated)
- `schemaVersion`: String (read from backup's knex_migrations table)

**Lifecycle**:
1. Created via backup operation
2. Exists on filesystem until deleted
3. Deleted via manual action or auto-cleanup

---

### BackupMetadata (Optional - In-Memory Only)

**Purpose**: Runtime metadata for UI display, not persisted to database

**Why Not Persisted**:
- Backups are self-contained SQLite files
- Metadata can be read from filesystem + backup file on demand
- Avoids sync issues between metadata DB and actual files
- Simpler: filesystem is source of truth

**Attributes** (constructed on-demand):
```typescript
interface BackupMetadata {
  filename: string;
  path: string;
  size: number;
  created: Date;
  type: 'manual' | 'pre-migration' | 'safety';
  schemaVersion: string;
  verified: boolean;
}
```

**How Constructed**:
1. Scan `backups/` directory for `*.db` files
2. Read filesystem metadata (size, created date)
3. Parse filename for timestamp and type
4. Open backup DB (read-only) to get schema version from `knex_migrations`

---

## Relationships

### Backup ↔ Schema Version

Each backup is associated with a specific database schema version (from `knex_migrations` table).

```
Backup                  Schema Version
┌────────────────────┐  ┌──────────────────┐
│ backup_*.db        │  │ knex_migrations  │
│ - schemaVersion    │──│ - version        │
└────────────────────┘  │ - name           │
                        └──────────────────┘
```

**Usage**: Check compatibility before restore (FR-015)

---

## File Naming Convention

### Standard Backups
```
backup_YYYY-MM-DD_HH-MM-SS.db
```

Example: `backup_2025-10-14_10-30-15.db`

### Pre-Migration Backups
```
backup_YYYY-MM-DD_HH-MM-SS_pre-migration.db
```

Example: `backup_2025-10-14_10-30-15_pre-migration.db`

### Safety Backups (before restore)
```
safety_backup_YYYY-MM-DD_HH-MM-SS.db
```

Example: `safety_backup_2025-10-14_10-35-00.db`

**Rationale**: Filename encodes type and timestamp, enabling sorting and filtering without reading file contents.

---

## Database Schema Changes

**No new tables required**. This feature operates on:

1. **Existing `knex_migrations` table** (already present):
   - Read schema version for compatibility checks
   - Used in backup verification

2. **Filesystem** (`backups/` directory):
   - Stores backup files
   - Metadata derived from filesystem + file contents

---

## State Transitions

### Backup Lifecycle

```
┌─────────────────┐
│   Not Exists    │
└────────┬────────┘
         │ createBackup()
         ▼
┌─────────────────┐
│   Creating      │ (atomic operation)
└────────┬────────┘
         │ success
         ▼
┌─────────────────┐
│   Verifying     │ (integrity check)
└────────┬────────┘
         │ valid
         ▼
┌─────────────────┐
│    Available    │ ◄────────────┐
└────────┬────────┘              │
         │                       │
         │ (time passes)         │ restore()
         ▼                       │
┌─────────────────┐              │
│   Old (>30d)    │              │
└────────┬────────┘              │
         │                       │
         │ auto-cleanup          │
         │ OR manual delete      │
         ▼                       │
┌─────────────────┐              │
│    Deleted      │              │
└─────────────────┘              │
                                 │
         ┌───────────────────────┘
         │
         ▼
┌─────────────────┐
│   Restoring     │ (atomic operation)
└────────┬────────┘
         │ success
         ▼
┌─────────────────┐
│ App Restarting  │
└─────────────────┘
```

---

## Validation Rules

### Backup Creation
- **Filename uniqueness**: Timestamp ensures uniqueness
- **Disk space**: Must have 2x current DB size available
- **Directory exists**: `backups/` must exist (create if needed)
- **Write permissions**: User must have write access to `backups/`

### Backup Restoration
- **File exists**: Backup file must exist on filesystem
- **File readable**: User must have read access
- **Schema compatibility**: Backup schema version ≤ current version (FR-015)
- **Integrity valid**: `PRAGMA integrity_check` must pass (FR-028)

### Backup Deletion
- **Not last backup**: Cannot delete if only backup remaining (FR-020)
- **User confirmation**: Required for manual deletion (FR-023)
- **File permissions**: User must have delete access

---

## Data Flow

### Manual Backup Creation
```
User clicks "Create Backup"
    ↓
Check disk space
    ↓
Generate filename (timestamp)
    ↓
Call better-sqlite3 .backup()
    ↓
Verify backup integrity
    ↓
Update UI (show new backup in list)
```

### Automatic Pre-Migration Backup
```
App starts → Detects pending migrations
    ↓
Check disk space
    ↓
Generate filename (_pre-migration suffix)
    ↓
Call .backup()
    ↓
Verify backup integrity
    ↓
If SUCCESS: Proceed with migration
If FAILURE: Block migration, show error (FR-007)
```

### Backup Restoration
```
User selects backup → Clicks "Restore"
    ↓
Check schema compatibility (FR-015)
    ↓
Show confirmation dialog (FR-014)
    ↓
User confirms
    ↓
Create safety backup (FR-018)
    ↓
Verify safety backup
    ↓
Close current DB connection
    ↓
Replace DB file with backup
    ↓
Restart app (FR-017)
```

### Automatic Cleanup
```
App starts
    ↓
Scan backups/ directory
    ↓
Filter: age > 30 days
    ↓
Exclude: pre-migration backups (FR-024)
    ↓
Ensure at least 1 backup remains (FR-020)
    ↓
Delete old backups (no confirmation for auto-cleanup)
```

---

## Performance Considerations

### Backup List Loading
- **Scan directory**: Fast (~10-50ms for 10-50 files)
- **Read metadata**: ~1-5ms per file (filesystem only)
- **Get schema version**: ~10-20ms per file (open DB read-only)
- **Total for 20 backups**: ~200-500ms (acceptable for UI)

**Optimization**: Cache backup list, refresh only when needed (after backup/delete operations)

### Backup Creation
- **1 MB DB**: ~100-200ms
- **10 MB DB**: ~500ms-1s
- **50 MB DB**: ~2-5s
- **100 MB DB**: ~5-10s

**UI Strategy**: Show progress indicator, non-blocking operation

### Backup Restoration
- **Operation time**: Similar to backup creation
- **Blocking**: Yes - app restarts after completion
- **User feedback**: Progress dialog "Restoring... Please wait"

---

## Error Scenarios & Handling

| Scenario | Detection | Handling |
|----------|-----------|----------|
| Disk full during backup | `better-sqlite3` throws error | Show error, suggest freeing space |
| Corrupted backup | `PRAGMA integrity_check` fails | Refuse restore, offer to delete |
| Permission denied | `fs` throws EACCES | Show error with path, suggest admin rights |
| Backup file missing | `fs.stat()` returns ENOENT | Remove from UI list, log warning |
| Schema too new | Version comparison | Block restore, show error message (FR-015) |
| Concurrent operation | Operation lock check | Block second op, show "in progress" error (FR-026) |
| Restore fails mid-process | Try-catch around restore | Restore from safety backup (FR-029) |

---

## Summary

- **Primary storage**: Filesystem (`backups/` directory)
- **Metadata**: Derived on-demand from filesystem + backup file contents
- **No new database tables**: Uses existing `knex_migrations` for version info
- **Validation**: Disk space, schema compatibility, integrity checks
- **Performance**: <5s backup, <10s restore for typical DB sizes

This simple file-based approach avoids metadata sync issues and keeps implementation straightforward.
