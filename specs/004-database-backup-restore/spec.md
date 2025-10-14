# Feature Specification: Database Backup & Restore System

**Feature Branch**: `004-database-backup-restore`
**Created**: 2025-10-14
**Status**: Draft
**Input**: User description: "Database Backup & Restore System: Als Nutzer möchte ich meine Datenbank automatisch und manuell sichern können, damit keine Daten verloren gehen. Vor jeder Migration soll automatisch ein Backup erstellt werden. Im Settings-Bereich soll es einen manuellen Backup-Button geben. Backups sollen im backups/ Ordner mit Timestamp gespeichert werden. Es soll auch eine Restore-Funktion geben, um ein Backup wiederherzustellen. Alte Backups nach 30 Tagen optional löschen oder User fragen. Backup-Status (letztes Backup-Datum) soll im UI sichtbar sein. Electron Desktop App, SQLite Datenbank mit better-sqlite3."

## Execution Flow (main)
```
1. Parse user description from Input
   → Feature: Database backup and restore system
   → Triggers: Automatic (before migrations), Manual (Settings UI)
   → Storage: backups/ folder with timestamps
   → Platform: Electron desktop app, SQLite database
2. Extract key concepts from description
   → Actors: Single user (desktop app owner), System (migration process)
   → Actions: Create backup (auto/manual), restore backup, delete old backups
   → Data: SQLite database backups with timestamps
   → Constraints: 30-day retention policy, user confirmation for restore
3. For each unclear aspect:
   → ✓ Backup format: SQLite .backup() API or SQL dump
   → ✓ Restore confirmation: Always ask user before overwriting current DB
   → ✓ Migration integration: Hook into existing Knex migration system
   → ✓ Backup deletion: User prompt or automatic after 30 days
   → ✓ Backup verification: Should backups be tested after creation?
   → ✓ Concurrent operations: Can user work while backup/restore runs?
   → ✓ Failed backup handling: Retry? Notify user? Block migration?
4. Fill User Scenarios & Testing section
   → Primary flow: User opens Settings, clicks backup, sees confirmation
   → Auto flow: Migration starts → backup created → migration proceeds
5. Generate Functional Requirements
   → Automatic pre-migration backups
   → Manual backup trigger in Settings UI
   → Restore function with user confirmation
   → Backup list display with dates
   → Old backup cleanup (manual or automatic)
6. Identify Key Entities
   → Backup metadata (timestamp, size, DB schema version)
7. Run Review Checklist
   → WARN "Spec has uncertainties - clarifications needed"
8. Return: SUCCESS (spec ready for planning after clarifications)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## Clarifications

### Session 2025-10-14

- Q: Wie soll das System reagieren, wenn das automatische Backup vor einer Migration fehlschlägt? → A: Migration blockieren - Zeige Fehler an und erlaube keine Migration ohne erfolgreiches Backup
- Q: Wie sollen Backups älter als 30 Tage behandelt werden? → A: Automatisch im Hintergrund löschen, aber mindestens ein Backup muss erhalten bleiben
- Q: Soll das System vor jedem Restore automatisch ein Safety-Backup des aktuellen Zustands erstellen? → A: Ja, immer automatisch Safety-Backup erstellen
- Q: Wie soll das System mit gleichzeitigen Backup/Restore-Operationen umgehen? → A: Blockieren - Zweite Operation wird blockiert mit Fehlermeldung
- Q: Soll das System Backups nach der Erstellung verifizieren? → A: Ja, vollständiger Test - Backup öffnen und Tabellen lesen

---

## User Scenarios & Testing

### Primary User Story
As a user, I want to manually create a backup of my application data from the Settings page, so that I can safeguard my profile, skills, and job history before making significant changes or testing new features.

### Acceptance Scenarios

#### Scenario 1: Manual Backup Creation
1. **Given** the user is on the Settings page
2. **When** the user clicks the "Create Backup" button
3. **Then** the system creates a backup file with current timestamp
4. **And** displays a success message with the backup filename
5. **And** updates the "Last Backup" status indicator

#### Scenario 2: Automatic Pre-Migration Backup
1. **Given** a new app version requires database migration
2. **When** the app starts and detects schema changes
3. **Then** the system automatically creates a backup before migration
4. **And** displays a migration dialog showing backup creation status
5. **And** only proceeds with migration after successful backup

#### Scenario 3: Restore from Backup
1. **Given** the user selects a backup from the backup list in Settings
2. **When** the user clicks "Restore"
3. **Then** the system shows a warning dialog explaining data will be overwritten
4. **And** requires explicit user confirmation
5. **When** the user confirms
6. **Then** the system restores the selected backup
7. **And** restarts the application with restored data

#### Scenario 4: View Backup History
1. **Given** multiple backups exist
2. **When** the user opens the Backup Management section in Settings
3. **Then** the system displays a list of all backups
4. **And** shows timestamp, file size, and database version for each backup
5. **And** indicates which backup was created automatically vs. manually

#### Scenario 5: Delete Old Backups
1. **Given** backups older than 30 days exist
2. **When** the user opens Backup Management
3. **Then** the system highlights old backups
4. **And** offers a "Clean Up Old Backups" button
5. **When** the user clicks cleanup
6. **Then** the system shows which backups will be deleted
7. **And** requires user confirmation before deletion

### Edge Cases
- What happens when backup creation fails (disk full, permissions error)?
- How does system handle corrupted backup files during restore?
- What if user tries to restore a backup from a newer database schema version?
- Can user cancel an in-progress restore operation?
- What happens if app crashes during backup/restore?
- Should system verify backup integrity after creation?
- How to handle backups when disk space is critically low?
- What if user accidentally deletes backups/ folder?

## Requirements

### Functional Requirements

#### Backup Creation
- **FR-001**: System MUST automatically create a backup before executing any database migration
- **FR-002**: System MUST provide a manual "Create Backup" button in the Settings interface
- **FR-003**: System MUST save backups in a dedicated `backups/` directory
- **FR-004**: System MUST include timestamp in backup filename format: `backup_YYYY-MM-DD_HH-MM-SS.db`
- **FR-005**: System MUST store backup metadata (creation time, backup type [auto/manual], database schema version, file size)
- **FR-006**: System MUST verify backup integrity after creation by opening the backup file and attempting to read all table schemas to confirm the backup is valid and restorable
- **FR-007**: System MUST block database migration if automatic backup fails, displaying clear error message and preventing migration until backup succeeds

#### Backup Display & Management
- **FR-008**: Settings UI MUST display the timestamp of the last successful backup
- **FR-009**: Settings UI MUST show a list of all available backups with details (timestamp, size, type, schema version)
- **FR-010**: System MUST allow users to sort backup list by date (newest/oldest first)
- **FR-011**: System MUST indicate which backups were created automatically vs. manually
- **FR-012**: System MUST highlight backups older than 30 days in the backup list

#### Restore Functionality
- **FR-013**: System MUST provide a "Restore" action for each backup in the list
- **FR-014**: System MUST display a confirmation dialog before restoring, warning that current data will be overwritten
- **FR-015**: System MUST [NEEDS CLARIFICATION: check schema version compatibility before restore? If backup is from newer version, should restore be blocked or warned?]
- **FR-016**: System MUST [NEEDS CLARIFICATION: allow user to cancel in-progress restore? If yes, what happens to partially restored data?]
- **FR-017**: System MUST restart the application automatically after successful restore
- **FR-018**: System MUST automatically create a safety backup of the current database state before restoring any backup, using filename format: `safety_backup_YYYY-MM-DD_HH-MM-SS.db`

#### Backup Cleanup
- **FR-019**: System MUST identify backups older than 30 days
- **FR-020**: System MUST automatically delete backups older than 30 days in the background at app startup, while always preserving at least one backup (the newest) regardless of age
- **FR-021**: System MUST provide a "Delete" action for individual backups with user confirmation
- **FR-022**: System MUST provide a "Clean Up Old Backups" button to manually trigger deletion of old backups with user confirmation
- **FR-023**: System MUST require user confirmation before manual deletion of any backup (automatic cleanup runs without confirmation)
- **FR-024**: System MUST [NEEDS CLARIFICATION: retention policy for automatic pre-migration backups - keep all, or only last N migrations?]

#### Error Handling & Safety
- **FR-025**: System MUST notify user if backup creation fails (with clear error message)
- **FR-026**: System MUST prevent concurrent backup/restore operations by blocking the second operation and displaying error message "Operation already in progress"
- **FR-027**: System MUST [NEEDS CLARIFICATION: handle insufficient disk space - show warning at X% free, block backup at Y% free?]
- **FR-028**: System MUST detect and warn user about corrupted backup files when attempting restore
- **FR-029**: System MUST [NEEDS CLARIFICATION: recovery strategy if restore fails mid-process - rollback, keep corrupted state, restore from emergency backup?]

### Key Entities

#### Backup Metadata
- **Purpose**: Track information about each database backup
- **Attributes**:
  - Filename (with timestamp)
  - Creation timestamp
  - Backup type (automatic/manual)
  - Database schema version at time of backup
  - File size in bytes
  - Backup trigger (pre-migration, manual, emergency)
  - Verification status (if implemented)
- **Relationships**: Associated with specific database schema version

#### Backup File
- **Purpose**: Physical backup of SQLite database
- **Attributes**:
  - File path in backups/ directory
  - File size
  - Last modified timestamp
- **Relationships**: Linked to Backup Metadata entry

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [ ] No implementation details (languages, frameworks, APIs) - *Note: User mentioned SQLite/better-sqlite3 in input, but spec focuses on user needs*
- [ ] Focused on user value and business needs
- [ ] Written for non-technical stakeholders
- [ ] All mandatory sections completed

### Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain - *9 clarification points identified*
- [ ] Requirements are testable and unambiguous - *Pending clarifications*
- [ ] Success criteria are measurable
- [ ] Scope is clearly bounded
- [ ] Dependencies and assumptions identified

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked (9 clarification points)
- [x] User scenarios defined (5 scenarios + edge cases)
- [x] Requirements generated (29 functional requirements)
- [x] Entities identified (2 entities)
- [ ] Review checklist passed - *Blocked by clarification needs*

---

## Dependencies & Assumptions

### Dependencies
- Existing database migration system (Knex.js) must be hookable for pre-migration backups
- Settings page UI must exist or be created
- File system access permissions for creating/reading/deleting files in backups/ directory

### Assumptions
- Single-user desktop application (no multi-user permissions needed)
- Backups are stored locally (not cloud sync)
- User has sufficient disk space for multiple backups
- Application can be restarted programmatically after restore
- Database file is not locked by other processes during backup/restore

---

## Out of Scope (Phase 1)
- Cloud backup sync (Dropbox, Google Drive integration)
- Encrypted backups
- Incremental backups (only full database backups)
- Backup compression
- Email notifications for backup status
- Scheduled automatic backups (daily/weekly)
- Export to other formats (CSV, JSON)
- Import from other backup sources

---
