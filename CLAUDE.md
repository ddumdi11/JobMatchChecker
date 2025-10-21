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
<!-- MANUAL ADDITIONS END -->
