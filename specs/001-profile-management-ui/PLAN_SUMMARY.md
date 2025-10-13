# Implementation Plan: Profile Management UI

**Branch**: 001-profile-management-ui | **Date**: 2025-10-01

## Summary
Profile management UI with personal info, skills (max 500, level 0-10), and enhanced job preferences (preferred + acceptable remote range). Hybrid save: auto basic fields, explicit skills/preferences.

## Technical Stack
- **Electron 32.3** + React 18.2 + TypeScript 5.3
- **Material-UI 5.15**, Zustand 4.5
- **SQLite** (better-sqlite3 v11), Knex migrations
- **Target**: Windows/macOS/Linux Desktop

## Data Model Changes

### UserPreferences (3 new fields)
- `preferredRemotePercentage` (0-100): Ideal scenario
- `acceptableRemoteMin` (0-100): Minimum acceptable  
- `acceptableRemoteMax` (0-100): Maximum acceptable
- Validation: min ≤ preferred ≤ max

### Skills
- Max 500 per profile (UI + DB constraint)
- Duplicates allowed across categories
- Level 0-10 (slider component)

## Components
1. **ProfileForm**: Name, email, location → Auto-save (2s debounce)
2. **SkillsManager**: Add/edit/remove skills → Explicit save
3. **PreferencesPanel**: Salary, location, remote range → Explicit save
4. **Profile Page**: Integrates all 3 + unsaved warnings

## IPC Channels
- PROFILE_GET/UPDATE/CREATE
- SKILLS_GET_ALL/UPSERT/DELETE/VALIDATE
- PREFERENCES_GET/UPDATE/VALIDATE

## Known Issue (T001)
**Electron startup fails** - `require('electron')` undefined
**Fix in T001**: Use TypeScript compiler for main, Vite only for renderer

## Next Steps
Run `/tasks` to generate T001-T020 task list

**Status**: ✅ PLAN COMPLETE
