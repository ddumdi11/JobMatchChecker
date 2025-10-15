# Implementation Plan: Database Backup & Restore System

**Branch**: `004-database-backup-restore` | **Date**: 2025-10-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-database-backup-restore/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path ✓
2. Fill Technical Context ✓
3. Fill Constitution Check ✓
4. Evaluate Constitution Check → PASS
5. Execute Phase 0 → research.md (IN PROGRESS)
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
7. Re-evaluate Constitution Check
8. Plan Phase 2 → Task generation approach
9. STOP - Ready for /tasks command
```

## Summary

This feature implements a comprehensive database backup and restore system for the Job Match Checker Electron application. The system provides:
- **Automatic backups** before every database migration (constitutional requirement)
- **Manual backups** via Settings UI
- **Restore functionality** with safety backups and app restart
- **Automatic cleanup** of backups older than 30 days (keeping minimum 1)
- **Backup verification** to ensure integrity
- **Concurrent operation protection** to prevent data corruption

Technical approach: Leverage SQLite's `.backup()` API via better-sqlite3 for atomic backups, integrate with existing Knex migration system, implement file-based backup management in Node.js main process.

## Technical Context

**Language/Version**: TypeScript 5.3 / Node.js (Electron 38.2.1)
**Primary Dependencies**: better-sqlite3 (existing), Knex.js (existing), Node.js fs/fs-extra
**Storage**: SQLite database (existing at `data/jobmatcher.db`), Backups stored in `backups/` directory
**Testing**: Jest (existing project setup)
**Target Platform**: Electron desktop app (Windows, macOS, Linux)
**Project Type**: Electron app (main process + renderer process architecture)
**Performance Goals**: Backup creation <5 seconds for typical DB size (<50MB), Restore <10 seconds
**Constraints**: Non-blocking UI during backup, blocking during restore, atomic operations
**Scale/Scope**: ~10-50 backups retained, DB size 1-100MB, backup metadata tracked

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Privacy First (✅ PASS)
- All backups stored locally in `backups/` folder
- No cloud synchronization in Phase 1
- User controls all backup/restore actions

### Datenintegrität (✅ PASS - Core Feature)
- **This feature directly fulfills constitutional requirement #2**
- Automatic backups before migrations (FR-001, FR-007)
- Backup verification after creation (FR-006)
- Safety backup before restore (FR-018)
- Versionierte Backups mit Rollback-Möglichkeit (FR-013, FR-014, FR-017)

### Iterative Entwicklung (✅ PASS)
- MVP functionality only (no cloud, encryption, compression)
- Out of scope clearly defined
- Builds on existing Knex migration system

### Tech Constraints (✅ PASS)
- Uses existing better-sqlite3 dependency
- Integrates with Knex.js migration system
- Electron packaging-compatible (local file operations)

**Result**: No constitutional violations. This feature is a core constitutional requirement.

## Project Structure

### Documentation (this feature)
```
specs/004-database-backup-restore/
├── spec.md              # Feature specification (complete)
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (to be created)
├── data-model.md        # Phase 1 output (to be created)
├── quickstart.md        # Phase 1 output (to be created)
├── contracts/           # Phase 1 output (to be created)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
src/
├── main/
│   ├── backup/                    # NEW: Backup management module
│   │   ├── BackupManager.ts       # Core backup/restore logic
│   │   ├── BackupMetadata.ts      # Metadata handling
│   │   └── BackupVerifier.ts      # Integrity verification
│   ├── database/
│   │   ├── db.ts                  # MODIFY: Add pre-migration hook
│   │   └── migrations/            # EXISTING
│   └── ipc/
│       └── handlers.ts            # MODIFY: Add backup IPC handlers
│
├── renderer/
│   ├── pages/
│   │   └── Settings.tsx           # MODIFY: Add Backup section
│   └── components/
│       ├── BackupManagement.tsx   # NEW: Backup UI component
│       └── BackupList.tsx         # NEW: Backup list display
│
└── types/
    └── backup.ts                  # NEW: TypeScript interfaces

tests/
├── main/
│   └── backup/
│       ├── BackupManager.test.ts
│       ├── BackupVerifier.test.ts
│       └── integration/
│           └── backup-restore.test.ts
└── renderer/
    └── components/
        └── BackupManagement.test.tsx

backups/                          # NEW: Runtime backup storage
└── .gitkeep
```

**Structure Decision**: Follows existing Electron app structure with main/renderer separation. New `backup/` module in main process for file operations, UI components in renderer. Backups stored at repository root level for easy access outside app bundle.

## Phase 0: Outline & Research

### Unknowns & Research Tasks

#### 1. better-sqlite3 Backup API Best Practices
**Research**: How to use `.backup()` method for atomic SQLite backups
- Method signature and options
- Handling of concurrent connections
- Error handling and rollback strategies
- Performance characteristics for different DB sizes

#### 2. Knex Migration Hook Integration
**Research**: How to integrate pre-migration hooks with Knex.js
- Knex migration lifecycle events
- How to abort migration on backup failure
- Preserving existing migration behavior
- Testing migration + backup integration

#### 3. Electron App Restart Strategy
**Research**: How to programmatically restart Electron app after restore
- `app.relaunch()` and `app.exit()` sequence
- Handling of unsaved state
- Ensuring clean shutdown
- Cross-platform compatibility (Windows/macOS/Linux)

#### 4. File System Operations in Electron
**Research**: Best practices for file operations in Electron main process
- Async vs sync operations for backup operations
- Handling file permissions across platforms
- Disk space checking methods
- Atomic file operations (temp file + rename pattern)

#### 5. Backup Verification Strategy
**Research**: How to verify SQLite database integrity
- Opening backup DB in read-only mode
- Query to check all tables exist
- Detecting corruption (PRAGMA integrity_check)
- Performance impact of verification

### Pragmatic Decisions for Remaining Clarifications

The spec has 5 remaining "NEEDS CLARIFICATION" points. Based on constitutional principles (safety first, simplicity), here are the pragmatic decisions:

**FR-015** (Schema version compatibility):
- **Decision**: Block restore if backup is from newer schema version
- **Rationale**: Prevents data loss from incompatible schema downgrades
- **Implementation**: Compare schema versions, show error dialog

**FR-016** (Cancel in-progress restore):
- **Decision**: No cancel option once restore starts
- **Rationale**: Partial restore leaves DB in undefined state; restore is fast (<10s)
- **Implementation**: Show progress dialog with "Please wait" message

**FR-024** (Migration backup retention):
- **Decision**: Keep all migration backups, exclude from 30-day cleanup
- **Rationale**: Migration backups are critical for rollback, typically few in number
- **Implementation**: Flag migration backups differently, skip in auto-cleanup

**FR-027** (Disk space handling):
- **Decision**: Check available space before backup; require 2x current DB size
- **Rationale**: Simple heuristic prevents backup failures
- **Implementation**: Check disk space, show error if insufficient

**FR-029** (Restore failure recovery):
- **Decision**: Restore from safety backup, show error, log details
- **Rationale**: Safety backup (FR-018) provides automatic recovery path
- **Implementation**: Try-catch around restore, fallback to safety backup

**Output**: ✅ research.md complete

---

## Phase 1: Design & Contracts

**Status**: ✅ COMPLETE

### Generated Artifacts

1. **data-model.md** ✅
   - Defined BackupFile (filesystem entity)
   - Defined BackupMetadata (in-memory only)
   - File naming conventions
   - State transitions and lifecycle
   - Validation rules
   - Data flow diagrams

2. **contracts/ipc-backup-api.md** ✅
   - 6 IPC endpoints defined:
     - CREATE_BACKUP
     - GET_BACKUPS
     - RESTORE_BACKUP
     - DELETE_BACKUP
     - CLEANUP_OLD_BACKUPS
     - CHECK_BACKUP_STATUS
   - Request/response schemas
   - Error codes and messages
   - TypeScript type definitions
   - Performance targets

3. **quickstart.md** ✅
   - 12 manual test scenarios
   - Step-by-step validation procedures
   - Performance validation tests
   - Regression test checklist
   - Success criteria defined

4. **CLAUDE.md** ✅
   - Agent context file updated
   - Tech stack documented
   - Project structure noted

### Re-evaluation: Constitution Check

**Status**: ✅ PASS (No changes from initial check)

- Privacy First: ✅ Local storage only
- Datenintegrität: ✅ Core constitutional requirement fulfilled
- Iterative Entwicklung: ✅ MVP scope maintained
- Tech Constraints: ✅ Uses existing dependencies

**No design violations detected. Ready for Phase 2.**

---

## Phase 2: Task Planning Approach

*This section describes what the /tasks command will do - DO NOT execute during /plan*

### Task Generation Strategy

The `/tasks` command will generate tasks from the Phase 1 design documents:

**From data-model.md**:
- Create TypeScript interfaces (`src/types/backup.ts`)
- Implement BackupManager class
- Implement BackupMetadata class
- Implement BackupVerifier class

**From contracts/ipc-backup-api.md**:
- Add IPC handlers to `src/main/ipc/handlers.ts`
- Implement preload API extensions
- Create type-safe IPC wrapper for renderer

**From quickstart.md**:
- Create integration tests for each scenario
- Create unit tests for BackupManager, BackupVerifier
- Create UI component tests

**From research.md**:
- Implement Knex migration wrapper with pre-backup hook
- Implement disk space check utility
- Implement app restart utility

### Task Ordering Strategy

**Phase 1: Types & Foundation** [P = Parallel]
- [P] T001: Create TypeScript interfaces
- [P] T002: Create backup directory structure
- [P] T003: Implement disk space check utility

**Phase 2: Core Logic** [Sequential within module]
- T004: Implement BackupManager.createBackup()
- T005: Implement BackupVerifier
- T006: Implement BackupManager.restoreBackup()
- T007: Implement BackupManager.listBackups()
- T008: Implement BackupManager.deleteBackup()
- T009: Implement BackupManager.cleanupOldBackups()

**Phase 3: Migration Integration**
- T010: Add pre-migration backup hook to db.ts
- T011: Test migration + backup integration

**Phase 4: IPC Layer** [P]
- [P] T012: Add IPC handlers for backup operations
- [P] T013: Update preload script
- [P] T014: Create renderer-side API wrapper

**Phase 5: UI Components** [P]
- [P] T015: Create BackupManagement component
- [P] T016: Create BackupList component
- [P] T017: Add Backup section to Settings page

**Phase 6: Testing** [P after implementation]
- [P] T018: Unit tests for BackupManager
- [P] T019: Unit tests for BackupVerifier
- [P] T020: Integration tests (backup/restore flow)
- [P] T021: UI component tests

**Phase 7: Polish**
- T022: Error message localization
- T023: Add loading states to UI
- T024: Performance optimization
- T025: Manual testing (quickstart scenarios)

### Estimated Task Count

**Total**: ~25 tasks
**Parallelizable**: ~12 tasks (marked [P])
**Sequential**: ~13 tasks (dependencies)

### Dependencies

```
T001, T002, T003 → T004
T004 → T005 → T006
T006 → T007 → T008 → T009
T004 → T010 → T011
T004 → T012, T013, T014
T012 → T015, T016, T017
T004-T009 → T018-T021
T011, T017 → T022-T025
```

**IMPORTANT**: This phase is executed by the `/tasks` command, NOT by `/plan`

---

## Phase 3+: Future Implementation

*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (`/tasks` command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following TDD where applicable)
**Phase 5**: Validation (run quickstart.md scenarios, performance tests)

---

## Complexity Tracking

*No constitutional violations - this section is empty*

This feature adheres to all constitutional principles and adds no unnecessary complexity.

---

## Progress Tracking

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - approach described)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved (pragmatic decisions documented)
- [x] Complexity deviations documented (none)

**Artifacts Generated**:
- [x] plan.md (this file)
- [x] research.md
- [x] data-model.md
- [x] contracts/ipc-backup-api.md
- [x] quickstart.md
- [x] CLAUDE.md (agent context)

---

## Next Steps

Run `/tasks` command to generate `tasks.md` with detailed, ordered implementation tasks.

---

*Based on Constitution v1.0 - See `.specify/memory/constitution.md`*
*Implementation Plan Complete - Ready for /tasks*
