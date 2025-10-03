# Tasks: Profile Management UI

**Input**: Design documents from `/specs/001-profile-management-ui/`
**Branch**: `001-profile-management-ui`
**Prerequisites**: PLAN_SUMMARY.md, spec.md

## Execution Flow (main)

```txt
1. Load PLAN_SUMMARY.md from feature directory
   → Tech stack: Electron 32.3, React 18.2, TypeScript 5.3, Material-UI 5.15
   → Structure: src/main/ (Electron), src/renderer/ (React), src/shared/
2. Extract design requirements:
   → 3 Components: ProfileForm, SkillsManager, PreferencesPanel
   → Data Model: UserPreferences (3 new fields), Skills (max 500)
   → IPC Channels: PROFILE_*, SKILLS_*, PREFERENCES_*
3. Generate tasks by category:
   → Setup: T001 (COMPLETED - electron-rebuild fix)
   → Database: T002-T003 (migration + types)
   → Components: T004-T006 (parallel - different files)
   → Integration: T007-T010
   → Polish: T011-T016
4. Apply task rules:
   → Different components = mark [P] for parallel
   → Same file = sequential (no [P])
5. Number tasks sequentially (T001-T016)
6. Validate completeness:
   → All 3 components covered ✓
   → All IPC channels implemented ✓
   → All data model changes covered ✓
7. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Main Process**: `src/main/`
- **Renderer Process**: `src/renderer/`
- **Shared**: `src/shared/`
- **Database**: `src/main/database/migrations/`

---

## Phase 3.1: Setup ✅
- [x] **T001** Fix Electron startup issue with electron-rebuild
  - **Status**: ✅ COMPLETED (2025-10-01)
  - **Solution**: Run `npx electron-rebuild` to rebuild native modules for Electron's Node.js version
  - **Documentation**: README.md updated, CHECKPOINT.md updated

---

## Phase 3.2: Database & Types
- [x] **T002** Create database migration for UserPreferences remote work fields
  - **Status**: ✅ COMPLETED (2025-10-02)
  - **File**: `src/main/database/migrations/20251002000001_add_remote_preferences.js`
  - **Changes**:
    - Added `remote_work_preference` STRING (remote_only, hybrid, on_site, flexible)
    - Added `remote_work_updated_at` DATETIME (auto-updated by triggers)
    - Added `preferred_remote_percentage` INTEGER (0-100)
    - Added `acceptable_remote_min` INTEGER (0-100)
    - Added `acceptable_remote_max` INTEGER (0-100)
    - Added CHECK constraints and validation triggers
    - Added auto-timestamp triggers for all remote preference changes
  - **Dependencies**: None

- [x] **T003** [P] Update TypeScript interfaces for new data model
  - **Status**: ✅ COMPLETED (2025-10-02)
  - **File**: `src/shared/types.ts`
  - **Changes**:
    - Update `UserPreferences` interface with 3 new remote fields
    - Add `MAX_SKILLS_PER_PROFILE = 500` constant
    - Add `SkillLevel` type (0-10)
    - Add validation types for remote range
  - **Dependencies**: None (can run parallel with T002)

---

## Phase 3.3: React Components (All parallel - different files) ✅
- [x] **T004** [P] Create ProfileForm component with auto-save
  - **Status**: ✅ COMPLETED (2025-10-02)
  - **File**: `src/renderer/components/ProfileForm.tsx`
  - **Features**:
    - Fields: first name, last name, email, location
    - Auto-save with 2-second debounce
    - Email validation with regex
    - Loading states with spinner
    - Success/error notifications (Snackbar)
  - **Dependencies**: T003 (types)

- [x] **T005** [P] Create SkillsManager component with explicit save
  - **Status**: ✅ COMPLETED (2025-10-02)
  - **File**: `src/renderer/components/SkillsManager.tsx`
  - **Features**:
    - Add/edit/delete skills with dialog
    - Skill level slider (0-10)
    - Category selection (7 predefined + custom)
    - Max 500 skills validation
    - Grouped display by category
    - Unsaved changes warning with beforeunload
    - Explicit save button
    - Years of experience (optional)
  - **Dependencies**: T003 (types)

- [x] **T006** [P] Create PreferencesPanel component with remote work range
  - **Status**: ✅ COMPLETED (2025-10-02)
  - **File**: `src/renderer/components/PreferencesPanel.tsx`
  - **Features**:
    - Salary range inputs (min/max)
    - Location preferences with add/remove
    - Remote work preference dropdown (4 options)
    - Preferred remote percentage slider (0-100%)
    - Acceptable range slider (min-max)
    - Real-time validation: min ≤ preferred ≤ max
    - Job type checkboxes (full-time, part-time, contract)
    - Willing to relocate checkbox
    - Explicit save button
  - **Dependencies**: T003 (types)

---

## Phase 3.4: Page Integration ✅
- [x] **T007** Create Profile page integrating all components
  - **Status**: ✅ COMPLETED (2025-10-02)
  - **File**: `src/renderer/pages/Profile.tsx`
  - **Features**:
    - Integrated all three components (ProfileForm, SkillsManager, PreferencesPanel)
    - Tab navigation with Material-UI Tabs (3 tabs with icons)
    - Profile completion indicator with progress bar (0-100%)
    - Error boundary for graceful error handling
    - Loading states with LinearProgress
    - TODO placeholders for IPC calls (T008-T010)
    - Global info alert explaining save mechanisms
  - **Dependencies**: T004, T005, T006 (all components must exist)

---

## Phase 3.5: IPC Layer
- [ ] **T008** [P] Implement IPC handlers for profile operations
  - **File**: `src/main/ipc/handlers.ts`
  - **Channels**:
    - `PROFILE_GET`: Get user profile
    - `PROFILE_UPDATE`: Update profile with auto-save
    - `PROFILE_CREATE`: Create initial profile
  - **Dependencies**: T002 (database migration)

- [ ] **T009** [P] Implement IPC handlers for skills operations
  - **File**: `src/main/ipc/handlers.ts` (same file as T008, so run sequentially)
  - **Channels**:
    - `SKILLS_GET_ALL`: Get all skills for profile
    - `SKILLS_UPSERT`: Create or update skill
    - `SKILLS_DELETE`: Remove skill
    - `SKILLS_VALIDATE`: Check max 500 limit
  - **Dependencies**: T002, T008 (same file)

- [ ] **T010** Implement IPC handlers for preferences operations
  - **File**: `src/main/ipc/handlers.ts` (same file as T008/T009)
  - **Channels**:
    - `PREFERENCES_GET`: Get user preferences
    - `PREFERENCES_UPDATE`: Update preferences
    - `PREFERENCES_VALIDATE`: Validate remote range (min ≤ preferred ≤ max)
  - **Dependencies**: T002, T008, T009 (same file)

---

## Phase 3.6: State Management
- [ ] **T011** Create Zustand store for profile state
  - **File**: `src/renderer/store/profileStore.ts`
  - **Features**:
    - Profile state (name, email, location)
    - Skills state (array, max 500)
    - Preferences state (salary, location, remote range)
    - Unsaved changes tracking
    - IPC integration for persistence
  - **Dependencies**: T003 (types), T007 (page), T008-T010 (IPC)

---

## Phase 3.7: Polish & Testing
- [ ] **T012** [P] Add loading states and error handling to all components
  - **Files**:
    - `src/renderer/components/ProfileForm.tsx`
    - `src/renderer/components/SkillsManager.tsx`
    - `src/renderer/components/PreferencesPanel.tsx`
  - **Features**:
    - Loading spinners during IPC calls
    - Error messages with retry
    - Empty states
    - Skeleton loaders
  - **Dependencies**: T004, T005, T006

- [ ] **T013** [P] Add input validation and constraints
  - **Files**: All component files
  - **Validations**:
    - Email format validation
    - Salary range (min ≤ max)
    - Remote range (min ≤ preferred ≤ max)
    - Skill level (0-10)
    - Max 500 skills
  - **Dependencies**: T004, T005, T006

- [ ] **T014** [P] Add Material-UI styling and responsive layout
  - **Files**: All component files
  - **Features**:
    - Consistent Material-UI theming
    - Responsive grid layout
    - Proper spacing and typography
    - Accessibility (ARIA labels, keyboard navigation)
  - **Dependencies**: T004, T005, T006, T007

- [ ] **T015** Implement unsaved changes warning
  - **Files**:
    - `src/renderer/pages/Profile.tsx`
    - `src/renderer/components/SkillsManager.tsx`
    - `src/renderer/components/PreferencesPanel.tsx`
  - **Features**:
    - Warn before leaving page with unsaved changes
    - Warn before app quit with unsaved changes
    - Visual indicator for unsaved state
  - **Dependencies**: T007, T011

- [ ] **T016** Add profile completion indicator
  - **File**: `src/renderer/pages/Profile.tsx`
  - **Features**:
    - Progress bar showing % completion
    - Required fields: name, email, at least 1 skill, preferences set
    - Visual feedback for missing required fields
  - **Dependencies**: T007, T011

---

## Dependencies Graph
```txt
T001 (✅ COMPLETED)
  ↓
T002, T003 [P]
  ↓
T004, T005, T006 [P]
  ↓
T007
  ↓
T008 → T009 → T010 (sequential - same file)
  ↓
T011
  ↓
T012, T013, T014 [P]
  ↓
T015 → T016
```

---

## Parallel Execution Examples

### Phase 3.2 - Database & Types (both parallel)
```bash
# Can run simultaneously - different files
Task: "Create database migration for UserPreferences remote work fields in src/main/database/migrations/"
Task: "Update TypeScript interfaces in src/shared/types.ts"
```

### Phase 3.3 - Components (all 3 parallel)
```bash
# Can run simultaneously - all different files
Task: "Create ProfileForm component in src/renderer/components/ProfileForm.tsx"
Task: "Create SkillsManager component in src/renderer/components/SkillsManager.tsx"
Task: "Create PreferencesPanel component in src/renderer/components/PreferencesPanel.tsx"
```

### Phase 3.7 - Polish (T012, T013, T014 parallel)
```bash
# Can run simultaneously - independent concerns
Task: "Add loading states and error handling to all components"
Task: "Add input validation and constraints"
Task: "Add Material-UI styling and responsive layout"
```

---

## Notes
- **T001** ✅ Already completed with electron-rebuild solution
- **[P]** tasks = different files, no dependencies - can run in parallel
- **T008-T010** must run sequentially (same file `handlers.ts`)
- Auto-save applies only to ProfileForm (T004)
- Explicit save applies to SkillsManager (T005) and PreferencesPanel (T006)
- Max 500 skills validation needed in both UI (T005) and backend (T009)
- Remote range validation (min ≤ preferred ≤ max) needed in both UI (T006) and backend (T010)

---

## Validation Checklist
- [x] All 3 components covered (ProfileForm, SkillsManager, PreferencesPanel)
- [ ] All IPC channels implemented (PROFILE_*, SKILLS_*, PREFERENCES_*) - In Progress (T008-T010)
- [x] All data model changes covered (3 remote fields, max 500 skills)
- [x] Parallel tasks truly independent (different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task (except T008-T010 marked sequential)
- [x] Setup task (T001) completed
- [x] Database migration included (T002)
- [x] State management included (T011)
- [x] Polish and validation included (T012-T016)

---

**Estimated Time**: 15-20 hours total
**Critical Path**: T001 ✅ → T002/T003 → T004/T005/T006 → T007 → T008→T009→T010 → T011 → T012/T013/T014 → T015→T016

**Status**: 🚧 IN PROGRESS - T001-T007 completed, continue with T008 (IPC handlers)
