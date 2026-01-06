# Aktuelle Aufgabe: Skills-Import Erweiterung

**Stand:** 2026-01-06
**Status:** Bereit zur Implementierung

---

## Kontext

Das Skills Hub Projekt exportiert jetzt CSV-Dateien mit zwei neuen Spalten:
- `confidence` (very_likely, possible) - Multi-LLM-Analyse Konfidenz
- `marketRelevance` (high, medium, low) - Marktrelevanz des Skills

Diese Felder sollen in JobMatchChecker importiert und später beim Matching genutzt werden.

---

## Implementierungsplan

| # | Aufgabe | Details |
|---|---------|---------|
| 1 | Feature-Branch | `feature/skills-import-conflict-resolution` |
| 2 | DB-Migration | `confidence` (TEXT), `market_relevance` (TEXT) |
| 3 | Types erweitern | `HardSkill` + `SkillImportRow` + neue Enums |
| 4 | SkillConflictDialog.tsx | Radio-Buttons pro Feld (Alt / Neu / Keins), "Smart Merge" Button |
| 5 | Import-Service | Konflikte erkennen, Dialog-Daten vorbereiten |
| 6 | Test-CSV | `test-data/skills_export_sample.csv` |
| 7 | PR erstellen | Nach erfolgreichem Test |

---

## Konflikt-Dialog Konzept

- Pro Skill mit Konflikt: Tabelle mit Feldern nebeneinander (Alt vs. Neu)
- Radio-Buttons: ⚪ Alt | ⚪ Neu | ⚪ Keins (für jedes Feld)
- "Smart Merge" Button: Automatisch höheres Level + neue Metadaten wählen
- "Alle übernehmen" / "Alle behalten" Schnelloptionen

---

## Skill-Kategorien Priorisierung (für Matching)

1. **Hard Skills** (höchste Priorität) - Technische Fähigkeiten
2. **Future Skills** (zweite Priorität) - Transformative, digitale, gemeinschaftliche Skills
3. **Soft Skills** (dritte Priorität) - Zusätzliche persönliche Eigenschaften

Die Kategorien werden über `skill_categories` Tabelle unterschieden:
- "Hard Skills", "Soft Skills", "Future Skills" als Kategorienamen

**Hinweis für AI-Matching:** Diese Priorisierung sollte dem Modell mitgegeben werden, falls der aktuelle Prompt das nicht automatisch erkennt.

---

## DB-Schema Überblick

**Tabelle `skills`:**
- Basis: `id`, `name`, `category_id`, `level`, `years_experience`, `verified`, `notes`, `source`
- Future Skills: `skill_type`, `future_skill_category`, `assessment_method`, `certifications`, `last_assessed`
- **NEU:** `confidence`, `market_relevance`

**Tabelle `skill_categories`:**
- `id`, `name`, `parent_id`, `sort_order`
- Enthält: "Hard Skills", "Soft Skills", "Future Skills"

---

## Neue Felder Details

```typescript
// Confidence aus Multi-LLM-Analyse
export type SkillConfidence = 'very_likely' | 'possible';

// Marktrelevanz des Skills
export type MarketRelevance = 'high' | 'medium' | 'low';

// Erweiterung HardSkill Interface
export interface HardSkill {
  // ... bestehende Felder ...
  confidence?: SkillConfidence;
  marketRelevance?: MarketRelevance;
}
```

---

## Test-CSV Vorhanden

Export aus Skills Hub mit 94 Skills:
- Hard Skills (Python, Docker, etc.)
- Soft Skills (Analytisches Denken, etc.)
- Future Skills (Kritisches Denken, Systemisches Denken, etc.)
- Enthält: `confidence` und `marketRelevance` Spalten

---

## Nächste Schritte nach dieser Aufgabe

1. Matching-Prompt prüfen: Skill-Priorisierung (Hard > Future > Soft)
2. Confidence + MarketRelevance beim Matching berücksichtigen
3. Skills mit `very_likely` + `high` relevance höher gewichten
