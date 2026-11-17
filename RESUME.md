# RESUME — JobMatchChecker

**Stand:** 2026-11-17
**Rollen:** Claude (Architekt) → Thorsten (Supervisor/Relay) → Kurt (Implementierung; seit 11/2026 Opus 5.5 in T3 Code, vorher Claude Code CLI)

## Repo-Zustand

- `main` sauber, CI grün (`test` + `nanobot-tool`). Remote-Branch `fix/bulk-match-exclude-archived` (#77, gemerged) kann noch gelöscht werden.
- Zuletzt gemerged (seit Snapshot 07/2026):
  - **#66** Dual-URL-Rückkanal: `source_url` (roher Original-Link, nie bereinigt) + `message_id` für das nanobot-Matching; `url` bleibt Anzeige-/Dedup-URL.
  - **#67** Node 20 vereinheitlicht · **#68** Contract-Tests auf Handler-Schicht umklassifiziert (laufen jetzt in CI) · **#69** Task-Scheduler-tauglicher Export-Wrapper · **#70** `nanobot:install` auf `npm ci`.
  - **#73** Quelle als Pflicht-Dropdown mit URL-Autoerkennung (`job_sources.domain_patterns`, längste Domain gewinnt, nie raten) + Gestern-Default fürs Datum; neue Quelle stellenangebote.de.
  - **#74** Truncation-Fix: abgeschnittene Matching-Antworten erkennen (max_tokens 2000 → 8000, Listen im Prompt begrenzt, ehrliche Fehlermeldung statt „Bitte erneut versuchen“). Auslöser: Job 406 — Expert DevSecOps Process Automation.
  - **#75** Job-ID sichtbar: ID-Spalte (umschaltbar, pro Rechner gemerkt), `#ID · Titel` in Kopfzeilen und Bulk-Ergebnis (`formatJobRef`), alle Sortierköpfe tastaturbedienbar (`TableSortLabel`), Fehler-Normalisierung im Batch.
  - **#77** Archivierte Jobs vom Matching ausgeschlossen (Neue/Alle/Ausgewählte + Zähler, gemeinsame Bedingung in `matchingSelection.ts`). Zähler DB-weit statt aus der gefilterten Liste; Ladefehler wird als „unbekannt“ angezeigt (Hinweis + „Erneut versuchen“), nie als „Alle gematcht“. Listenfilter „Alle“ bewusst unverändert (→ #76).

## Merge-Hinweis (wichtig, spart Rätselraten)

Das Ruleset „Coderabbit-Reviews“ ist für Solo-PRs **nie ohne Bypass erfüllbar**: Es verlangt 1 Approval (eigener PR nicht approvebar, CodeRabbit kommentiert nur) und einen Check `coderabbitai` (CodeRabbit meldet sich als `CodeRabbit`). Darum steht bei jedem PR „Approval required“ + „1 required pending“, auch wenn alles grün ist. Mergen: Pfeil neben „Squash and merge“ → **„Bypass requirements“**. Fehlt der Eintrag: mit dem **Admin-Account** angemeldet? (Der Zweitaccount per Google-Login hat keine Admin-Rechte.)
Gestapelte PRs: Nach Squash-Merge des Basis-PRs den Folge-Branch mit `git rebase --onto origin/main <alter-Basis-Tip>` umsetzen (Ruleset verlangt lineare Historie).

## Geparkt (bewusst, keine Arbeit ohne Auftrag)

- **#76** Job-Lifecycle & Archivierungskonzept — Diskussion vertagt, kein Code, keine Migration. Job 137 (Hach) wurde bewusst gelöscht, Rätsel geschlossen.
- **#71** Einstellungen → Jobquellen verwalten (Name + Domains).
- **stellenangebote.de:** Domain-Pattern ist geraten; sobald die echte Mail-Domain bekannt ist, nur den DB-Wert anpassen (keine Codeänderung).

## Thorsten-Zettel (manuell, klein)

1. **Klassische Branch Protection löschen** (Ruleset ist führend; die alte Protection mit Pflicht-Check `test` existiert noch): `gh api -X DELETE repos/:owner/:repo/branches/main/protection` oder via Settings.
2. **Zweiter Export-Task klären:** Der Windows-Task „Nanobot-Export JobMatchChecker“ läuft täglich 06:00 erfolgreich (`jobs_processed.csv` aktuell). Der Task **„JMC Export zu nanobot-workspace (Syncthing)“** (09:00) endet dagegen mit Ergebnis 1. Dazu liegen ungetrackte Fehlerberichte eines Sandbox-Laufs in `tools/nanobot-export/` (14./16.10.: `src/shared` nicht gemountet). Vermutlich ein überzähliger Doppel-Task → prüfen, ggf. abschalten, Berichte löschen.
3. **Optional Ruleset aufräumen:** Approvals → 0 und Check-Name `coderabbitai` → `CodeRabbit`; dann wäre der Merge-Button wieder ohne Bypass grün. Entscheidung Architekt/Thorsten.
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
10. **Formular-Alias `source_url` umbenennen** (JobAdd.tsx/jobStore.ts → z. B. `formUrl`): lokaler Feldname für `url`, kollidiert namentlich mit der DB-Spalte `source_url` aus #66 (roher Tracking-Link, andere Semantik).
11. **„Dubletten bereinigen“ und „CSV-Export“ an `jobs.length === 0` gekoppelt** (JobList.tsx): Ein Statusfilter ohne Treffer sperrt sie, obwohl beide auf dem ganzen Bestand arbeiten. Gleiches Muster wie in #77 bei „Alle neu matchen“ behoben; harmlos, aber inkonsistent. Ggf. mit #76 zusammen.
12. **Komponenten-Tests:** Es gibt keine DOM-Testumgebung (kein jsdom/happy-dom, vitest `environment: node`). UI-Logik wird daher in reine Funktionen gezogen und dort getestet (`jobScoreFilter.ts`, `bulkMatchButtons.ts`). Ob jsdom eingeführt wird, ist eine offene Architektur-Entscheidung (CodeRabbit fragt danach).

**Lehre aus #77:** Alles, was UI-Zustand anfasst, ist nie „mini“ — solche Fixes gleich als normalen kleinen Feature-PR einplanen.

## Separates Projekt: nanobot-Pipeline

- **Bug melden/fixen:** Digest-Mail-Extraktion hat im Dez. 2025 Titel↔Link falsch verheiratet (3 Links pro Job-Karte → 17 kaputte Einträge, inzwischen gelöscht). Prüfen, ob die Extraktion aktuell noch fehlerhaft ist.
- Konsumseite für `jobs_processed.csv` (inkl. `source_url`/`message_id` aus #66) prüfen.

## Später / Ideen

- Statistik-Cockpit (braucht vollständige Historie inkl. archivierter Jobs, siehe #76); dort auch Button „An nanobot melden“ als zweiter Aufrufweg des CLI-Tools.
- Falls Schnittstellentool je netzwerkfähig wird: dann Auth-Thema aus der Schublade holen.
- Spec Kit bleibt bewusst dormant.

## Erledigt-Archiv (Kurzform)

Dubletten-Feature + Härtung (#61/#62) inkl. Live-DB-Bereinigung. Skills-Re-Import mit Stable-ID (#60). CSV-Export (#63), Kleinigkeiten Charge 1 (#64), nanobot-Rückkanal (#65) inkl. Inbetriebnahme (Task Scheduler läuft täglich). Dual-URL (#66), Node 20 (#67), Contract-Tests (#68), Wrapper/`npm ci` (#69/#70), Quelle-Dropdown (#73), Truncation-Fix (#74), Job-ID sichtbar (#75), Archived-Ausschluss (#77). Hach-Job 137 bewusst gelöscht.
