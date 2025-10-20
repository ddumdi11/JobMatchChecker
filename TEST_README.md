# Test Ausführung für JobMatchChecker

## 🚀 Schnellstart

### PowerShell (Empfohlen für Windows)
```powershell
# Alle Tests ausführen
.\run-tests.ps1

# Nur BackupVerifier Tests
.\run-tests.ps1 BackupVerifier

# Nur BackupManager Tests
.\run-tests.ps1 BackupManager

# Alle Backup-bezogenen Tests
.\run-tests.ps1 backup
```

### Batch-Datei (Alternative)
```cmd
# Alle Tests ausführen
run-tests.bat

# Nur BackupVerifier Tests
run-tests.bat BackupVerifier

# Nur BackupManager Tests
run-tests.bat BackupManager
```

### Direkt mit npm
```bash
# Alle Tests ausführen
npm test -- --run

# Mit Filter
npm test -- --run BackupVerifier

# Mit UI (interaktiv)
npm run test:ui
```

## 📋 Verfügbare Test-Suites

### Feature 004: Database Backup & Restore
- **BackupVerifier** - 14 Tests ✅ (alle bestanden)
  - SQLite Datei-Validierung
  - Integritätsprüfung
  - Schema-Version Extraktion

- **BackupManager** - 11 Tests 🚧 (in Entwicklung)
  - createBackup() Tests
  - Backup-Erstellung und Verifizierung
  - Fehlerbehandlung

## ⚙️ Vitest Konfiguration

### Wichtig für Windows/Cygwin:
Tests MÜSSEN von PowerShell oder CMD ausgeführt werden, NICHT von Cygwin/Git Bash!

**Warum?**
- Vitest hat Kompatibilitätsprobleme mit Cygwin
- Die Test-Scripts verwenden PowerShell für optimale Kompatibilität

### Test-Verzeichnisse
```
tests/
├── main/           # Main-Process Tests
│   └── backup/     # Backup-System Tests
├── unit/           # Unit Tests
├── integration/    # Integration Tests
├── helpers/        # Test Helper Functions
│   └── testDatabase.ts  # Test DB Setup/Cleanup
├── data/           # Test-Datenbanken (automatisch erstellt, .gitignored)
│   └── test.db     # SQLite Test-Datenbank
└── setup.ts        # Global Test Setup
```

### Test-Datenbanken

**Speicherort:** `tests/data/test.db`

- Wird automatisch von `tests/helpers/testDatabase.ts` erstellt
- Wird vor jedem Test-Lauf neu initialisiert
- Verwendet separate Datenbank von der Production-DB
- **Nicht in Git committen** (ist in `.gitignore`)

**Production-Datenbank:** `src/data/job_match_checker.db`
- Wird von der App automatisch erstellt
- Auch .gitignored
- Wird NICHT von Tests verwendet

## 🔧 Troubleshooting

### Problem: "No test suite found"
**Lösung:** Tests von PowerShell/CMD starten, nicht von Cygwin

### Problem: "better-sqlite3 module version mismatch"
**Lösung:**
```bash
npm rebuild better-sqlite3
```

### Problem: Tests laufen nicht
**Lösung:**
1. Dependencies neu installieren:
   ```bash
   npm install
   ```
2. better-sqlite3 neu kompilieren:
   ```bash
   npm rebuild better-sqlite3
   ```

## 📊 Test-Optionen

```bash
# Tests im Watch-Modus (automatisch bei Änderungen)
npm test

# Tests einmal ausführen
npm test -- --run

# Tests mit Coverage-Report
npm test -- --run --coverage

# Tests mit UI
npm run test:ui

# Verbose Output
npm test -- --run --reporter=verbose

# Nur fehlgeschlagene Tests erneut ausführen
npm test -- --run --reporter=verbose --retry=1
```

## 🎯 Beispiel-Output

Erfolgreicher Test:
```
✓ tests/main/backup/BackupVerifier.test.ts (14 tests)

Test Files  1 passed (1)
     Tests  14 passed (14)
  Start at  19:15:23
  Duration  1.66s
```

## 🗑️ Temporäre Test-Dateien

**Automatisch erzeugte Dateien beim Testen:**

- `tests/data/test.db` - Test-Datenbank (automatisch erstellt/gelöscht)
- `tests/data/test.db-shm` - SQLite Shared Memory (temporär)
- `tests/data/test.db-wal` - SQLite Write-Ahead Log (temporär)

**Manuell erstellte Test-Output-Dateien (nicht in Git):**

- `Test_*.txt` - Test-Ergebnisse (z.B. `Test_feature_005_tests_20102025.txt`)
- `npx-vitest-result*.txt` - Vitest Outputs
- `feature-*-test-*.md` - Test-Analysen und Notizen
- `*.jpg`, `*.png` - Screenshots von Test-Ergebnissen

**Disabled Test-Dateien:**

- `tests/*.disabled` - Deaktivierte Test-Helper (z.B. `mocks.ts.disabled`)
- `tests/unit/minimal.test.ts` - Debug-Tests

**Cleanup:** Diese Dateien können gelöscht werden und sollten nicht in Git committed werden.

## 📝 Notizen

- Alle Tests verwenden vitest als Test-Framework
- Test-Dateien müssen `.test.ts` oder `.spec.ts` Endung haben
- Tests laufen in Node.js Umgebung (nicht Browser)
- Windows-Pfade werden korrekt behandelt
- Test-Datenbanken und temporäre Dateien sind in `.gitignore`

## 🔗 Nützliche Links

- [Vitest Dokumentation](https://vitest.dev/)
- [Feature 004 Spezifikation](./specs/004-database-backup-restore/spec.md)
- [Test Tasks](./specs/004-database-backup-restore/tasks.md)
