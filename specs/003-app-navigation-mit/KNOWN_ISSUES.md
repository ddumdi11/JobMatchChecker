# Known Issues: App Navigation (Feature 003)

**Feature Branch**: `003-app-navigation-mit`
**Status**: Documented - To be addressed in future features

---

## Issue 1: Jobs Route Parameter Missing

**Severity**: Medium
**Impact**: Jobs navigation will break until Jobs List feature is implemented
**Reported by**: CodeRabbit (PR #5)

### Problem
The sidebar navigation links to `/jobs`, but the `JobDetail` component expects a route parameter `/jobs/:id`.

**Current State:**
```tsx
// src/renderer/App.tsx line 36
<Route path="jobs" element={<JobDetail />} />

// src/renderer/components/Sidebar.tsx line 26
{ label: 'Jobs', path: '/jobs', icon: <WorkIcon /> }

// src/renderer/pages/JobDetail.tsx
const { id } = useParams<{id: string}>();  // ❌ id will be undefined
```

### Symptom
When clicking "Jobs" in the sidebar, the JobDetail page renders but:
- `id` parameter is `undefined`
- Page will likely show an error or empty state
- No job data can be loaded

### Root Cause
The navigation specification (FR-002) defines 4 main pages including "Jobs", but:
- No Jobs List component exists yet (only JobDetail)
- JobDetail was designed for `/jobs/:id` route
- Sidebar assumes `/jobs` is a valid standalone page

### Workaround Options

**Option A: Dynamic Route (Quick Fix)**
```tsx
// Change route to expect parameter
<Route path="jobs/:id" element={<JobDetail />} />

// Update sidebar to link to placeholder job
{ label: 'Jobs', path: '/jobs/1', icon: <WorkIcon /> }
```
**Pros**: Quick fix, preserves navigation
**Cons**: Hardcoded job ID, not ideal UX

**Option B: Create Jobs List Component (Proper Solution)**
```tsx
// Add new Jobs.tsx list component
<Route path="jobs" element={<Jobs />} />
<Route path="jobs/:id" element={<JobDetail />} />
```
**Pros**: Proper UX, follows standard pattern
**Cons**: Requires new component, outside scope of navigation feature

**Option C: Remove from Sidebar Temporarily**
```tsx
// Remove Jobs from navItems until list is ready
const navItems = [
  { label: 'Dashboard', path: '/', icon: <DashboardIcon /> },
  { label: 'Profile', path: '/profile', icon: <PersonIcon /> },
  // { label: 'Jobs', path: '/jobs', icon: <WorkIcon /> },  // Disabled
  { label: 'Settings', path: '/settings', icon: <SettingsIcon /> }
];
```
**Pros**: No broken navigation
**Cons**: Reduces navigation scope, deviates from spec

### Recommendation
**Option C (Remove from Sidebar)** for now, implement **Option B (Jobs List)** in separate feature.

**Rationale**:
- Jobs List Management is a separate feature (not yet specified)
- Navigation feature should work without breaking
- Clean separation of concerns
- Easy to restore when Jobs List is ready

### Action Items
- [ ] Remove Jobs from sidebar in this PR (optional)
- [ ] Create Feature 005: Jobs List Management
- [ ] Implement Jobs.tsx list component
- [ ] Add both routes: `/jobs` (list) and `/jobs/:id` (detail)
- [ ] Restore Jobs link in sidebar

### Related Files
- `src/renderer/App.tsx` (line 36)
- `src/renderer/components/Sidebar.tsx` (line 26)
- `src/renderer/pages/JobDetail.tsx`

---

## Issue 2: Electron Main Process Error (Pre-existing)

**Severity**: Critical (for app startup)
**Impact**: Application doesn't start in dev mode
**Status**: Pre-existing issue, not caused by this feature

### Problem
```
TypeError: Cannot read properties of undefined (reading 'whenReady')
at dist/main/main/main.js:81
```

### Root Cause
Electron import issue in compiled main process - under investigation.

### Workaround
Renderer works standalone at http://localhost:5176 (Vite dev server).

### Action Items
- [ ] Create Feature 004: Fix Electron Main Process
- [ ] Investigate electron import in compiled output
- [ ] Fix without modifying protected config files

**Reference**: Bug will be tracked in branch `004-fix-electron-main-process`

---

*Last Updated: 2025-10-03*
