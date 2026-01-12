# JobMatchChecker - Wiederaufnahme-Datei

> **Letzte Aktualisierung:** 2026-01-12
> **Status:** MVP funktionsfähig, Bulk-Export + UX-Verbesserungen komplett

## Session 12.01.2026 - Zusammenfassung

### Erledigte Features

**PR #42: Bulk-Export (Issue #34 Block 1)** ✅

- Mehrere Jobs als ein PDF exportieren (ein Job pro Seite)
- UI: Checkboxes in Job-Liste + "Bulk exportieren" Button
- Inhalt: Titel, Firma, Match-Score, Top-Skills, KI-Fazit
- Max-Limit: 100 Jobs, Selection wird nach Export zurückgesetzt

**PR #43: UX-Fix Matchen-Button (Issue #40)** ✅

- "Matchen" Button ist disabled wenn Job bereits Match-Score hat
- Tooltip: "Bereits gematcht – nutze Erneut matchen"
- "Erneut matchen" Button nur bei gematchten Jobs sichtbar

## Schnellstart für neue Session

```bash
# Projekt starten
cd c:\Users\diede\source\ClaudeProjekte\JobMatchChecker
npm run dev

# Build prüfen
npm run build

# TypeScript-Fehler anzeigen (viele sind vorbestehend)
npx tsc --noEmit
```

## Aktueller Projektstatus

### Fertige Features (in main)
- **Profil-Management** - Benutzerprofil mit Skills anlegen/bearbeiten
- **Job-Verwaltung** - Jobs anlegen, bearbeiten, löschen, filtern, sortieren
- **CSV-Import** - Jobs aus CSV importieren mit Duplikaterkennung
- **Merge-Funktion** - Doppelte Jobs zusammenführen (Smart-Merge)
- **Skills-Import** - Skills aus CSV mit Konfliktauflösung (PR #32, gemerged)
- **Skills Metadata** - confidence + marketRelevance Import (PR #37, gemerged)
- **Unsaved Changes** - Dirty-State-Tracking mit Confirmation-Dialog (PR #36, gemerged)
- **Bulk Matching & Export** - Selective Matching + MD/PDF Export (PR #33, gemerged)

### Bekannte Issues (nicht kritisch)

1. **Filter-Bug in JobList**
   - "Nur Jobs mit Match-Score" deaktiviert zeigt ungematchte Jobs nicht korrekt
   - Match-Score-Range-Slider (0-100%) filtert Jobs ohne Score unbeabsichtigt aus
   - **Workaround:** Slider nicht verwenden wenn alle Jobs sichtbar sein sollen

2. **Vorbestehende TypeScript-Fehler**
   - `JobSortConfig` Type-Fehler in JobList.tsx
   - `JobStatus` Type-Mismatches in Dashboard.tsx
   - Beeinträchtigen Runtime nicht, nur tsc --noEmit

3. **UX-Issue: PreferencesPanel Location Deletion**
   - Locations können aktuell nicht entfernt werden
   - Chip hat kein `onDelete` Handler
   - Issue dokumentiert (siehe unten)

## Nächste Schritte

### Kurzfristig (nächste Session)

- **PreferencesPanel: Location Deletion (Mini-Issue)**
  - Location Chips mit `onDelete` Handler ausstatten
  - Locations aus Array entfernen können
  - DoD: User kann Location mit X-Button löschen, formData aktualisiert sich, Dirty-State wird korrekt getriggert

- **Matching-Algorithmus erweitern (Skills Metadata nutzen)**
  - Confidence + MarketRelevance beim Matching berücksichtigen
  - Skills mit `very_likely` + `high` relevance höher gewichten
  - Skill-Kategorien-Priorisierung: Hard Skills > Future Skills > Soft Skills

- **Optional: Filter-Bug für ungematchte Jobs fixen**
  - Match-Score-Filter überarbeiten: null-Werte korrekt handhaben
  - "Jobs ohne Match-Score" Checkbox richtig implementieren

### Mittelfristig

- Bulk-Export (mehrere Jobs gleichzeitig exportieren)
- Matching-Ergebnisse detaillierter im Dialog anzeigen
- Dashboard mit Statistiken erweitern

## Architektur-Kurzübersicht

```
src/
├── main/                    # Electron Main Process
│   ├── services/           # Business Logic
│   │   ├── matchingService.ts    # AI-Matching mit Claude API
│   │   ├── exportService.ts      # Markdown/PDF Export
│   │   ├── skillsImportService.ts # Skills-Import mit Konfliktauflösung
│   │   └── jobService.ts         # Job CRUD + Merge
│   ├── ipc/handlers.ts     # IPC Handler registrierung
│   └── preload.ts          # Context Bridge
├── renderer/               # React Frontend
│   ├── pages/             # Route-Komponenten
│   │   ├── JobList.tsx    # Hauptliste mit Bulk-Matching
│   │   ├── JobDetail.tsx  # Detailansicht mit Export
│   │   ├── SkillsImport.tsx # Skills-Import UI
│   │   └── PreferencesPanel.tsx # Preferences mit UnsavedChanges
│   ├── components/        # Wiederverwendbare UI
│   │   ├── Layout.tsx     # UnsavedChangesContext Provider
│   │   └── SkillConflictDialog.tsx # Konfliktauflösung
│   └── store/             # Zustand State Management
├── shared/
│   └── types.ts           # SINGLE SOURCE OF TRUTH für Types
```

## Wichtige Dateien für Änderungen

| Feature | Hauptdateien |
|---------|--------------|
| Job Matching | `matchingService.ts`, `JobList.tsx`, `JobDetail.tsx` |
| Export | `exportService.ts`, `JobDetail.tsx` |
| Skills Import | `skillsImportService.ts`, `SkillsImport.tsx`, `SkillConflictDialog.tsx` |
| Unsaved Changes | `Layout.tsx` (Context), `PreferencesPanel.tsx`, `ProfileForm.tsx`, etc. |
| IPC | `handlers.ts`, `preload.ts`, `global.d.ts` |

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

## Kontakt zum CodeRabbit

PRs werden automatisch von CodeRabbit reviewed. Findings sollten addressiert werden bevor der User merged (User merged manuell).
