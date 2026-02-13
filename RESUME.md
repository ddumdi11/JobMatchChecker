# JobMatchChecker - Wiederaufnahme-Datei

> **Letzte Aktualisierung:** 2026-02-13
> **Status:** MVP funktionsfähig, aktive Weiterentwicklung

## Session 12.02.2026 - Zusammenfassung

### OpenRouter Integration (PR #53) ✅

Multi-Provider AI-Abstraktion: Anthropic SDK + OpenRouter als alternative Provider.

- **aiProviderService.ts** (NEU): Zentrale Abstraktionsschicht mit `sendPrompt()`, Provider-Config in `app_settings`, API-Keys in `electron-store`
- **Settings UI**: Provider-Auswahl (Anthropic/OpenRouter), Modell-Dropdown mit Free-Filter, Verbindungstest
- **Migration**: `aiExtractionService.ts` + `matchingService.ts` nutzen jetzt `sendPrompt()` statt direktem Anthropic SDK
- **IPC**: 6 neue Handler (Provider-Config, Modelle, Connection-Test, OpenRouter-Key)
- **CodeRabbit**: Alle 11 Findings adressiert (Timeouts, Validierung, Type-Safety, Model-Reset)
- **Validierung**: Qwen3 Free liefert vergleichbare Scores wie Claude Sonnet (50% vs 48%)

### Session 11.02.2026

**PR #50: Session Findings (7 Bugs/UX/Matching)** ✅
**PR #51: Skills-Suche + CSV-Export** ✅
**PR #52: Level-Proportionale Score-Gewichtung** ✅
**Skills-Cleanup**: 132 → ~80 Skills, Levels kalibriert

### Session 05-11.02.2026

**PR #48:** Clear State & Stale Matching Fix ✅
**PR #47:** File Import (MD/Text/PDF) ✅
**PR #46:** Kontextabhängige Snackbar-Meldungen ✅
Weitere: Keyboard-Shortcuts, Filter-Bug, TypeScript-Fixes, GitHub Pages

## Schnellstart für neue Session

```bash
# Projekt starten
cd c:\Users\diede\source\ClaudeProjekte\JobMatchChecker
npm run dev

# Build prüfen
npm run build

# TypeScript-Fehler anzeigen (einige vorbestehend)
npx tsc --noEmit
```

## Aktueller Projektstatus

### Fertige Features (in main)
- **Profil-Management** - Benutzerprofil mit Skills anlegen/bearbeiten
- **Job-Verwaltung** - Jobs anlegen, bearbeiten, löschen, filtern, sortieren
- **CSV-Import** - Jobs aus CSV importieren mit Duplikaterkennung
- **File-Import** - Jobs aus Markdown/Text/PDF importieren (PR #47)
- **Merge-Funktion** - Doppelte Jobs zusammenführen (Smart-Merge)
- **Skills-Import** - Skills aus CSV mit Konfliktauflösung (PR #32)
- **Skills Metadata** - confidence + marketRelevance Import (PR #37)
- **Unsaved Changes** - Dirty-State-Tracking mit Confirmation-Dialog (PR #36)
- **Bulk Matching** - Selective Matching (Neue/Alle/Ausgewählte) (PR #33)
- **Bulk Export PDF** - Mehrere Jobs als ein PDF (PR #42)
- **Bulk Export ZIP** - Mehrere Jobs als ZIP (MD + JSON) (PR #44)
- **UX: Match-Button** - Disabled wenn bereits gematcht (PR #43)
- **UX: Snackbar-Meldungen** - Kontextabhängige Erfolgs-/Fehlermeldungen (PR #46)
- **Status-Dropdown** - Status direkt in JobDetail änderbar (PR #49)
- **Session Findings** - 7 Bugs/UX-Fixes (PR #50)
- **Skills-Suche + CSV-Export** - Suchfeld, Kategorie-Filter, CSV-Export (PR #51)
- **Score-Gewichtung** - Level-proportionale Bewertung (PR #52)
- **OpenRouter Integration** - Multi-Provider AI (Anthropic + OpenRouter, 200+ Modelle) (PR #53)
- **Keyboard-Shortcuts** - Ctrl+M (Match), Ctrl+E (Edit), Ctrl+S (Save)

### Bekannte Issues (nicht kritisch)

1. **Vorbestehende TypeScript-Fehler**
   - Einige Type-Mismatches in tsc --noEmit
   - Beeinträchtigen Runtime nicht

2. **PreferencesPanel: Englische Labels**
   - Einige Labels noch auf Englisch statt Deutsch (CodeRabbit Nitpick)

## Backlog (priorisiert)

| Prio | Item | Aufwand | Impact |
|------|------|---------|--------|
| 1 | FEAT-1: Skills Duplikat-Erkennung | Groß | Mittel |
| 2 | FEAT-2: Ctrl+F / findInPage | Mittel | Mittel |
| 3 | FEAT-3: Default-Kategorie "IT Infrastructure" | Klein | Klein |
| 4 | MATCH-3: Gehalts-Warnung in Preferences | Klein | Niedrig |
| 5 | PreferencesPanel: Labels übersetzen | Klein | Klein |
| 6 | CodeRabbit Nitpicks PR #53 (6 Stück) | Klein | Klein |

### Details zu wichtigsten Backlog-Items

**FEAT-1: Skills Duplikat-Erkennung (Groß/Mittel)**
- Case-Sensitivity: "Docker" vs "docker"
- Sprach-Mixing: "Communication" vs "Kommunikation"
- Varianten: "Git", "git / github", "git/github"

## Architektur-Kurzübersicht

```
src/
├── main/                    # Electron Main Process
│   ├── services/           # Business Logic
│   │   ├── aiProviderService.ts  # AI-Abstraktionsschicht (Anthropic + OpenRouter)
│   │   ├── matchingService.ts    # AI-Matching via sendPrompt()
│   │   ├── aiExtractionService.ts # AI-Extraktion via sendPrompt()
│   │   ├── exportService.ts      # Markdown/PDF Export
│   │   ├── skillsImportService.ts # Skills-Import mit Konfliktauflösung
│   │   └── jobService.ts         # Job CRUD + Merge + Source-Resolution
│   ├── ipc/handlers.ts     # IPC Handler registrierung
│   └── preload.ts          # Context Bridge
├── renderer/               # React Frontend
│   ├── pages/             # Route-Komponenten
│   │   ├── JobList.tsx    # Hauptliste mit Bulk-Matching
│   │   ├── JobDetail.tsx  # Detailansicht mit Status-Dropdown + Export
│   │   ├── JobAdd.tsx     # Job anlegen/bearbeiten mit Datumsfeld
│   │   ├── SkillsImport.tsx # Skills-Import UI
│   │   └── PreferencesPanel.tsx # Preferences mit Gehalts-Einheiten
│   ├── components/        # Wiederverwendbare UI
│   │   ├── Layout.tsx     # UnsavedChangesContext Provider
│   │   └── SkillConflictDialog.tsx # Konfliktauflösung
│   └── store/             # Zustand State Management
│       └── jobStore.ts    # createJob/updateJob mit Feld-Transformation
├── shared/
│   └── types.ts           # SINGLE SOURCE OF TRUTH für Types
```

## Wichtige Dateien für Änderungen

| Feature | Hauptdateien |
|---------|--------------|
| AI Provider | `aiProviderService.ts`, `Settings.tsx`, `constants.ts` (AI_PROVIDER_DEFAULTS) |
| Job Matching | `matchingService.ts`, `JobList.tsx`, `JobDetail.tsx` |
| AI Extraktion | `aiExtractionService.ts`, `JobAdd.tsx` |
| Export (MD/PDF/ZIP) | `exportService.ts`, `JobDetail.tsx`, `JobList.tsx` |
| Skills Import | `skillsImportService.ts`, `SkillsImport.tsx`, `SkillConflictDialog.tsx` |
| Unsaved Changes | `Layout.tsx` (Context), `PreferencesPanel.tsx`, `ProfileForm.tsx` |
| IPC | `handlers.ts`, `preload.ts`, `global.d.ts` |
| Source-Resolution | `jobService.ts` (getOrCreateJobSource), `jobStore.ts` |

## Git-Workflow

```bash
# Aktuellen Branch prüfen
git branch

# Auf main wechseln und updaten
git checkout main && git pull

# Neuen Feature-Branch erstellen
git checkout -b feature/neue-funktion

# Nach Fertigstellung
git push -u origin feature/neue-funktion
# → PR auf GitHub erstellen
```

## Coding Conventions

- **Sprache:** TypeScript strikt, deutsche UI-Labels
- **DB-Spalten:** snake_case (`match_score`, `posted_date`)
- **TS-Properties:** camelCase (`matchScore`, `postedDate`)
- **Konvertierung:** In Service-Layer via `rowToJobOffer()`
- **Types:** IMMER aus `src/shared/types.ts` importieren
- **Dirty-State:** Nur persistente Felder vergleichen (nie UI-only Felder!)
- **Store-Transformationen:** `createJob` und `updateJob` transformieren Frontend-Felder (source→sourceId, description→fullText etc.)

## Kontakt zum CodeRabbit

PRs werden automatisch von CodeRabbit reviewed. Findings sollten adressiert werden bevor der User merged (User merged manuell).
