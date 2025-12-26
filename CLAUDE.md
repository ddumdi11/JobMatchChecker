# JobMatchChecker Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-10-14

## Active Technologies
- TypeScript 5.3 / Node.js (Electron 38.2.1) + better-sqlite3 (existing), Knex.js (existing), Node.js fs/fs-extra (004-database-backup-restore)
- TypeScript 5.3 + React 18.2, Material-UI 5.15, React Router 6.21, better-sqlite3 12.4, Knex 3.1, Anthropic SDK 0.30, Electron 38.2 (005-job-offer-management)
- SQLite (via better-sqlite3 and Knex migrations) (005-job-offer-management)
- TypeScript 5.3 / Node.js 18+ (Electron 38.2.1) + React 18.2, Material-UI 5.15, Zustand 4.5, better-sqlite3 12.4, Knex 3.1 (001-profile-management-ui)
- SQLite (embedded, local via better-sqlite3) (001-profile-management-ui)

## Project Structure
```
src/
tests/
```

## Commands
npm test; npm run lint

## Code Style
TypeScript 5.3 / Node.js (Electron 38.2.1): Follow standard conventions

## Recent Changes
- 001-profile-management-ui: Added TypeScript 5.3 / Node.js 18+ (Electron 38.2.1) + React 18.2, Material-UI 5.15, Zustand 4.5, better-sqlite3 12.4, Knex 3.1
- 005-job-offer-management: Added TypeScript 5.3 + React 18.2, Material-UI 5.15, React Router 6.21, better-sqlite3 12.4, Knex 3.1, Anthropic SDK 0.30, Electron 38.2
- 004-database-backup-restore: Added TypeScript 5.3 / Node.js (Electron 38.2.1) + better-sqlite3 (existing), Knex.js (existing), Node.js fs/fs-extra

<!-- MANUAL ADDITIONS START -->

## Context Management & Summary Instructions

When compacting or summarizing the conversation, prioritize the following information:

### Critical Implementation Details
- **CSV Import Feature** (PR #27): Content-based duplicate detection, staging workflow, import/skip/merge actions
- **Merge Duplicates Feature** (Issue #28, PR #29): MergeDialog component, smart-merge logic, side-by-side comparison, automatic status updates
- **Key Bug Fixes**:
  - Merge button visibility: Include 'duplicate' status in addition to 'likely_duplicate'
  - Auto-marking merged rows as 'imported' to remove from duplicate list

### Recent Code Changes
- `src/shared/types.ts`: MergeFieldSource, MergeFieldComparison, MergePreview types
- `src/main/services/jobService.ts`: createMergePreview(), mergeJobs(), smart-merge helpers
- `src/main/ipc/handlers.ts`: job:createMergePreview, job:merge handlers
- `src/renderer/components/MergeDialog.tsx`: Complete merge UI with German labels
- `src/renderer/pages/Import.tsx`: Merge button integration, status update after merge

### Architecture Patterns
- **Electron IPC**: Main process (jobService) ↔ Preload (contextBridge) ↔ Renderer (React)
- **Smart-Merge Algorithm**: Prefers non-empty values, newer dates (postedDate), CSV for conflicts
- **Staging Workflow**: import_staging → duplicate detection → manual merge → mark as 'imported'

### Testing Results
- All features tested and working
- User feedback: Very positive ("richtig gut")
- Branch: feature/merge-duplicates (commit 230d024)
- Status: PR #29 created, CodeRabbit review in progress

### User Preferences
- Manual PR merging (user prefers to review and merge PRs themselves)
- German UI labels throughout
- Visual feedback with MUI components

### Context Management Best Practice
- **Manual `/compact` at 60-75%** context usage (between features) - Sweet spot!
- **Emergency `/compact` at 85%+** to avoid auto-compact interruption during work
- Use `/cost` to monitor current context usage
- Auto-compact triggers at 95% but may interrupt ongoing work
- `/clear` starts fresh session but loses all conversation history

<!-- MANUAL ADDITIONS END -->
