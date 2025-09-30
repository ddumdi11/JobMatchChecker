# Job Match Checker – Data Model Specification

## Database Schema (SQLite)

---

## 1. User Profile

### `user_profile`
Speichert die Basis-Profildaten des Nutzers (Single-User-System, nur 1 Zeile).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Immer 1 |
| `first_name` | TEXT | NOT NULL | Vorname |
| `last_name` | TEXT | NOT NULL | Nachname |
| `email` | TEXT | UNIQUE | Kontakt-Email |
| `phone` | TEXT | | Telefonnummer |
| `location` | TEXT | | Aktueller Standort |
| `cv_latex_source` | TEXT | | Original LaTeX-Code des CVs |
| `cv_imported_at` | DATETIME | | Zeitpunkt des letzten Imports |
| `created_at` | DATETIME | NOT NULL DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | DATETIME | NOT NULL DEFAULT CURRENT_TIMESTAMP | |

---

## 2. Skills & Competencies

### `skill_categories`
Hierarchische Kategorien für Skills (z.B. "Programmiersprachen" → "Backend").

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| `name` | TEXT | NOT NULL UNIQUE | z.B. "Programmiersprachen" |
| `parent_id` | INTEGER | FOREIGN KEY → skill_categories(id) | NULL = Top-Level |
| `sort_order` | INTEGER | DEFAULT 0 | Für UI-Reihenfolge |

**Beispiel-Hierarchie:**
```
Programmiersprachen (id=1, parent_id=NULL)
  ├─ Backend (id=2, parent_id=1)
  └─ Frontend (id=3, parent_id=1)
```

### `skills`
Konkrete Skills des Nutzers.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| `name` | TEXT | NOT NULL | z.B. "Python", "AWS" |
| `category_id` | INTEGER | FOREIGN KEY → skill_categories(id) | |
| `level` | INTEGER | CHECK (level BETWEEN 0 AND 10) | 0=keine Kenntnis, 10=Expert |
| `years_experience` | REAL | | Optionale Jahresangabe |
| `verified` | BOOLEAN | DEFAULT FALSE | Zertifikat/Nachweis vorhanden? |
| `notes` | TEXT | | Freitext (z.B. "Zertifikat XY") |
| `source` | TEXT | | z.B. "CV", "LinkedIn", "Manual" |
| `created_at` | DATETIME | NOT NULL DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | DATETIME | NOT NULL DEFAULT CURRENT_TIMESTAMP | |

---

## 3. Preferences

### `user_preferences`
Präferenzen für die Jobsuche (Single-User, 1 Zeile).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Immer 1 |
| `desired_salary_min` | INTEGER | | Mindestgehalt (€/Jahr) |
| `desired_salary_max` | INTEGER | | Maximalgehalt (€/Jahr) |
| `desired_locations` | TEXT | | JSON-Array: ["Berlin", "Remote"] |
| `remote_preference` | TEXT | CHECK IN ('onsite','hybrid','remote','flexible') | |
| `contract_types` | TEXT | | JSON: ["permanent","contract","freelance"] |
| `availability_date` | DATE | | Ab wann verfügbar |
| `max_commute_minutes` | INTEGER | | Maximale Pendelzeit |
| `updated_at` | DATETIME | NOT NULL DEFAULT CURRENT_TIMESTAMP | |

---

## 4. Job Sources (Jobbörsen)

### `job_sources`
Registrierte Jobbörsen.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| `name` | TEXT | NOT NULL UNIQUE | z.B. "LinkedIn", "XING" |
| `url` | TEXT | | Homepage der Börse |
| `api_available` | BOOLEAN | DEFAULT FALSE | API-Integration möglich? |
| `api_config` | TEXT | | JSON mit API-Keys, Endpoints etc. |
| `logo_url` | TEXT | | Für UI-Darstellung |
| `notes` | TEXT | | Freitext |
| `created_at` | DATETIME | NOT NULL DEFAULT CURRENT_TIMESTAMP | |

**Initiale Seeds:**
- XING
- LinkedIn
- Stepstone
- Indeed.de
- web.arbeitsagentur.de
- https://www.nachhaltigejobs.de/
- https://www.linkedin.com/
- https://konto.meinestadt.de/
- https://career5.successfactors.eu/

---

## 5. Job Offers

### `job_offers`
Erfasste Stellenangebote.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| `source_id` | INTEGER | NOT NULL FOREIGN KEY → job_sources(id) | |
| `title` | TEXT | NOT NULL | Stellentitel |
| `company` | TEXT | NOT NULL | Firma |
| `url` | TEXT | | Link zum Angebot |
| `posted_date` | DATE | NOT NULL | Veröffentlichungsdatum |
| `deadline` | DATE | | Bewerbungsschluss |
| `location` | TEXT | | Standort |
| `remote_option` | TEXT | | "onsite", "hybrid", "remote" |
| `salary_range` | TEXT | | Freitext oder strukturiert |
| `contract_type` | TEXT | | "permanent", "contract", etc. |
| `full_text` | TEXT | | Komplette Stellenbeschreibung |
| `raw_import_data` | TEXT | | Original-Import (PDF-Text, etc.) |
| `import_method` | TEXT | | "copy_paste", "latex", "pdf", "api" |
| `notes` | TEXT | | Manuelle Notizen |
| `status` | TEXT | DEFAULT 'new' | "new", "reviewed", "applied", "rejected", "archived" |
| `created_at` | DATETIME | NOT NULL DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | DATETIME | NOT NULL DEFAULT CURRENT_TIMESTAMP | |

**Indizes:**
```sql
CREATE INDEX idx_job_offers_source ON job_offers(source_id);
CREATE INDEX idx_job_offers_posted ON job_offers(posted_date DESC);
CREATE INDEX idx_job_offers_status ON job_offers(status);
```

---

## 6. Matching System

### `matching_prompts`
Versionierte System-Prompts für AI-Matching.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| `name` | TEXT | NOT NULL | z.B. "Default Matching v1.2" |
| `prompt_text` | TEXT | NOT NULL | Kompletter Prompt |
| `is_active` | BOOLEAN | DEFAULT FALSE | Aktuell verwendeter Prompt? |
| `version` | TEXT | | Semantische Versionierung (1.0.0) |
| `created_at` | DATETIME | NOT NULL DEFAULT CURRENT_TIMESTAMP | |

**Constraint:** Nur ein Prompt kann `is_active=TRUE` sein.

### `matching_results`
Ergebnisse der Job-Matching-Analysen.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| `job_id` | INTEGER | NOT NULL FOREIGN KEY → job_offers(id) | |
| `prompt_id` | INTEGER | NOT NULL FOREIGN KEY → matching_prompts(id) | |
| `match_score` | INTEGER | CHECK (match_score BETWEEN 0 AND 100) | Prozentuale Passung |
| `match_category` | TEXT | | "perfect", "good", "gap", "poor" |
| `gap_analysis` | TEXT | NOT NULL | JSON-strukturierte Gap-Liste |
| `strengths` | TEXT | | JSON: Was passt gut? |
| `ai_reasoning` | TEXT | | Begründung der AI |
| `api_model` | TEXT | | z.B. "claude-sonnet-4-5-20250929" |
| `tokens_used` | INTEGER | | Für Kosten-Tracking |
| `processing_time_ms` | INTEGER | | Performance-Monitoring |
| `created_at` | DATETIME | NOT NULL DEFAULT CURRENT_TIMESTAMP | |

**`gap_analysis` JSON-Struktur:**
```json
{
  "missing_skills": [
    {"skill": "AWS", "required_level": 7, "current_level": 3, "gap": 4},
    {"skill": "Scrum Master", "required": true, "has_certificate": false}
  ],
  "experience_gaps": [
    {"area": "Python", "required_years": 5, "actual_years": 3, "gap_years": 2}
  ],
  "recommendations": [
    "AWS Solutions Architect Zertifikat anstreben",
    "2 Jahre Projekterfahrung in Python-basierten Systemen"
  ]
}
```

**Indizes:**
```sql
CREATE INDEX idx_matching_job ON matching_results(job_id);
CREATE INDEX idx_matching_score ON matching_results(match_score DESC);
```

---

## 7. Reports & Statistics

### `reports`
Generierte Reports (für Archivierung).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| `type` | TEXT | NOT NULL | "weekly", "monthly", "custom" |
| `period_start` | DATE | NOT NULL | |
| `period_end` | DATE | NOT NULL | |
| `format` | TEXT | NOT NULL | "pdf", "csv", "json" |
| `file_path` | TEXT | | Relativer Pfad zur Export-Datei |
| `content` | TEXT | | Inline-Speicherung (optional) |
| `metadata` | TEXT | | JSON mit Report-Parametern |
| `created_at` | DATETIME | NOT NULL DEFAULT CURRENT_TIMESTAMP | |

---

## 8. System & Metadata

### `app_settings`
Key-Value Store für App-Konfiguration.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `key` | TEXT | PRIMARY KEY | z.B. "db_version", "last_backup" |
| `value` | TEXT | | |
| `updated_at` | DATETIME | NOT NULL DEFAULT CURRENT_TIMESTAMP | |

**Wichtige Keys:**
- `db_version`: Schema-Version für Migrationen
- `last_backup_path`: Pfad zum letzten SQL-Dump
- `claude_api_key_hash`: Hash des API-Keys (Validierung)

### `migration_history`
Tracking von DB-Schema-Änderungen.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | |
| `version` | TEXT | NOT NULL UNIQUE | z.B. "v1.2.0" |
| `description` | TEXT | | Was wurde geändert |
| `sql_script` | TEXT | | Migrations-SQL |
| `backup_path` | TEXT | | Pfad zum Pre-Migration Backup |
| `applied_at` | DATETIME | NOT NULL DEFAULT CURRENT_TIMESTAMP | |

---

## Relationships Diagram (Simplified)

```
user_profile (1) ─────┐
                      │
skill_categories ─┬─> skills (n)
                  │
job_sources ──────┬─> job_offers (n) ──┬─> matching_results (n)
                  │                     │
                  └─> reports           └─> matching_prompts (1)
```

---

## Data Integrity Rules

### Cascading Deletes
- `skills.category_id` → `ON DELETE SET NULL`
- `job_offers.source_id` → `ON DELETE RESTRICT` (Quelle nicht löschbar wenn Jobs existieren)
- `matching_results.job_id` → `ON DELETE CASCADE`

### Triggers (Beispiele)

**Auto-Update Timestamps:**
```sql
CREATE TRIGGER update_job_timestamp 
AFTER UPDATE ON job_offers
BEGIN
  UPDATE job_offers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
```

**Backup vor kritischen Operationen:**
```sql
CREATE TRIGGER before_delete_job
BEFORE DELETE ON job_offers
BEGIN
  INSERT INTO deleted_jobs_archive SELECT * FROM job_offers WHERE id = OLD.id;
END;
```

---

## Migration Strategy

### Version Numbering
- Schema-Version in `app_settings.db_version`
- Format: `MAJOR.MINOR.PATCH` (Semantic Versioning)

### Migration Flow
1. **Pre-Check:** App vergleicht `db_version` mit erwarteter Version
2. **Backup:** Automatischer SQL-Dump nach `backups/pre_migration_vX.Y.Z_TIMESTAMP.sql`
3. **Apply:** Sequenzielle Anwendung aller fehlenden Migrations-Scripts
4. **Verify:** Integritäts-Checks (Foreign Keys, Constraints)
5. **Update:** `db_version` auf neue Version setzen
6. **Rollback:** Bei Fehler → Restore aus Backup + User-Benachrichtigung

### Example Migration Script (v1.0.0 → v1.1.0)
```sql
-- Add column for job_offers
ALTER TABLE job_offers ADD COLUMN deadline DATE;

-- Create new index
CREATE INDEX idx_job_deadline ON job_offers(deadline);

-- Update version
UPDATE app_settings SET value = '1.1.0' WHERE key = 'db_version';
```

---

## Performance Considerations

### Indexing Strategy
- Primärschlüssel: Auto-indexed
- Foreign Keys: Explizite Indizes
- Filter-Spalten: `status`, `posted_date`, `match_score`
- Volltextsuche: FTS5 für `job_offers.full_text` (optional in Phase 2)

### Query Optimization
- Prepared Statements für alle DB-Zugriffe
- Connection Pooling (auch wenn SQLite single-threaded)
- EXPLAIN QUERY PLAN für komplexe Abfragen

---

*Version: 1.0 | Zuletzt aktualisiert: 2025-09-30*
