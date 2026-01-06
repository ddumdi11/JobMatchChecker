# JobMatchChecker - Wiederaufnahme-Datei

> **Letzte Aktualisierung:** 2026-01-06
> **Status:** MVP funktionsfähig, PR #33 offen für Review

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

### PR #33 - Bulk Matching & Export (offen)
**Branch:** `feature/bulk-matching-and-export`

Neue Features:
1. **Bulk Matching**
   - "Neue matchen (X)" - Nur Jobs ohne Match-Score
   - "Alle neu matchen" - Alle Jobs rematchen
   - "Ausgewählte matchen (X)" - Checkbox-Selektion für gezieltes Matching

2. **Export-Funktionen**
   - Markdown-Export mit vollständiger Matching-Analyse
   - PDF-Export (professionelles Layout)
   - Beide über JobDetail-Seite erreichbar

### Bekannte Issues (nicht kritisch)

1. **Filter-Bug in JobList**
   - "Nur Jobs mit Match-Score" deaktiviert zeigt ungematchte Jobs nicht korrekt
   - Match-Score-Range-Slider (0-100%) filtert Jobs ohne Score unbeabsichtigt aus
   - **Workaround:** Slider nicht verwenden wenn alle Jobs sichtbar sein sollen

2. **Vorbestehende TypeScript-Fehler**
   - `JobSortConfig` Type-Fehler in JobList.tsx
   - `JobStatus` Type-Mismatches in Dashboard.tsx
   - Beeinträchtigen Runtime nicht, nur tsc --noEmit

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
│   │   └── SkillsImport.tsx # Skills-Import UI
│   └── components/        # Wiederverwendbare UI
├── shared/
│   └── types.ts           # SINGLE SOURCE OF TRUTH für Types
```

## Wichtige Dateien für Änderungen

| Feature | Hauptdateien |
|---------|--------------|
| Job Matching | `matchingService.ts`, `JobList.tsx`, `JobDetail.tsx` |
| Export | `exportService.ts`, `JobDetail.tsx` |
| Skills Import | `skillsImportService.ts`, `SkillsImport.tsx`, `SkillConflictDialog.tsx` |
| IPC | `handlers.ts`, `preload.ts`, `global.d.ts` |

## Nächste Schritte

### Kurzfristig
- [ ] CodeRabbit Review für PR #33 abwarten und Findings addressieren
- [ ] PR #33 mergen nach Review
- [ ] Filter-Bug für ungematchte Jobs fixen (optional)

### Mittelfristig
- [ ] Bulk-Export (mehrere Jobs gleichzeitig exportieren)
- [ ] Matching-Ergebnisse detaillierter im Dialog anzeigen
- [ ] Dashboard mit Statistiken erweitern

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

## Kontakt zum CodeRabbit

PRs werden automatisch von CodeRabbit reviewed. Findings sollten addressiert werden bevor der User merged (User merged manuell).
