# Session-Ende-Protokoll

**Zweck:** Sicherstellen, dass am Ende jeder Session alle wichtigen Informationen dokumentiert und der Projektstatus korrekt festgehalten wird.

---

## ✅ Checkliste: Vor Session-Ende IMMER durchführen

### 1. 🧪 Test-Status dokumentieren

- [ ] Letzte Test-Ergebnisse speichern
  - Dateiname: `Test_[feature]_[DDMMYYYY].txt` im Root
  - Befehl: `npm test > Test_[beschreibung]_[DDMMYYYY].txt`

- [ ] Test-Zusammenfassung notieren:
  - Anzahl bestandene Tests
  - Anzahl fehlgeschlagene Tests
  - Welche Feature-Tests betroffen sind
  - Bekannte Probleme (z.B. Feature 004 Backup Tests)

### 2. 📂 Git-Status prüfen

- [ ] `git status` ausführen und dokumentieren:
  - Welche Dateien sind **modified** aber nicht committed?
  - Welche Dateien sind **untracked** und können gelöscht werden?
  - Welche Dateien sollten committed werden?

- [ ] Offene Änderungen committen oder Grund dokumentieren warum nicht

### 3. 🔄 Pull Request Status

- [ ] Alle offenen PRs auflisten:
  ```bash
  gh pr list
  ```

- [ ] Für jeden PR dokumentieren:
  - PR-Nummer und Titel
  - Status (Draft/Open/Ready to merge)
  - Offene Review-Kommentare
  - Was fehlt noch bis zum Merge?

### 4. 📝 CHECKPOINT.md aktualisieren

- [ ] **Datum aktualisieren** (WICHTIG!)
  - Format: `**Stand:** YYYY-MM-DD, HH:MM Uhr`

- [ ] **Branch aktualisieren**
  - Aktuellen Branch eintragen

- [ ] **Status-Zusammenfassung schreiben:**
  - Was wurde in dieser Session erreicht?
  - Welche Tests laufen? Welche nicht?
  - Welche PRs sind offen/bereit?
  - Was sind die nächsten Schritte?

- [ ] **Uncommitted Changes auflisten**
  - Alle modified/untracked Dateien dokumentieren

- [ ] **Wichtige Erkenntnisse festhalten**
  - Neue Probleme entdeckt?
  - Neue Lösungen gefunden?
  - Wichtige Entscheidungen getroffen?

### 5. 📋 SESSION_START.md prüfen

- [ ] Ist SESSION_START.md noch aktuell?
  - Neue Regeln hinzugekommen?
  - Neue protected files?
  - Neue kritische Warnungen?

- [ ] Falls Änderungen nötig: Aktualisieren und committen

### 6. 🗂️ Aufräumen

- [ ] Temporäre/Debug-Dateien löschen:
  - `Test_*.txt` (falls nicht mehr relevant)
  - `npx-vitest-result*.txt`
  - `*.disabled` Dateien
  - Screenshots von Test-Ergebnissen (falls dokumentiert)

- [ ] Test-Datenbanken prüfen:
  - `tests/data/test.db` sollte von Tests automatisch verwaltet werden
  - Keine manuellen Änderungen committen

### 7. 🎯 Nächste Schritte definieren

- [ ] Klar dokumentieren in CHECKPOINT.md:
  - Was ist das nächste Todo?
  - Welche Blocker gibt es?
  - Welche Entscheidungen müssen getroffen werden?
  - Was sollte die nächste Session als erstes tun?

### 8. 💾 Alles committen

- [ ] CHECKPOINT.md committen:
  ```bash
  git add CHECKPOINT.md
  git commit -m "Update checkpoint: [kurze Beschreibung]"
  ```

- [ ] SESSION_START.md committen (falls geändert):
  ```bash
  git add SESSION_START.md
  git commit -m "Update session start instructions"
  ```

- [ ] Andere Dokumentations-Änderungen committen

---

## 🚨 RED FLAGS - Session NICHT beenden wenn:

- ❌ Tests laufen noch / Build läuft noch
- ❌ Mitten in einem Feature-Implementation (Code halb fertig)
- ❌ Kritischer Fehler/Bug eingeführt aber nicht gefixt
- ❌ PR-Review-Kommentare offen aber nicht bearbeitet
- ❌ Git-Status zeigt unerwartete/unklare Änderungen

**In diesen Fällen:** Entweder fertig implementieren ODER klar in CHECKPOINT.md dokumentieren was halb fertig ist und warum.

---

## 📊 Template für CHECKPOINT.md Header

```markdown
# Job Match Checker - Entwicklungs-Checkpoint

**Stand:** YYYY-MM-DD, HH:MM Uhr
**Branch:** `[current-branch]`
**Status:** [Feature XXX Status] - [KOMPLETT/IN PROGRESS/BLOCKED]

---

## 🎯 Aktuelle Session Zusammenfassung

### ✅ Was erreicht wurde
- [Liste was implementiert/gefixt wurde]

### 📊 Test-Status
- **Gesamt:** X Tests (Y ✅, Z ❌, W ⏭️ skipped)
- **Feature-spezifisch:** [Details zu aktuellen Feature-Tests]
- **Bekannte Probleme:** [z.B. Feature 004 Backup Tests]

### 📋 Pull Request Status
- **PR #XX:** [Titel] - [Status]

### 🗂️ Uncommitted Changes
[git status Ausgabe zusammengefasst]

---

## 🎯 Nächste Schritte
1. [Nächstes konkretes Todo]
2. [Danach]
3. [...]

**Wichtigster Blocker:** [Falls vorhanden, sonst "Keiner"]

---

**Nächste Session:** Starte mit `SESSION_START.md` lesen, dann diesen Checkpoint.
```

---

## 💡 Tipps

1. **Zeit einplanen:** Rechne 5-10 Minuten am Session-Ende für dieses Protokoll ein
2. **Nicht überspringen:** Auch bei "kurzen Sessions" - verhindert Verwirrung nächstes Mal
3. **Konkret sein:** "Tests laufen" ist zu vague, schreibe "Feature 005: 52/52 Tests grün ✅"
4. **Datum ist kritisch:** Ohne aktuelles Datum weiß man nicht, ob CHECKPOINT.md veraltet ist
5. **Untracked files:** Lieber zu viel dokumentieren als zu wenig - verhindert Verwirrung

---

## 📚 Verwandte Dokumente

- [SESSION_START.md](SESSION_START.md) - Was bei Session-Start zu tun ist
- [CHECKPOINT.md](CHECKPOINT.md) - Der aktuelle Projekt-Checkpoint
- [PROJECT_RULES.md](PROJECT_RULES.md) - Projekt-spezifische Regeln

---

**Version:** 1.0
**Erstellt:** 2025-10-20
**Letztes Update:** 2025-10-20
