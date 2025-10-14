# Tasks: Job Offer Management

**Feature**: 005-job-offer-management
**Branch**: `005-job-offer-management`
**Input**: Design documents from `/specs/005-job-offer-management/`
**Prerequisites**: plan.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

## Overview

This task list implements the Job Offer Management feature following TDD (Test-Driven Development) principles. Tasks are ordered by dependencies, with parallel-executable tasks marked [P].

**Total Estimated Tasks**: 33
**Estimated Completion Time**: 12-16 hours
**Complexity**: Medium-High

## Path Conventions

This is a single Electron project:
- **Main process**: `src/main/` (Node.js, IPC handlers, services, database)
- **Renderer process**: `src/renderer/` (React, UI components, pages, hooks)
- **Shared types**: `src/shared/`
- **Tests**: `tests/` (contract, integration, unit)

---

## Phase 3.1: Setup & Types

### T001: Extend shared types for Job entities
**File**: `src/shared/types.ts`
**Description**: Add TypeScript interfaces and types for Job Offer Management

**Acceptance Criteria**:
- [ ] Add `JobOffer` interface matching data-model.md schema
- [ ] Add `JobStatus` type: `'new' | 'interesting' | 'applied' | 'rejected' | 'archived'`
- [ ] Add `JobSource` interface (if not already exists)
- [ ] Add `AIExtractionResult` interface for AI service responses
- [ ] Add `JobFilters` interface for filter state
- [ ] Add `JobSortConfig` interface for sort state
- [ ] All interfaces use camelCase field names (match existing pattern)
- [ ] Export all new types

**Dependencies**: None

**Implementation Notes**:
```typescript
export interface JobOffer {
  id: number;
  sourceId: number;
  sourceName?: string;        // Joined from job_sources (read-only)
  title: string;
  company: string;
  url?: string | null;
  postedDate: Date;
  deadline?: Date | null;
  location?: string | null;
  remoteOption?: string | null;
  salaryRange?: string | null;
  contractType?: string | null;
  fullText?: string | null;
  rawImportData?: string | null;
  importMethod?: 'manual' | 'ai_paste' | 'bulk' | null;
  notes?: string | null;
  status: JobStatus;
  matchScore?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export type JobStatus = 'new' | 'interesting' | 'applied' | 'rejected' | 'archived';

export interface AIExtractionResult {
  success: boolean;
  fields: Partial<JobOffer>;
  confidence: 'high' | 'medium' | 'low';
  missingRequired: string[];
  warnings?: string[];
}

export interface JobFilters {
  status?: JobStatus | null;
  sourceId?: number | null;
  postedDateFrom?: Date | null;
  postedDateTo?: Date | null;
  matchScoreMin?: number | null;
  matchScoreMax?: number | null;
}

export interface JobSortConfig {
  sortBy: 'postedDate' | 'company' | 'status' | 'matchScore';
  sortOrder: 'asc' | 'desc';
}
```

---

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL**: These tests MUST be written and MUST FAIL before ANY implementation code is written.

### T002 [P]: Contract test for getJobs IPC handler
**File**: `tests/contract/job-crud.test.ts` (section 1)
**Description**: Write failing contract test for GET /api/jobs endpoint

**Acceptance Criteria**:
- [ ] Test `window.api.getJobs()` exists
- [ ] Test accepts pagination params: `{ page: 1, limit: 25 }`
- [ ] Test accepts filter params: `{ status, sourceId, postedDateFrom, postedDateTo, matchScoreMin, matchScoreMax }`
- [ ] Test accepts sort params: `{ sortBy, sortOrder }`
- [ ] Test returns `{ jobs: JobOffer[], pagination: { page, limit, total, totalPages } }`
- [ ] Test handles empty filter (returns all jobs)
- [ ] Test handles multiple filters (AND logic)
- [ ] Test must **FAIL** (handler not implemented yet)

**Dependencies**: T001

---

### T003 [P]: Contract test for getJobById IPC handler
**File**: `tests/contract/job-crud.test.ts` (section 2)
**Description**: Write failing contract test for GET /api/jobs/:id endpoint

**Acceptance Criteria**:
- [ ] Test `window.api.getJobById(id)` exists
- [ ] Test accepts integer ID parameter
- [ ] Test returns `JobOffer` object with `sourceName` joined
- [ ] Test throws NOT_FOUND error for non-existent ID
- [ ] Test must **FAIL** (handler not implemented yet)

**Dependencies**: T001

---

### T004 [P]: Contract test for createJob IPC handler
**File**: `tests/contract/job-crud.test.ts` (section 3)
**Description**: Write failing contract test for POST /api/jobs endpoint

**Acceptance Criteria**:
- [ ] Test `window.api.createJob(data)` exists
- [ ] Test accepts `JobOfferInput` object (required: sourceId, title, company, postedDate)
- [ ] Test returns created `JobOffer` with generated ID and timestamps
- [ ] Test throws VALIDATION_ERROR for missing required fields
- [ ] Test throws VALIDATION_ERROR for future `postedDate`
- [ ] Test throws VALIDATION_ERROR for `deadline` before `postedDate`
- [ ] Test throws VALIDATION_ERROR for invalid URL format
- [ ] Test must **FAIL** (handler not implemented yet)

**Dependencies**: T001

---

### T005 [P]: Contract test for updateJob IPC handler
**File**: `tests/contract/job-crud.test.ts` (section 4)
**Description**: Write failing contract test for PUT /api/jobs/:id endpoint

**Acceptance Criteria**:
- [ ] Test `window.api.updateJob(id, data)` exists
- [ ] Test accepts ID and `JobOfferInput` object
- [ ] Test returns updated `JobOffer` with refreshed `updatedAt`
- [ ] Test throws NOT_FOUND for non-existent ID
- [ ] Test throws VALIDATION_ERROR for invalid data (same rules as create)
- [ ] Test must **FAIL** (handler not implemented yet)

**Dependencies**: T001

---

### T006 [P]: Contract test for deleteJob IPC handler
**File**: `tests/contract/job-crud.test.ts` (section 5)
**Description**: Write failing contract test for DELETE /api/jobs/:id endpoint

**Acceptance Criteria**:
- [ ] Test `window.api.deleteJob(id)` exists
- [ ] Test accepts integer ID parameter
- [ ] Test returns void (no content)
- [ ] Test throws NOT_FOUND for non-existent ID
- [ ] Test cascades to `matching_results` (verify foreign key constraint)
- [ ] Test must **FAIL** (handler not implemented yet)

**Dependencies**: T001

---

### T007 [P]: Contract test for getJobSources IPC handler
**File**: `tests/contract/job-crud.test.ts` (section 6)
**Description**: Write failing contract test for GET /api/jobs/sources endpoint

**Acceptance Criteria**:
- [ ] Test `window.api.getJobSources()` exists
- [ ] Test returns array of `JobSource` objects
- [ ] Test returns empty array if no sources configured
- [ ] Test must **FAIL** (handler not implemented yet)

**Dependencies**: T001

---

### T008 [P]: Contract test for getJobStatusOptions IPC handler
**File**: `tests/contract/job-crud.test.ts` (section 7)
**Description**: Write failing contract test for GET /api/jobs/status-options endpoint

**Acceptance Criteria**:
- [ ] Test `window.api.getJobStatusOptions()` exists
- [ ] Test returns array of `{ value: JobStatus, label: string }` objects
- [ ] Test returns all 5 status values: new, interesting, applied, rejected, archived
- [ ] Test labels are user-friendly (capitalized)
- [ ] Test must **FAIL** (handler not implemented yet)

**Dependencies**: T001

---

### T009 [P]: Contract test for extractJobFields IPC handler
**File**: `tests/contract/ai-extraction.test.ts`
**Description**: Write failing contract test for POST /api/jobs/extract endpoint

**Acceptance Criteria**:
- [ ] Test `window.api.extractJobFields(text)` exists
- [ ] Test accepts string (job description text)
- [ ] Test returns `AIExtractionResult` object
- [ ] Test timeout after 5 seconds (mock slow API)
- [ ] Test handles partial extraction (missing required fields)
- [ ] Test handles API key missing error
- [ ] Test handles rate limit error
- [ ] Test must **FAIL** (handler not implemented yet)

**Dependencies**: T001

---

### T010 [P]: Unit test for jobService validation logic
**File**: `tests/unit/jobService.test.ts`
**Description**: Write unit tests for job validation business rules

**Acceptance Criteria**:
- [ ] Test BR-1: Required fields (title, company, postedDate, sourceId)
- [ ] Test BR-2: postedDate not in future
- [ ] Test BR-3: deadline after postedDate
- [ ] Test BR-4: URL validation (valid HTTP/HTTPS)
- [ ] Test BR-5: Status enum values
- [ ] Test BR-6: Match score range (0-100)
- [ ] Test BR-7: Foreign key integrity (source exists)
- [ ] Tests must **FAIL** (service not implemented yet)

**Dependencies**: T001

---

### T011 [P]: Unit test for aiExtractionService
**File**: `tests/unit/aiExtractionService.test.ts`
**Description**: Write unit tests for AI extraction logic

**Acceptance Criteria**:
- [ ] Test successful extraction with high confidence
- [ ] Test partial extraction with medium/low confidence
- [ ] Test timeout handling (5 seconds)
- [ ] Test API key missing error
- [ ] Test rate limit handling
- [ ] Test JSON parsing from Claude response
- [ ] Test field mapping to JobOffer interface
- [ ] Tests must **FAIL** (service not implemented yet)

**Dependencies**: T001

---

## Phase 3.3: Core Implementation (ONLY after tests are failing)

**Gate**: All tests T002-T011 must be written and failing before proceeding.

### T012: Implement jobService with validation
**File**: `src/main/services/jobService.ts` (new file)
**Description**: Create job service with CRUD operations and business rule validation

**Acceptance Criteria**:
- [ ] Export `createJob(data)` function
- [ ] Export `getJobById(id)` function
- [ ] Export `getJobs(filters, sort, pagination)` function
- [ ] Export `updateJob(id, data)` function
- [ ] Export `deleteJob(id)` function
- [ ] Export `getJobSources()` function
- [ ] Export `getJobStatusOptions()` function
- [ ] Implement all 6 business rules from data-model.md
- [ ] Use prepared statements for SQL queries
- [ ] Return proper error codes: VALIDATION_ERROR, NOT_FOUND, DATABASE_ERROR
- [ ] Test T010 now passes

**Dependencies**: T010 (test must exist and fail)

**Implementation Notes**:
- Use existing `db.ts` database connection
- Follow pattern from `src/main/ipc/handlers.ts` (existing profile/skills handlers)
- SQL queries from data-model.md Query Patterns section
- Validate before INSERT/UPDATE, throw errors with user-friendly messages

---

### T013: Implement aiExtractionService
**File**: `src/main/services/aiExtractionService.ts` (new file)
**Description**: Create AI extraction service using Anthropic SDK

**Acceptance Criteria**:
- [ ] Export `extractJobFields(text: string)` function
- [ ] Use existing Anthropic SDK (`@anthropic-ai/sdk`)
- [ ] Implement 5-second timeout with AbortController
- [ ] Return `AIExtractionResult` with confidence level
- [ ] Identify missing required fields
- [ ] Handle API errors gracefully (missing key, rate limit, network)
- [ ] Parse JSON response from Claude API
- [ ] Map extracted fields to JobOffer interface (camelCase)
- [ ] Test T011 now passes

**Dependencies**: T011 (test must exist and fail)

**Implementation Notes**:
```typescript
import Anthropic from '@anthropic-ai/sdk';

const prompt = `Extract structured job offer fields from this text.
Return JSON with fields: title, company, location, remoteOption, salaryRange,
contractType, postedDate (YYYY-MM-DD), deadline (YYYY-MM-DD), url, fullText.

Job text:
${text}

Return only valid JSON, no explanation.`;
```

---

### T014: Add IPC handlers for job operations
**File**: `src/main/ipc/handlers.ts` (extend existing file)
**Description**: Register IPC handlers for all 8 job-related endpoints

**Acceptance Criteria**:
- [ ] Add `getJobs` handler (calls `jobService.getJobs`)
- [ ] Add `getJobById` handler (calls `jobService.getJobById`)
- [ ] Add `createJob` handler (calls `jobService.createJob`)
- [ ] Add `updateJob` handler (calls `jobService.updateJob`)
- [ ] Add `deleteJob` handler (calls `jobService.deleteJob`)
- [ ] Add `getJobSources` handler (calls `jobService.getJobSources`)
- [ ] Add `getJobStatusOptions` handler (calls `jobService.getJobStatusOptions`)
- [ ] Add `extractJobFields` handler (calls `aiExtractionService.extractJobFields`)
- [ ] All handlers use existing IPC pattern (`ipcMain.handle`)
- [ ] Tests T002-T009 now pass

**Dependencies**: T002-T009 (tests), T012 (jobService), T013 (aiExtractionService)

**Implementation Notes**:
- Follow pattern from existing handlers (`getProfile`, `updateProfile`, etc.)
- Wrap service calls in try-catch, return error objects
- Example:
```typescript
ipcMain.handle('getJobs', async (event, filters, sort, pagination) => {
  try {
    return await jobService.getJobs(filters, sort, pagination);
  } catch (error) {
    return { error: error.message, code: error.code };
  }
});
```

---

### T015: Expose IPC handlers in preload script
**File**: `src/main/preload.ts` (extend existing file)
**Description**: Add job-related APIs to `window.api` for renderer access

**Acceptance Criteria**:
- [ ] Add `getJobs` to `window.api`
- [ ] Add `getJobById` to `window.api`
- [ ] Add `createJob` to `window.api`
- [ ] Add `updateJob` to `window.api`
- [ ] Add `deleteJob` to `window.api`
- [ ] Add `getJobSources` to `window.api`
- [ ] Add `getJobStatusOptions` to `window.api`
- [ ] Add `extractJobFields` to `window.api`
- [ ] Update `src/renderer/global.d.ts` with type definitions

**Dependencies**: T014

**Implementation Notes**:
```typescript
// In preload.ts
const api = {
  // ... existing methods
  getJobs: (filters, sort, pagination) => ipcRenderer.invoke('getJobs', filters, sort, pagination),
  // ... other job methods
};

// In global.d.ts
interface Window {
  api: {
    // ... existing
    getJobs: (filters?: JobFilters, sort?: JobSortConfig, pagination?: { page: number; limit: number }) => Promise<{ jobs: JobOffer[]; pagination: PaginationInfo }>;
    // ... other job methods
  };
}
```

---

## Phase 3.4: UI Components (Atomic → Composite)

### T016 [P]: Implement useJobFilters hook
**File**: `src/renderer/hooks/useJobFilters.ts` (new file)
**Description**: Custom hook for managing filter state

**Acceptance Criteria**:
- [ ] Export `useJobFilters()` hook
- [ ] Return `{ filters, setFilters, resetFilters }` object
- [ ] State type: `JobFilters` from shared types
- [ ] Initial state: all filters null
- [ ] `resetFilters()` clears all filters to initial state
- [ ] State resets on component unmount (no persistence)

**Dependencies**: T001

---

### T017 [P]: Implement useJobSort hook
**File**: `src/renderer/hooks/useJobSort.ts` (new file)
**Description**: Custom hook for managing sort state

**Acceptance Criteria**:
- [ ] Export `useJobSort()` hook
- [ ] Return `{ sortConfig, setSortConfig, toggleSort }` object
- [ ] State type: `JobSortConfig` from shared types
- [ ] Initial state: `{ sortBy: 'postedDate', sortOrder: 'desc' }`
- [ ] `toggleSort(column)` toggles order if same column, else sets new column

**Dependencies**: T001

---

### T018 [P]: Implement JobDeleteDialog component
**File**: `src/renderer/components/JobDeleteDialog.tsx` (new file)
**Description**: Confirmation dialog for job deletion

**Acceptance Criteria**:
- [ ] Props: `{ open, jobTitle, onConfirm, onCancel }`
- [ ] Use Material-UI `<Dialog>` component
- [ ] Display job title in confirmation message
- [ ] Two buttons: "Cancel" (secondary) and "Delete" (danger/red)
- [ ] Accessible (aria-labels, keyboard navigation)
- [ ] Close dialog on both cancel and confirm

**Dependencies**: T001

**Implementation Notes**:
```tsx
<Dialog open={open} onClose={onCancel}>
  <DialogTitle>Delete Job?</DialogTitle>
  <DialogContent>
    <DialogContentText>
      Are you sure you want to delete "<strong>{jobTitle}</strong>"?
      This action cannot be undone.
    </DialogContentText>
  </DialogContent>
  <DialogActions>
    <Button onClick={onCancel}>Cancel</Button>
    <Button onClick={onConfirm} color="error" variant="contained">
      Delete
    </Button>
  </DialogActions>
</Dialog>
```

---

### T019: Implement JobListFilters component
**File**: `src/renderer/components/JobListFilters.tsx` (new file)
**Description**: Filter controls for job list (status, source, date range, match score)

**Acceptance Criteria**:
- [ ] Props: `{ filters, setFilters, sources }`
- [ ] Use Material-UI form controls (Select, DatePicker, TextField)
- [ ] 6 filter controls: Status, Source, Posted Date From/To, Match Score Min/Max
- [ ] "Clear All Filters" button (visible only when filters active)
- [ ] Responsive layout (Grid or Stack)
- [ ] Filter changes trigger immediate re-render (controlled components)

**Dependencies**: T001, T016 (useJobFilters hook)

---

### T020: Implement JobListTable component
**File**: `src/renderer/components/JobListTable.tsx` (new file)
**Description**: Table display for job list with sortable columns

**Acceptance Criteria**:
- [ ] Props: `{ jobs, sortConfig, onSortChange, onRowClick }`
- [ ] Use Material-UI `<Table>`, `<TableHead>`, `<TableBody>`, `<TableRow>`, `<TableCell>`
- [ ] Columns: Title, Company, Status, Posted Date, Source, Location, Match Score
- [ ] Sortable columns use `<TableSortLabel>` (Posted Date, Company, Status, Match Score)
- [ ] Row click navigates to job detail page
- [ ] Empty state: "No jobs found" message with helpful text
- [ ] Sticky header for scrolling
- [ ] Responsive (hide Location/Match Score on mobile)

**Dependencies**: T001, T017 (useJobSort hook)

---

### T021: Implement JobFormManual component
**File**: `src/renderer/components/JobFormManual.tsx` (new file)
**Description**: Manual job entry form (all fields editable)

**Acceptance Criteria**:
- [ ] Props: `{ initialData?, onSubmit, onCancel, sources }`
- [ ] Use Material-UI form components (TextField, Select, DatePicker)
- [ ] All fields from JobOffer interface (required fields marked with *)
- [ ] Client-side validation (required fields, date validation, URL format)
- [ ] Error messages under invalid fields (red border + helper text)
- [ ] Submit button disabled until required fields valid
- [ ] Cancel button resets form (if create) or discards changes (if edit)
- [ ] Pre-populate if `initialData` provided (edit mode)

**Dependencies**: T001

---

### T022: Implement JobFormAIPaste component
**File**: `src/renderer/components/JobFormAIPaste.tsx` (new file)
**Description**: AI-assisted job entry form (textarea → extract → manual review)

**Acceptance Criteria**:
- [ ] Props: `{ onSubmit, onCancel, sources }`
- [ ] Large textarea for pasting job description text
- [ ] "Extract with AI" button
- [ ] Loading indicator during extraction (max 5 seconds)
- [ ] After extraction: show `JobFormManual` pre-filled with extracted data
- [ ] Missing required fields highlighted in red
- [ ] Warning message if confidence low or fields missing
- [ ] User can edit extracted fields before saving
- [ ] Store original text in `rawImportData` field

**Dependencies**: T001, T021 (JobFormManual)

**Implementation Notes**:
```tsx
const handleExtract = async () => {
  setLoading(true);
  try {
    const result = await window.api.extractJobFields(text);
    if (result.success) {
      setExtractedData(result.fields);
      setMissingFields(result.missingRequired);
      setConfidence(result.confidence);
    }
  } finally {
    setLoading(false);
  }
};
```

---

## Phase 3.5: Pages & Routing

### T023: Implement JobList page
**File**: `src/renderer/pages/JobList.tsx` (new file)
**Description**: Main job list page with filters, table, and pagination

**Acceptance Criteria**:
- [ ] Route: `/jobs`
- [ ] Fetch jobs on mount with `window.api.getJobs()`
- [ ] Use `useJobFilters()` and `useJobSort()` hooks
- [ ] Use `useSearchParams()` for pagination (page number in URL)
- [ ] Render `<JobListFilters>` component
- [ ] Render `<JobListTable>` component
- [ ] Render Material-UI `<Pagination>` component (25 items/page)
- [ ] "Add Job" button (FloatingActionButton or AppBar action)
- [ ] Re-fetch jobs when filters, sort, or page changes
- [ ] Loading state (skeleton or spinner)
- [ ] Error state (error message with retry button)

**Dependencies**: T015 (IPC), T016-T017 (hooks), T019-T020 (components)

---

### T024: Implement JobForm page
**File**: `src/renderer/pages/JobForm.tsx` (new file)
**Description**: Add/Edit job form page (with mode toggle)

**Acceptance Criteria**:
- [ ] Routes: `/jobs/new` (create) and `/jobs/:id/edit` (edit)
- [ ] Mode toggle: "Manual Entry" / "Paste Job Text" tabs
- [ ] Create mode: default to Manual Entry
- [ ] Edit mode: show Manual Entry only (pre-filled with existing data)
- [ ] Fetch job sources on mount with `window.api.getJobSources()`
- [ ] Fetch job data if editing (`window.api.getJobById(id)`)
- [ ] Handle form submission (`window.api.createJob` or `updateJob`)
- [ ] Success: show toast message + navigate to `/jobs`
- [ ] Error: display validation errors inline
- [ ] Cancel button navigates back to `/jobs`

**Dependencies**: T015 (IPC), T021-T022 (form components)

---

### T025: Add job routes to App router
**File**: `src/renderer/App.tsx` (extend existing routes)
**Description**: Register job routes in React Router configuration

**Acceptance Criteria**:
- [ ] Add `/jobs` route → `<JobList />` page
- [ ] Add `/jobs/new` route → `<JobForm />` page
- [ ] Add `/jobs/:id/edit` route → `<JobForm />` page
- [ ] Routes nested under existing `<Layout />` component
- [ ] Update sidebar navigation to include "Jobs" link

**Dependencies**: T023-T024 (pages)

**Implementation Notes**:
```tsx
const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      // ... existing routes
      {
        path: 'jobs',
        element: <JobList />,
      },
      {
        path: 'jobs/new',
        element: <JobForm />,
      },
      {
        path: 'jobs/:id/edit',
        element: <JobForm />,
      },
    ],
  },
]);
```

---

## Phase 3.6: Integration Tests

**Note**: These tests validate full user workflows from quickstart.md scenarios.

### T026 [P]: Integration test for Scenario 2 (Add Job Manually)
**File**: `tests/integration/job-crud-flow.test.ts` (section 1)
**Description**: Test manual job creation workflow

**Acceptance Criteria**:
- [ ] Navigate to `/jobs` page
- [ ] Click "Add Job" button
- [ ] Select "Manual Entry" mode
- [ ] Fill required fields (title, company, posted date, source)
- [ ] Fill optional fields (location, salary)
- [ ] Submit form
- [ ] Verify success message displayed
- [ ] Verify redirect to `/jobs` page
- [ ] Verify new job appears in table
- [ ] Verify job persisted to database

**Dependencies**: T025 (routing complete)

---

### T027 [P]: Integration test for Scenario 3 (AI-Assisted Paste)
**File**: `tests/integration/job-crud-flow.test.ts` (section 2)
**Description**: Test AI extraction workflow

**Acceptance Criteria**:
- [ ] Navigate to `/jobs/new`
- [ ] Select "Paste Job Text" mode
- [ ] Paste test job description
- [ ] Click "Extract with AI" button
- [ ] Verify loading indicator appears
- [ ] Verify form fields pre-filled after extraction
- [ ] Manually select job source
- [ ] Submit form
- [ ] Verify job saved with `import_method: 'ai_paste'`
- [ ] Verify `raw_import_data` contains original text

**Dependencies**: T025

---

### T028 [P]: Integration test for Scenario 4 (Required Field Validation)
**File**: `tests/integration/job-crud-flow.test.ts` (section 3)
**Description**: Test form validation

**Acceptance Criteria**:
- [ ] Navigate to `/jobs/new`
- [ ] Leave title field empty
- [ ] Fill other required fields
- [ ] Attempt to submit
- [ ] Verify form does NOT submit
- [ ] Verify error message under title field
- [ ] Verify title field has red border
- [ ] Fill title field
- [ ] Verify error clears
- [ ] Submit successfully

**Dependencies**: T025

---

### T029 [P]: Integration test for Scenario 5 (Filter by Status)
**File**: `tests/integration/job-list-flow.test.ts` (section 1)
**Description**: Test status filter

**Acceptance Criteria**:
- [ ] Seed database with 5 jobs (2 new, 2 interesting, 1 applied)
- [ ] Navigate to `/jobs`
- [ ] Verify 5 jobs displayed
- [ ] Select "Interesting" from status filter
- [ ] Verify table shows only 2 jobs
- [ ] Verify count displays "Showing 2 of 5 jobs"
- [ ] Clear filter
- [ ] Verify all 5 jobs displayed again

**Dependencies**: T025

---

### T030 [P]: Integration test for Scenario 6 (Multiple Filters AND logic)
**File**: `tests/integration/job-list-flow.test.ts` (section 2)
**Description**: Test AND logic for combined filters

**Acceptance Criteria**:
- [ ] Seed database with 10 jobs (varied attributes)
- [ ] Navigate to `/jobs`
- [ ] Apply Status filter: "New"
- [ ] Apply Source filter: "LinkedIn"
- [ ] Apply Posted Date From filter: 7 days ago
- [ ] Verify only jobs matching ALL criteria displayed
- [ ] Verify count accurate
- [ ] Verify filter chips/badges show all active filters

**Dependencies**: T025

---

### T031 [P]: Integration test for Scenario 7 (Sorting)
**File**: `tests/integration/job-list-flow.test.ts` (section 3)
**Description**: Test column sorting

**Acceptance Criteria**:
- [ ] Seed database with 5 jobs (different posted dates and companies)
- [ ] Navigate to `/jobs`
- [ ] Verify default sort: Posted Date DESC (newest first)
- [ ] Click "Company" column header
- [ ] Verify sort changes to Company ASC (A-Z)
- [ ] Verify sort indicator shows ascending arrow
- [ ] Click "Company" header again
- [ ] Verify sort reverses to Company DESC (Z-A)

**Dependencies**: T025

---

### T032 [P]: Integration test for Scenario 8 (Pagination)
**File**: `tests/integration/job-list-flow.test.ts` (section 4)
**Description**: Test pagination with 25 items per page

**Acceptance Criteria**:
- [ ] Seed database with 30 jobs
- [ ] Navigate to `/jobs`
- [ ] Verify exactly 25 jobs displayed
- [ ] Verify pagination shows "Page 1 of 2"
- [ ] Click "Next" or page "2"
- [ ] Verify URL changes to `?page=2`
- [ ] Verify next 5 jobs displayed
- [ ] Click "Previous"
- [ ] Verify returns to page 1

**Dependencies**: T025

---

### T033 [P]: Integration test for Scenario 9 (Edit Job)
**File**: `tests/integration/job-crud-flow.test.ts` (section 4)
**Description**: Test job editing workflow

**Acceptance Criteria**:
- [ ] Seed database with 1 job
- [ ] Navigate to `/jobs`
- [ ] Click job row to open detail (or use Edit button)
- [ ] Verify form pre-filled with existing data
- [ ] Change status from "New" to "Applied"
- [ ] Add notes field
- [ ] Submit form
- [ ] Verify success message
- [ ] Verify changes persisted to database
- [ ] Verify `updated_at` timestamp refreshed

**Dependencies**: T025

---

### T034 [P]: Integration test for Scenario 10 (Delete Job)
**File**: `tests/integration/job-crud-flow.test.ts` (section 5)
**Description**: Test job deletion with confirmation

**Acceptance Criteria**:
- [ ] Seed database with 1 job
- [ ] Navigate to `/jobs/:id/edit` or job detail page
- [ ] Click "Delete Job" button
- [ ] Verify confirmation dialog appears
- [ ] Click "Cancel"
- [ ] Verify dialog closes, job still exists
- [ ] Click "Delete Job" again
- [ ] Click "Delete" (confirm)
- [ ] Verify success message
- [ ] Verify redirect to `/jobs`
- [ ] Verify job no longer in database

**Dependencies**: T025

---

## Phase 3.7: Polish & Documentation

### T035 [P]: Add JSDoc comments to services
**File**: `src/main/services/jobService.ts`, `src/main/services/aiExtractionService.ts`
**Description**: Document service functions with JSDoc

**Acceptance Criteria**:
- [ ] Add JSDoc comment to each exported function
- [ ] Document parameters with `@param`
- [ ] Document return types with `@returns`
- [ ] Document thrown errors with `@throws`
- [ ] Include example usage in comments

**Dependencies**: T012-T013

---

### T036 [P]: Performance validation
**File**: N/A (manual testing + profiling)
**Description**: Verify performance benchmarks from quickstart.md

**Acceptance Criteria**:
- [ ] Job list load (100 jobs) < 200ms
- [ ] Apply single filter < 100ms
- [ ] Sort column < 100ms
- [ ] Pagination (page change) < 100ms
- [ ] AI extraction < 5 seconds
- [ ] Create job (manual) < 500ms
- [ ] Update job < 500ms
- [ ] Delete job < 500ms
- [ ] Document results in quickstart.md Performance Benchmarks table

**Dependencies**: All integration tests (T026-T034)

---

### T037: Run quickstart.md manual test suite
**File**: `specs/005-job-offer-management/quickstart.md`
**Description**: Execute all 13 acceptance scenarios manually

**Acceptance Criteria**:
- [ ] Complete all 13 scenarios from quickstart.md
- [ ] Mark pass/fail for each scenario
- [ ] Document any bugs found
- [ ] Update "Pass Rate" in quickstart.md
- [ ] All scenarios must pass before feature complete

**Dependencies**: T036 (performance validated)

---

## Dependencies Graph

```
T001 (Types)
  ├─→ T002-T009 [P] (Contract tests)
  ├─→ T010-T011 [P] (Unit tests)
  ├─→ T016-T018 [P] (Hooks & Dialog)
  └─→ T021-T022 (Form components)

T002-T009 (Contract tests)
  └─→ T010-T011 (Unit tests)
      ├─→ T012 (jobService)
      └─→ T013 (aiExtractionService)
          └─→ T014 (IPC handlers)
              └─→ T015 (Preload)

T016-T017 [P] (Hooks)
  └─→ T019-T020 (Filters & Table)

T018 [P] (Dialog)
  └─→ (Used in JobList page)

T021 (Manual form)
  └─→ T022 (AI Paste form)

T015 + T019-T022 (All UI ready)
  └─→ T023-T024 (Pages)
      └─→ T025 (Routing)
          └─→ T026-T034 [P] (Integration tests)
              └─→ T035-T036 [P] (Polish)
                  └─→ T037 (Manual QA)
```

---

## Parallel Execution Examples

**Contract Tests (T002-T009)**: All can run in parallel (different test file sections)
```bash
# Launch contract tests together:
vitest tests/contract/job-crud.test.ts tests/contract/ai-extraction.test.ts
```

**Unit Tests (T010-T011)**: Parallel (different service files)
```bash
vitest tests/unit/jobService.test.ts tests/unit/aiExtractionService.test.ts
```

**UI Components (T016-T018, T021-T022)**: Parallel if no dependencies
```bash
# Hooks and Dialog (T016-T018) can be built in parallel
# Forms (T021-T022) are sequential (T022 depends on T021)
```

**Integration Tests (T026-T034)**: All parallel (independent scenarios)
```bash
vitest tests/integration/job-crud-flow.test.ts tests/integration/job-list-flow.test.ts
```

---

## Validation Checklist

**Before marking tasks complete**:
- [x] All contract tests written and failing (T002-T009)
- [x] All unit tests written and failing (T010-T011)
- [ ] All contract tests passing after implementation (T012-T015)
- [ ] All unit tests passing after implementation (T012-T013)
- [ ] All integration tests written (T026-T034)
- [ ] All integration tests passing (T026-T034)
- [ ] All 13 quickstart scenarios pass (T037)
- [ ] Performance benchmarks met (T036)
- [ ] No console errors in production build
- [ ] TypeScript compilation successful with no errors

---

## Notes

- **TDD is critical**: Do NOT implement code before tests exist and fail
- **Commit after each task**: Keep git history granular for easy rollback
- **Test isolation**: Each test should be independent (seed data, clean up)
- **Error handling**: Always return user-friendly error messages
- **Accessibility**: All form controls must have labels and aria-attributes
- **Responsive design**: Test on multiple screen sizes (desktop, tablet, mobile)

---

**Total Tasks**: 37
**Estimated Time**: 14-18 hours
**Complexity**: Medium-High

Ready to start implementation. Begin with T001 (Types) and proceed sequentially through each phase.
