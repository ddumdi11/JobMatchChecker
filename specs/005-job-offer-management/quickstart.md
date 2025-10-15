# Quickstart: Job Offer Management

**Feature**: 005-job-offer-management
**Date**: 2025-10-14
**Purpose**: User acceptance test scenarios for validating the Job Offer Management feature

## Prerequisites

Before running these scenarios, ensure:

1. **Application Running**: Job Match Checker desktop app is launched
2. **Database Initialized**: Migrations run successfully, `job_offers` and `job_sources` tables exist
3. **Job Sources Configured**: At least one job source exists (e.g., "LinkedIn", "Indeed")
4. **API Key Set**: `ANTHROPIC_API_KEY` in `.env` file (for AI extraction scenarios)
5. **Test Data**: (Optional) Seed database with sample jobs for filter/sort testing

---

## Scenario 1: View Empty Job List

**Goal**: Verify job list page loads correctly when no jobs exist

**Steps**:
1. Navigate to application home
2. Click "Jobs" in sidebar navigation
3. Observe `/jobs` route loads

**Expected Result**:
- Page title displays "Job Offers" or "My Jobs"
- Empty state message: "No jobs found. Click 'Add Job' to get started."
- "Add Job" button is visible and enabled
- No table/list displayed (or table with empty state)
- URL shows `/jobs`

**Pass Criteria**: ✅ Empty state renders without errors

---

## Scenario 2: Add Job Manually

**Goal**: Create a job offer using manual form entry (FR-016 to FR-023)

**Steps**:
1. From job list page, click "Add Job" button
2. Select "Manual Entry" mode (if mode selection exists)
3. Fill in required fields:
   - Title: `"Full Stack Engineer"`
   - Company: `"StartupXYZ"`
   - Posted Date: `2025-10-14` (today)
4. Select job source from dropdown: `"LinkedIn"`
5. Fill optional fields:
   - Location: `"Remote"`
   - Salary Range: `"50k-70k"`
6. Click "Save" button

**Expected Result**:
- Form validates successfully (no error messages)
- Success message: "Job added successfully"
- Redirect to `/jobs` list page
- New job appears in table with status "New"
- Job details match entered data

**Pass Criteria**: ✅ Job created and persisted to database

---

## Scenario 3: Add Job via AI-Assisted Copy-Paste

**Goal**: Create a job using AI field extraction (FR-024 to FR-031)

**Test Data** (copy this text):
```
Senior Backend Developer - Node.js
CloudTech Solutions GmbH
Berlin, Germany (Hybrid: 2 days office)
Posted: October 10, 2025

We're seeking an experienced backend developer proficient in Node.js, TypeScript, and PostgreSQL.
Requirements: 5+ years backend development, REST API design, microservices architecture.
Compensation: €65,000 - €85,000 per year
Contract: Full-time, permanent position
Apply by: November 15, 2025

https://cloudtech.example.com/jobs/backend-senior-123
```

**Steps**:
1. From job list page, click "Add Job" button
2. Select "Paste Job Text" mode
3. Paste above test data into large textarea
4. Click "Extract with AI" button
5. Wait for loading indicator (max 5 seconds)
6. Observe form fields auto-populate
7. Verify extraction results:
   - Title: `"Senior Backend Developer - Node.js"`
   - Company: `"CloudTech Solutions GmbH"`
   - Location: `"Berlin, Germany (Hybrid: 2 days office)"`
   - Salary Range: `"€65,000 - €85,000"`
   - URL: `"https://cloudtech.example.com/jobs/backend-senior-123"`
   - Posted Date: `2025-10-10`
   - Deadline: `2025-11-15`
8. Manually select job source: `"Company Website"`
9. Click "Save"

**Expected Result**:
- AI extraction completes within 5 seconds
- Form fields pre-filled with extracted data
- Missing required fields (if any) highlighted in red
- User can edit any field before saving
- Job saved successfully with `import_method: 'ai_paste'`
- Original pasted text stored in `raw_import_data`

**Pass Criteria**: ✅ AI extraction works, partial pre-fill allows manual completion

---

## Scenario 4: Validate Required Fields

**Goal**: Verify required field validation works (FR-020, FR-021)

**Steps**:
1. Click "Add Job" → "Manual Entry"
2. Leave Title field empty
3. Fill Company: `"TestCorp"`
4. Fill Posted Date: `2025-10-14`
5. Select source: `"Indeed"`
6. Click "Save"

**Expected Result**:
- Form does NOT submit
- Error message under Title field: "Title is required"
- Title field border turns red
- Form focus moves to Title field
- No database write occurs

**Repeat for other required fields** (Company, Posted Date, Source)

**Pass Criteria**: ✅ All required fields enforced with clear error messages

---

## Scenario 5: Filter Jobs by Status

**Goal**: Test status filter with AND logic (FR-006, FR-007)

**Prerequisites**: At least 5 jobs with mixed statuses:
- 2 jobs with status "new"
- 2 jobs with status "interesting"
- 1 job with status "applied"

**Steps**:
1. Navigate to `/jobs` page
2. Locate filter controls (above table)
3. Open "Status" dropdown
4. Select "Interesting"
5. Observe table updates

**Expected Result**:
- Table shows only 2 jobs with status "interesting"
- Count displays "Showing 2 of 5 jobs"
- Other status jobs hidden
- Filter chip/badge displays "Status: Interesting"
- Clear filters button appears

**Pass Criteria**: ✅ Status filter works, count accurate

---

## Scenario 6: Combine Multiple Filters (AND Logic)

**Goal**: Verify AND logic when multiple filters active (FR-007)

**Prerequisites**: 10 jobs with varied attributes:
- 3 jobs from "LinkedIn", status "new", posted last 7 days
- 2 jobs from "LinkedIn", status "new", posted 30 days ago
- 5 jobs from other sources

**Steps**:
1. Navigate to `/jobs` page
2. Apply filters:
   - Status: "New"
   - Source: "LinkedIn"
   - Posted Date From: (7 days ago)
3. Observe table updates after each filter

**Expected Result**:
- Only 3 jobs displayed (must match ALL criteria)
- Count: "Showing 3 of 10 jobs"
- Jobs from other sources excluded
- Old jobs excluded
- Filter chips show all active filters

**Pass Criteria**: ✅ AND logic correctly narrows results

---

## Scenario 7: Sort Jobs by Column

**Goal**: Test sorting functionality (FR-010, FR-011)

**Prerequisites**: At least 5 jobs with different posted dates

**Steps**:
1. Navigate to `/jobs` page (default sort: Posted Date DESC)
2. Verify jobs sorted newest first
3. Click "Company" column header
4. Observe sort changes to Company A-Z
5. Click "Company" header again
6. Observe sort reverses to Z-A
7. Click "Posted Date" header
8. Observe sort returns to date-based

**Expected Result**:
- Column headers clickable
- Sort indicator (arrow icon) shows active column and direction
- Table re-orders on each click
- Sort persists while filters applied
- Pagination resets to page 1 on sort change

**Pass Criteria**: ✅ Sorting works for all sortable columns

---

## Scenario 8: Pagination with 25 Items Per Page

**Goal**: Verify pagination behavior (FR-004, FR-012)

**Prerequisites**: At least 30 jobs in database

**Steps**:
1. Navigate to `/jobs` page
2. Verify table shows exactly 25 jobs (first page)
3. Verify pagination controls show "Page 1 of 2"
4. Click "Next" or page "2" button
5. Observe URL changes to `?page=2`
6. Verify next 5 jobs displayed (jobs 26-30)
7. Click "Previous" or page "1" button
8. Verify returns to first 25 jobs
9. Close app and restart
10. Navigate to `/jobs`
11. Verify starts at page 1 (reset on app start)

**Expected Result**:
- Exactly 25 jobs per page (never more)
- URL reflects current page (`?page=N`)
- Back button works (browser history)
- App restart resets to page 1
- No filters or sort persisted across restart

**Pass Criteria**: ✅ Pagination works, state resets on restart

---

## Scenario 9: Edit Existing Job

**Goal**: Update job fields and status (FR-034 to FR-039)

**Prerequisites**: At least 1 job exists

**Steps**:
1. From job list, click any job row to open detail view
2. Click "Edit" button
3. Observe form pre-filled with current data
4. Change fields:
   - Status: "Interesting" → "Applied"
   - Notes: Add `"Applied via company portal on 2025-10-14"`
5. Click "Save"

**Expected Result**:
- Form pre-populated with existing data
- All fields editable (including required fields)
- Validation enforced (same as create)
- Success message: "Job updated successfully"
- Redirect to job detail view (not list)
- Changes visible in detail view
- `updated_at` timestamp refreshed

**Cancel Flow**:
- Click "Edit" → Click "Cancel" → No changes saved

**Pass Criteria**: ✅ Edit works, validation enforced, cancel works

---

## Scenario 10: Delete Job with Confirmation

**Goal**: Test delete workflow and cascade behavior (FR-040 to FR-045)

**Prerequisites**: At least 1 job exists (ideally with matching results, if matching feature implemented)

**Steps**:
1. From job list, click job to open detail view
2. Click "Delete Job" button (likely red, with warning icon)
3. Observe confirmation dialog appears:
   - Title: "Delete Job?"
   - Message: "Are you sure you want to delete this job? This action cannot be undone."
   - Buttons: "Cancel" (secondary), "Delete" (danger/red)
4. Click "Cancel"
5. Verify dialog closes, job still exists
6. Click "Delete Job" again
7. Click "Delete" (confirm)

**Expected Result**:
- Confirmation dialog prevents accidental deletion
- Cancel preserves job
- Delete button removes job permanently
- Success message: "Job deleted successfully"
- Redirect to `/jobs` list
- Job no longer appears in list
- Associated matching results also deleted (cascade)

**Pass Criteria**: ✅ Delete requires confirmation, cascade works

---

## Scenario 11: Handle Empty Job Source Dropdown

**Goal**: Verify error handling when no sources configured (FR-051)

**Prerequisites**: Database has ZERO job sources (delete all sources)

**Steps**:
1. Click "Add Job" → "Manual Entry"
2. Fill required fields
3. Observe "Job Source" dropdown
4. Attempt to save

**Expected Result**:
- Dropdown is empty or disabled
- Helper text displays: "No job sources available. Please add a source in Settings first."
- Save button disabled OR error on submit: "Please configure at least one job source"
- Clear guidance to resolve issue

**Pass Criteria**: ✅ Empty source state handled gracefully with guidance

---

## Scenario 12: AI Extraction Fallback (Partial Data)

**Goal**: Verify partial pre-fill when AI can't extract all fields (FR-031)

**Test Data** (intentionally vague):
```
Looking for a developer.
Good salary. Remote ok.
```

**Steps**:
1. Click "Add Job" → "Paste Job Text"
2. Paste vague test data
3. Click "Extract with AI"
4. Wait for response

**Expected Result**:
- AI extraction completes
- Most fields empty or null
- Confidence: "low"
- Missing required fields highlighted in red:
  - Title (red border + error: "Title is required")
  - Company (red border + error: "Company is required")
  - Posted Date (red border + error: "Posted date is required")
- Warning message: "AI could not extract all required fields. Please fill in manually."
- Form still usable, user can complete manually
- Save button enabled once required fields filled

**Pass Criteria**: ✅ Partial extraction doesn't break form, validation guides user

---

## Scenario 13: AI Extraction Timeout Handling

**Goal**: Verify timeout fallback after 5 seconds (FR-032)

**Steps** (requires network throttling or AI service mock):
1. Click "Add Job" → "Paste Job Text"
2. Paste any job text
3. Click "Extract with AI"
4. (Simulate 5-second timeout in test environment)
5. Observe behavior after 5 seconds

**Expected Result**:
- Loading indicator shows for 5 seconds
- After 5 seconds, timeout error message:
  "AI extraction timed out. Please try again or enter fields manually."
- Form resets to empty (or shows partial data if any received)
- User can retry or switch to manual entry
- No app crash or frozen UI

**Pass Criteria**: ✅ Timeout handled gracefully, user not blocked

---

## Performance Benchmarks

**Test Environment**: Windows 10, 16GB RAM, SSD

**Metrics** (measured with browser dev tools / Electron dev tools):

| Operation | Target | Actual | Pass? |
|-----------|--------|--------|-------|
| Job list load (100 jobs) | < 200ms | ___ms | ⬜ |
| Apply single filter | < 100ms | ___ms | ⬜ |
| Sort column | < 100ms | ___ms | ⬜ |
| Pagination (page change) | < 100ms | ___ms | ⬜ |
| AI extraction | < 5s | ___ms | ⬜ |
| Create job (manual) | < 500ms | ___ms | ⬜ |
| Update job | < 500ms | ___ms | ⬜ |
| Delete job | < 500ms | ___ms | ⬜ |

**Pass Criteria**: All operations meet target performance

---

## Success Criteria Summary

Feature is ready for release when:

- ✅ All 13 scenarios pass
- ✅ Performance benchmarks met
- ✅ No console errors during normal usage
- ✅ No data loss on app restart
- ✅ AI extraction works with valid API key
- ✅ AI extraction gracefully falls back when unavailable
- ✅ Validation prevents invalid data entry
- ✅ Delete cascades to matching results

**Next Steps After Quickstart**:
1. Run automated contract tests
2. Run integration tests
3. Run unit tests
4. Execute this quickstart manual test suite
5. Create PR for feature review

---

**Last Updated**: 2025-10-14
**Tested By**: ____________
**Test Environment**: ____________
**Pass Rate**: ___/13 scenarios
