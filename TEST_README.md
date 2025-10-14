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
└── integration/    # Integration Tests
```

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

## 📝 Notizen

- Alle Tests verwenden vitest als Test-Framework
- Test-Dateien müssen `.test.ts` oder `.spec.ts` Endung haben
- Tests laufen in Node.js Umgebung (nicht Browser)
- Windows-Pfade werden korrekt behandelt

## 🔗 Nützliche Links

- [Vitest Dokumentation](https://vitest.dev/)
- [Feature 004 Spezifikation](./specs/004-database-backup-restore/spec.md)
- [Test Tasks](./specs/004-database-backup-restore/tasks.md)
