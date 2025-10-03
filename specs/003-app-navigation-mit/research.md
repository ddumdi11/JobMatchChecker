# Research: App Navigation

**Feature**: App Navigation with Sidebar
**Date**: 2025-10-03
**Status**: Complete

## Research Questions

### 1. Material-UI Drawer Best Practices for Desktop Apps

**Decision**: Use permanent variant Drawer (always visible)

**Rationale**:
- Desktop apps have sufficient screen space for fixed sidebar
- Permanent drawer is Material-UI standard for desktop layouts
- No need for temporary/persistent variants (those are for mobile/responsive)
- `variant="permanent"` removes backdrop and keeps drawer always visible

**Alternatives Considered**:
- Persistent Drawer (requires toggle button) - rejected: adds unnecessary complexity
- Temporary Drawer (overlay) - rejected: not suitable for desktop primary navigation

**Implementation Notes**:
- Use `<Drawer variant="permanent">` with fixed `width={240}`
- Place Drawer as sibling to main content, not parent
- Use `<Box sx={{ display: 'flex' }}>` wrapper for Layout

**References**:
- Material-UI Drawer docs: https://mui.com/material-ui/react-drawer/
- Desktop app layout pattern: https://mui.com/material-ui/react-app-bar/#fixed-placement

---

### 2. React Router Navigation Patterns with Persistent Sidebar

**Decision**: Use Layout component wrapping Routes with useLocation hook for active page detection

**Rationale**:
- React Router 6.x recommends Layout pattern for shared UI
- `useLocation()` hook provides current pathname for highlighting
- `<Link>` component for navigation prevents full page reload
- Sidebar remains mounted during navigation (prevents flicker)

**Alternatives Considered**:
- Individual sidebar in each page - rejected: DRY violation, unmount/remount issues
- Higher-order component pattern - rejected: hooks pattern cleaner in React 18

**Implementation Notes**:
```tsx
// Layout.tsx
<Box sx={{ display: 'flex' }}>
  <Sidebar />
  <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
    <Outlet /> {/* React Router renders child routes here */}
  </Box>
</Box>

// App.tsx
<Routes>
  <Route path="/" element={<Layout />}>
    <Route index element={<Dashboard />} />
    <Route path="profile" element={<Profile />} />
    {/* ... */}
  </Route>
</Routes>
```

**References**:
- React Router Layout Routes: https://reactrouter.com/en/main/start/tutorial#layout-routes
- useLocation hook: https://reactrouter.com/en/main/hooks/use-location

---

### 3. Unsaved Changes Detection Patterns in React

**Decision**: Custom `useUnsavedChanges` hook with React Router `useBlocker`

**Rationale**:
- React Router 6.4+ provides `useBlocker` hook for navigation blocking
- Hook pattern reusable across pages (Profile, Settings, etc.)
- Dialog component from Material-UI for confirmation UI
- Pages opt-in by calling hook with `isDirty` boolean

**Alternatives Considered**:
- `window.onbeforeunload` - rejected: doesn't work for in-app navigation
- Route guards - rejected: React Router 6 removed, use hooks instead
- Context-based dirty tracking - rejected: overcomplicated for v1

**Implementation Notes**:
```tsx
// useUnsavedChanges.tsx (custom hook)
export function useUnsavedChanges(isDirty: boolean) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    isDirty && currentLocation.pathname !== nextLocation.pathname
  );

  // Return dialog state + confirm/cancel handlers
}

// ProfileForm.tsx (usage)
const [isDirty, setIsDirty] = useState(false);
useUnsavedChanges(isDirty);
```

**References**:
- React Router useBlocker: https://reactrouter.com/en/main/hooks/use-blocker
- Material-UI Dialog: https://mui.com/material-ui/react-dialog/

---

## Summary

All research complete, no blockers. Ready for Phase 1 (Design & Contracts).

**Key Decisions**:
1. Material-UI permanent Drawer (240px fixed width)
2. Layout component with React Router Outlet
3. useUnsavedChanges custom hook with useBlocker

**Dependencies Confirmed**:
- @mui/material: ^5.15.0 (already installed)
- react-router-dom: ^6.x (already installed)
- No new dependencies needed

**Performance Expectations**:
- Navigation: <50ms (React Router client-side routing)
- Rendering: 60fps (Material-UI optimized components)
- Bundle impact: ~15KB (Drawer + List components)
