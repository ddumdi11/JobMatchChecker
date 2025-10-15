# Quickstart Tests: Database Backup & Restore

**Feature**: 004-database-backup-restore
**Date**: 2025-10-14
**Purpose**: Manual test scenarios to validate feature functionality

## Prerequisites

- App installed and database initialized
- Some test data in database (profile, skills, preferences)
- At least 100MB free disk space

---

## Test Scenario 1: Manual Backup Creation

**Goal**: Verify user can manually create a backup from Settings

### Steps

1. Launch the application
2. Navigate to Settings page
3. Locate "Backup & Restore" section
4. Click "Create Backup" button
5. Wait for backup creation
6. Observe success message

### Expected Results

- ✅ Backup button is visible and enabled
- ✅ Progress indicator appears during backup
- ✅ Success message displays: "Backup created: backup_YYYY-MM-DD_HH-MM-SS.db"
- ✅ "Last Backup" timestamp updates to current time
- ✅ New backup appears in backup list
- ✅ Backup file exists in `backups/` directory
- ✅ Backup file size > 0 bytes
- ✅ Backup operation completes in <5 seconds

### Validation

```bash
# Check backup file exists
ls -lh backups/backup_*.db

# Check backup is valid SQLite database
sqlite3 backups/backup_2025-10-14_*.db "PRAGMA integrity_check;"
# Expected output: ok

# Check tables exist in backup
sqlite3 backups/backup_2025-10-14_*.db ".tables"
# Expected: user_profile, user_preferences, skills, knex_migrations, etc.
```

**Acceptance Criteria**: FR-002, FR-003, FR-004, FR-005, FR-006

---

## Test Scenario 2: View Backup List

**Goal**: Verify backup list displays correctly with all details

### Steps

1. Ensure multiple backups exist (create 2-3 manual backups)
2. Navigate to Settings > Backup Management
3. Observe backup list

### Expected Results

- ✅ All backups are listed
- ✅ Each backup shows:
  - Filename
  - Creation date/time
  - File size (human-readable, e.g., "15 MB")
  - Type badge ("Manual", "Pre-Migration", or "Safety")
- ✅ Backups are sorted by date (newest first)
- ✅ "Last Backup" indicator shows most recent backup timestamp
- ✅ Backups older than 30 days are highlighted/marked

### Validation

```bash
# Verify backup count matches UI
ls -1 backups/*.db | wc -l
```

**Acceptance Criteria**: FR-008, FR-009, FR-010, FR-011, FR-012

---

## Test Scenario 3: Restore from Backup

**Goal**: Verify restore functionality works and app restarts

### Preparation

1. Note current data (e.g., profile name)
2. Create a backup ("Backup A")
3. Modify data (e.g., change profile name)
4. Note modified data

### Steps

1. Navigate to Settings > Backup Management
2. Select "Backup A" from list
3. Click "Restore" button
4. Read confirmation dialog carefully
5. Click "Confirm Restore"
6. Wait for restore operation
7. App should restart automatically

### Expected Results

- ✅ Confirmation dialog appears with warning: "Current data will be overwritten"
- ✅ Dialog shows backup details (date, size)
- ✅ Progress message: "Creating safety backup..."
- ✅ Progress message: "Restoring backup..."
- ✅ App restarts automatically
- ✅ After restart, data matches "Backup A" state (original data restored)
- ✅ Safety backup created: `safety_backup_YYYY-MM-DD_HH-MM-SS.db`
- ✅ Total restore time <10 seconds

### Validation

```bash
# Check safety backup was created
ls -t backups/safety_backup_*.db | head -1

# Verify data was restored (check modification time of main DB)
ls -lh data/jobmatcher.db
```

**Acceptance Criteria**: FR-013, FR-014, FR-017, FR-018

---

## Test Scenario 4: Automatic Pre-Migration Backup

**Goal**: Verify backup is created automatically before migrations

### Preparation

1. Create a new migration file (or trigger existing pending migration)
2. Ensure app is NOT running

### Steps

1. Start the application
2. App detects pending migration
3. Observe migration dialog

### Expected Results

- ✅ Migration dialog appears: "Database update required"
- ✅ Dialog shows: "Creating backup before migration..."
- ✅ Backup creation progress shown
- ✅ Backup creation completes successfully
- ✅ Migration proceeds automatically
- ✅ App starts normally with migrated database
- ✅ Backup file created: `backup_YYYY-MM-DD_HH-MM-SS_pre-migration.db`
- ✅ If backup fails, migration is blocked with error message

### Validation

```bash
# Check pre-migration backup exists
ls -lh backups/*_pre-migration.db

# Verify migration ran (check knex_migrations table)
sqlite3 data/jobmatcher.db "SELECT * FROM knex_migrations ORDER BY id DESC LIMIT 1;"
```

**Acceptance Criteria**: FR-001, FR-007

---

## Test Scenario 5: Delete Individual Backup

**Goal**: Verify user can delete backups with confirmation

### Steps

1. Navigate to Settings > Backup Management
2. Select an old backup (not the newest)
3. Click "Delete" button
4. Read confirmation dialog
5. Click "Confirm Delete"

### Expected Results

- ✅ Delete button is visible for each backup
- ✅ Confirmation dialog appears: "Are you sure you want to delete this backup?"
- ✅ Dialog shows backup filename and date
- ✅ After confirmation, backup is deleted
- ✅ Backup disappears from list
- ✅ Success message: "Backup deleted"
- ✅ If trying to delete last backup, error: "Cannot delete last remaining backup"

### Validation

```bash
# Verify backup file is gone
ls backups/backup_YYYY-MM-DD_*.db
# Should not list the deleted backup
```

**Acceptance Criteria**: FR-021, FR-023

---

## Test Scenario 6: Cleanup Old Backups

**Goal**: Verify manual cleanup of old backups works

### Preparation

1. Create test backups with old timestamps (manually modify file dates for testing):
   ```bash
   touch -t 202409010900 backups/backup_2024-09-01_09-00-00.db
   ```
2. Create a few recent backups

### Steps

1. Navigate to Settings > Backup Management
2. Observe backups older than 30 days are highlighted
3. Click "Clean Up Old Backups" button
4. Review dialog showing which backups will be deleted
5. Click "Confirm Cleanup"

### Expected Results

- ✅ Dialog lists backups to be deleted (>30 days old)
- ✅ Pre-migration backups are NOT listed for deletion
- ✅ At least 1 backup will be kept (even if > 30 days)
- ✅ After confirmation, old backups are deleted
- ✅ Success message: "Deleted X old backups"
- ✅ Backup list refreshes automatically

### Validation

```bash
# Check no backups older than 30 days remain (except pre-migration)
find backups/ -name "*.db" -mtime +30
# Should only show pre-migration backups, if any
```

**Acceptance Criteria**: FR-019, FR-020, FR-022, FR-023, FR-024

---

## Test Scenario 7: Automatic Cleanup on App Start

**Goal**: Verify automatic background cleanup works

### Preparation

1. Create old test backups (>30 days) using `touch` command
2. Ensure multiple recent backups exist
3. Close app if running

### Steps

1. Launch the application
2. Wait for app to fully load
3. Navigate to Settings > Backup Management
4. Check backup list

### Expected Results

- ✅ App starts normally (no user-facing dialogs about cleanup)
- ✅ Old backups (>30 days) are automatically deleted
- ✅ Pre-migration backups are NOT deleted
- ✅ At least 1 backup always remains
- ✅ No confirmation dialog (automatic process)

### Validation

```bash
# Check cleanup happened
find backups/ -name "*.db" -mtime +30
# Should only show pre-migration backups or the newest backup if it's >30 days
```

**Acceptance Criteria**: FR-020, FR-024

---

## Test Scenario 8: Insufficient Disk Space

**Goal**: Verify error handling when disk is full

### Preparation

1. Fill disk to leave only ~5 MB free (or mock low disk space in code)

### Steps

1. Navigate to Settings > Backup Management
2. Click "Create Backup" button

### Expected Results

- ✅ Error message appears: "Insufficient disk space. Required: X MB, Available: Y MB"
- ✅ Backup is NOT created
- ✅ No partial/corrupt backup files left behind
- ✅ User is prompted to free up space

**Acceptance Criteria**: FR-025, FR-027

---

## Test Scenario 9: Corrupted Backup Detection

**Goal**: Verify system detects and rejects corrupted backups

### Preparation

1. Create a valid backup
2. Corrupt the backup file:
   ```bash
   dd if=/dev/zero of=backups/backup_2025-10-14_10-00-00.db bs=1024 count=10 conv=notrunc
   ```

### Steps

1. Navigate to Settings > Backup Management
2. Select the corrupted backup
3. Click "Restore" button
4. Observe error

### Expected Results

- ✅ Integrity check fails during restore attempt
- ✅ Error message: "Backup file is corrupted and cannot be restored"
- ✅ Restore operation is aborted
- ✅ Current database is NOT affected
- ✅ Option to delete corrupted backup is offered

**Acceptance Criteria**: FR-028

---

## Test Scenario 10: Schema Version Compatibility

**Goal**: Verify restore blocks when backup is from newer version

### Preparation

1. Manually create a backup
2. Modify backup's `knex_migrations` table to add a future migration:
   ```sql
   INSERT INTO knex_migrations (name, batch, migration_time)
   VALUES ('20991231235959_future_migration.js', 999, CURRENT_TIMESTAMP);
   ```

### Steps

1. Navigate to Settings > Backup Management
2. Select the modified backup
3. Click "Restore" button

### Expected Results

- ✅ Error message: "Cannot restore backup from newer version (backup: 20991231235959, current: 20251002000001)"
- ✅ Restore is blocked
- ✅ User is advised to update app first
- ✅ Current database is NOT affected

**Acceptance Criteria**: FR-015

---

## Test Scenario 11: Concurrent Operation Protection

**Goal**: Verify concurrent operations are blocked

### Steps

1. Navigate to Settings > Backup Management
2. Click "Create Backup" button
3. Immediately (while backup is in progress) click "Create Backup" again

### Expected Results

- ✅ First backup starts normally
- ✅ Second request shows error: "Operation already in progress"
- ✅ First backup completes successfully
- ✅ After first backup completes, second backup can be started

### Alternative Test

1. Start a restore operation
2. Try to create a backup while restore is running

### Expected Results

- ✅ Backup creation is blocked
- ✅ Error: "Restore operation in progress"

**Acceptance Criteria**: FR-026

---

## Test Scenario 12: Restore Failure Recovery

**Goal**: Verify safety backup is used if restore fails

### Preparation

1. Create a backup
2. Mock a restore failure (e.g., interrupt DB file replacement)

### Steps

1. Attempt to restore backup
2. Simulate failure during restore
3. Observe recovery behavior

### Expected Results

- ✅ Safety backup is created before restore
- ✅ When restore fails, safety backup is automatically restored
- ✅ User sees error: "Restore failed. Recovered using safety backup."
- ✅ App restarts with original data intact (from safety backup)
- ✅ Data is NOT lost or corrupted

**Acceptance Criteria**: FR-029

---

## Performance Validation

Run these checks after completing functional tests:

### Backup Creation Speed
```bash
time node -e "require('./dist/main/backup/BackupManager').createBackup('manual')"
```
- ✅ 1 MB DB: <200ms
- ✅ 10 MB DB: <1s
- ✅ 50 MB DB: <5s

### Backup List Loading Speed
```bash
time node -e "require('./dist/main/backup/BackupManager').listBackups()"
```
- ✅ 20 backups: <500ms

### Restore Speed
```bash
time node -e "require('./dist/main/backup/BackupManager').restoreBackup('backup_*.db')"
```
- ✅ 10 MB DB: <10s
- ✅ 50 MB DB: <10s

---

## Regression Test Checklist

Run these after any code changes to backup system:

- [ ] Manual backup creation works
- [ ] Backup list displays correctly
- [ ] Restore works and app restarts
- [ ] Pre-migration backup triggers automatically
- [ ] Delete backup works with confirmation
- [ ] Cleanup removes old backups (>30 days)
- [ ] Automatic cleanup runs on app start
- [ ] Insufficient disk space is detected
- [ ] Corrupted backup is rejected
- [ ] Schema version check blocks incompatible restore
- [ ] Concurrent operations are blocked
- [ ] Safety backup protects against restore failures

---

## Success Criteria

All 12 test scenarios must pass for feature to be considered complete and ready for release.

**Estimated Testing Time**: ~45-60 minutes for full manual test suite
