<div align="center">

# 🎯 Job Match Checker

**Finde den perfekten Job – mit KI-Unterstützung**

*Stellenangebote erfassen, analysieren und matchen – alles lokal auf deinem Rechner*

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-38.2-blue.svg)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18.2-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Claude AI](https://img.shields.io/badge/Claude-Sonnet_4.5-orange.svg)](https://www.anthropic.com/)

![Job-Übersicht mit Match-Scores](docs/assets/jobuebersicht.jpg)

</div>

---

## Warum Job Match Checker?

| Problem | Lösung |
|---------|--------|
| Stellenangebote überall verstreut | Zentrale Verwaltung in einer App |
| "Passt der Job zu mir?" | AI-Matching mit Score (0-100%) |
| "Was fehlt mir noch?" | Gap-Analyse zeigt Lücken auf |
| Daten in der Cloud? | 100% lokal – deine Daten bleiben bei dir |

---

## Features

- **AI-Matching** – Stellenangebote gegen dein Profil matchen (Claude Sonnet 4.5), einzeln oder als Bulk
- **Profil & Skills** – Profilverwaltung mit kategorisierten Skills, Levels, Confidence und Market Relevance
- **Job-Verwaltung** – CRUD, Filterung, Sortierung, Statusverwaltung
- **Datei-Import** – Stellenanzeigen per Drag & Drop oder Datei-Dialog (.md, .txt, .pdf) importieren
- **CSV-Import** – Bulk-Import mit automatischer Duplikaterkennung und Merge-Dialog
- **Skills-Import** – CSV/JSON-Import mit Konfliktauflösung und Future Skills Framework
- **Export** – Einzeln oder Bulk als PDF, Markdown oder ZIP (Markdown + JSON)
- **Privacy First** – Alle Daten lokal in SQLite, kein Cloud-Sync

---

## Quick Start

### Voraussetzungen

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Claude API Key** ([console.anthropic.com](https://console.anthropic.com))

### Installation

```bash
git clone https://github.com/ddumdi11/JobMatchChecker.git
cd JobMatchChecker
npm install
npm run dev
```

Die App öffnet sich automatisch. Beim ersten Start den Claude API Key unter **Einstellungen** eingeben.

---

## Nutzung

### 1. Profil anlegen

Unter **Profil** persönliche Daten, bevorzugte Standorte und Skills pflegen. Skills können manuell oder per CSV/JSON-Import hinzugefügt werden.

![Skills-Verwaltung](docs/assets/skills.jpg)

### 2. Stellenangebote erfassen

Vier Wege, Jobs hinzuzufügen:

| Methode | Beschreibung |
|---------|-------------|
| **Copy-Paste** | Text aus Zwischenablage einfügen, AI extrahiert Felder |
| **Datei laden** | Markdown, Text oder PDF per Dialog oder Drag & Drop importieren |
| **CSV-Import** | Bulk-Import mit Duplikaterkennung und Merge-Dialog |
| **Manuell** | Formular direkt ausfüllen |

![Job hinzufügen – Drag & Drop](docs/assets/jobhinzufuegen.jpg)

### 3. AI-Analyse

Nach dem Einfügen analysiert Claude AI den Text und extrahiert automatisch alle relevanten Felder:

![AI-Analyse Ergebnis](docs/assets/jobhinzufuegen_ai_analyse.jpg)

### 4. Matching ausführen

- **Einzeln**: Job öffnen, "Match Job" klicken
- **Bulk**: Mehrere Jobs auswählen oder alle neuen matchen lassen
- **Ergebnis**: Match-Score (0-100%), Stärken, Lücken, Empfehlungen

### 5. Exportieren

- **PDF** – Einzeln oder mehrere Jobs als PDF
- **Markdown** – Strukturierter Text-Export
- **ZIP** – Bulk-Export als ZIP (Markdown + JSON)

---

## Tech Stack

| Bereich | Technologie |
|---------|-------------|
| Frontend | React 18.2, Material-UI 5.15, Zustand 4.5 |
| Backend | Electron 38.2, Node.js 18+ |
| Datenbank | SQLite (better-sqlite3 12.4), Knex 3.1 |
| AI | Claude Sonnet 4.5 (Anthropic SDK 0.30) |
| Build | electron-vite, TypeScript 5.3 |
| Test | Vitest |

---

## Projektstruktur

```
JobMatchChecker/
├── src/
│   ├── main/              # Electron Main Process
│   │   ├── database/      # SQLite + Knex Migrations
│   │   ├── services/      # Business Logic (AI, Import, Export, Matching)
│   │   └── ipc/           # IPC Handler
│   ├── renderer/          # React Frontend
│   │   ├── components/    # UI-Komponenten (MergeDialog, SkillsImport, etc.)
│   │   ├── pages/         # Seiten (Dashboard, JobList, JobAdd, Import, etc.)
│   │   └── store/         # Zustand State Management
│   └── shared/            # Geteilte Types & Konstanten
├── tests/                 # Unit & Contract Tests
├── testdata/              # Test-Dateien (PDFs, Markdown, CSV)
├── data/                  # SQLite-Datenbank (gitignored)
└── specs/                 # Technische Spezifikationen
```

---

## Architektur

```
Renderer (React/Zustand)
    │
    │ window.api.*
    ▼
Preload (contextBridge)
    │
    │ ipcRenderer.invoke()
    ▼
Main Process (IPC Handler)
    │
    ├── jobService           # CRUD, Merge, Validierung
    ├── aiExtractionService  # Claude AI Feld-Extraktion
    ├── matchingService      # AI Matching & Gap-Analyse
    ├── importService        # CSV-Import & Staging
    ├── skillsImportService  # Skills CSV/JSON Import
    └── exportService        # PDF, Markdown, ZIP Export
    │
    ▼
SQLite (better-sqlite3)
```

### Konventionen

- **Datenbank**: `snake_case` (SQL Standard)
- **TypeScript**: `camelCase` (JS Standard)
- **Konvertierung**: `rowToJobOffer()` im Service Layer
- **Types**: Single Source of Truth in `src/shared/types.ts`
- **UI-Sprache**: Deutsch

---

## Ökosystem

Job Match Checker ist Teil eines größeren Workflows:

```
Multi-LLM Profil-Analyse (ChatGPT, Claude, Gemini)
    ↓ YAML
skills_hub (Python/Streamlit) → Konsolidierung
    ↓ CSV
Job Match Checker → Skills-Import, AI-Matching, Export
```

Siehe [WORKFLOW_VISION.md](./WORKFLOW_VISION.md) für das vollständige Ökosystem.

---

## Scripts

| Command | Beschreibung |
|---------|-------------|
| `npm run dev` | Entwicklungsserver starten (Hot Reload) |
| `npm run build` | Production Build |
| `npm run package` | Distributable erstellen |
| `npm run lint` | ESLint ausführen |
| `npm test` | Tests mit Vitest |
| `npm run migrate:latest` | Datenbank-Migrationen ausführen |

---

## Sicherheit

- **API Keys**: Im App-internen Store gespeichert
- **SQL Injection**: Verhindert durch Knex.js Prepared Statements
- **XSS**: Mitigiert durch React's automatisches Escaping
- **Daten**: Vollständig lokal, kein Cloud-Sync
- **Backups**: Datenbank-Backup & Restore integriert

---

## Lizenz

MIT License – siehe [LICENSE](LICENSE)

---

## Danksagungen

- [Anthropic](https://www.anthropic.com/) – Claude API
- [Electron](https://www.electronjs.org/) – Desktop Framework
- [React](https://reactjs.org/) & [Material-UI](https://mui.com/) – UI
- [CodeRabbit](https://coderabbit.ai/) – AI Code Review

---

<div align="center">

**Built with ❤️ and a lot of Claude**

</div>
