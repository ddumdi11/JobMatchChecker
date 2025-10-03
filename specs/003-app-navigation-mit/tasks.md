# Tasks: App Navigation with Sidebar

**Input**: Design documents from `/specs/003-app-navigation-mit/`
**Prerequisites**: plan.md, research.md, quickstart.md
**Feature Branch**: `003-app-navigation-mit`

## Execution Flow (main)
```txt
1. Load plan.md from feature directory
   → ✓ Found: TypeScript 5.3, React 18.2, Material-UI 5.15, React Router DOM 6.x
   → ✓ Extract: Electron desktop app, permanent Drawer, Layout pattern
2. Load optional design documents:
   → ✓ research.md: Material-UI Drawer (permanent variant), useBlocker for unsaved changes
   → ✓ quickstart.md: 6 test scenarios extracted
   → ✗ data-model.md: N/A (UI-only feature)
   → ✗ contracts/: N/A (no API contracts)
3. Generate tasks by category:
   → Setup: Verify dependencies
   → Core: Sidebar, Layout, App integration, unsaved changes hook
   → Tests: Component tests for Sidebar and Layout
   → Integration: Page integration with unsaved changes
   → Polish: Manual testing, documentation
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests can run parallel with implementation (TDD optional for UI)
5. Number tasks sequentially (T001-T011)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → ✓ All components have tests
   → ✓ All pages integrated
   → ✓ All quickstart scenarios covered
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Phase 3.1: Setup & Verification
- [x] **T001** Verify dependencies installed: `react-router-dom` ^6.x, `@mui/material` ^5.15, `@mui/icons-material` in package.json

## Phase 3.2: Core Components
- [x] **T002** [P] Create Sidebar component in `src/renderer/components/Sidebar.tsx` with Material-UI permanent Drawer (240px width), 4 navigation items (Dashboard, Profile, Jobs, Settings) using ListItemButton, icons from @mui/icons-material, active page highlighting using useLocation hook
- [x] **T003** [P] Create Layout component in `src/renderer/components/Layout.tsx` with Box display:flex wrapper, Sidebar component, main content area with Outlet for React Router child routes
- [x] **T004** Update `src/renderer/App.tsx` to wrap all routes in Layout component using React Router 6 Layout Routes pattern (Route with Layout element, child Routes for pages)
- [x] **T005** [P] Create useUnsavedChanges hook in `src/renderer/hooks/useUnsavedChanges.tsx` using React Router useBlocker to prevent navigation when isDirty=true, return dialog state + confirm/cancel handlers

## Phase 3.3: Tests (Can run parallel with Phase 3.2)
- [ ] **T006** [P] Create Sidebar component test in `tests/renderer/components/Sidebar.test.tsx` verifying: renders 4 navigation items, highlights active page based on current route, clicking item changes route
- [ ] **T007** [P] Create Layout component test in `tests/renderer/components/Layout.test.tsx` verifying: renders Sidebar and Outlet, maintains flex layout structure

## Phase 3.4: Integration
- [x] **T008** Add unsaved changes dialog to `src/renderer/components/Layout.tsx` using Material-UI Dialog, trigger from useUnsavedChanges blocker state, show "Save"/"Discard"/"Cancel" buttons
- [x] **T009** [P] Update `src/renderer/pages/Profile.tsx` to integrate with useUnsavedChanges hook, pass isDirty state from existing hasUnsavedChanges tracking
- [x] **T010** [P] Create Settings page in `src/renderer/pages/Settings.tsx` with placeholder content and unsaved changes integration (if forms exist)

## Phase 3.5: Polish & Validation
- [x] **T011** Execute all test scenarios from `specs/003-app-navigation-mit/quickstart.md` (6 scenarios: sidebar visibility, active highlighting, navigation, unsaved changes, resize, restart behavior)

## Dependencies Graph
```txt
T001 (Setup - verify deps)
  ↓
T002 [P] Sidebar.tsx  ────┐
T003 [P] Layout.tsx   ────┤─→ T004 App.tsx update → T008 Dialog integration
T005 [P] useUnsavedChanges─┘                            ↓
                                                    T009 [P] Profile integration
                                                    T010 [P] Settings page
                                                         ↓
T006 [P] Sidebar.test.tsx ──┐                           ↓
T007 [P] Layout.test.tsx  ──┴───────────────────────→ T011 Manual testing
```

## Parallel Execution Examples

### Launch T002, T003, T005 together (different files, no dependencies):
```bash
# In Claude Code or Task agent:
Task 1: "Create Sidebar component in src/renderer/components/Sidebar.tsx with Material-UI permanent Drawer"
Task 2: "Create Layout component in src/renderer/components/Layout.tsx with Sidebar and Outlet"
Task 3: "Create useUnsavedChanges hook in src/renderer/hooks/useUnsavedChanges.tsx using useBlocker"
```

### Launch T006, T007 together (independent test files):
```bash
Task 1: "Create Sidebar test in tests/renderer/components/Sidebar.test.tsx"
Task 2: "Create Layout test in tests/renderer/components/Layout.test.tsx"
```

### Launch T009, T010 together (different page files):
```bash
Task 1: "Update Profile.tsx to integrate useUnsavedChanges hook"
Task 2: "Create Settings.tsx page with unsaved changes integration"
```

## Task Details

### T001: Verify Dependencies
**File**: `package.json`
**Action**: Check that `react-router-dom` ^6.x and `@mui/material` ^5.15 are already installed. If missing, run `npm install react-router-dom @mui/material @mui/icons-material`.
**Success**: Dependencies present in package.json, no errors on `npm install`.

### T002: Create Sidebar Component
**File**: `src/renderer/components/Sidebar.tsx`
**Requirements**:
- Material-UI `<Drawer variant="permanent">` with `sx={{ width: 240 }}`
- List with 4 ListItemButton items: Dashboard (/), Profile (/profile), Jobs (/jobs), Settings (/settings)
- Icons: DashboardIcon, PersonIcon, WorkIcon, SettingsIcon from @mui/icons-material
- Use `useLocation()` hook to get current pathname
- Apply `selected={true}` and `sx={{ bgcolor: 'primary.light' }}` to active item
**Dependencies**: None
**Parallel**: [P] with T003, T005

### T003: Create Layout Component
**File**: `src/renderer/components/Layout.tsx`
**Requirements**:
- `<Box sx={{ display: 'flex' }}>` wrapper
- `<Sidebar />` component
- `<Box component="main" sx={{ flexGrow: 1, p: 3 }}><Outlet /></Box>` for route content
**Dependencies**: T002 (needs Sidebar component)
**Parallel**: [P] with T002, T005

### T004: Update App.tsx
**File**: `src/renderer/App.tsx`
**Requirements**:
- Import Layout component
- Wrap routes: `<Route path="/" element={<Layout />}>` with child routes inside
- Child routes: `<Route index element={<Dashboard />} />`, `<Route path="profile" element={<Profile />} />`, `<Route path="jobs" element={<JobDetail />} />`, `<Route path="settings" element={<Settings />} />`
**Dependencies**: T002, T003 (needs Sidebar and Layout components)
**Parallel**: No (blocks T008)

### T005: Create useUnsavedChanges Hook
**File**: `src/renderer/hooks/useUnsavedChanges.tsx`
**Requirements**:
- Accept `isDirty: boolean` parameter
- Accept optional `onSave: () => Promise<void>` callback parameter for save action
- Use `useBlocker` from react-router-dom: block when isDirty=true AND navigation to different pathname
- Return object: `{ blocker, handleSave, handleDiscard, handleCancel }` where:
  - `blocker`: React Router blocker state
  - `handleSave`: Calls onSave callback, then blocker.proceed() on success
  - `handleDiscard`: Calls blocker.proceed() without saving
  - `handleCancel`: Calls blocker.reset() to stay on current page
**Dependencies**: None
**Parallel**: [P] with T002, T003

### T006: Create Sidebar Test
**File**: `tests/renderer/components/Sidebar.test.tsx`
**Requirements**:
- Test: renders 4 navigation items (Dashboard, Profile, Jobs, Settings)
- Test: highlights active page (mock useLocation to return pathname)
- Test: clicking item changes route (use MemoryRouter, verify Link href)
**Dependencies**: T002 (needs Sidebar component to test)
**Parallel**: [P] with T007

### T007: Create Layout Test
**File**: `tests/renderer/components/Layout.test.tsx`
**Requirements**:
- Test: renders Sidebar component
- Test: renders Outlet (React Router child routes)
- Test: applies flex layout (`display: flex`)
**Dependencies**: T003 (needs Layout component to test)
**Parallel**: [P] with T006

### T008: Add Unsaved Changes Dialog to Layout
**File**: `src/renderer/components/Layout.tsx`
**Requirements**:
- Import Material-UI Dialog, DialogTitle, DialogContent, DialogActions, Button
- Create UnsavedChangesContext with `{ isDirty, onSave }` to share state between Layout and child pages
- Use useUnsavedChanges hook in Layout, consuming context values
- Render Dialog when blocker.state === 'blocked'
- Show "Unsaved Changes" title, warning message, 3 buttons: Save/Discard/Cancel
- Wire buttons to handleSave/handleDiscard/handleCancel from hook
- Save button: Calls onSave from context, then proceeds if successful
**Dependencies**: T004, T005 (needs App.tsx updated and useUnsavedChanges hook)
**Parallel**: No (blocks T009, T010)

### T009: Integrate Profile with Unsaved Changes
**File**: `src/renderer/pages/Profile.tsx`
**Requirements**:
- Import UnsavedChangesContext from Layout
- Use context to set `isDirty` to existing `hasUnsavedChanges` state
- Provide `onSave` callback that calls existing `handleSave` function from Profile
- Verify dialog appears when navigating away with unsaved changes
**Dependencies**: T008 (needs dialog in Layout with context)
**Parallel**: [P] with T010

### T010: Create Settings Page
**File**: `src/renderer/pages/Settings.tsx`
**Requirements**:
- Create basic Settings page component with Material-UI Container
- Add placeholder text: "Settings page (to be implemented)"
- If forms added later, integrate useUnsavedChanges hook
**Dependencies**: T008 (needs Layout with routing)
**Parallel**: [P] with T009

### T011: Manual Testing
**File**: `specs/003-app-navigation-mit/quickstart.md`
**Requirements**:
- Execute all 6 test scenarios from quickstart.md
- Verify: sidebar visibility, active highlighting, navigation, unsaved changes dialog, window resize, restart behavior
- Document any issues found
**Dependencies**: T001-T010 (all implementation complete)
**Parallel**: No (final validation)

## Notes
- [P] tasks = different files, no dependencies - can run in parallel
- Layout pattern requires React Router 6.x (already installed per plan.md)
- No backend/IPC changes needed - pure frontend feature
- Commit after each task or logical group (e.g., T002-T003 together)
- Avoid: modifying same file in parallel tasks

## Validation Checklist
*GATE: Checked before marking tasks complete*

- [x] All components have corresponding tests (T002→T006, T003→T007)
- [x] All pages integrated with navigation (T009, T010)
- [x] All quickstart scenarios covered in T011
- [x] Parallel tasks truly independent (checked dependency graph)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Dependencies properly ordered (Setup → Core → Integration → Polish)

---

*Generated from plan.md, research.md, quickstart.md - See `/specs/003-app-navigation-mit/` for design documents*
