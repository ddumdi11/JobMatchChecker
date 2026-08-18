# nanobot-Export (Rückkanal zur Pipeline)

Standalone-CLI, das Jobs der letzten *N* Tage (Default **90**) als
`jobs_processed.csv` im **nanobot-Profil** (Rohwerte) in einen Zielordner
schreibt — z. B. einen Syncthing-Ordner. Läuft **ohne** die Electron-App.

- Ort: `tools/nanobot-export/`
- Öffnet die DB **strikt read-only** (`readonly: true`, `fileMustExist: true`).
  Es schreibt **nie** in die DB; paralleler Betrieb neben der laufenden App
  (SQLite-WAL) ist unbedenklich.

## Warum ein eigenes Package? (ABI)

`better-sqlite3` ist ein natives Modul und wird für eine bestimmte ABI gebaut.
Die App braucht die **Electron-ABI** (via `electron-rebuild`), ein Node-CLI die
**Node-ABI**. Statt ständig hin- und herzubauen („ABI-Tanz"), hat dieses Tool
ein **eigenes `node_modules`** mit eigenem, für Node gebautem `better-sqlite3`.
Beide Welten koexistieren — die App im Repo-Root bleibt unberührt.

## Einmalige Einrichtung

```bash
npm run nanobot:install
# entspricht: npm --prefix tools/nanobot-export install
```

Das baut `better-sqlite3` für die Node-ABI. (Kein Build-Step für den TS-Code —
das Tool läuft direkt via `tsx`.)

## Aufruf

Zielordner ist Pflicht (kein Pfad ist im Repo hinterlegt). Drei Wege, ihn zu
setzen (Priorität: CLI > Env > Config-Datei):

```bash
# 1) per Flag
npm run nanobot:export -- --out "D:\Sync\nanobot"

# 2) mit anderem Zeitfenster / anderer DB
npm run nanobot:export -- --out "D:\Sync\nanobot" --days 30 --db "C:\pfad\zur\jobmatcher.db"
```

Optionen:

| Option    | Env           | Default                     | Bedeutung                                   |
|-----------|---------------|-----------------------------|---------------------------------------------|
| `--out`   | `NANOBOT_OUT` | – (Pflicht)                 | Zielordner für `jobs_processed.csv`         |
| `--days`  | `NANOBOT_DAYS`| `90`                        | Fenster: letzte N Tage inkl. heute          |
| `--db`    | `DB_PATH`     | `<repo>/data/jobmatcher.db` | Pfad zur SQLite-DB (read-only)              |

Alternativ eine **lokale, gitignorete** Konfiguration `tools/nanobot-export/nanobot.config.json`:

```json
{ "out": "D:\\Sync\\nanobot", "days": 90 }
```

## Ausgabeformat (`jobs_processed.csv`)

UTF-8 mit BOM, RFC4180-Quoting, Spalten (Rohwerte, keine deutschen Labels):

```
source_url,message_id,url,title,company,match_score,status,processed_at
```

- `source_url` — **roher** Original-Tracking-Link aus `jobs_with_links.csv` (Spalte
  „Link"), byte-identisch übernommen und ausgegeben — **nie** durch `cleanJobUrl`.
  Das ist der eigentliche Rückkanal-Schlüssel (XING `…/m/<token>`, LinkedIn
  `…/jobs/view/<id>/` mit Schluss-Slash). Leer bei manuell erfassten Jobs.
- `message_id` — Mail-Message-ID aus `jobs_with_links.csv`. Leer bei manuell
  erfassten Jobs.
- `url` — via `cleanJobUrl` bereinigte Anzeige-/Dedup-URL (LinkedIn kanonisch,
  Tracking entfernt). Bleibt zusätzlich zum Matching erhalten.
- `match_score` — leer, wenn nicht bewertet
- `status` — Rohwert (z. B. `new`, `applied`)
- `processed_at` — lokaler Kalendertag von `created_at` (`YYYY-MM-DD`), konsistent zur App

> Die Konsumseite (`move_done_mails.py`) matcht auf `source_url ∪ url` und ist damit
> rückwärtskompatibel: leere `source_url` fallen automatisch auf `url` zurück. Der
> Rollout beider Seiten ist unabhängig möglich.

Gespeist wird `source_url`/`message_id` über den Import von `jobs_with_links.csv`
(deterministisches Mapping, ohne KI). Details siehe
[dual-url-roundtrip](dual-url-roundtrip.md).

## Windows Task Scheduler (Einrichtung durch Thorsten)

Es liegt ein Wrapper `tools/nanobot-export/run-nanobot-export.cmd` bei, der
Argumente durchreicht.

1. **Aufgabenplanung** öffnen → *Aufgabe erstellen…*
2. Reiter **Aktionen** → *Neu…*
   - Programm/Skript: `…\JobMatchChecker\tools\nanobot-export\run-nanobot-export.cmd`
   - Argumente hinzufügen: `--out "D:\Sync\nanobot"`
     *(oder `NANOBOT_OUT` als Umgebungsvariable bzw. `nanobot.config.json` nutzen)*
3. Reiter **Trigger** → z. B. täglich zur gewünschten Uhrzeit.
4. Bei „Unabhängig von der Benutzeranmeldung ausführen" sicherstellen, dass der
   Node-/npm-Pfad im System-`PATH` liegt.

Test von Hand vorab:

```bash
tools\nanobot-export\run-nanobot-export.cmd --out "D:\Sync\nanobot"
```

## Tests

```bash
npm --prefix tools/nanobot-export test
```

Deckt readonly-Öffnung (inkl. Schreibversuch wirft), 90-Tage-Fenstergrenzen und
die Rohwert-Spalten gegen eine echte Temp-SQLite-DB ab. In CI läuft dafür ein
**eigener Job** (`nanobot-tool`), der die unabhängige ABI-Welt beweist.
