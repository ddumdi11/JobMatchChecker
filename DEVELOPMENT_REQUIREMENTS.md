# Entwicklungsumgebung - Anforderungen

## Übersicht
Dieses Dokument beschreibt alle Anforderungen und Abhängigkeiten für die Entwicklung am JobMatchChecker-Projekt.

## System-Anforderungen

### Alle Plattformen
- **Node.js**: v18.18.2+ oder v22.19.0+
- **npm**: v9.0.0+
- **Git**: Latest stable version

### Windows 10/11

**WICHTIG:** Für native Module wie `better-sqlite3` werden C++ Build Tools benötigt.

#### Visual Studio 2022 (erforderlich)

- **Visual Studio Community 2022** oder **Visual Studio Build Tools 2022**
  - **Version**: 17.14.16 oder höher (mit C++20 Support)
  - **Erforderliche Komponenten**:
    - ✅ Workload: **"Desktopentwicklung mit C++"**
    - ✅ MSVC v143 (Latest) - **C++20 Support erforderlich!**
    - ✅ Windows 11 SDK (10.0.22621.0 oder höher)
    - ✅ C++ CMake Tools für Windows

- **Python**: 3.x (wird automatisch mit Visual Studio installiert)

**Installation:**
1. [Visual Studio Installer](https://visualstudio.microsoft.com/downloads/) herunterladen
2. Bei Installation "Desktopentwicklung mit C++" auswählen
3. Oder über "Ändern" → "Workloads" nachträglich installieren

### macOS

- **Xcode Command Line Tools**:
  ```bash
  xcode-select --install
  ```
- **Python**: 3.x

### Linux (Ubuntu/Debian)

```bash
sudo apt-get install build-essential python3 libsqlite3-dev
```

## Installation

### 1. Repository klonen

```bash
git clone https://github.com/ddumdi11/JobMatchChecker.git
cd JobMatchChecker
```

### 2. Dependencies installieren

```bash
npm install
```

### 3. Native Module bauen

```bash
npx electron-rebuild
```

**Erwartetes Ergebnis:**
```
✔ Rebuild Complete
```

### 4. App starten

```bash
npm run dev
```

## Projekt-Dependencies

### Runtime Dependencies
- **Electron**: 38.2.1 (aktuell unterstützte Version)
- **better-sqlite3**: 12.4.1 (native module - benötigt C++ compiler)
- **React**: 18.x
- **Material-UI**: 5.x
- **Knex.js**: Database migrations

### Development Dependencies
- **electron-vite**: Build tool
- **TypeScript**: 5.x
- **Vite**: 5.x
- **ESLint**: Code quality
- **Vitest**: Testing framework

## Häufige Probleme

### Windows: "C++20 or later required" Fehler

**Symptom:**
```
error C1189: #error:  "C++20 or later required."
```

**Ursache:** Visual Studio Build Tools zu alt oder fehlen.

**Lösung:**
1. Visual Studio Installer öffnen
2. Build Tools 2022 aktualisieren auf Version 17.14.16+
3. Workload "Desktopentwicklung mit C++" installieren
4. Projekt neu bauen:
   ```bash
   rm -rf node_modules
   npm install
   npx electron-rebuild
   ```

### Windows: "better-sqlite3" Build-Fehler

**Symptom:**
```
✖ Rebuild Failed
node-gyp failed to rebuild 'better-sqlite3'
```

**Lösungen:**

1. **Visual Studio Build Tools prüfen** (siehe oben)

2. **better-sqlite3 Version prüfen:**
   - Für Electron 38 wird better-sqlite3 >= 12.x benötigt
   - Ältere Versionen (9.x) unterstützen kein C++20

3. **Node.js Version prüfen:**
   - Verwende Node.js 18.x oder 22.x (LTS-Versionen)

### "Electron failed to start" / Blank Window

**Mögliche Ursachen:**
1. Native modules nicht rebuilt → `npx electron-rebuild` ausführen
2. Build-Fehler → DevTools öffnen (F12) und Console prüfen
3. Port 5173 bereits belegt → `npm run dev` neu starten

### macOS: "xcrun: error: invalid active developer path"

**Lösung:**
```bash
xcode-select --install
```

## Entwicklungs-Workflow

### Entwicklungsserver starten
```bash
npm run dev
```
Startet:
- Vite Dev Server auf http://localhost:5173
- Electron App mit Hot Reload
- DevTools automatisch geöffnet

### Build für Produktion
```bash
npm run build        # Build für alle Plattformen
npm run package      # Erstellt distributables
npm run package:win  # Windows only
npm run package:mac  # macOS only
npm run package:linux # Linux only
```

### Tests ausführen
```bash
npm test             # Unit tests
npm run test:ui      # Vitest UI
```

### Database Migrations
```bash
npm run migrate:latest  # Run all pending migrations
npm run migrate:rollback # Rollback last batch
npm run migrate:make <name> # Create new migration
```

## Weiterführende Dokumentation

- [ELECTRON_DEBUGGING_CHRONOLOGIE.md](ELECTRON_DEBUGGING_CHRONOLOGIE.md) - Detaillierte Troubleshooting-Historie
- [PROJECT_RULES.md](PROJECT_RULES.md) - Projekt-spezifische Regeln
- [SESSION_START.md](SESSION_START.md) - Onboarding für neue Sessions
- [Electron Docs](https://www.electronjs.org/docs/latest/)
- [better-sqlite3 Docs](https://github.com/WiseLibs/better-sqlite3)

## Support

Bei Problemen:
1. Prüfe diese Dokumentation
2. Lies [ELECTRON_DEBUGGING_CHRONOLOGIE.md](ELECTRON_DEBUGGING_CHRONOLOGIE.md)
3. Öffne ein Issue auf GitHub

---

**Zuletzt aktualisiert:** 2025-10-05
**Electron Version:** 38.2.1
**Node.js Version:** 18.x / 22.x
