# Research: Database Backup & Restore System

**Feature**: 004-database-backup-restore
**Date**: 2025-10-14
**Status**: Complete

## Research Findings

### 1. better-sqlite3 Backup API

**Decision**: Use `Database.backup()` method for atomic SQLite backups

**Rationale**:
- Atomic operation - backup is consistent snapshot
- Native SQLite backup API (VACUUM INTO equivalent)
- Handles concurrent connections correctly
- Better than manual file copy (avoids corruption)

**API Usage**:
```typescript
const source = new Database('data/jobmatcher.db');
const destination = 'backups/backup_2025-10-14_10-30-00.db';

// Synchronous backup (blocks main process ~1-5 seconds)
source.backup(destination);

// With progress callback (optional)
source.backup(destination, {
  progress({ totalPages, remainingPages }) {
    console.log(`Backup progress: ${totalPages - remainingPages}/${totalPages}`);
  }
});
```

**Error Handling**:
- Throws on disk full, permission errors
- Wrap in try-catch, show user-friendly error
- No partial backup files created on failure

**Alternatives Considered**:
- ❌ `fs.copyFile()` - Not atomic, can corrupt if DB in use
- ❌ SQL dump - Slower, larger files, requires parsing on restore
- ✅ `.backup()` API - Fast, atomic, native

---

### 2. Knex Migration Hook Integration

**Decision**: Hook into Knex `before:migrate` event (if available) or wrap migration call

**Rationale**:
- Need to run backup BEFORE migration starts
- Must block migration if backup fails
- Preserve existing migration behavior

**Implementation Approach**:

Option A: Wrap migration call in `src/main/database/db.ts`:
```typescript
export async function runMigrations() {
  try {
    // 1. Create pre-migration backup
    const backupPath = await createBackup('pre-migration');

    // 2. Verify backup
    await verifyBackup(backupPath);

    // 3. Run migrations
    await knex.migrate.latest();

    return { success: true, backup: backupPath };
  } catch (error) {
    // Migration blocked - show error to user
    throw new Error(`Migration failed: ${error.message}`);
  }
}
```

Option B: Knex hooks (if supported):
```typescript
knex.on('before:migrate', async () => {
  await createBackup('pre-migration');
});
```

**Decision**: Use Option A (wrapper approach)
- More control over error handling
- Works with all Knex versions
- Clearer error messages to user

**Testing Strategy**:
- Mock backup failure → verify migration blocked
- Successful backup → verify migration proceeds
- Integration test with real migration

**Alternatives Considered**:
- ❌ Post-migration backup - Too late, data already changed
- ❌ Manual backup reminder - Users will forget
- ✅ Automatic pre-migration - Enforces constitutional requirement

---

### 3. Electron App Restart Strategy

**Decision**: Use `app.relaunch()` + `app.exit()` sequence

**Rationale**:
- Official Electron API for app restart
- Preserves command-line arguments
- Works cross-platform (Windows/macOS/Linux)

**Implementation**:
```typescript
import { app } from 'electron';

export async function restartApp() {
  // 1. Save any pending state (not needed for restore)
  // 2. Relaunch app
  app.relaunch();
  // 3. Quit current instance
  app.exit(0);
}
```

**User Experience**:
1. User clicks "Restore" button
2. Safety backup created
3. Restore operation runs
4. Dialog: "Restore complete. App will restart..."
5. App restarts automatically
6. Restored data is active

**Edge Cases**:
- What if user has unsaved changes? → Restore is Settings-only, no unsaved data
- What if restart fails? → User can manually restart, restored DB is already in place

**Alternatives Considered**:
- ❌ Require manual restart - Bad UX
- ❌ Hot-reload database connection - Complex, risky
- ✅ Automatic restart - Clean, simple, expected behavior

---

### 4. File System Operations in Electron

**Decision**: Use Node.js `fs.promises` for async operations, sync for critical paths

**Rationale**:
- Async for backup creation (non-blocking UI)
- Sync for restore (operation must complete atomically)
- `fs-extra` for convenience methods (ensureDir, etc.)

**Patterns**:

**Disk Space Check**:
```typescript
import { statfs } from 'fs';
import { promisify } from 'util';

const statfsAsync = promisify(statfs);

async function checkDiskSpace(path: string): Promise<number> {
  const stats = await statfsAsync(path);
  return stats.bavail * stats.bsize; // Available bytes
}

// Require 2x current DB size
const dbSize = (await fs.stat('data/jobmatcher.db')).size;
const available = await checkDiskSpace('backups/');
if (available < dbSize * 2) {
  throw new Error('Insufficient disk space');
}
```

**Atomic File Operations** (temp + rename pattern):
```typescript
async function atomicWrite(dest: string, data: Buffer) {
  const temp = `${dest}.tmp`;
  await fs.writeFile(temp, data);
  await fs.rename(temp, dest); // Atomic on same filesystem
}
```

**Directory Initialization**:
```typescript
import fs from 'fs-extra';

await fs.ensureDir('backups/'); // Creates if not exists
```

**Cross-Platform Paths**:
```typescript
import path from 'path';

const backupPath = path.join(app.getPath('userData'), '..', '..', 'backups');
// Or relative to app root for packaged app
```

**Alternatives Considered**:
- ❌ All sync operations - Blocks UI thread
- ❌ All async - Restore needs atomicity
- ✅ Mixed approach - Best of both

---

### 5. Backup Verification Strategy

**Decision**: Open backup in read-only mode, run PRAGMA integrity_check

**Rationale**:
- Fast (~100-500ms for typical DB)
- Detects corruption
- Does not modify backup
- SQLite built-in feature

**Implementation**:
```typescript
import Database from 'better-sqlite3';

export async function verifyBackup(backupPath: string): Promise<boolean> {
  let db: Database.Database | null = null;

  try {
    // Open in read-only mode
    db = new Database(backupPath, { readonly: true });

    // Run integrity check
    const result = db.pragma('integrity_check');

    // Result is array: [{ integrity_check: 'ok' }] if valid
    const isValid = result[0]?.integrity_check === 'ok';

    if (!isValid) {
      throw new Error('Backup integrity check failed');
    }

    // Optional: Check that main tables exist
    const tables = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `).all();

    const requiredTables = ['user_profile', 'user_preferences', 'skills', 'knex_migrations'];
    const missingTables = requiredTables.filter(
      t => !tables.some(row => row.name === t)
    );

    if (missingTables.length > 0) {
      throw new Error(`Missing tables: ${missingTables.join(', ')}`);
    }

    return true;
  } catch (error) {
    console.error('Backup verification failed:', error);
    throw new Error(`Backup verification failed: ${error.message}`);
  } finally {
    if (db) db.close();
  }
}
```

**Performance**:
- `PRAGMA integrity_check`: ~100-500ms for 1-100MB DB
- Table existence check: ~10ms
- Total verification time: <1 second

**Alternatives Considered**:
- ❌ No verification - Risky, backup might be corrupt
- ❌ Full table scan - Too slow (seconds/minutes)
- ❌ File size check only - Doesn't detect corruption
- ✅ integrity_check + table check - Fast and thorough

---

## Pragmatic Decisions (Clarifications Resolved)

### FR-015: Schema Version Compatibility

**Decision**: Block restore if backup schema > current schema

**Implementation**:
```typescript
// Get schema version from knex_migrations table
const backupVersion = getSchemaVersion(backupPath);
const currentVersion = getSchemaVersion(currentDbPath);

if (backupVersion > currentVersion) {
  throw new Error(
    `Cannot restore backup from newer version (backup: ${backupVersion}, current: ${currentVersion})`
  );
}
```

**Rationale**: Prevents data loss from schema incompatibility

---

### FR-016: Cancel In-Progress Restore

**Decision**: No cancel button - restore is atomic and fast

**Implementation**: Show non-dismissible progress dialog "Restoring backup... Please wait."

**Rationale**:
- Restore is <10 seconds
- Canceling mid-restore leaves DB corrupt
- Simpler implementation

---

### FR-024: Migration Backup Retention

**Decision**: Exclude migration backups from 30-day auto-cleanup

**Implementation**:
```typescript
interface BackupMetadata {
  type: 'manual' | 'pre-migration' | 'safety';
  // ...
}

// In cleanup logic
const backupsToDelete = allBackups.filter(b =>
  b.age > 30 &&
  b.type !== 'pre-migration' && // Keep migration backups
  !isNewestBackup(b) // Always keep at least 1
);
```

**Rationale**: Migration backups are critical for rollback, typically few in number

---

### FR-027: Disk Space Handling

**Decision**: Check available space before backup; require 2x DB size

**Implementation**: See "Disk Space Check" in section 4 above

**Rationale**: Simple heuristic, prevents most failures

---

### FR-029: Restore Failure Recovery

**Decision**: Restore from safety backup automatically

**Implementation**:
```typescript
async function restoreBackup(backupPath: string) {
  const safetyPath = await createSafetyBackup();

  try {
    await doRestore(backupPath);
  } catch (error) {
    console.error('Restore failed, restoring from safety backup:', error);
    await doRestore(safetyPath);
    throw new Error(`Restore failed. Recovered using safety backup. Error: ${error.message}`);
  }
}
```

**Rationale**: Safety backup (FR-018) provides automatic recovery

---

## Summary

All technical unknowns resolved. Ready for Phase 1 (Design & Contracts).

**Key Technologies**:
- better-sqlite3 `.backup()` API
- Knex migration wrapper
- Electron `app.relaunch()` / `app.exit()`
- Node.js `fs.promises` + `fs-extra`
- SQLite `PRAGMA integrity_check`

**Key Patterns**:
- Atomic backup operations
- Pre-migration hooks
- Automatic app restart
- Disk space validation
- Backup verification

**Next Steps**: Generate data model, API contracts, and quickstart tests
