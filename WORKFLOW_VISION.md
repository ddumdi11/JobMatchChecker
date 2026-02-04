# JobMatchChecker – Workflow-Vision

> **Stand:** 2026-02-04
> **Status:** Konzept / Ideensammlung – keine aktive Umsetzung geplant

---

## Workflow-Übersicht

```
┌─────────────────────────────────────────────────────────────┐
│            AI-ANALYSE (Profil-Ermittlung)                    │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  ChatGPT     │  │   Claude     │  │   Gemini     │      │
│  │  (OpenAI)    │  │ (Anthropic)  │  │  (Google)    │      │
│  │              │  │              │  │              │      │
│  │  Profil-     │  │  Profil-     │  │  Profil-     │      │
│  │  Analyse     │  │  Analyse     │  │  Analyse     │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │               │
│         └────────────┬────┘────────┬────────┘               │
│                      ▼             ▼                         │
│            skills_master_consolidated.yml                    │
│            skills_excluded.yml                               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         SKILLS_HUB (Python/Streamlit) – separat             │
│         Pfad: ..\skills_hub                                 │
│                                                             │
│  • YAML-Import (Multi-LLM-Analyse)                          │
│  • Text-Extraktion (~70 bekannte Skills)                    │
│  • Merge mit Konflikt-Erkennung                             │
│  • Normalisierung & Kategorisierung                         │
│  • Future Skills Framework 2030 (Hölzle)                    │
│  • confidence (very_likely/possible)                         │
│  • market_relevance (high/medium/low)                        │
│                                                             │
│  Export: CSV (UTF-8 BOM, JobMatchChecker-Format)            │
└──────────────────────┬──────────────────────────────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
┌──────────────────┐  ┌──────────────────────────────────────┐
│ SOMAS Prompt     │  │                                      │
│ Generator        │  │                                      │
│                  │  │                                      │
│ Bitscaler        │  │                                      │
│ (VidScaler-      │  │                                      │
│  SubtitleAdder)  │  │                                      │
│                  │  │                                      │
│ Weitere Tools    │  │                                      │
│ (ergänzende      │  │                                      │
│  Skills-Quellen) │  │                                      │
└────────┬─────────┘  │                                      │
         │ CSV        │                                      │
         ▼            │                                      │
┌─────────────────────────────────────────────────────────────┐
│            ★ JOBMATCHCHECKER (Electron) ★                    │
│            Pfad: ..\JobMatchChecker                         │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Profil &   │  │    Jobs     │  │  Matching   │         │
│  │   Skills    │──│  verwalten  │──│  (Claude AI) │         │
│  │  (SQLite)   │  │  CSV/Text/  │  │  Score +     │         │
│  │             │  │  manuell    │  │  Empfehlung  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
│  Skills-DB = Single Source of Truth                          │
│  für Matching & Bewerbungs-Workflow                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              PLATTFORMEN (Output – Zukunft)                  │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Indeed     │  │   LinkedIn   │  │    Xing      │      │
│  │              │  │              │  │              │      │
│  │ Skills →     │  │ Skills →     │  │ Skills →     │      │
│  │ Profil-      │  │ Profil-      │  │ Profil-      │      │
│  │ Abgleich     │  │ Abgleich     │  │ Abgleich     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
│  Mögliche Wege (Zukunft):                                   │
│  • Export als plattform-spezifisches Format                 │
│  • Zwischengeschaltete Konverter-App                        │
│  • API-Anbindung (wenn vorhanden)                           │
│  • Manueller Workflow mit Checkliste                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Apps im Ökosystem

### 1. skills_hub (Python/Streamlit) – Konsolidierung

| Eigenschaft | Details |
|-------------|---------|
| **Pfad** | `..\skills_hub` |
| **Technik** | Python 3.10+, Streamlit, pandas, PyYAML |
| **Funktion** | AI-Analysen konsolidieren, Skills normalisieren, CSV exportieren |
| **Input** | YAML (Multi-LLM-Analyse), Text (CV, LinkedIn, etc.) |
| **Output** | CSV im JobMatchChecker-Format |
| **Status** | Eigenständiges Projekt, separate Weiterentwicklung |

**Kernkonzept:**
- Mehrere AI-Assistenten analysieren das Profil unabhängig voneinander
- `skills_master_consolidated.yml` = konservativ konsolidiertes Ergebnis
- `skills_excluded.yml` = explizit ausgeschlossene Skills (verhindert Fehlmatches)
- Keine Skill-Inflation, keine Rollenverallgemeinerungen

### 2. SOMAS Prompt Generator

| Eigenschaft | Details |
|-------------|---------|
| **Pfad** | `..\somas_prompt_generator` |
| **Funktion** | Skills ermitteln & strukturieren |
| **Output** | CSV → Skills-Import |

### 3. Bitscaler / VidScalerSubtitleAdder

| Eigenschaft | Details |
|-------------|---------|
| **Pfad** | `..\VidScalerSubtitleAdder` |
| **Funktion** | Skills bewerten & skalieren |
| **Output** | CSV → Skills-Import |

### 4. JobMatchChecker (Electron) – Zentrale App

| Eigenschaft | Details |
|-------------|---------|
| **Pfad** | `..\JobMatchChecker` |
| **Technik** | TypeScript, Electron, React, SQLite, Claude API |
| **Funktion** | Profil + Jobs verwalten, AI-Matching, Export |
| **Input** | CSV (Skills), Text (Stellenanzeigen), manuell |
| **Output** | Match-Scores, PDF, Markdown, ZIP |

---

## Datenfluss (Skills)

```
Multi-LLM-Analyse
    ↓ YAML (consolidated + excluded)
skills_hub
    ↓ CSV (UTF-8 BOM, mit confidence + marketRelevance)
JobMatchChecker → Skills-Import (mit Konfliktauflösung)
    ↓ SQLite (Skills-DB)
Matching gegen Stellenangebote (Claude AI)
    ↓
Match-Score + Empfehlungen + Gap-Analyse
```

---

## Browser-Extension: Quick-Import (geplant)

**Idee:** Chromium-Extension (Comet-Browser) zum schnellen Erfassen von Stellenangeboten.

**Workflow:**

```
Indeed/LinkedIn/Xing im Browser
    ↓ Extension-Button: Seitentext kopieren (plain text)
    ↓ Zwischenablage
JobMatchChecker → "Aus Zwischenablage einfügen"
    ↓ Claude AI extrahiert Felder (erkennt Quellformat automatisch)
    ↓ Formular wird ausgefüllt
Fertig!
```

**Technische Details:**

- Chrome Extension (Manifest V3) - kompatibel mit allen Chromium-Browsern
- Output: **Reiner Text** (kein Markdown nötig)
- Claude AI trennt Stellentext zuverlässig von UI-Elementen (Buttons, Profil-Abgleich, etc.)
- Tipp: Hauptinhalt der Seite extrahieren, Header/Footer/Sidebar weglassen
- Entwicklung: mit Gemini (Google AI, optimal für Chrome-Extensions)

**Status:** Idee, Umsetzung als separates Mini-Projekt

---

## Plattform-Anbindung (Zukunft)

### Indeed

- **Beobachtung:** Indeed bietet eigenen Profil-Qualifikations-Abgleich
- **Wunsch:** Skills aus JobMatchChecker in Indeed-Profil übertragen
- **Status:** Idee, kein konkreter Plan

### LinkedIn

- **Wunsch:** Skills-Synchronisation mit LinkedIn-Profil
- **Möglicher Weg:** Zwischengeschaltete Konverter-App
- **Status:** Idee, kein konkreter Plan

### Xing

- **Status:** Noch nicht betrachtet

---

## Offene Fragen (für später)

1. Welches Exportformat eignet sich für plattform-übergreifenden Skills-Transfer?
2. Brauchen wir eine Konverter-App oder reicht ein Export + Anleitung?
3. Bieten Indeed/LinkedIn/Xing offene APIs für Profil-Updates?
4. Wie granular müssen Skills gemappt werden (Taxonomie-Unterschiede)?
5. Browser-Extension: Nur Zwischenablage oder direkte App-Kommunikation (z.B. localhost-API)?

---

## Zeithorizont

- **Jetzt:** Workflow-Skizze dokumentiert ✅
- **Kurzfristig:** App mit echten Daten testen, Reibungspunkte finden
- **Kurzfristig:** Browser-Extension als Mini-Projekt (Gemini/Comet)
- **Mittelfristig (Wochen):** Ggf. Export-Formate definieren
- **Langfristig:** Plattform-Anbindungen evaluieren

---

## Architektur-Prinzip

> Jede App bleibt eigenständig und wird separat weiterentwickelt.
> Der Datenaustausch erfolgt über standardisierte Formate (CSV, YAML).
> Der JobMatchChecker ist der **Konsument**, nicht der Orchestrator.
