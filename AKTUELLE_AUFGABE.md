# Aktuelle Aufgabe: Session 12.01.2026

**Stand:** 2026-01-12
**Status:** ✅ ERLEDIGT - Bulk-Export + UX-Fix

---

## ✅ Erledigte Aufgaben (12.01.2026)

### Bulk-Export (Issue #34, PR #42)

- ✅ Mehrere Jobs als ein PDF exportieren (ein Job pro Seite)
- ✅ UI: Checkboxes in Job-Liste + "Bulk exportieren" Button
- ✅ Inhalt: Titel, Firma, Match-Score, Top-Skills, KI-Fazit
- ✅ Max-Limit: 100 Jobs (CodeRabbit Nitpick)
- ✅ Selection wird nach Export zurückgesetzt (CodeRabbit Nitpick)

### UX-Fix Matchen-Button (Issue #40, PR #43)

- ✅ "Matchen" Button disabled wenn Job bereits Match-Score hat
- ✅ Tooltip: "Bereits gematcht – nutze Erneut matchen"
- ✅ "Erneut matchen" Button nur bei gematchten Jobs sichtbar
- ✅ Span-Wrapper für Tooltip bei disabled Button (CodeRabbit Fix)

---

## 📋 Nächste Aufgaben (Vorschlag)

### 1. **PreferencesPanel: Location Deletion (Mini-Issue)** 🔴 PRIO

**Beschreibung:**
Aktuell können Locations in PreferencesPanel nicht entfernt werden. Chips zeigen keine Delete-Funktion.

**DoD (Definition of Done):**
- [ ] Location Chips haben `onDelete` Handler
- [ ] Click auf X-Button entfernt Location aus `formData.preferredLocations`
- [ ] Dirty-State wird korrekt getriggert
- [ ] Save speichert aktualisierte Location-Liste

**Dateien:**
- `src/renderer/components/PreferencesPanel.tsx` (ca. Zeile 264-271)

**Zeitaufwand:** 15-30 Minuten

---

### 2. **Matching-Algorithmus: Skills Metadata Integration** 🟡 WICHTIG

**Beschreibung:**
Confidence + MarketRelevance beim Matching berücksichtigen, um präzisere Match-Scores zu erzeugen.

**Implementierungsplan:**

| # | Aufgabe | Details |
|---|---------|---------|
| 1 | Matching-Service erweitern | `matchingService.ts` - Skills mit Metadata laden |
| 2 | Prompt anpassen | Skill-Kategorien-Priorisierung: Hard > Future > Soft |
| 3 | Gewichtung implementieren | `very_likely` + `high` → höheres Gewicht |
| 4 | Test mit echten Daten | Match-Scores mit/ohne Metadata vergleichen |

**Skill-Kategorien Priorisierung:**
1. **Hard Skills** (höchste Priorität) - Technische Fähigkeiten
2. **Future Skills** (zweite Priorität) - Transformative, digitale, gemeinschaftliche Skills
3. **Soft Skills** (dritte Priorität) - Zusätzliche persönliche Eigenschaften

**DoD:**
- [ ] Skills mit `confidence='very_likely'` + `marketRelevance='high'` höher gewichtet
- [ ] Matching-Prompt enthält Skill-Kategorien-Priorisierung
- [ ] Match-Scores sind präziser als vorher (Smoke Test)

**Dateien:**
- `src/main/services/matchingService.ts`
- Evtl. `src/main/services/profileService.ts` (Skills laden)

**Zeitaufwand:** 2-3 Stunden

---

### 3. **Filter-Bug: Jobs ohne Match-Score** 🟢 OPTIONAL

**Beschreibung:**
"Jobs ohne Match-Score" Filter funktioniert nicht korrekt. Match-Score-Range-Slider filtert Jobs mit `null` Match-Score unbeabsichtigt aus.

**DoD:**
- [ ] "Nur Jobs mit Match-Score" Checkbox funktioniert korrekt
- [ ] Jobs ohne Match-Score werden angezeigt wenn Checkbox deaktiviert
- [ ] Match-Score-Range-Slider ignoriert Jobs mit `null` Match-Score

**Dateien:**
- `src/renderer/pages/JobList.tsx`
- `src/main/services/jobService.ts` (Filter-Logik)

**Zeitaufwand:** 1-2 Stunden

---

## Empfehlung für nächste Session

**Start mit:** Mini-Issue "PreferencesPanel: Location Deletion" (schneller Quick-Win)

**Dann:** Matching-Algorithmus erweitern (bringt den größten Business Value)

**Optional:** Filter-Bug fixen (falls Zeit übrig)
