# Implementation Plan: App Navigation

**Branch**: `003-app-navigation-mit` | **Date**: 2025-10-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-app-navigation-mit/spec.md`

## Execution Flow (/plan command scope)
```txt
1. Load feature spec from Input path
   → ✓ Loaded: 10 functional requirements, 0 data entities
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → ✓ Project Type: Electron desktop app (existing structure)
   → ✓ No NEEDS CLARIFICATION markers
3. Fill the Constitution Check section
   → ✓ Based on constitution.md v1.0
4. Evaluate Constitution Check section
   → ✓ PASS - UI-only feature, no violations
   → ✓ Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → ✓ Material-UI Drawer patterns researched
6. Execute Phase 1 → contracts, data-model.md, quickstart.md
   → ✓ No data model (UI-only)
   → ✓ No API contracts (frontend-only)
   → ✓ Quickstart.md created
7. Re-evaluate Constitution Check section
   → ✓ PASS - No new violations
   → ✓ Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach
   → ✓ Ready for /tasks command
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 8. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Implement a persistent sidebar navigation component for the Electron desktop app, allowing users to switch between Dashboard, Profile, Jobs, and Settings pages. Uses Material-UI Drawer with React Router, includes active page highlighting and unsaved changes detection.

## Technical Context
**Language/Version**: TypeScript 5.3, React 18.2, Node.js (Electron 32.3)
**Primary Dependencies**: Material-UI 5.15, React Router DOM 6.x, Electron 32.3
**Storage**: N/A (UI state only, no persistence)
**Testing**: React Testing Library, Jest (existing setup)
**Target Platform**: Desktop (Windows, macOS, Linux via Electron)
**Project Type**: Electron desktop app (frontend renderer + main process)
**Performance Goals**: Instant navigation (<50ms), 60fps UI rendering
**Constraints**: No browser chrome visible, fixed sidebar width (240px), always visible
**Scale/Scope**: 4 pages, 1 layout component, 1 navigation component

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Privacy First ✅
- **Status**: PASS
- **Rationale**: No data collected, no network requests, pure UI feature

### Data Integrity ✅
- **Status**: N/A
- **Rationale**: No database changes, no data storage

### Adaptivity ✅
- **Status**: PASS
- **Rationale**: Material-UI theming allows customization, navigation routes easily extensible

### Multi-Source Support ✅
- **Status**: N/A
- **Rationale**: Not applicable to navigation feature

### Transparenz ✅
- **Status**: PASS
- **Rationale**: Navigation state is always visible, active page clearly highlighted

### Iterative Development ✅
- **Status**: PASS
- **Rationale**: v1 without keyboard shortcuts/persistence, easily extended later

## Project Structure

### Documentation (this feature)
```
specs/003-app-navigation-mit/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (N/A - UI only)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (N/A - no API)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
src/
├── main/                # Electron main process (unchanged)
├── renderer/            # React application
│   ├── components/
│   │   ├── Layout.tsx        # NEW: Main layout with sidebar
│   │   └── Sidebar.tsx       # NEW: Navigation sidebar component
│   ├── pages/
│   │   ├── Dashboard.tsx     # EXISTING
│   │   ├── Profile.tsx       # EXISTING
│   │   ├── JobDetail.tsx     # EXISTING (Jobs)
│   │   └── Settings.tsx      # EXISTING
│   ├── App.tsx              # MODIFY: Wrap routes in Layout
│   └── index.html           # EXISTING
└── shared/              # Shared types (unchanged)

tests/
└── renderer/
    └── components/
        ├── Layout.test.tsx   # NEW
        └── Sidebar.test.tsx  # NEW
```

**Structure Decision**: Electron app with React renderer. Sidebar and Layout components live in `src/renderer/components/`. No backend/main process changes needed - pure frontend feature.

## Phase 0: Outline & Research
*Prerequisites: spec.md complete*

**Research Topics**:
1. Material-UI Drawer best practices for desktop apps
2. React Router navigation patterns with persistent sidebar
3. Unsaved changes detection patterns in React

**Output**: research.md

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Data Model**: N/A (no persistent entities, UI-only feature)

2. **API Contracts**: N/A (no IPC channels needed, frontend routing only)

3. **Component Contracts**:
   - `<Layout>`: Wrapper component with sidebar + main content area
   - `<Sidebar>`: Navigation drawer with 4 menu items + active highlighting
   - Navigation routes: /, /profile, /jobs, /settings

4. **Test Scenarios**:
   - Sidebar renders 4 navigation items
   - Active page is highlighted
   - Clicking navigation item changes route
   - Unsaved changes dialog appears when navigating away from dirty page

5. **Agent Context Update**: N/A (Claude Code agent file not used in this project)

**Output**: quickstart.md, component test files

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `.specify/templates/tasks-template.md` as base
- Create tasks based on component hierarchy:
  1. Setup: Add React Router if not present
  2. Create Sidebar component with Material-UI Drawer
  3. Create Layout component wrapping routes
  4. Update App.tsx to use Layout
  5. Add active page highlighting logic
  6. Implement unsaved changes detection hook
  7. Add tests for Sidebar
  8. Add tests for Layout
  9. Update existing pages to integrate with unsaved changes hook

**Ordering Strategy**:
- Bottom-up: Sidebar → Layout → App integration
- Tests after each component
- Mark [P] for parallel test writing

**Estimated Output**: 8-10 numbered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, visual QA)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

No violations - UI-only feature aligned with all constitutional principles.

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none)

---
*Based on Constitution v1.0 - See `.specify/memory/constitution.md`*
