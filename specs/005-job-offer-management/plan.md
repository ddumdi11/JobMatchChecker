# Implementation Plan: Job Offer Management

**Branch**: `005-job-offer-management` | **Date**: 2025-10-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-job-offer-management/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path ✓
   → Spec found and loaded with 53 functional requirements
2. Fill Technical Context ✓
   → Project Type: Single Electron desktop app
   → Structure Decision: Single project layout
3. Fill Constitution Check ✓
   → Evaluated against 6 principles
4. Evaluate Constitution Check section ✓
   → No violations detected
   → Update Progress Tracking: Initial Constitution Check ✓
5. Execute Phase 0 → research.md ✓
   → All technical decisions documented
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md ✓
7. Re-evaluate Constitution Check section ✓
   → No new violations after design
   → Update Progress Tracking: Post-Design Constitution Check ✓
8. Plan Phase 2 → Describe task generation approach ✓
9. STOP - Ready for /tasks command ✓
```

**IMPORTANT**: The /plan command STOPS at step 9. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Implement comprehensive Job Offer Management system enabling users to create, read, update, and delete job offers through both manual entry and AI-assisted copy-paste workflows. The system provides filtering by status/source/date/score, sorting capabilities, pagination (25 items/page), and integrates with existing Claude API for field extraction from unstructured text.

**Key Technical Approach**: Leverage existing database schema (`job_offers`, `job_sources` tables), build new React components with Material-UI, use existing IPC handlers pattern for main/renderer communication, and extend Anthropic SDK integration for AI extraction.

## Technical Context
**Language/Version**: TypeScript 5.3
**Primary Dependencies**: React 18.2, Material-UI 5.15, React Router 6.21, better-sqlite3 12.4, Knex 3.1, Anthropic SDK 0.30, Electron 38.2
**Storage**: SQLite (via better-sqlite3 and Knex migrations)
**Testing**: Vitest 1.1, React Testing Library 14.1
**Target Platform**: Electron desktop (Windows/macOS/Linux via electron-builder)
**Project Type**: Single project (Electron app with main + renderer processes)
**Performance Goals**: Job list render < 200ms for 100 items, AI extraction < 5 seconds, filter/sort operations < 100ms
**Constraints**: <200ms p95 for UI interactions, <5s for AI calls, maintain < 100MB memory footprint for job list page
**Scale/Scope**: Support 1000+ jobs in database, 25 jobs per page, AI cost monitoring ~$5/month at 50 extractions (Phase 1: monitor only, no hard rate limits)

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Initial Constitution Check (Before Phase 0)

**1. Privacy First** ✓
- All job data stored locally in SQLite
- API key stored in `.env` file (already configured)
- No cloud sync in Phase 1
- **Compliance**: PASS

**2. Datenintegrität** ✓
- Existing backup system (Feature 004 - planned)
- Database migrations via Knex (already in use)
- Cascade delete maintains referential integrity
- **Compliance**: PASS

**3. Adaptivität** ✓
- AI extraction prompt can be refined iteratively
- Status values are simple strings (easily extendable)
- Filter/sort logic modular for future enhancements
- **Compliance**: PASS

**4. Multi-Source Support** ✓
- Jobs linked to `job_sources` table (already exists)
- Supports any job board via manual entry
- AI extraction works with any text format
- **Compliance**: PASS

**5. Transparenz** ✓
- Clear validation messages for required fields
- AI extraction shows preview before save
- Filter/sort state visible in UI
- Deletion requires confirmation dialog
- **Compliance**: PASS

**6. Iterative Entwicklung** ✓
- Phase 1: Manual CRUD + AI extraction only
- Phase 2: Bulk import, PDF, OCR (deferred)
- Builds on existing schema (no breaking changes)
- **Compliance**: PASS

**Result**: ✅ All constitutional principles satisfied. No violations detected.

## Project Structure

### Documentation (this feature)
```
specs/005-job-offer-management/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
│   ├── api-jobs.yaml    # IPC API contract for job operations
│   └── api-ai.yaml      # IPC API contract for AI extraction
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
src/
├── main/
│   ├── ipc/
│   │   └── handlers.ts                    # Add job CRUD + AI extraction handlers
│   └── services/
│       ├── jobService.ts                  # NEW: Job business logic
│       └── aiExtractionService.ts         # NEW: AI field extraction
├── renderer/
│   ├── pages/
│   │   ├── JobList.tsx                    # NEW: Main job list page (/jobs)
│   │   └── JobForm.tsx                    # NEW: Add/Edit job form page
│   ├── components/
│   │   ├── JobListTable.tsx               # NEW: Job table with sort
│   │   ├── JobListFilters.tsx             # NEW: Filter controls
│   │   ├── JobFormManual.tsx              # NEW: Manual entry form
│   │   ├── JobFormAIPaste.tsx             # NEW: AI-assisted paste form
│   │   └── JobDeleteDialog.tsx            # NEW: Confirmation dialog
│   └── hooks/
│       ├── useJobFilters.ts               # NEW: Filter state management
│       └── useJobSort.ts                  # NEW: Sort state management
└── shared/
    └── types.ts                           # Extend with Job-related types

tests/
├── contract/
│   ├── job-crud.test.ts                   # NEW: Contract tests for IPC
│   └── ai-extraction.test.ts              # NEW: AI extraction contract tests
├── integration/
│   ├── job-list-flow.test.ts              # NEW: Full job list workflow
│   └── job-crud-flow.test.ts              # NEW: CRUD operations workflow
└── unit/
    ├── jobService.test.ts                 # NEW: Service logic tests
    └── aiExtractionService.test.ts        # NEW: AI extraction tests
```

**Structure Decision**: Single project structure selected. This is an Electron desktop application with main process (Node.js backend) and renderer process (React frontend). Source code lives in `src/main` (backend logic, IPC handlers, database access) and `src/renderer` (UI components, pages, hooks). Testing follows TDD approach with contract tests first, then integration, then unit tests. Existing patterns from Profile/Skills/Preferences features are reused.

## Phase 0: Outline & Research

**Status**: ✅ COMPLETE - All research documented in [research.md](./research.md)

### Key Research Findings

1. **Job List Display Format**: Table view with Material-UI `<Table>` component (consistent with existing app patterns)

2. **Pagination Implementation**: Material-UI `<Pagination>` component with URL-based page state (React Router search params)

3. **AI Extraction Strategy**:
   - Use existing Anthropic SDK (`@anthropic-ai/sdk`)
   - Structured output via prompt engineering (JSON response)
   - 5-second timeout, fallback to partial results

4. **Filter Persistence**:
   - React state only (resets on page unmount)
   - No localStorage/sessionStorage needed

5. **Duplicate Detection**:
   - Phase 2 feature (deferred)
   - URL-based matching most reliable when implemented

**Output**: See [research.md](./research.md) for detailed decisions, rationales, and alternatives considered.

## Phase 1: Design & Contracts

**Status**: ✅ COMPLETE - All design artifacts created

### Outputs Created
1. ✅ [data-model.md](./data-model.md) - Entity definitions and relationships
2. ✅ [contracts/api-jobs.yaml](./contracts/api-jobs.yaml) - IPC API contract for job CRUD operations
3. ✅ [contracts/api-ai.yaml](./contracts/api-ai.yaml) - IPC API contract for AI extraction
4. ✅ Failing contract tests generated (will be created in Phase 2 tasks)
5. ✅ [quickstart.md](./quickstart.md) - User acceptance test scenarios
6. ✅ Agent context file updated (CLAUDE.md incremental update via script)

### Key Design Decisions

**Data Model**:
- Reuse existing `job_offers` table (no schema changes needed)
- Job entity has 3 required fields: title, company, posted_date
- Status enum: 'new', 'interesting', 'applied', 'rejected', 'archived'
- Match score nullable (filled by future matching feature)

**API Contracts**:
- 8 IPC handlers: getJobs, getJobById, createJob, updateJob, deleteJob, extractJobFields, getJobSources, getJobStatusOptions
- Request/response schemas use TypeScript types
- Error handling: specific error codes for validation, not found, database errors

**Testing Strategy**:
- Contract tests assert IPC handler interfaces
- Integration tests cover full user workflows (8 scenarios from spec)
- Unit tests cover service logic (field extraction, filtering, sorting)

### Post-Design Constitution Check

**Re-evaluation after Phase 1 design**:
- ✅ Privacy First: Still compliant (local storage, no new external services)
- ✅ Datenintegrität: CASCADE DELETE properly configured in contracts
- ✅ Adaptivität: Modular service design allows prompt refinement
- ✅ Multi-Source Support: job_sources table integration maintained
- ✅ Transparenz: Error responses include user-friendly messages
- ✅ Iterative Entwicklung: Design adds features without breaking existing functionality

**Result**: ✅ No new constitutional violations. Design approved.

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
1. Load `.specify/templates/tasks-template.md` as base structure
2. Generate tasks from Phase 1 contracts and data model:
   - Each IPC endpoint in contracts → 1 contract test task
   - Each service class → 1 unit test task
   - Each user scenario in quickstart.md → 1 integration test task
   - Each UI component in structure → 1 implementation task
3. Apply TDD ordering: Tests before implementation
4. Mark parallelizable tasks with [P] (independent files, no shared state)
5. Group related tasks into sections:
   - Section 1: Contract tests (8 tasks, all [P])
   - Section 2: Service implementation (2 tasks)
   - Section 3: IPC handlers (1 task)
   - Section 4: UI components (7 tasks, some [P])
   - Section 5: Pages/routing (2 tasks)
   - Section 6: Integration tests (8 tasks)
   - Section 7: Documentation/polish (2 tasks)

**Task Dependencies**:
- Contract tests → Services → IPC handlers → UI components → Pages → Integration tests
- Within UI components: Atomic components [P] before composite components
- Integration tests run last (depend on full implementation)

**Ordering Strategy**:
1. Contract tests first (define interfaces) - All parallel
2. Service layer (business logic) - Sequential
3. IPC handlers (connect services to renderer) - Sequential
4. UI components (atomic first) - Parallel where possible
5. Pages (compose components) - Sequential
6. Integration tests (validate scenarios) - Parallel
7. Polish/documentation - Parallel

**Estimated Output**: 30-35 numbered tasks in tasks.md, organized by dependency order, with clear acceptance criteria per task.

**Complexity Estimate**: Medium-High
- New routes: 2 (`/jobs`, `/jobs/new`, `/jobs/:id/edit`)
- New components: 7
- New services: 2
- New IPC handlers: 8
- Test files: 18 (8 contract + 8 integration + 2 unit)

**IMPORTANT**: This phase is executed by the `/tasks` command, NOT by `/plan`

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)
**Phase 4**: Implementation (execute tasks.md following constitutional principles)
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

No violations detected. This section is empty.

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [x] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none exist)

---
*Based on Constitution v1.0 - See `.specify/memory/constitution.md`*
