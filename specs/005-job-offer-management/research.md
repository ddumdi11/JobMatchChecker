# Research: Job Offer Management

**Feature**: 005-job-offer-management
**Date**: 2025-10-14
**Status**: Complete

## Purpose

This document captures all technical research decisions made during Phase 0 planning. Each decision includes the chosen approach, rationale, and alternatives considered.

---

## Research Question 1: Job List Display Format

**Context**: FR-003 requires clarification on display format - table, cards, or list view?

### Decision
Use **Material-UI Table component** (`<Table>`, `<TableHead>`, `<TableBody>`, `<TableRow>`, `<TableCell>`)

### Rationale
1. **Consistency**: Existing app doesn't have table views yet, but Material-UI tables are standard for data-heavy displays
2. **Information Density**: Jobs have 7+ displayable fields (title, company, status, date, source, location, score) - tables handle this better than cards
3. **Sorting UX**: Table headers with sort indicators provide clear, clickable sorting (Material-UI `<TableSortLabel>`)
4. **Filtering Integration**: Tables work well with filter controls above them (standard pattern)
5. **Responsive**: Material-UI tables support responsive breakpoints via `sx` prop

### Alternatives Considered
- **Card Grid** (`<Grid>` + `<Card>`): Better for visual content, but wastes space for text-heavy job data. Harder to scan multiple fields at once.
- **List View** (`<List>` + `<ListItem>`): Good for mobile, but less efficient for desktop users who need to compare multiple jobs side-by-side.

### Implementation Notes
- Use `<TableContainer component={Paper}>` for elevation
- Column headers: Title, Company, Status, Posted Date, Source, Location, Match Score
- Row actions: View (navigate to detail), Edit, Delete icons in last column
- Sticky header for long lists (`stickyHeader` prop)

---

## Research Question 2: Pagination Implementation

**Context**: FR-004 specifies 25 jobs per page. How to implement pagination in Electron + React Router?

### Decision
Use **Material-UI Pagination component** with **React Router search params** for page state

### Rationale
1. **State Management**: URL-based pagination (`?page=2`) allows bookmarking, back button support, and sharable links
2. **Component Library**: Material-UI `<Pagination>` provides accessible, themed UI out of the box
3. **Server-Side Ready**: Using search params makes it easy to migrate to server-side pagination if needed (though SQLite queries are fast enough for 1000+ jobs)
4. **Existing Pattern**: React Router 6.21 already in use, `useSearchParams` hook is idiomatic

### Alternatives Considered
- **Infinite Scroll**: User specifically rejected this (from clarification session - based on past experience)
- **Local State Only**: Would lose page state on navigation/refresh, poor UX
- **Manual Pagination Logic**: Reinventing the wheel, Material-UI already solves this

### Implementation Notes
```typescript
// In JobList.tsx
const [searchParams, setSearchParams] = useSearchParams();
const page = parseInt(searchParams.get('page') || '1', 10);

const handlePageChange = (event: unknown, value: number) => {
  setSearchParams({ page: value.toString() });
};

// SQL query with LIMIT and OFFSET
const offset = (page - 1) * 25;
const jobs = await db.query('SELECT * FROM job_offers LIMIT 25 OFFSET ?', [offset]);
```

---

## Research Question 3: AI Extraction Timeout and Error Handling

**Context**: FR-032 asks how to handle AI extraction timeout - fallback to manual, retry, or error message?

### Decision
**5-second timeout with fallback to partial results** + manual completion

### Rationale
1. **User Experience**: Users want fast feedback. Claude API typically responds in 2-3 seconds, 5 seconds is generous buffer.
2. **Partial Results**: Even if extraction times out or returns incomplete data, pre-filled fields save user time (FR-031 already specifies this)
3. **No Retry Needed**: Retry would double wait time. User can always manually correct or re-paste if needed.
4. **Cost Control**: Timeout prevents runaway API costs from hung requests

### Alternatives Considered
- **10+ second timeout**: Too slow, user will assume app is frozen
- **Automatic Retry**: Adds complexity, doubles API costs, delays user further
- **Hard Failure**: Falls back to fully manual entry, wastes AI capability

### Implementation Notes
```typescript
// In aiExtractionService.ts
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);

try {
  const response = await anthropic.messages.create({
    // ... prompt config
    signal: controller.signal
  });
  clearTimeout(timeoutId);
  return parseResponse(response); // Returns partial data if incomplete
} catch (error) {
  if (error.name === 'AbortError') {
    return { success: false, partialData: {}, message: 'AI extraction timed out. Please fill in fields manually.' };
  }
  throw error;
}
```

---

## Research Question 4: AI Service Cost Limits

**Context**: FR-033 asks about rate limiting, max extractions per day, or unlimited?

### Decision
**No hard limits in Phase 1** (monitor usage, add soft warnings later if needed)

### Rationale
1. **Single-User App**: Desktop app for one person, not multi-tenant SaaS. Risk is bounded.
2. **Realistic Usage**: User won't paste 100 jobs per day. Typical job search: 5-10 applications per week = 10-20 extractions/week = $0.10-$0.20/week.
3. **Anthropic Pricing**: Claude 3.5 Sonnet costs ~$0.003 per extraction (assuming 1000 input tokens + 500 output tokens). 50 extractions/month = $0.15/month, well within $5 budget.
4. **YAGNI**: Adding rate limiting now is premature optimization. If user hits unexpected costs, they'll notice billing first.

### Alternatives Considered
- **Hard Daily Limit**: (e.g., 10/day) Could frustrate user during high-activity days (job fair, mass application push)
- **Soft Warning**: (e.g., "You've used 20 extractions this month") Adds complexity without clear benefit yet
- **Cache by URL**: Could reduce API calls, but jobs frequently update (deadlines, descriptions change)

### Implementation Notes
- Add usage logging to database for future analysis: `ai_extractions (timestamp, input_length, output_tokens, cost_estimate)`
- Display cumulative monthly cost in Settings page (Phase 2 enhancement)

---

## Research Question 5: Duplicate Job Detection Criteria

**Context**: FR-053 mentions duplicate detection but defers criteria - URL match or title+company match?

### Decision
**Phase 2 feature - deferred entirely** (no implementation in Phase 1)

### Rationale
1. **Complexity**: Fuzzy matching (typos, abbreviations, "Inc." vs "Incorporated") requires string similarity algorithms (Levenshtein distance, fuzzy search)
2. **User Priority**: Manual CRUD and filtering are "very important", bulk features are "nice to have". Duplicates are edge case.
3. **Workaround Available**: User can manually check list before adding, or delete duplicates after the fact
4. **URL Reliability**: URL is most reliable unique identifier, but many jobs don't have URLs (recruiter emails, PDFs)

### Future Implementation Notes (Phase 2)
- Use **URL as primary key** if available (exact match)
- Fallback to **title + company name normalized** (lowercase, trim, remove punctuation)
- Similarity threshold: 90% match triggers "Possible duplicate" warning with option to proceed
- Library: `fuse.js` for fuzzy string matching

---

## Research Question 6: Filter Persistence Strategy

**Context**: FR-012 specifies reset on app start, but how to handle persistence during session?

### Decision
**React state only** (no localStorage, no sessionStorage)

### Rationale
1. **User Requirement**: Clarification explicitly states "Reset on each app start" - implies no persistence across sessions
2. **Simplicity**: useState or useReducer hook sufficient, no need for storage APIs
3. **Predictable Behavior**: Filter state resets on page unmount (e.g., navigating to job detail and back), consistent with "reset on start" philosophy
4. **No Browser Dependency**: Electron app, no risk of localStorage quota issues

### Alternatives Considered
- **sessionStorage**: Persists across page reloads during session, but Electron renderer doesn't crash often, and user wants clean slate on start
- **Redux/Zustand**: Overkill for single-page state, adds bundle size

### Implementation Notes
```typescript
// In useJobFilters.ts
const [filters, setFilters] = useState<JobFilters>({
  status: null,
  sourceId: null,
  postedDateFrom: null,
  postedDateTo: null,
  matchScoreMin: null,
  matchScoreMax: null
});

// Reset function for "Clear All Filters" button
const resetFilters = () => setFilters({
  status: null,
  sourceId: null,
  postedDateFrom: null,
  postedDateTo: null,
  matchScoreMin: null,
  matchScoreMax: null
});
```

---

## Summary

All technical unknowns resolved. Key decisions:
1. **UI**: Material-UI Table (consistent, information-dense)
2. **Pagination**: URL-based with search params (25/page)
3. **AI**: 5-second timeout, partial results fallback
4. **Cost**: No hard limits (monitor only)
5. **Duplicates**: Phase 2 (deferred)
6. **Filters**: React state only (reset on unmount)

**Next Step**: Proceed to Phase 1 (data model, contracts, quickstart)
