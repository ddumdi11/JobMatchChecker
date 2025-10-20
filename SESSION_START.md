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

✅ **SAFE - USE INSTEAD:**
- **Read files:** Use the `Read` tool (NOT cat/head/tail)
- **Search in files:** Use the `Grep` tool (NOT grep/sed/awk)
- **Windows commands ONLY:** `type`, `dir`, `findstr` via Bash tool
- **Check existence:** Test via Read tool or PowerShell commands

**Why this is CRITICAL:**
- Linux commands on Windows can **CORRUPT FILES**
- Example: `cat > file.txt << 'EOF'` will write shell code INTO the file
- Bash redirects (`>`, `<<`) are especially dangerous

**If you need to run a command:**
1. Use the `Read` tool for file operations
2. Use the `Grep` tool for searching
3. Use PowerShell syntax if you must use Bash tool
4. When in doubt: **ASK FIRST**

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
```
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
1. `PROJECT_RULES.md` - Project-specific rules
2. `specs/*/PLAN_SUMMARY.md` - Current implementation plan
3. `specs/*/TASKS_SUMMARY.txt` - Task list and status

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

---

**Acknowledge these rules by saying:**
"✅ I've read SESSION_START.md and will follow all protection rules"