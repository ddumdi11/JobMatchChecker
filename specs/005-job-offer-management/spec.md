# Feature Specification: Job Offer Management

**Feature Branch**: `005-job-offer-management`
**Created**: 2025-10-14
**Status**: Draft
**Input**: User description: "Job Offer Management: Als Nutzer möchte ich Jobs verwalten können. Ich brauche eine Job-Liste unter /jobs die alle meine erfassten Stellenangebote zeigt. Die Liste soll filterbar sein nach Status (new, interesting, applied, rejected, archived), nach Jobbörse, nach Datum und nach Match-Score. Ich möchte Jobs manuell hinzufügen, bearbeiten und löschen können. Beim Hinzufügen möchte ich entweder alle Felder manuell ausfüllen oder einen Job-Text per Copy-Paste einfügen, den die AI dann automatisch in die Felder extrahiert (Titel, Firma, Standort, Gehalt, Remote-Option, Anforderungen etc.). Die Job-Detail-Ansicht unter /jobs/:id existiert bereits und zeigt alle Informationen an. Jobs haben folgende Felder: Titel (Pflicht), Firma (Pflicht), URL, Datum (Pflicht), Deadline, Standort, Remote-Option, Gehaltsrange, Vertragsart, Volltext, Status, Notizen. Der Volltext enthält alle Job-Anforderungen die später per AI mit meinen Skills abgeglichen werden. Für Phase 1 reicht es wenn Requirements im Volltext bleiben, strukturierte job_requirements Tabelle kommt später in Phase 2."

## Execution Flow (main)
```
1. Parse user description from Input ✓
   → Feature: Job Offer Management System
   → Routes: /jobs (list), /jobs/:id (detail - exists)
   → CRUD operations: Create, Read, Update, Delete
   → Input modes: Manual form, AI-assisted copy-paste
2. Extract key concepts from description ✓
   → Actors: User (job seeker)
   → Actions: View list, filter, sort, add, edit, delete jobs
   → Data: Job offers with 13+ fields
   → Constraints: 3 required fields (title, company, posted_date)
   → AI: Extract structured data from unstructured text
3. For each unclear aspect:
   → ✓ AI extraction accuracy: How to handle partial extraction?
   → ✓ Validation: What happens if required fields missing after AI extraction?
   → ✓ Filter behavior: AND vs OR logic for multiple filters?
   → ✓ Sorting: Default sort order?
   → ✓ Deletion: Soft delete or hard delete?
   → ✓ Match Score: Available before matching or default value?
4. Fill User Scenarios & Testing section ✓
   → Primary flow: User adds job via copy-paste, AI extracts fields
   → Secondary flow: Manual CRUD operations
   → Filter/sort scenarios
5. Generate Functional Requirements ✓
   → List view, filter, sort, CRUD operations
   → AI extraction, validation, status management
6. Identify Key Entities ✓
   → Job Offer (existing entity in DB)
7. Run Review Checklist
   → 6 NEEDS CLARIFICATION items identified
8. Return: SUCCESS (spec ready for /clarify)
```

---

## Clarifications

### Session 2025-10-14

- Q: Wenn mehrere Filter gleichzeitig aktiv sind, wie sollen diese kombiniert werden? → A: AND-Logik - Jobs müssen ALLE Kriterien erfüllen
- Q: Wenn die AI nicht alle Pflichtfelder extrahieren kann, wie soll das System reagieren? → A: Partial Pre-fill mit Warnung - Felder vorausfüllen soweit möglich, fehlende Pflichtfelder rot markieren, User muss manuell nachtragen
- Q: Pagination oder Infinite Scroll bei vielen Jobs? → A: Pagination mit 25 Jobs pro Seite
- Q: Filter/Sort-Einstellungen zwischen Sitzungen speichern oder zurücksetzen? → A: Zurücksetzen bei jedem Start - Immer Standardansicht (Posted Date newest first, keine Filter)
- Q: Job-Löschung mit bestehenden Matching-Ergebnissen? → A: Cascade Delete - Job und alle verknüpften Matching-Ergebnisse automatisch löschen

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## User Scenarios & Testing

### Primary User Story
As a job seeker, I want to efficiently manage all my job applications in one place, so that I can track my progress, filter opportunities by relevance, and make data-driven decisions about which positions to pursue.

### Acceptance Scenarios

#### Scenario 1: View Job List
1. **Given** I have previously saved 15 job offers in the system
2. **When** I navigate to `/jobs`
3. **Then** I see a list/table showing all 15 jobs with key information (title, company, status, posted date, match score if available)
4. **And** the list is sorted by posted date (newest first) by default

#### Scenario 2: Filter Jobs by Status
1. **Given** I am on the job list page with 15 jobs in various states
2. **When** I select "applied" from the status filter
3. **Then** the list updates to show only jobs with status "applied"
4. **And** the count displays "Showing 3 of 15 jobs"

#### Scenario 3: Add Job via AI-Assisted Copy-Paste
1. **Given** I found an interesting job posting on a job board
2. **When** I click "Add Job" and select "Paste Job Text"
3. **And** I paste the complete job description text
4. **And** I click "Extract with AI"
5. **Then** the system sends the text to AI for field extraction
6. **And** the form fields are pre-filled with extracted data (title, company, location, salary, etc.)
7. **And** I can review and edit any field before saving
8. **When** I click "Save"
9. **Then** the new job appears in my job list with status "new"

#### Scenario 4: Add Job Manually
1. **Given** I want to add a job without AI assistance
2. **When** I click "Add Job" and select "Manual Entry"
3. **Then** I see an empty form with all job fields
4. **When** I fill in required fields (title, company, posted date) and select a job source
5. **And** I click "Save"
6. **Then** the job is added to my list
7. **And** I see a success message

#### Scenario 5: Edit Existing Job
1. **Given** I am viewing a job detail page
2. **When** I click "Edit"
3. **Then** I see an editable form with all current job data
4. **When** I change the status from "new" to "applied"
5. **And** I add a note "Applied on 2025-10-14 via company website"
6. **And** I click "Save"
7. **Then** the job is updated with my changes
8. **And** I am redirected to the updated job detail view

#### Scenario 6: Delete Job
1. **Given** I am viewing a job I no longer want to track
2. **When** I click "Delete Job"
3. **Then** I see a confirmation dialog "Are you sure you want to delete this job? This action cannot be undone."
4. **When** I confirm deletion
5. **Then** the job is removed from the system
6. **And** I am redirected to the job list

#### Scenario 7: Combine Multiple Filters
1. **Given** I have 50 jobs from various sources
2. **When** I filter by status "interesting" AND source "LinkedIn" AND posted date "Last 7 days"
3. **Then** I see only jobs matching ALL selected criteria
4. **And** the count shows "Showing 4 of 50 jobs"

#### Scenario 8: Sort by Different Columns
1. **Given** I am viewing my job list
2. **When** I click the "Company" column header
3. **Then** the list re-sorts alphabetically by company name (A-Z)
4. **When** I click the "Company" header again
5. **Then** the sort order reverses (Z-A)

### Edge Cases
- What happens when AI extraction fails to identify required fields (title, company, date)?
- What if the pasted text is too short or not job-related?
- How does the system handle duplicate jobs (same title + company + URL)?
- What if match score is not yet available (job not yet matched)?
- What happens when user tries to save a job without filling required fields?
- How does the system behave when all filters are applied but no jobs match?
- What if user deletes a job that has associated matching results?
- Can user cancel out of the delete confirmation?
- What if the job source dropdown is empty (no sources configured)?

## Requirements

### Functional Requirements

#### Job List View
- **FR-001**: System MUST display a `/jobs` route showing all saved job offers
- **FR-002**: Job list MUST show key information for each job: title, company name, status, posted date, job source, and match score (if available)
- **FR-003**: System MUST display jobs in table format using Material-UI Table component (decision documented in research.md)
- **FR-004**: System MUST support pagination with 25 jobs per page
- **FR-005**: System MUST display a count showing "X of Y jobs" when filters are active

#### Filtering & Sorting
- **FR-006**: System MUST provide filters for: Status, Job Source, Posted Date Range, Match Score Range
- **FR-007**: System MUST combine multiple active filters using AND logic (jobs must match ALL selected criteria)
- **FR-008**: System MUST allow users to clear all filters with one action
- **FR-009**: System MUST sort job list by posted date (newest first) by default
- **FR-010**: System MUST allow sorting by: Posted Date, Company Name, Status, Match Score (when available)
- **FR-011**: System MUST support ascending and descending sort order
- **FR-012**: System MUST reset filter and sort settings to defaults (Posted Date newest first, no filters) on each app start

#### Job Status Management
- **FR-013**: System MUST support five status values: "new" (default), "interesting", "applied", "rejected", "archived"
- **FR-014**: System MUST allow users to change job status from list view or detail view
- **FR-015**: System MUST default new jobs to "new" status

#### Create Job - Manual Entry
- **FR-016**: System MUST provide an "Add Job" button accessible from job list
- **FR-017**: System MUST display a form with all job fields when "Manual Entry" mode selected
- **FR-018**: System MUST require: Title, Company, Posted Date as mandatory fields
- **FR-019**: System MUST require user to select an existing Job Source from dropdown
- **FR-020**: System MUST validate required fields before saving
- **FR-021**: System MUST display field-specific error messages for validation failures
- **FR-022**: System MUST save the job and redirect to job list upon successful creation
- **FR-023**: System MUST display success message after job creation

#### Create Job - AI-Assisted Copy-Paste
- **FR-024**: System MUST provide a "Paste Job Text" mode in the "Add Job" workflow
- **FR-025**: System MUST provide a large text area for pasting unstructured job description text
- **FR-026**: System MUST send pasted text to AI service for field extraction when user clicks "Extract with AI"
- **FR-027**: System MUST display loading indicator during AI extraction
- **FR-028**: System MUST parse AI response and pre-fill form fields with extracted data
- **FR-029**: System MUST allow user to review and manually edit all extracted fields before saving
- **FR-030**: System MUST store original pasted text in the "Full Text" field
- **FR-031**: System MUST pre-fill fields with AI-extracted data even if required fields are missing, highlight missing required fields in red with validation message, and allow user to manually complete them
- **FR-032**: System MUST timeout AI extraction after 5 seconds and return partial results with user notification, allowing manual completion (decision documented in research.md)
- **FR-033**: System MUST NOT enforce hard limits on AI service usage in Phase 1; usage will be monitored for cost and operational concerns (decision documented in research.md)

#### Update Job
- **FR-034**: System MUST provide an "Edit" button on job detail view
- **FR-035**: System MUST display editable form pre-filled with current job data
- **FR-036**: System MUST validate required fields on update (same as create)
- **FR-037**: System MUST save changes and redirect to updated job detail view
- **FR-038**: System MUST display success message after update
- **FR-039**: System MUST allow canceling edit without saving changes

#### Delete Job
- **FR-040**: System MUST provide a "Delete" button on job detail view
- **FR-041**: System MUST display confirmation dialog before deletion: "Are you sure you want to delete this job? This action cannot be undone."
- **FR-042**: System MUST allow user to cancel deletion from confirmation dialog
- **FR-043**: System MUST permanently remove job from database upon confirmation
- **FR-044**: System MUST redirect to job list after successful deletion
- **FR-045**: System MUST automatically cascade delete all associated matching results when a job is deleted

#### Data Validation
- **FR-046**: System MUST validate Posted Date is not in the future
- **FR-047**: System MUST validate Deadline (if provided) is after Posted Date
- **FR-048**: System MUST validate URL format (if provided)
- **FR-049**: System MUST validate Match Score (if provided) is between 0-100

#### Error Handling
- **FR-050**: System MUST display user-friendly error messages for all validation failures
- **FR-051**: System MUST display error message if job source dropdown is empty with guidance to add sources first
- **FR-052**: System MUST handle AI service unavailability gracefully with fallback to manual entry
- **FR-053**: [DEFERRED TO PHASE 2] Duplicate job detection (research.md documents this as out of scope for Phase 1)

### Key Entities

#### Job Offer
- **Purpose**: Represents a single job opportunity the user is tracking
- **Attributes**:
  - **Required**: Title, Company Name, Posted Date, Job Source (reference to Job Sources entity)
  - **Optional**: URL, Deadline, Location, Remote Option, Salary Range, Contract Type, Full Text, Status, Notes
  - **System-generated**: Created At, Updated At
- **Relationships**: Belongs to one Job Source, may have multiple Matching Results (future feature)
- **Lifecycle**: Created (status: new) → Updated (status changes) → Deleted (permanent removal)

#### Job Source
- **Purpose**: Represents job boards or platforms where jobs are found (e.g., LinkedIn, Indeed, company website)
- **Note**: This entity already exists in the database and is managed separately
- **Relationship**: One source has many job offers

---

## Dependencies & Assumptions

### Dependencies
- Existing `job_offers` table in database (schema already defined)
- Existing `job_sources` table with at least one source configured
- AI service integration for text extraction (Claude API or similar)
- Job detail view component at `/jobs/:id` already exists

### Assumptions
- User has already configured at least one Job Source before adding jobs
- Single-user desktop application (no multi-user permissions needed)
- Jobs are stored locally (no cloud sync in Phase 1)
- AI extraction is a convenience feature; manual entry is always available as fallback
- Match Score field may be null/empty until AI Matching feature is implemented
- Internet connection available for AI-assisted extraction

---

## Out of Scope (Phase 1)

- **Bulk Import**: Importing multiple jobs at once from CSV or other formats (Phase 2)
- **PDF Text Import**: Extracting text from PDF job postings (Phase 2)
- **Screenshot OCR**: Extracting text from images (Phase 2)
- **Structured Job Requirements Table**: Separate entity for individual skill requirements per job (Phase 2 - currently requirements live in Full Text field)
- **AI Matching**: Calculating match scores and gap analysis (separate feature)
- **Job Application Tracking**: Tracking application submissions, responses, interviews (Phase 2)
- **Duplicate Detection**: Automatic detection of duplicate job postings
- **Job Source Management**: CRUD operations for job sources (separate feature or settings)
- **Export/Import**: Exporting job list to CSV/PDF
- **Browser Extension**: Capturing jobs directly from browser
- **Email Integration**: Importing jobs from email alerts

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs) - *Note: "AI service" mentioned at high level only*
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain - *6 clarification points identified*
- [ ] Requirements are testable and unambiguous - *Pending clarifications*
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted (actors, actions, data, constraints)
- [x] Ambiguities marked (6 clarification points)
- [x] User scenarios defined (8 scenarios + 9 edge cases)
- [x] Requirements generated (53 functional requirements)
- [x] Entities identified (Job Offer, Job Source)
- [ ] Review checklist passed - *Blocked by clarification needs*

---

*Ready for `/clarify` command to resolve ambiguities before planning phase*
