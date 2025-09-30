# Job Match Checker – Constitution

## Vision
Eine intelligente Desktop-Anwendung zur systematischen Erfassung, Verwaltung und AI-gestützten Bewertung von Stellenangeboten aus verschiedenen Jobbörsen. Die App lernt kontinuierlich, liefert präzise Gap-Analysen und ermöglicht datengetriebene Entscheidungen bei der Jobsuche.

## Mission
Dem Nutzer Zeit sparen durch:
- Zentralisierte Verwaltung aller Stellenangebote
- Automatisierte Passung-Bewertung basierend auf individuellem Profil
- Transparente Darstellung von Qualifikationslücken
- Historische Auswertung zur kontinuierlichen Verbesserung der Jobsuche-Strategie

---

## Kernprinzipien

### 1. Privacy First
- Alle Daten bleiben lokal (SQLite-Datenbank)
- Keine Cloud-Synchronisation ohne explizite Zustimmung
- API-Keys sicher in `.env`-Dateien gespeichert

### 2. Datenintegrität
- Automatische SQL-Dumps vor jedem Update
- Verlustfreie Datenbank-Migration bei Version-Upgrades
- Versionierte Backups mit Rollback-Möglichkeit

### 3. Adaptivität
- Matching-Prompts sind durch Admin-Bereich anpassbar
- Skill-Levels und Kategorien erweiterbar
- Kontinuierliche Verbesserung durch Re-Matching-Funktion

### 4. Multi-Source Support
- Jobs von beliebigen Börsen erfassbar
- Flexible Import-Formate (Text, LaTeX, PDF, später API)
- Einheitliche Datenhaltung trotz heterogener Quellen

### 5. Transparenz
- Nutzer versteht, warum ein Job (nicht) passt
- Nachvollziehbare Gap-Analysen
- Klare Score-Begründungen

### 6. Iterative Entwicklung
- MVP zuerst funktional, dann Features erweitern
- User-Feedback-gesteuerte Roadmap
- Rückwärtskompatibilität bei allen Updates

---

## Tech Constraints

### Frontend
- **Framework:** Electron (Cross-Platform Desktop)
- **UI:** React oder Vue.js (TBD basierend auf Team-Präferenz)
- **Styling:** Tailwind CSS oder Material-UI

### Backend
- **Runtime:** Node.js
- **Datenbank:** SQLite (embedded, lokal)
- **Migrations:** Automatisch via Knex.js oder Sequelize

### AI Integration
- **Primär:** Claude Sonnet 4.5 API (Anthropic)
- **Fallback:** OpenRouter (optional, konfigurierbar)
- **Prompt-Verwaltung:** In DB speicherbar, versionierbar

### Build & Deployment
- **Packaging:** electron-builder
- **Installer:** Automatische Datenmigration + Backup-Mechanismus
- **Updates:** Sicherer Update-Prozess ohne Datenverlust

---

## Scope Definition

### MVP (Phase 1) – Target: Q2 2025
**Muss haben:**
- [ ] LaTeX-Lebenslauf-Import → strukturiertes Profil erstellen
- [ ] Manuelle Job-Erfassung via Copy-Paste (mit AI-gesteuerter Feld-Extraktion)
- [ ] Plain-Text & PDF-Text-Import (ohne OCR)
- [ ] Profil-Verwaltung: Hard Skills mit Kategorien & Level (0-10)
- [ ] Präferenzen: Gehalt, Standort, Remote-Anteil
- [ ] AI-Matching: Score + Gap-Analyse (Claude API)
- [ ] Job-Liste mit Filter (Börse, Datum, Match-Score)
- [ ] Basis-Report: Wochen-/Monatsübersicht (PDF + CSV Export)
- [ ] Admin-Bereich: Standard-Prompts editieren

**Nice to have (wenn Zeit):**
- [ ] Zwischenschritt-Validierung vor DB-Speicherung
- [ ] Einfache Job-Detail-Ansicht

### Phase 2 – Target: Q3/Q4 2025
- [ ] Screenshot OCR (Tesseract-Integration)
- [ ] API-Anbindung für Jobbörsen (börsenspezifisch)
- [ ] Soft Skills Profil
- [ ] Erweiterte Statistiken:
  - Jobs pro Börse (Ranking)
  - Durchschnitts-Match-Score über Zeit
  - Top-5 häufigste Gaps
  - Trend-Charts (Matching-Qualität)
- [ ] Automatische Weiterbildungsvorschläge basierend auf Gaps

### Out of Scope (zunächst)
- Multi-User-Support
- Cloud-Synchronisation
- Mobile App
- Automatische Bewerbungs-Generierung
- Integration mit E-Mail-Clients
- Echtzeit-Job-Alerts

---

## Datenmodell (High-Level)

### Kern-Entitäten
1. **User Profile**
   - Hard Skills (kategorisiert, Level 0-10)
   - Soft Skills (später)
   - Präferenzen (Gehalt, Standort, Remote)
   - CV-Daten (aus LaTeX geparst)

2. **Job Offers**
   - Quelle/Börse
   - Pflichtfelder: Titel, Firma, Link, Datum
   - Volltext (für spätere Analysen)
   - Matching-Ergebnisse (Score, Gap, Timestamp)

3. **Job Sources** (Jobbörsen)
   - Name, URL, API-Config (falls vorhanden)
   - Statistiken (Anzahl Jobs, Ø Match)

4. **Matching Prompts**
   - Versioniert
   - Editierbar über Admin-UI
   - Referenz zu Matching-Ergebnissen

5. **Matching Results**
   - Score (0-100)
   - Gap-Analyse (strukturiert)
   - Timestamp, verwendeter Prompt

---

## User Stories (Auswahl MVP)

### Als Nutzer möchte ich...
1. **...meinen Lebenslauf importieren**  
   *Damit mein Profil schnell erstellt wird, ohne alles manuell einzugeben.*

2. **...Jobs per Copy-Paste erfassen**  
   *Damit ich schnell interessante Angebote in die App bekomme.*

3. **...automatisch vorausgefüllte Felder sehen**  
   *Damit die AI mir Arbeit abnimmt bei der Job-Erfassung.*

4. **...ein Matching mit einem Klick starten**  
   *Damit ich sofort sehe, ob ein Job passt.*

5. **...einen Score und eine Gap-Liste sehen**  
   *Damit ich weiß, was mir fehlt und ob es sich lohnt zu bewerben.*

6. **...alle Jobs einer Woche/Monat übersichtlich exportieren**  
   *Damit ich meine Jobsuche dokumentieren und reflektieren kann.*

7. **...Matching-Prompts anpassen**  
   *Damit die AI besser auf meine individuellen Kriterien matcht.*

---

## Success Metrics

### MVP-Erfolg gemessen an:
- **Funktionalität:** Alle MVP-Features implementiert & getestet
- **Usability:** Job-Erfassung in < 2 Minuten pro Angebot
- **AI-Qualität:** Matching-Score subjektiv als "hilfreich" bewertet
- **Stabilität:** Keine Datenverluste bei Updates

### Phase 2-Erfolg:
- **Automatisierung:** 50% der Felder automatisch korrekt befüllt
- **Insights:** Mindestens 3 statistisch verwertbare Reports verfügbar
- **Adoption:** Nutzer verwendet App regelmäßig > 3 Monate

---

## Entwicklungs-Philosophie

### Code Quality
- Clean Code Prinzipien (DRY, SOLID)
- Automatisierte Tests für kritische Logik (DB-Migration, Matching)
- Code Reviews für alle Features

### Iteratives Vorgehen
1. **Design:** Wireframes für neue Features
2. **Prototyp:** Funktionierende Minimal-Version
3. **Feedback:** Nutzer-Test & Anpassungen
4. **Polish:** UI/UX-Verbesserungen
5. **Release:** Versioniertes Deployment

### Documentation
- README mit Setup-Anleitung
- API-Dokumentation für Matching-Prompts
- User Guide für zentrale Features

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| API-Kosten überschreiten Budget | Hoch | Rate-Limiting, Caching von Matches, OpenRouter-Fallback |
| LaTeX-Parser versagt bei komplexen CVs | Mittel | Manuelle Nachbearbeitung ermöglichen |
| DB-Migration führt zu Datenverlust | Kritisch | Automatische Backups + Rollback-Mechanismus |
| OCR-Qualität zu schlecht | Niedrig | Fallback auf manuelle Eingabe |
| API-Anbindung Jobbörsen nicht verfügbar | Mittel | Fokus auf manuelle Erfassung für MVP |

---

## Roadmap Timeline

**Q2 2025:** MVP fertigstellen  
**Q3 2025:** Phase 2 Features (OCR, APIs, Statistiken)  
**Q4 2025:** Polish & Advanced Features  
**2026:** Community-Feedback-gesteuerte Erweiterungen

---

## Governance

### Decision Making
- **Tech-Entscheidungen:** Pragmatisch, bewährte Technologien bevorzugen
- **Feature-Priorisierung:** Nach Impact/Effort-Matrix
- **Breaking Changes:** Nur bei klarem Nutzen + Migrationspfad

### Change Management
- Constitution ist "Living Document"
- Änderungen dokumentiert in `CHANGELOG.md`
- Rückwärtskompatibilität wo möglich

---

*Version: 1.0 | Erstellt: 2025-09-30 | Nächste Review: Nach MVP-Release*
