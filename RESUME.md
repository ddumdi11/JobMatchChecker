# RESUME — JobMatchChecker

**Stand:** 2026-07-22
**Rollen:** Claude (Architekt) → Thorsten (Supervisor/Relay) → Kurt (Claude Code, Implementierung)

## Repo-Zustand

- `main` sauber, nur main (alle Feature-/Alt-Branches gelöscht), CI grün, Required Checks aktiv (Ruleset: PR + `coderabbitai` + `test`, Owner-Bypass; klassische Protection noch parallel — siehe Thorsten-Zettel).
- Zuletzt gemerged: **#63** CSV-Export mit Datumsbereich (Profil-Architektur, TZ-korrekt, Formula-Injection-Schutz) · **#64** Kleinigkeiten (Score-Dreifach-Filter + Range-Leak-Fix, ehrlicher Import-Zähler, id-Regressionstest, Skills-Typen nach shared/types.ts) · **#65** nanobot-Rückkanal.

## nanobot-Rückkanal (#65) — fertig, Inbetriebnahme offen

- Profil `nanobot` (Rohwerte: url=cleanJobUrl-Key, title, company, match_score, status, processed_at) in electron-freiem `src/shared/jobCsv.ts`; Labels in `src/shared/jobLabels.ts`.
- Standalone-CLI `tools/nanobot-export/`: read-only DB-Zugriff, eigenes Node-ABI-better-sqlite3 (kein ABI-Tanz), eigener CI-Job, 90-Tage-Fenster (--days), Ziel via --out/NANOBOT_OUT/gitignorete Config. Doku: `docs/nanobot-export.md`.
- **Inbetriebnahme (Thorsten):** (1) `npm run nanobot:install`, (2) Syncthing-Zielordner konfigurieren, (3) Task Scheduler nach Doku einrichten (Wrapper `run-nanobot-export.cmd`). Danach: nanobot-Seite prüfen, ob sie `jobs_processed.csv` korrekt konsumiert.

## Thorsten-Zettel (manuell, klein)

1. **Hach-Job #137:** URL leeren/korrigieren (hat per Copy-Paste die Honeywell-URL von #136; echte Job-ID R10265846). Danach Dubletten-Scan = 0 Gruppen.
2. **Klassische Branch Protection löschen** (Ruleset ist führend): `gh api -X DELETE repos/:owner/:repo/branches/main/protection` oder via Settings.
3. Task-Scheduler-Einrichtung (siehe oben) + Uhrzeit wählen.
4. Gelegentlich: alte DB-Kopien in `data/` prunen; Sprachen-Jahre (Deutsch 40/Englisch 25, geschätzt) prüfen.

## Kleinigkeiten-Liste, zweite Charge (offen)

1. **Gehalts-Einheiten-Mismatch:** Wunschgehalt monatlich (3.000–5.000) vs. Job-Jahresgehälter → verzerrt KI-Analysen. Profil-Feld umstellen oder normalisieren.
2. **Timestamp-Inkonsistenz:** created_at "YYYY-MM-DD HH:MM:SS" (lokal gelesen) vs. posted_date ISO+"Z" (UTC) → vereinheitlichen (Migration nötig, TZ-Verhalten aus PR #63 beachten).
3. **`tsc --noEmit` in CI** + vorbestehende TS-Fehler fixen (JobAdd.tsx:438/441, Contract-/Backup-Tests).
4. **Backup-Disk-Space-Check (Windows) reaktivieren** (diskSpace.ts:58, BackupManager.ts:21/81) — durch Platte-voll-Vorfall vom 19.07. aufgewertet.
5. Klein: `LIMIT 1000.0` Float-Kosmetik; leere Alt-Kategorien (Hard/Digital Skills, Frameworks) prüfen.
6. **Ctrl+F / findInPage** in Listen (Alt-Backlog FEAT-2, offen, mittel).
7. **Default-Kategorie „IT Infrastructure"** (Alt-Backlog FEAT-3, klein).
8. **PreferencesPanel: englische Labels → Deutsch** (alter CodeRabbit-Nitpick).
9. **CI-Status-Badge ins README** (neben License/Electron/React, wenn ohnehin am README gearbeitet wird).
10. **Formular-Alias `source_url` umbenennen** (JobAdd.tsx/jobStore.ts → z. B. `formUrl`): Der Alias ist nur ein lokaler Feldname für `url`, kollidiert aber namentlich mit der neuen DB-Spalte `source_url` (roher Tracking-Link, andere Semantik). Umbenennen, damit die Namensfalle ganz verschwindet (aktuell per Kommentar an beiden Stellen entschärft).

## Separates Projekt: nanobot-Pipeline

- **Bug melden/fixen:** Digest-Mail-Extraktion hat im Dez. 2025 Titel↔Link falsch verheiratet (3 Links pro Job-Karte → 17 kaputte Einträge, inzwischen gelöscht). Prüfen, ob die Extraktion aktuell noch fehlerhaft ist.
- Konsumseite für `jobs_processed.csv` implementieren/testen (Format ist abgestimmt).

## Später / Ideen

- Cockpit-Ausbaustufen (dort auch Button "An nanobot melden" als zweiter Aufrufweg des CLI-Tools).
- Falls Schnittstellentool je netzwerkfähig wird: dann Auth-Thema aus der Schublade holen.
- Spec Kit bleibt bewusst dormant.

## Erledigt-Archiv (Kurzform)

Dubletten-Feature + Härtung (#61/#62) inkl. Live-DB-Bereinigung 137→~115 (XING-Tracking-Dubletten, kaputter Dez-Import, Copy-Paste-Fund). Skills-Re-Import mit Stable-ID (#60): 92 Skills, neue Taxonomie, 0 Dubletten. CSV-Export (#63), Kleinigkeiten Charge 1 (#64), nanobot-Rückkanal (#65). Hygiene, Branch Protection, TZ-/ABI-/CI-Lernnotizen als Kurt-Memories.
