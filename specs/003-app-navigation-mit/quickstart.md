# Quickstart: App Navigation Testing

**Feature**: App Navigation with Sidebar
**Branch**: `003-app-navigation-mit`
**Prerequisites**: Application built and running in dev mode

---

## Manual Test Scenarios

### Test 1: Sidebar Visibility and Layout
**Goal**: Verify the sidebar is always visible with correct layout

1. Start the application in dev mode: `npm run dev`
2. Observe the main window when it opens
3. **Expected**:
   - Sidebar visible on the left side of the window
   - Sidebar has fixed width (240px)
   - Sidebar contains 4 navigation items: Dashboard, Profile, Jobs, Settings
   - Each item has an icon and label
   - Main content area is visible to the right of the sidebar

### Test 2: Active Page Highlighting
**Goal**: Verify the current page is visually highlighted in the sidebar

1. Application opens on Dashboard by default
2. **Expected**: Dashboard item in sidebar has colored background and emphasized icon
3. Click "Profile" in the sidebar
4. **Expected**: Profile item now highlighted, Dashboard item returns to normal state
5. Click each navigation item (Jobs, Settings, Dashboard)
6. **Expected**: Only the current page is highlighted at any time

### Test 3: Page Navigation
**Goal**: Verify navigation between pages works correctly

1. Start on Dashboard page
2. Click "Profile" in sidebar
3. **Expected**: Profile page content displays without browser chrome/address bar
4. Click "Jobs" in sidebar
5. **Expected**: Jobs page content displays
6. Click "Settings" in sidebar
7. **Expected**: Settings page content displays
8. Click "Dashboard" in sidebar
9. **Expected**: Returns to Dashboard page
10. **Performance**: All navigations should feel instant (<50ms)

### Test 4: Unsaved Changes Warning
**Goal**: Verify unsaved changes are detected and user is warned

**Setup**: Requires Profile or Settings page to have form with unsaved changes tracking

1. Navigate to Profile page
2. Make a change to any form field (e.g., edit first name)
3. Do NOT save the changes
4. Click "Dashboard" in the sidebar
5. **Expected**:
   - Dialog appears with title "Unsaved Changes"
   - Message warns that changes will be lost
   - Three buttons: "Save", "Discard", "Cancel"
6. Click "Cancel"
7. **Expected**: Dialog closes, remain on Profile page, changes still visible
8. Click "Dashboard" again
9. Click "Discard" in dialog
10. **Expected**: Navigate to Dashboard, changes lost
11. Navigate back to Profile, make another change
12. Click "Settings" in sidebar
13. Click "Save" in dialog
14. **Expected**: Changes saved, navigate to Settings page

### Test 5: Window Resize Behavior
**Goal**: Verify sidebar behaves correctly at different window sizes

1. Resize application window to minimum height (e.g., 400px)
2. **Expected**: Sidebar shows vertical scrollbar if navigation items overflow
3. Resize window to normal size
4. **Expected**: Scrollbar disappears, all items visible
5. Resize window width to minimum
6. **Expected**: Sidebar maintains 240px width, main content area shrinks

### Test 6: Navigation State on App Restart
**Goal**: Verify app always starts on Dashboard (no state persistence in v1)

1. Navigate to Profile page
2. Close the application completely
3. Restart the application
4. **Expected**: Application opens on Dashboard page (not Profile)

---

## Known Limitations (v1)

- No keyboard shortcuts for navigation (e.g., Ctrl+1 for Dashboard)
- No navigation state persistence across app restarts
- Sidebar is not collapsible (always visible)
- No breadcrumb navigation
- No back/forward navigation controls

---

## Success Criteria

All 6 test scenarios pass with expected outcomes:
- [x] Sidebar renders with correct layout and items
- [x] Active page highlighting works correctly
- [x] Navigation between pages is instant and smooth
- [x] Unsaved changes dialog appears and functions correctly
- [x] Sidebar handles window resizing gracefully
- [x] App always starts on Dashboard page

---

## Troubleshooting

**Issue**: Sidebar not visible
**Fix**: Check Layout.tsx renders Drawer component correctly

**Issue**: Active highlighting not working
**Fix**: Check useLocation() hook in Sidebar.tsx, verify pathname matching

**Issue**: Navigation causes page refresh
**Fix**: Ensure using React Router `<Link>` components, not `<a>` tags

**Issue**: Unsaved changes dialog not appearing
**Fix**: Verify page calls useUnsavedChanges hook with correct isDirty state

**Issue**: Browser chrome visible
**Fix**: Electron app should have `frame: false` or custom titlebar in BrowserWindow options
