# SESSION START INSTRUCTIONS

Read and follow these rules STRICTLY for this entire session.

## 🔒 PROTECTED FILES - NEVER MODIFY WITHOUT EXPLICIT APPROVAL

These files control the build system. Changes can break the entire project.

**PROTECTED:**

- `package.json`
- `electron.vite.config.ts`
- `tsconfig.json`
- `tsconfig.main.json`
- `knexfile.js`

**RULE:** If you think any protected file needs changes:

1. ❌ DO NOT modify it
2. 📋 Document WHY you think it needs changes
3. 🤝 Ask human for approval
4. ⏸️ STOP implementation until confirmed

## 💻 WINDOWS ENVIRONMENT - CRITICAL

**This project runs on Windows. NEVER use Linux/Unix commands!**

❌ **DANGEROUS - NEVER USE:**

- `cat`, `grep`, `sed`, `awk`, `head`, `tail`
- Any bash/shell redirects like `>`, `>>`, `<<`, `|`
- Unix path separators like `/usr/bin/`
- **`os.tmpdir()` in Tests** - führt zu Race Conditions!

✅ **SAFE - USE INSTEAD:**

- **Read files:** Use the `Read` tool (NOT cat/head/tail)
- **Search in files:** Use the `Grep` tool (NOT grep/sed/awk)
- **Windows commands ONLY:** `type`, `dir`, `findstr` via Bash tool
- **Check existence:** Test via Read tool or PowerShell commands
- **Test directories:** `path.join(process.cwd(), 'tests', 'data')` (NOT `os.tmpdir()`)

**Why this is CRITICAL:**

- Linux commands on Windows can **CORRUPT FILES**
- Example: `cat > file.txt << 'EOF'` will write shell code INTO the file
- Bash redirects (`>`, `<<`) are especially dangerous
- **`os.tmpdir()` causes race conditions** - temp folders deleted during tests

**If you need to run a command:**

1. Use the `Read` tool for file operations
2. Use the `Grep` tool for searching
3. Use PowerShell syntax if you must use Bash tool
4. When in doubt: **ASK FIRST**

### 🧪 Test-Verzeichnisse auf Windows (WICHTIG!)

**NIEMALS `os.tmpdir()` in Tests verwenden!**

**Problem:**

- Windows Temp-Verzeichnisse haben Race Conditions
- Ordner werden zwischen/während Tests gelöscht
- Führt zu: "Source database file not found", "disk I/O error"

**Lösung:**

```typescript
// ❌ FALSCH - Race Conditions!
const testDir = path.join(os.tmpdir(), 'test-data');

// ✅ RICHTIG - Stabile Projekt-Verzeichnisse
const testDir = path.join(process.cwd(), 'tests', 'data');
```

**Best Practices:**

- Unique Dateinamen pro Test: `test-${Date.now()}-${Math.random()}.db`
- Per-test unique Backup/Migrations Directories
- Erhöhte Wartezeiten für File Handle Releases (300ms - 10000ms)
- Cleanup mit Retry-Logik (3 Versuche, 100ms Delays)
- Nur spezifische Test-Dateien löschen, nicht ganze Verzeichnisse

## 🐛 DEBUGGING PROTOCOL

When encountering build errors:

### Step 1: Check Code Files FIRST

- Review recently changed `.ts` / `.tsx` files
- Check import paths
- Verify function signatures

### Step 2: Validate Configuration (only if code is correct)

```powershell
npm run validate  # Run validation before assuming config issue
```

### Step 3: Never Guess

- ❌ DO NOT trial-and-error config changes
- ✅ ASK human before modifying any protected file
- ✅ Explain your reasoning before making changes

## 🚨 HÄUFIGSTES PROBLEM: NODE_MODULE_VERSION Mismatch

**Wenn du diesen Fehler siehst:**

```text
Error: The module 'better-sqlite3.node' was compiled against a different Node.js version
using NODE_MODULE_VERSION 115. This version requires NODE_MODULE_VERSION 139.
```

**Lösung (IMMER diese exakte Sequenz):**

```bash
rm -rf dist out             # Optional: Build-Artefakte löschen (bei hartnäckigen Problemen)
rm -rf node_modules
npm cache clean --force     # ← KRITISCH! Nicht überspringen!
npm install
npx electron-rebuild
```

**WICHTIG:**

- ❌ NICHT nur `npx electron-rebuild` ausführen - reicht NICHT!
- ✅ IMMER `npm cache clean --force` mit einbeziehen
- ✅ Die komplette 4-Schritte-Sequenz ist notwendig
- ℹ️ Detaillierte Erklärung: siehe [DEVELOPMENT_REQUIREMENTS.md](DEVELOPMENT_REQUIREMENTS.md) Zeile 137-179

## 📁 PROJECT CONTEXT

Read these files at session start:

1. `CHECKPOINT.md` - Current project status and last session summary
2. `SESSION_END_PROTOCOL.md` - Protocol to follow at session end
3. `PROJECT_RULES.md` - Project-specific rules
4. `specs/*/PLAN_SUMMARY.md` - Current implementation plan
5. `specs/*/TASKS_SUMMARY.txt` - Task list and status

## 🎯 CURRENT TASK

Before starting work:

1. Confirm which task you're implementing (e.g., "Starting T002?")
2. Read the task requirements
3. Verify dependencies are completed

## 🚫 PROCESS MANAGEMENT

**NEVER kill system processes yourself.**

❌ DO NOT use commands like:

- `taskkill` / `pkill` / `killall`
- `taskkill //IM node.exe` (kills yourself!)
- Any process termination commands

✅ INSTEAD:

- Ask human to restart processes
- Let human handle process cleanup
- Focus on code changes only

**Why?** You run inside a Node.js process. Killing Node processes kills you too.

## ⚠️ WHEN IN DOUBT

**ALWAYS ask instead of guessing.**

Examples:

- "Should I modify package.json to add X?"
- "The build fails - can I check electron.vite.config.ts?"
- "Task T005 seems to require changes to protected files - how should I proceed?"
- "Should I restart the dev server, or will you handle that?"

## 🔚 SESSION-ENDE REGEL

**KRITISCH: Am Ende JEDER Session MUSS das Session-Ende-Protokoll durchgeführt werden!**

**Ich (Claude) MUSS proaktiv fragen wenn ich erkenne:**

- User will Session beenden ("Feierabend", "bis morgen", "machen wir Schluss")
- Längere Pause steht bevor
- Größere Aufgabe abgeschlossen (PR gemerged, Feature komplett)

**Dann MUSS ich fragen:**

> "Soll ich das SESSION_END_PROTOCOL.md durchgehen bevor wir die Session beenden?"

**Protokoll-Datei:** [SESSION_END_PROTOCOL.md](SESSION_END_PROTOCOL.md)

**Warum wichtig:**

- CHECKPOINT.md muss aktuell sein (mit richtigem Datum!)
- Git-Status dokumentieren
- Keine veralteten Informationen für nächste Session
- Temporäre Dateien aufräumen

**Falls ich es vergesse:** User kann mich erinnern mit "Session beenden" oder "Führe Session-Ende-Protokoll durch"

---

**Acknowledge these rules by saying:**
"✅ I've read SESSION_START.md and will follow all protection rules"
