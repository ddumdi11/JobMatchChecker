# JobMatchChecker - Wiederaufnahme-Datei

> **Letzte Aktualisierung:** 2026-02-12
> **Status:** MVP funktionsfähig, aktive Weiterentwicklung

## Session 11.02.2026 - Zusammenfassung

### Erledigte Fixes

**PR #50: Session Findings - Bugs, UX & Matching** ✅

Vollständiger Workflow-Test mit echtem Stellenangebot ergab 7 Findings, alle behoben:

- **BUG-1:** Quelle-Feld wird jetzt korrekt gespeichert (getOrCreateJobSource + Feld-Transformation in updateJob)
- **BUG-2:** Datum (postedDate) ist jetzt editierbar im Formular
- **UX-1:** AI Confidence zeigt "medium" statt "low" wenn nur Datum fehlt
- **UX-2:** Gehaltsfelder zeigen jetzt "€/Jahr" als Einheit
- **UX-5:** AI-Prompt ignoriert Email-Header/Nachrichten-Envelope
- **UX-6:** Remote-Default "0% - Vor Ort" bei keiner Remote-Angabe
- **MATCH-2:** Level-basierte Sprachrichtlinien im Matching-Prompt

CodeRabbit Review: 4 weitere Findings adressiert (State-Update, Timezone, undefined-Check, await)

**PR #49: Status-Dropdown & Farben** ✅

- Status direkt in JobDetail änderbar (Dropdown mit farbigen Chips)
- Konsistente Farben: Neu=Hellblau, Interessant=Grün, Beworben=Orange, Abgelehnt=Rot, Archiviert=Grau

## Session 05-11.02.2026 - Zusammenfassung

**PR #48: Clear State & Stale Matching Fix** ✅
- State wird nach Job-Speichern korrekt zurückgesetzt
- Bulk-Matching-Count zeigt aktuelle Werte

**PR #47: File Import (MD/Text/PDF)** ✅
- Jobs aus Markdown-, Text- und PDF-Dateien importieren

**PR #46: Kontextabhängige Snackbar-Meldungen** ✅
- Skill-Aktionen zeigen spezifische Erfolgs-/Fehlermeldungen

**Weitere Fixes (direkt in main):**
- Keyboard-Shortcuts (Ctrl+M, Ctrl+E, Ctrl+S)
- Filter-Bug behoben: Match-Score-Range versteckt keine ungematchten Jobs mehr
- TypeScript-Fehler in Renderer-Komponenten aufgelöst
- GitHub Pages Landing Page

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
- **Keyboard-Shortcuts** - Ctrl+M (Match), Ctrl+E (Edit), Ctrl+S (Save)

### Bekannte Issues (nicht kritisch)

1. **Vorbestehende TypeScript-Fehler**
   - Einige Type-Mismatches in tsc --noEmit
   - Beeinträchtigen Runtime nicht

2. **UX-Issue: PreferencesPanel Location Deletion**
   - Locations können nicht entfernt werden (kein `onDelete` Handler)

3. **PreferencesPanel: Englische Labels**
   - Einige Labels noch auf Englisch statt Deutsch (CodeRabbit Nitpick)

## Backlog (priorisiert)

| Prio | Item | Aufwand | Impact |
|------|------|---------|--------|
| 1 | MATCH-1: Score-Gewichtung überarbeiten | Groß | Hoch (Kernfunktion) |
| 2 | UX-3: Skills-Suche/Filter | Mittel | Hoch (Usability) |
| 3 | UX-4: Skills CSV-Export | Mittel | Mittel |
| 4 | FEAT-1: Skills Duplikat-Erkennung | Groß | Mittel |
| 5 | FEAT-2: Ctrl+F / findInPage | Mittel | Mittel |
| 6 | FEAT-3: Default-Kategorie "IT Infrastructure" | Klein | Klein |
| 7 | PreferencesPanel: Location Deletion | Klein | Klein |
| 8 | PreferencesPanel: Labels übersetzen | Klein | Klein |

### Details zu wichtigsten Backlog-Items

**MATCH-1: Score-Gewichtung (Groß/Hoch)**
- Score-Sprung von 42% auf 78% durch zwei niedrig bewertete Skills unrealistisch
- Binäres "Skill vorhanden" dominiert über tatsächliches Level
- Kern: Gewichtung muss Level-basiert statt nur existenz-basiert sein

**UX-3: Skills-Suche (Mittel/Hoch)**
- Bei 132 Skills keine Suche/Filter möglich
- Kein Ctrl+F in Electron
- Suchfeld + optional Kategorie-Filter

**FEAT-1: Skills Duplikat-Erkennung (Groß/Mittel)**
- Case-Sensitivity: "Docker" vs "docker"
- Sprach-Mixing: "Communication" vs "Kommunikation"
- Varianten: "Git", "git / github", "git/github"

## Architektur-Kurzübersicht

```
src/
├── main/                    # Electron Main Process
│   ├── services/           # Business Logic
│   │   ├── matchingService.ts    # AI-Matching mit Claude API
│   │   ├── aiExtractionService.ts # AI-Extraktion aus Text
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
