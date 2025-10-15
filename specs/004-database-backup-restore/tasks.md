# Tasks: Database Backup & Restore System

**Feature**: 004-database-backup-restore
**Input**: Design documents from `/specs/004-database-backup-restore/`
**Prerequisites**: plan.md, research.md, data-model.md, contracts/ipc-backup-api.md, quickstart.md

## Execution Summary

This task list implements a comprehensive database backup and restore system for the Electron app. The implementation follows TDD principles where applicable, with tests written before implementation. Tasks are organized by dependencies, with [P] marking tasks that can run in parallel (different files, no blocking dependencies).

**Total Tasks**: 28
**Parallelizable**: 14 tasks
**Estimated Time**: 2-3 days

---

## Phase 3.1: Setup & Foundation

### T001: Create backup directory structure
**Files**: `backups/.gitkeep`
**Description**: Create `backups/` directory at repository root with `.gitkeep` to ensure it's tracked by git but empty of backup files.
**Dependencies**: None

### T002: Create TypeScript interfaces for backup system
**Files**: `src/types/backup.ts`
**Description**: Create type definitions based on contracts/ipc-backup-api.md:
- `BackupMetadata` interface
- `BackupApiResponse<T>` generic type
- `CreateBackupRequest`, `RestoreBackupRequest`, `DeleteBackupRequest` types
- `BackupErrorCode` enum
- `BackupType` enum ('manual' | 'pre-migration' | 'safety')
**Dependencies**: None
**Reference**: [contracts/ipc-backup-api.md:289-337](contracts/ipc-backup-api.md#L289-L337)

### T003 [P]: Create disk space utility
**Files**: `src/main/utils/diskSpace.ts`
**Description**: Implement utility to check available disk space:
- Function `getAvailableDiskSpace(path: string): Promise<number>` (returns bytes)
- Cross-platform support (Windows/macOS/Linux)
- Use Node.js `fs.statfs()` or similar
**Dependencies**: None
**Reference**: [research.md:150-155](research.md#L150-L155)

---

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation in Phase 3.3**

### T004 [P]: Unit test for BackupManager.createBackup()
**Files**: `tests/main/backup/BackupManager.test.ts`
**Description**: Write unit tests for backup creation:
- ✅ Creates backup file with correct naming convention
- ✅ Verifies backup integrity after creation
- ❌ Fails when insufficient disk space
- ❌ Fails when source DB doesn't exist
- ✅ Returns BackupMetadata with all fields
**Dependencies**: T002 (types)
**Reference**: [quickstart.md:15-56](quickstart.md#L15-L56), [contracts/ipc-backup-api.md:15-56](contracts/ipc-backup-api.md#L15-L56)

### T005 [P]: Unit test for BackupVerifier
**Files**: `tests/main/backup/BackupVerifier.test.ts`
**Description**: Write unit tests for backup verification:
- ✅ Passes for valid SQLite database
- ❌ Fails for corrupted file
- ❌ Fails for non-SQLite file
- ✅ Reads schema version from knex_migrations
- ✅ Verifies all tables exist
**Dependencies**: T002 (types)
**Reference**: [quickstart.md:315-342](quickstart.md#L315-L342), [research.md:157-162](research.md#L157-L162)

### T006 [P]: Unit test for BackupManager.restoreBackup()
**Files**: `tests/main/backup/BackupManager.restore.test.ts`
**Description**: Write unit tests for restore functionality:
- ✅ Creates safety backup before restore
- ✅ Restores database successfully
- ❌ Blocks restore if schema version too new
- ❌ Fails if backup file not found
- ✅ Triggers app restart after successful restore
**Dependencies**: T002 (types)
**Reference**: [quickstart.md:93-134](quickstart.md#L93-L134), [contracts/ipc-backup-api.md:128-174](contracts/ipc-backup-api.md#L128-L174)

### T007 [P]: Unit test for BackupManager.listBackups()
**Files**: `tests/main/backup/BackupManager.list.test.ts`
**Description**: Write unit tests for listing backups:
- ✅ Returns empty array when no backups exist
- ✅ Returns all backups sorted by date (newest first)
- ✅ Calculates age correctly
- ✅ Identifies backup type from filename
- ✅ Reads schema version from each backup
**Dependencies**: T002 (types)
**Reference**: [quickstart.md:59-89](quickstart.md#L59-L89), [contracts/ipc-backup-api.md:65-125](contracts/ipc-backup-api.md#L65-L125)

### T008 [P]: Unit test for BackupManager.deleteBackup()
**Files**: `tests/main/backup/BackupManager.delete.test.ts`
**Description**: Write unit tests for backup deletion:
- ✅ Deletes backup file successfully
- ❌ Blocks deletion of last remaining backup
- ❌ Fails if file doesn't exist
- ✅ Returns success message
**Dependencies**: T002 (types)
**Reference**: [quickstart.md:179-209](quickstart.md#L179-L209), [contracts/ipc-backup-api.md:177-216](contracts/ipc-backup-api.md#L177-L216)

### T009 [P]: Unit test for BackupManager.cleanupOldBackups()
**Files**: `tests/main/backup/BackupManager.cleanup.test.ts`
**Description**: Write unit tests for automatic cleanup:
- ✅ Deletes backups older than 30 days
- ✅ Keeps pre-migration backups regardless of age
- ✅ Always keeps at least 1 backup
- ✅ Returns list of deleted backups
- ✅ Handles no old backups gracefully
**Dependencies**: T002 (types)
**Reference**: [quickstart.md:213-249](quickstart.md#L213-L249), [contracts/ipc-backup-api.md:219-260](contracts/ipc-backup-api.md#L219-L260)

### T010 [P]: Integration test for backup/restore flow
**Files**: `tests/main/backup/integration/backup-restore.test.ts`
**Description**: Write end-to-end integration test:
- ✅ Create manual backup
- ✅ Modify database
- ✅ Restore from backup
- ✅ Verify data matches original state
- ✅ Safety backup created during restore
**Dependencies**: T002 (types)
**Reference**: [quickstart.md:93-134](quickstart.md#L93-L134)

### T011 [P]: Integration test for pre-migration backup
**Files**: `tests/main/backup/integration/migration-backup.test.ts`
**Description**: Write integration test for automatic pre-migration backup:
- ✅ Detects pending migration
- ✅ Creates backup before migration
- ✅ Backup has _pre-migration suffix
- ❌ Blocks migration if backup fails
- ✅ Migration proceeds after successful backup
**Dependencies**: T002 (types)
**Reference**: [quickstart.md:139-175](quickstart.md#L139-L175)

---

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### T012: Implement BackupVerifier class
**Files**: `src/main/backup/BackupVerifier.ts`
**Description**: Implement backup verification logic:
- Method `verifyBackup(backupPath: string): Promise<boolean>`
- Open backup DB in read-only mode
- Run `PRAGMA integrity_check`
- Verify knex_migrations table exists
- Get schema version from knex_migrations
- Close connection properly
**Dependencies**: T002 (types), T005 (tests must fail first)
**Reference**: [research.md:157-162](research.md#L157-L162), [data-model.md:180-199](data-model.md#L180-L199)

### T013: Implement BackupManager.createBackup()
**Files**: `src/main/backup/BackupManager.ts`
**Description**: Implement backup creation logic:
- Method `createBackup(type: BackupType): Promise<BackupMetadata>`
- Check disk space (require 2x DB size)
- Generate filename with timestamp
- Use better-sqlite3 `.backup()` API
- Verify backup using BackupVerifier
- Return BackupMetadata
- Handle errors (disk space, permissions, verification)
**Dependencies**: T002 (types), T003 (disk space util), T012 (verifier), T004 (tests must fail first)
**Reference**: [research.md:27-76](research.md#L27-L76), [data-model.md:203-216](data-model.md#L203-L216)

### T014: Implement BackupManager.listBackups()
**Files**: `src/main/backup/BackupManager.ts`
**Description**: Implement backup listing logic:
- Method `listBackups(): Promise<BackupMetadata[]>`
- Scan `backups/` directory for `*.db` files
- Read filesystem metadata (size, created date)
- Parse filename for type and timestamp
- Get schema version from each backup (read-only)
- Sort by date (newest first)
- Calculate age in days
**Dependencies**: T002 (types), T012 (verifier), T007 (tests must fail first)
**Reference**: [data-model.md:270-281](data-model.md#L270-L281), [contracts/ipc-backup-api.md:65-125](contracts/ipc-backup-api.md#L65-L125)

### T015: Implement BackupManager.restoreBackup()
**Files**: `src/main/backup/BackupManager.ts`
**Description**: Implement restore logic:
- Method `restoreBackup(filename: string): Promise<void>`
- Verify backup file exists
- Check schema compatibility (block if backup newer)
- Verify backup integrity
- Create safety backup
- Close current DB connection
- Replace DB file with backup (atomic operation)
- Trigger app restart (`app.relaunch()` + `app.exit()`)
- On failure: restore from safety backup
**Dependencies**: T002 (types), T012 (verifier), T013 (createBackup for safety backup), T006 (tests must fail first)
**Reference**: [research.md:94-129](research.md#L94-L129), [data-model.md:234-253](data-model.md#L234-L253)

### T016: Implement BackupManager.deleteBackup()
**Files**: `src/main/backup/BackupManager.ts`
**Description**: Implement backup deletion logic:
- Method `deleteBackup(filename: string): Promise<void>`
- Check file exists
- Block if last remaining backup
- Delete file using `fs.unlink()`
- Handle permission errors
**Dependencies**: T002 (types), T008 (tests must fail first)
**Reference**: [contracts/ipc-backup-api.md:177-216](contracts/ipc-backup-api.md#L177-L216)

### T017: Implement BackupManager.cleanupOldBackups()
**Files**: `src/main/backup/BackupManager.ts`
**Description**: Implement automatic cleanup logic:
- Method `cleanupOldBackups(): Promise<{deleted: string[], kept: string[]}>`
- List all backups
- Filter: age > 30 days
- Exclude: pre-migration backups
- Ensure at least 1 backup remains
- Delete old backups
- Return deleted/kept lists
**Dependencies**: T002 (types), T014 (listBackups), T016 (deleteBackup), T009 (tests must fail first)
**Reference**: [data-model.md:256-268](data-model.md#L256-L268), [contracts/ipc-backup-api.md:219-260](contracts/ipc-backup-api.md#L219-L260)

### T018: Implement operation locking in BackupManager
**Files**: `src/main/backup/BackupManager.ts`
**Description**: Add concurrent operation protection:
- Add private field `operationInProgress: {type: 'backup' | 'restore' | 'cleanup', progress?: number} | null`
- Method `checkOperationStatus(): {operationInProgress: boolean, operation: string | null}`
- Check and set lock before operations
- Release lock after completion/failure
- Throw error if operation already running
**Dependencies**: T013-T017 (all BackupManager methods)
**Reference**: [quickstart.md:375-403](quickstart.md#L375-L403), [contracts/ipc-backup-api.md:263-286](contracts/ipc-backup-api.md#L263-L286)

---

## Phase 3.4: Integration with Knex Migrations

### T019: Add pre-migration backup hook to db.ts
**Files**: `src/main/database/db.ts`
**Description**: Integrate automatic backup before migrations:
- Import BackupManager
- Wrap Knex migration logic with backup call
- Call `createBackup('pre-migration')` before `knex.migrate.latest()`
- Block migration if backup fails (throw error)
- Show user feedback during backup
- Ensure existing migration behavior preserved
**Dependencies**: T013 (createBackup), T011 (integration test must fail first)
**Reference**: [research.md:78-92](research.md#L78-L92), [data-model.md:218-232](data-model.md#L218-L232)

---

## Phase 3.5: IPC Layer

### T020: Add IPC handlers for backup operations
**Files**: `src/main/ipc/handlers.ts`
**Description**: Add 6 IPC handlers based on contracts/ipc-backup-api.md:
- `backup:create` → calls BackupManager.createBackup()
- `backup:list` → calls BackupManager.listBackups()
- `backup:restore` → calls BackupManager.restoreBackup()
- `backup:delete` → calls BackupManager.deleteBackup()
- `backup:cleanup` → calls BackupManager.cleanupOldBackups()
- `backup:status` → calls BackupManager.checkOperationStatus()
- Wrap calls in try-catch with error mapping
- Return standardized responses per contract
**Dependencies**: T013-T018 (all BackupManager methods)
**Reference**: [contracts/ipc-backup-api.md:341-353](contracts/ipc-backup-api.md#L341-L353)

### T021 [P]: Update preload script for backup API
**Files**: `src/preload/index.ts` (or similar)
**Description**: Expose backup API to renderer process:
- Add `backup` object to contextBridge.exposeInMainWorld
- Map all 6 IPC channels
- Type-safe wrappers using types from `src/types/backup.ts`
**Dependencies**: T002 (types), T020 (IPC handlers)
**Reference**: [contracts/ipc-backup-api.md:341-353](contracts/ipc-backup-api.md#L341-L353)

---

## Phase 3.6: UI Components

### T022 [P]: Create BackupList component
**Files**: `src/renderer/components/BackupList.tsx`
**Description**: Create component to display backup list:
- Props: `backups: BackupMetadata[]`, `onRestore: (filename) => void`, `onDelete: (filename) => void`
- Display: filename, date, size (human-readable), type badge, age
- Highlight backups >30 days old
- Sort by date (newest first)
- Delete button with confirmation
- Restore button with confirmation
**Dependencies**: T002 (types)
**Reference**: [quickstart.md:59-89](quickstart.md#L59-L89)

### T023 [P]: Create BackupManagement component
**Files**: `src/renderer/components/BackupManagement.tsx`
**Description**: Create main backup management component:
- "Create Backup" button
- "Clean Up Old Backups" button
- "Last Backup" timestamp display
- Loading states for async operations
- Error message display
- Success message display
- Use IPC API via preload
- Integrate BackupList component
**Dependencies**: T002 (types), T021 (preload API), T022 (BackupList)
**Reference**: [quickstart.md:15-56](quickstart.md#L15-L56)

### T024: Add Backup section to Settings page
**Files**: `src/renderer/pages/Settings.tsx`
**Description**: Integrate backup UI into Settings:
- Add new "Backup & Restore" section
- Import and render BackupManagement component
- Ensure consistent styling with existing settings
**Dependencies**: T023 (BackupManagement component)
**Reference**: [plan.md:99-103](plan.md#L99-L103)

---

## Phase 3.7: UI Component Tests

### T025 [P]: Unit test for BackupManagement component
**Files**: `tests/renderer/components/BackupManagement.test.tsx`
**Description**: Write React component tests:
- ✅ Renders create backup button
- ✅ Shows loading state during backup
- ✅ Displays success message after backup
- ✅ Shows error message on failure
- ✅ Calls IPC API correctly
**Dependencies**: T023 (BackupManagement component)

### T026 [P]: Unit test for BackupList component
**Files**: `tests/renderer/components/BackupList.test.tsx`
**Description**: Write React component tests:
- ✅ Renders empty state when no backups
- ✅ Displays all backups with correct data
- ✅ Highlights old backups (>30d)
- ✅ Shows confirmation dialog on delete
- ✅ Shows confirmation dialog on restore
- ✅ Calls callbacks correctly
**Dependencies**: T022 (BackupList component)

---

## Phase 3.8: Polish & Validation

### T027: Add automatic cleanup on app startup
**Files**: `src/main/index.ts` (or main entry point)
**Description**: Trigger automatic cleanup when app starts:
- Call `BackupManager.cleanupOldBackups()` in background
- Run after app is ready
- Don't block app startup
- Log results (deleted count)
- Don't show UI for automatic cleanup
**Dependencies**: T017 (cleanupOldBackups)
**Reference**: [quickstart.md:253-287](quickstart.md#L253-L287)

### T028: Run manual test scenarios from quickstart.md
**Files**: N/A (manual testing)
**Description**: Execute all 12 test scenarios from quickstart.md:
1. Manual Backup Creation
2. View Backup List
3. Restore from Backup
4. Automatic Pre-Migration Backup
5. Delete Individual Backup
6. Cleanup Old Backups
7. Automatic Cleanup on App Start
8. Insufficient Disk Space
9. Corrupted Backup Detection
10. Schema Version Compatibility
11. Concurrent Operation Protection
12. Restore Failure Recovery
- Document results
- Fix any issues found
- Verify performance targets met
**Dependencies**: T024 (UI integrated), T027 (all features complete)
**Reference**: [quickstart.md:1-483](quickstart.md)

---

## Dependencies Graph

```
Setup Phase:
T001, T002, T003 (all parallel, no dependencies)

Test Phase (all parallel, depend on T002):
T004, T005, T006, T007, T008, T009, T010, T011 (all [P])

Core Implementation:
T002 → T012 (BackupVerifier)
T002, T003, T012 → T013 (createBackup)
T002, T012 → T014 (listBackups)
T002, T012, T013 → T015 (restoreBackup)
T002 → T016 (deleteBackup)
T002, T014, T016 → T017 (cleanupOldBackups)
T013-T017 → T018 (operation locking)

Migration Integration:
T013, T011 → T019 (pre-migration hook)

IPC Layer:
T013-T018 → T020 (IPC handlers)
T002, T020 → T021 (preload) [P]

UI Components:
T002 → T022 (BackupList) [P]
T002, T021, T022 → T023 (BackupManagement)
T023 → T024 (Settings integration)

UI Tests:
T023 → T025 [P]
T022 → T026 [P]

Polish:
T017 → T027 (startup cleanup)
T024, T027 → T028 (manual testing)
```

---

## Parallel Execution Examples

### Example 1: Setup Phase
```bash
# All setup tasks can run in parallel:
# (In practice, T001-T002 are fast enough to run sequentially)
```

### Example 2: Test Phase (Run ALL together)
```typescript
// Launch T004-T011 in parallel (8 test files):
Task: "Unit test for BackupManager.createBackup() in tests/main/backup/BackupManager.test.ts"
Task: "Unit test for BackupVerifier in tests/main/backup/BackupVerifier.test.ts"
Task: "Unit test for BackupManager.restoreBackup() in tests/main/backup/BackupManager.restore.test.ts"
Task: "Unit test for BackupManager.listBackups() in tests/main/backup/BackupManager.list.test.ts"
Task: "Unit test for BackupManager.deleteBackup() in tests/main/backup/BackupManager.delete.test.ts"
Task: "Unit test for BackupManager.cleanupOldBackups() in tests/main/backup/BackupManager.cleanup.test.ts"
Task: "Integration test for backup/restore flow in tests/main/backup/integration/backup-restore.test.ts"
Task: "Integration test for pre-migration backup in tests/main/backup/integration/migration-backup.test.ts"
```

### Example 3: UI Components
```typescript
// Launch T022 and T021 in parallel (different files):
Task: "Create BackupList component in src/renderer/components/BackupList.tsx"
Task: "Update preload script for backup API in src/preload/index.ts"
```

### Example 4: UI Component Tests
```typescript
// Launch T025-T026 in parallel:
Task: "Unit test for BackupManagement component in tests/renderer/components/BackupManagement.test.tsx"
Task: "Unit test for BackupList component in tests/renderer/components/BackupList.test.tsx"
```

---

## Validation Checklist

Before marking tasks complete, verify:

- [x] All 6 IPC contracts have corresponding implementation (T020)
- [x] All BackupManager methods have unit tests (T004-T009)
- [x] All tests written BEFORE implementation (Phase 3.2 before 3.3)
- [x] Parallel tasks are truly independent (different files)
- [x] Each task specifies exact file path
- [x] No [P] task modifies same file as another [P] task
- [x] All 12 quickstart scenarios covered in manual testing (T028)
- [x] All functional requirements from spec.md covered:
  - FR-001 to FR-007: Backup creation & verification
  - FR-008 to FR-012: Display & management
  - FR-013 to FR-018: Restore functionality
  - FR-019 to FR-024: Cleanup
  - FR-025 to FR-029: Error handling

---

## Notes

- **TDD Enforcement**: Tests in Phase 3.2 MUST be written and failing before any implementation in Phase 3.3
- **Commit Strategy**: Commit after each task completion
- **Performance Targets**: Validate during T028 (<5s backup, <10s restore)
- **Cross-platform**: Test on Windows, macOS, Linux (focus on Windows first)
- **Error Handling**: All error codes from contracts/ipc-backup-api.md must be implemented
- **Safety First**: Never skip safety backup (FR-018), always verify integrity (FR-006)

---

*Based on Constitution v1.0 - See `.specify/memory/constitution.md`*
*Tasks Ready for Execution - Start with T001*
