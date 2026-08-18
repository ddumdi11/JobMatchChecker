# Dual-URL + message_id — nanobot-Rückkanal

**Feature:** `feat/dual-url-roundtrip`

## Problem

Das Rückkanal-Matching (`jobs_processed.csv` → nanobot-Pipeline) über die
bereinigte `url` schlug real fehl (2 von 54 Treffern), weil die Pipeline die
**Original-Tracking-Links** als Schlüssel führt:

- XING: `https://www.xing.com/m/<token>` (löst erst beim Klick auf die Firmenseite auf)
- LinkedIn: `https://www.linkedin.com/jobs/view/<id>/` (mit Schluss-Slash)

Jobs kommen in JMC aber mit **aufgelöster** Stellenseiten-URL an (z. B.
`careers.munichre.com/…`). Die beiden URL-Räume passen nicht zusammen —
`cleanJobUrl` kann eine Firmenseite nicht in den Tracking-Key zurückverwandeln.

## Lösung: Dual-URL

Zwei neue Spalten auf `job_offers` (Migration
`20260818000001_add_source_url_message_id_to_job_offers.js`):

| Spalte       | Bedeutung                                                                 |
|--------------|---------------------------------------------------------------------------|
| `source_url` | **Roher** Original-Link aus `jobs_with_links.csv` — NIEMALS `cleanJobUrl`. |
| `message_id` | Mail-Message-ID aus `jobs_with_links.csv`.                                |

Die bestehende `url` bleibt Anzeige-/Dedup-URL. `cleanJobUrl`, `getJobUrlKey` und
das komplette Dubletten-Feature bleiben **unverändert** auf `url`.

Bestandsdaten: `NULL` in beiden Feldern ist ok — der Rückkanal gilt ab jetzt. Beim
Export werden `NULL`-Werte als **leere** Felder ausgegeben (nie der Text „NULL").

## Import: zwei Formate, am Header erkannt

`importService.detectFormat()` unterscheidet am Header:

- **`jobs.csv`** (Altformat, `url,title,content,…`): unverändert — KI-Extraktion
  aus `content`.
- **`jobs_with_links.csv`** (`Stars,Datum,Quelle,Jobtitel,Unternehmen,Ort,Link,
  message_id,Mail-Betreff`): **rein deterministisches** Mapping, **keine KI**.

Unbekannter Header → klarer Fehler (kein stiller leerer Import).

### Deterministisches Mapping (jobs_with_links)

| CSV-Spalte   | Ziel                                             |
|--------------|--------------------------------------------------|
| `Jobtitel`   | `title`                                          |
| `Unternehmen`| `company`                                        |
| `Ort`        | `location`                                        |
| `Quelle`     | `source` → `job_sources`-ID (Name-Match)         |
| `Datum`      | `posted_date` (`DD.MM.YYYY` → ISO, Mittag UTC)   |
| `Link`       | `source_url` **roh** + `url` via `cleanJobUrl`   |
| `message_id` | `message_id`                                      |

`Stars` und `Mail-Betreff` werden ignoriert, aber in `csv_raw_data` mitgeführt.
Jobs landen bewusst **ohne** `full_text` — der Volltext wird bei Interesse
nachgeholt (über den „ohne Score“-Filter wiederauffindbar). Der Dedup-Add-Check
greift wie gehabt auf `url` (die bereinigte Dedup-URL).

## Byte-Roundtrip-Garantie

`source_url` ist beim Import byte-identisch zur CSV-Spalte „Link" und wird beim
Export byte-identisch wieder ausgegeben (kein `cleanJobUrl`, kein Trailing-Slash-
Anfassen, kein Trim über das übliche CSV-Parsing hinaus). Abgesichert durch einen
Roundtrip-Test für beide URL-Formen (`tests/unit/importService.test.ts`).

## ⚠️ Namensfalle `source_url`

Im Formular-Code (`JobAdd.tsx` / `jobStore.ts`) ist `source_url` nur ein **lokaler
Alias für `url`** (wird vor dem Backend in `url` umbenannt). Die neue DB-Spalte
`source_url` (TS: `sourceUrl`) hat eine **andere** Semantik (roher Tracking-Link).
Der Formular-Alias sollte perspektivisch umbenannt werden (z. B. `formUrl`), damit
die Falle verschwindet — siehe RESUME (zweite Kleinigkeiten-Charge).
