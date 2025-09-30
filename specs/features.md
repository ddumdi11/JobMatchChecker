# Job Match Checker – Feature Specifications

## Feature Overview

---

## MVP Features (Phase 1)

### F1: Profile Management

#### F1.1: LaTeX CV Import
**User Story:** Als Nutzer möchte ich meinen LaTeX-Lebenslauf importieren, damit mein Profil automatisch erstellt wird.

**Acceptance Criteria:**
- [ ] Datei-Upload-Dialog akzeptiert `.tex` Dateien
- [ ] Parser extrahiert mindestens: Name, Kontakt, Skills, Berufserfahrung
- [ ] Erkannte Skills werden Kategorien zugeordnet (mit manuellem Review)
- [ ] Import-Fehler werden klar angezeigt
- [ ] Original LaTeX-Code wird in DB gespeichert (für Re-Import)

**Technical Notes:**
- Library: `latex-utensils` oder `unified-latex-util`
- Strukturerkennung via Pattern-Matching (CV-Klassen: `moderncv`, `europecv`, etc.)
- Fallback: Nutzer kann unerkannte Abschnitte manuell zuordnen

**UI Mockup:**
```
┌─────────────────────────────────────┐
│ CV Import                           │
├─────────────────────────────────────┤
│ [Choose .tex file]  │ Import        │
│                                     │
│ ✓ Name erkannt: Max Mustermann     │
│ ✓ 12 Skills gefunden               │
│ ⚠ Abschnitt "Hobbies" ignoriert    │
│                                     │
│ [Review & Save]  [Cancel]          │
└─────────────────────────────────────┘
```

---

#### F1.2: Skills Verwaltung
**User Story:** Als Nutzer möchte ich meine Skills manuell hinzufügen, bearbeiten und kategorisieren können, damit ich ein präzises Profil habe.

**Acceptance Criteria:**
- [ ] Skill hinzufügen: Name, Kategorie, Level (0-10), Jahre Erfahrung
- [ ] Kategorien sind hierarchisch (z.B. Programmierung → Backend → Python)
- [ ] Skill-Level visuell als Slider oder Rating dargestellt
- [ ] Bulk-Import von Skills aus anderen Quellen (CSV, JSON)
- [ ] Skills können als "verifiziert" markiert werden (Zertifikat vorhanden)
- [ ] Suchfunktion für Skills

**Technical Notes:**
- Kategorien-Baum mit Drag & Drop (react-dnd oder @dnd-kit)
- Auto-Suggest für Skill-Namen (basierend auf Standard-Skills-Library)

**UI Mockup:**
```
┌─────────────────────────────────────────────┐
│ Skills Management              [+ Add Skill] │
├─────────────────────────────────────────────┤
│ 📁 Programmiersprachen (12)                 │
│   📁 Backend (7)                            │
│     • Python       ████████── 8/10  ✓       │
│     • Java         █████────  5/10          │
│   📁 Frontend (5)                           │
│     • React        ███████─── 7/10  ✓       │
│                                             │
│ 📁 Tools & Frameworks (8)                   │
│   • AWS            ███──────  3/10          │
│                                             │
│ [Search Skills]  [Import CSV]  [Export]    │
└─────────────────────────────────────────────┘
```

---

#### F1.3: Preferences Configuration
**User Story:** Als Nutzer möchte ich meine Job-Präferenzen speichern, damit das Matching meine Wünsche berücksichtigt.

**Acceptance Criteria:**
- [ ] Felder: Mindestgehalt, Maximalgehalt, Standorte (Multi-Select)
- [ ] Remote-Präferenz: Onsite / Hybrid / Remote / Flexibel
- [ ] Vertragsarten: Festanstellung, Freelance, etc.
- [ ] Verfügbar ab Datum
- [ ] Max. Pendelzeit in Minuten
- [ ] Änderungen werden sofort gespeichert (Auto-Save)

---

### F2: Job Offer Management

#### F2.1: Manual Job Entry (Copy-Paste)
**User Story:** Als Nutzer möchte ich Job-Texte direkt einfügen können, damit die App die wichtigsten Felder automatisch erkennt.

**Acceptance Criteria:**
- [ ] Großes Textfeld für Copy-Paste
- [ ] AI extrahiert automatisch: Titel, Firma, Standort, Remote-Option, Anforderungen
- [ ] Validierungs-Screen zeigt erkannte Felder zur Korrektur
- [ ] Pflichtfelder: Titel, Firma, Quelle/Börse, Datum
- [ ] Fehlerhafte Extraktion kann manuell überschrieben werden
- [ ] Original-Text wird als `full_text` gespeichert

**Technical Notes:**
- Claude API für Named Entity Recognition (NER)
- Prompt-Beispiel:
```
Extrahiere aus folgendem Stellenangebot:
- Job Title
- Company Name
- Location
- Required Skills (als Liste)
- Salary Range (falls angegeben)
...
```

**UI Flow:**
```
Step 1: Paste Text
┌──────────────────────┐
│ [Paste Job Text]     │
│                      │
│ (Multi-line textarea)│
│                      │
│ [Parse with AI]      │
└──────────────────────┘

Step 2: Review & Correct
┌──────────────────────┐
│ Title: Senior Dev ✓  │
│ Company: ACME ✓      │
│ Location: Berlin ⚠   │  <- User kann ändern
│ Posted: 2025-09-28 ✓ │
│                      │
│ [Save]  [Cancel]     │
└──────────────────────┘
```

---

#### F2.2: Plain Text File Import
**User Story:** Als Nutzer möchte ich `.txt` Dateien importieren, damit ich gespeicherte Job-Beschreibungen schnell hinzufügen kann.

**Acceptance Criteria:**
- [ ] Unterstützt `.txt` Format
- [ ] Nutzt gleichen AI-Parsing-Flow wie Copy-Paste
- [ ] Batch-Import mehrerer Dateien möglich
- [ ] Import-Status angezeigt (X von Y erfolgreich)

---

#### F2.3: PDF Text Extraction (No OCR)
**User Story:** Als Nutzer möchte ich PDF-Stellenbeschreibungen importieren, wenn der Text extrahierbar ist.

**Acceptance Criteria:**
- [ ] Unterstützt nur Text-PDFs (keine Bild-PDFs)
- [ ] Warnung bei Bild-PDFs: "Bitte Copy-Paste verwenden oder OCR aktivieren (Phase 2)"
- [ ] Extrahierter Text wird wie Copy-Paste verarbeitet

**Technical Notes:**
- Library: `pdf-parse` oder `pdfjs-dist`
- Check ob PDF searchable: `pdfDoc.numPages` vs. Text-Length

---

#### F2.4: Job Sources Management
**User Story:** Als Nutzer möchte ich meine Jobbörsen verwalten, damit ich Jobs schnell der richtigen Quelle zuordnen kann.

**Acceptance Criteria:**
- [ ] Vordefinierte Börsen (XING, LinkedIn, Stepstone, etc.)
- [ ] Neue Börsen manuell hinzufügen (Name, URL, Logo)
- [ ] Börsen aktivieren/deaktivieren
- [ ] Statistik pro Börse: Anzahl Jobs, Ø Match-Score

**UI Mockup:**
```
┌────────────────────────────────────┐
│ Job Sources          [+ Add Source] │
├────────────────────────────────────┤
│ ✓ LinkedIn      (23 Jobs, Ø 67%)  │
│ ✓ XING          (12 Jobs, Ø 58%)  │
│ ✓ Stepstone     (8 Jobs,  Ø 72%)  │
│ ✓ Indeed.de     (0 Jobs)          │
│ ○ custom.io     (Deaktiviert)     │
└────────────────────────────────────┘
```

---

#### F2.5: Job List & Filtering
**User Story:** Als Nutzer möchte ich alle erfassten Jobs übersichtlich sehen und filtern können.

**Acceptance Criteria:**
- [ ] Tabellen-View: Titel, Firma, Quelle, Datum, Match-Score, Status
- [ ] Filter: Quelle, Datum (von-bis), Status, Min. Match-Score
- [ ] Sortierung nach: Datum, Match-Score, Titel
- [ ] Pagination (20 Jobs pro Seite)
- [ ] Klick auf Job öffnet Detail-View

**UI Mockup:**
```
┌──────────────────────────────────────────────────────────┐
│ Jobs Overview           [+ Add Job]  [Filters ▼]         │
├──────────────────────────────────────────────────────────┤
│ Quelle: [All ▼]  Status: [All ▼]  Score: [0-100]        │
│                                                          │
│ Title          │ Company  │ Source    │ Date   │ Score  │
│ Senior Dev     │ ACME     │ LinkedIn  │ 09/28  │ 78% ✓  │
│ Backend Eng.   │ TechCo   │ XING      │ 09/27  │ 45% ⚠  │
│ Full Stack     │ StartUp  │ Stepstone │ 09/25  │ 92% ✓  │
│                                                          │
│ [< Prev]  Page 1 of 5  [Next >]                         │
└──────────────────────────────────────────────────────────┘
```

---

### F3: AI Matching

#### F3.1: Job Matching Execution
**User Story:** Als Nutzer möchte ich mit einem Klick ein Matching starten, damit ich schnell sehe ob ein Job passt.

**Acceptance Criteria:**
- [ ] Button "Match Job" auf Job-Detail-Seite
- [ ] Loading-Indicator während API-Call
- [ ] Ergebnis wird gespeichert und angezeigt
- [ ] Fehlerbehandlung bei API-Fehlern
- [ ] Re-Matching möglich (mit Hinweis auf Token-Kosten)
- [ ] Matching-History sichtbar (alle bisherigen Matches zu einem Job)

**Technical Flow:**
1. User klickt "Match Job"
2. App lädt aktuelles User-Profil (Skills, Präferenzen)
3. Prompt-Konstruktion:
   - User-Profil (JSON)
   - Job-Beschreibung
   - Aktiver Matching-Prompt
4. Claude API Call
5. Parse Response → Extract Score + Gap-Analysis
6. Speichere in `matching_results`
7. UI-Update

**API Response Format (erwartetes JSON):**
```json
{
  "match_score": 75,
  "match_category": "good",
  "strengths": [
    "Python-Kenntnisse passen perfekt",
    "Erfahrung mit agilen Methoden vorhanden"
  ],
  "gaps": {
    "missing_skills": [
      {"skill": "AWS", "required_level": 7, "current_level": 3, "gap": 4}
    ],
    "experience_gaps": [
      {"area": "Team Lead", "required_years": 2, "actual_years": 0}
    ]
  },
  "recommendations": [
    "AWS Solutions Architect Zertifikat in 3-6 Monaten erreichbar",
    "Team-Lead Erfahrung durch Mentoring aufbauen"
  ],
  "reasoning": "Die technischen Skills passen gut, aber..."
}
```

---

#### F3.2: Match Result Display
**User Story:** Als Nutzer möchte ich das Match-Ergebnis übersichtlich sehen, damit ich schnell entscheiden kann.

**Acceptance Criteria:**
- [ ] Score prominent angezeigt (großer Prozent-Wert mit Farb-Indikator)
- [ ] Kategorie-Badge: "Perfect Match", "Good Fit", "Needs Gap Closing", "Poor Fit"
- [ ] Stärken-Liste (was passt gut)
- [ ] Gap-Analyse als strukturierte Tabelle
- [ ] Empfehlungen separat aufgelistet
- [ ] AI-Reasoning als ausklappbarer Text
- [ ] Button "Re-Match" (mit Warnung: "Kostet X Tokens")

**UI Mockup:**
```
┌─────────────────────────────────────────────┐
│ Matching Result: Senior Backend Developer  │
├─────────────────────────────────────────────┤
│                                             │
│           75%  ✓ Good Fit                   │
│           ██████████████──────              │
│                                             │
│ ✓ Strengths:                                │
│   • Python-Kenntnisse (8/10) passen perfekt│
│   • Agile Methoden vorhanden               │
│                                             │
│ ⚠ Gaps:                                     │
│   Skill     Required  You Have  Gap        │
│   AWS         7/10      3/10    4 Levels   │
│   Team Lead   2 Jahre   0       2 Jahre    │
│                                             │
│ 💡 Recommendations:                         │
│   • AWS Solutions Architect (3-6 Monate)   │
│   • Team-Lead via Mentoring aufbauen       │
│                                             │
│ [Show AI Reasoning ▼]  [Re-Match]          │
└─────────────────────────────────────────────┘
```

---

#### F3.3: Matching Prompt Administration
**User Story:** Als Admin möchte ich die Matching-Prompts anpassen können, damit das Matching besser auf meine Kriterien passt.

**Acceptance Criteria:**
- [ ] Admin-Bereich mit Passwort-Schutz (optional für Single-User)
- [ ] Liste aller Prompts mit Versionen
- [ ] Aktiver Prompt markiert
- [ ] Prompt-Editor mit Syntax-Highlighting
- [ ] Prompt-Variablen dokumentiert: `{user_profile}`, `{job_description}`, etc.
- [ ] Prompt aktivieren/deaktivieren
- [ ] Test-Funktion: Prompt mit Sample-Daten testen
- [ ] Prompt-History (wann welcher Prompt verwendet wurde)

**UI Mockup:**
```
┌────────────────────────────────────────────┐
│ Matching Prompts                           │
├────────────────────────────────────────────┤
│ ● Default Matching v1.0   (Active)         │
│ ○ Experimental v2.0                        │
│ ○ Skills-Focused v1.5                      │
│                           [+ New Prompt]   │
│                                            │
│ ┌────────────────────────────────────────┐ │
│ │ Prompt Editor: Default Matching v1.0   │ │
│ │                                        │ │
│ │ You are an expert job matching AI...  │ │
│ │ User Profile: {user_profile}          │ │
│ │ Job Description: {job_description}    │ │
│ │ ...                                   │ │
│ │                                        │ │
│ └────────────────────────────────────────┘ │
│                                            │
│ [Test Prompt]  [Save]  [Activate]         │
└────────────────────────────────────────────┘
```

---

### F4: Reports & Export

#### F4.1: Weekly/Monthly Job Overview
**User Story:** Als Nutzer möchte ich mir wöchen- oder monatsweise anzeigen lassen, welche Jobs ich geprüft habe.

**Acceptance Criteria:**
- [ ] Zeitraum wählbar: Letzte Woche, Letzter Monat, Custom (von-bis)
- [ ] Tabellarische Übersicht: Job, Quelle, Datum, Score, Status
- [ ] Gruppierung nach Woche/Monat
- [ ] Filter: Nur gematched / Alle Jobs
- [ ] Inline-Notizen anzeigen
- [ ] Export als PDF oder CSV

**UI Mockup:**
```
┌──────────────────────────────────────────────┐
│ Report: September 2025                       │
├──────────────────────────────────────────────┤
│ Period: [01.09 - 30.09.2025]  [Generate]    │
│                                              │
│ Week 36 (Sep 2-8)                            │
│   Senior Dev (ACME)       78%  ✓ Applied    │
│   Backend Eng (TechCo)    45%  ⚠ Skipped    │
│                                              │
│ Week 37 (Sep 9-15)                           │
│   Full Stack (StartUp)    92%  ✓ Applied    │
│   DevOps (CloudCo)        55%  ⚠ Reviewing  │
│                                              │
│ Summary:                                     │
│   Total Jobs Checked: 4                     │
│   Average Match: 67.5%                      │
│   Applications Sent: 2                      │
│                                              │
│ [Export PDF]  [Export CSV]                  │
└──────────────────────────────────────────────┘
```

---

#### F4.2: PDF Export
**User Story:** Als Nutzer möchte ich Reports als PDF exportieren, damit ich sie archivieren oder teilen kann.

**Acceptance Criteria:**
- [ ] PDF enthält: Zeitraum, Job-Liste, Match-Scores, Gap-Analysen (optional)
- [ ] Layout: Professionell, gut lesbar
- [ ] Header: Datum, Nutzer-Name
- [ ] Footer: Seiten-Nummer
- [ ] Optional: Logo/Branding

**Technical Notes:**
- Library: `puppeteer` oder `pdfmake`
- Template: HTML → PDF Rendering

---

#### F4.3: CSV Export
**User Story:** Als Nutzer möchte ich Job-Daten als CSV exportieren, damit ich sie in Excel weiterverarbeiten kann.

**Acceptance Criteria:**
- [ ] CSV-Felder: Job-ID, Titel, Firma, Quelle, Datum, Score, Status, URL
- [ ] UTF-8 Encoding (Umlaute korrekt)
- [ ] Excel-kompatibel (Semikolon als Separator optional)
- [ ] Optional: Gap-Analyse als zusätzliche Spalten

---

### F5: System & Maintenance

#### F5.1: Automatic Database Backup
**User Story:** Als System möchte ich vor jedem Update automatisch ein Backup erstellen, damit keine Daten verloren gehen.

**Acceptance Criteria:**
- [ ] Vor jeder Migration: SQL-Dump in `backups/` Ordner
- [ ] Dateiname: `pre_migration_vX.Y.Z_TIMESTAMP.sql`
- [ ] Alte Backups nach 30 Tagen automatisch löschen (oder User fragt)
- [ ] Backup-Status im UI sichtbar (letztes Backup-Datum)
- [ ] Manueller Backup-Button im Settings-Bereich

**Technical Notes:**
- SQLite `.dump` Command via Node.js `child_process`
- Alternative: `better-sqlite3` Backup API

---

#### F5.2: Database Migration on Update
**User Story:** Als System möchte ich bei neuen App-Versionen die Datenbank automatisch migrieren.

**Acceptance Criteria:**
- [ ] Schema-Version in `app_settings` gespeichert
- [ ] Beim Start: Version-Check
- [ ] Falls veraltet: Migration-Dialog anzeigen
- [ ] User muss Migration bestätigen
- [ ] Progress-Indicator während Migration
- [ ] Bei Fehler: Rollback + User-Benachrichtigung + Backup-Restore-Option

**Migration-Dialog:**
```
┌────────────────────────────────────────┐
│ Database Update Required               │
├────────────────────────────────────────┤
│ Current Version: 1.0.0                 │
│ Target Version:  1.2.0                 │
│                                        │
│ Changes:                               │
│ • Added "deadline" field to jobs      │
│ • New table: soft_skills              │
│                                        │
│ ⚠ Backup will be created automatically│
│                                        │
│ [Start Migration]  [Cancel & Quit]    │
└────────────────────────────────────────┘
```

---

#### F5.3: Settings & Configuration
**User Story:** Als Nutzer möchte ich App-Einstellungen anpassen können.

**Acceptance Criteria:**
- [ ] API-Key Management (Claude, OpenRouter)
- [ ] Theme: Light/Dark Mode
- [ ] Sprache (zunächst nur Deutsch)
- [ ] Token-Budget Warnung (z.B. bei > 1000 Tokens/Tag)
- [ ] Backup-Einstellungen (Interval, Retention)
- [ ] Über-Dialog: App-Version, Credits, Lizenz

---

## Phase 2 Features (Future)

### F6: Advanced Job Import

#### F6.1: Screenshot OCR
- Tesseract.js Integration
- Bild-Upload → Text-Extraktion → AI-Parsing
- Fallback auf manuelle Korrektur

#### F6.2: API Integration (Per Job Source)
- LinkedIn API (falls verfügbar)
- Indeed API
- Custom API Endpoints (User-definiert)
- Auto-Sync (täglich neue Jobs abrufen)

---

### F7: Soft Skills Profil
- Freitext oder strukturierte Eingabe
- Integration ins Matching
- Gewichtung anpassbar

---

### F8: Advanced Statistics

#### F8.1: Dashboard
- KPI-Cards: Total Jobs, Ø Match, Best Source
- Trend-Charts (Match-Score über Zeit)
- Heatmap: Jobs nach Quelle & Monat

#### F8.2: Gap Analysis Over Time
- "Top 5 häufigste Gaps" (über alle Jobs)
- "Skill-Gap Closing Tracker" (User schließt Gaps → Score steigt)
- Empfehlungen basierend auf Trends

#### F8.3: Source Performance
- Welche Börse liefert die besten Matches?
- Response-Time Tracking (falls APIs)
- ROI-Berechnung (Zeit vs. Match-Quality)

---

### F9: Automatic Training Suggestions
- Gap → Kurs-Empfehlungen (via Web-Search oder API)
- Zertifizierungs-Roadmap
- Kostenabschätzung & Zeitaufwand

---

### F10: Collaboration Features (Optional)
- Multi-User (Familie, Team)
- Shared Job-Listen
- Kommentar-Funktion

---

## Non-Functional Requirements

### Performance
- App-Start: < 2 Sekunden
- Job-Matching: < 10 Sekunden (inkl. API-Call)
- UI bleibt responsiv während API-Calls (Async/Background Tasks)

### Security
- API-Keys verschlüsselt in OS-Keychain (electron-store + keytar)
- SQL-Injection Prevention (Prepared Statements)
- XSS-Schutz im Frontend

### Usability
- Intuitive Navigation (max. 3 Klicks zu jedem Feature)
- Keyboard-Shortcuts für Power-User
- Tooltips & Inline-Help
- Error-Messages verständlich (keine Tech-Jargon)

### Accessibility
- Keyboard-Navigation überall möglich
- Screen-Reader kompatibel (ARIA-Labels)
- Hoher Kontrast-Modus

---

*Version: 1.0 | Zuletzt aktualisiert: 2025-09-30*