# Job Match Checker – Tech Stack Specification

## Technology Decisions

---

## Desktop Application

### Framework: **Electron**
**Version:** ^28.0.0 (latest stable)

**Reasoning:**
- Cross-platform (Windows, macOS, Linux)
- Bewährte Technologie (VS Code, Slack, Discord)
- Große Community & Ecosystem
- Native System-Integration (File Dialogs, Notifications)

**Alternatives Considered:**
- ❌ Tauri: Zu neu, kleineres Ecosystem
- ❌ NW.js: Weniger aktiv maintained

---

## Frontend

### UI Framework: **React**
**Version:** ^18.2.0

**Reasoning:**
- Größte Community & Ressourcen
- Viele UI-Libraries kompatibel
- Hooks für State Management
- Developer-Tools exzellent

**Alternatives:**
- Vue.js: Auch gut, aber React hat mehr Electron-Beispiele
- Svelte: Zu spezialisiert für dieses Projekt

### UI Component Library: **Material-UI (MUI)**
**Version:** ^5.15.0

**Reasoning:**
- Enterprise-ready Komponenten
- Gutes Theming-System (Light/Dark Mode)
- Barrierefreiheit out-of-the-box
- Table, Dialog, Form-Komponenten vorhanden

**Alternatives:**
- Ant Design: Auch gut, aber MUI hat bessere Electron-Integration
- Tailwind + Headless UI: Zu viel Custom-Styling nötig

### State Management: **Zustand**
**Version:** ^4.5.0

**Reasoning:**
- Leichtgewichtig
- Minimale Boilerplate
- Gut für Electron (keine Redux DevTools-Probleme)

**Alternatives:**
- Redux Toolkit: Overkill für Single-User-App
- Context API: Zu viel Prop-Drilling

---

## Backend / Electron Main Process

### Runtime: **Node.js**
**Version:** >= 18.x (LTS)

### Process Architecture:
```
Main Process (Node.js)
  ├─ Database Layer (SQLite)
  ├─ File System Operations
  ├─ API Client (Claude)
  └─ IPC Communication

Renderer Process (React)
  ├─ UI Components
  ├─ State Management (Zustand)
  └─ IPC Calls to Main
```

### IPC Communication: **electron-better-ipc**
**Version:** ^2.0.1

**Reasoning:**
- Promise-based IPC (cleaner als default)
- Type-safe Channels
- Request/Response Pattern

---

## Database

### SQLite: **better-sqlite3**
**Version:** ^9.2.0

**Reasoning:**
- Synchronous API (einfacher in Electron Main Process)
- Schneller als async-Varianten
- Native Bindings (bessere Performance)
- Backup/Restore einfach

**Schema Migrations:** **Knex.js**
**Version:** ^3.1.0

**Reasoning:**
- Migration-Scripts versioniert
- Rollback-Support
- Schema-Builder (keine Raw-SQL nötig)

**Example Migration:**
```javascript
exports.up = function(knex) {
  return knex.schema.createTable('job_offers', table => {
    table.increments('id').primary();
    table.integer('source_id').references('job_sources.id');
    table.string('title').notNullable();
    // ...
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('job_offers');
};
```

---

## AI Integration

### Primary: **Anthropic Claude API**
**Model:** claude-sonnet-4-5-20250929  
**SDK:** @anthropic-ai/sdk ^0.30.0

**Usage:**
```javascript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY
});

const message = await client.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  max_tokens: 1024,
  messages: [{
    role: 'user',
    content: promptText
  }]
});
```

### Fallback: **OpenRouter**
**SDK:** Custom Fetch Wrapper  
**Config:** Optional in `.env`

**Reasoning:**
- Zugriff auf verschiedene Modelle
- Cost-Optimierung möglich
- Fallback wenn Anthropic-Quota erreicht

---

## File Parsing

### LaTeX Parser: **unified-latex**
**Version:** ^1.5.0

**Reasoning:**
- AST-basiert (strukturierte Daten)
- Kann CV-Klassen (moderncv, europecv) parsen
- Aktiv maintained

**Alternative:** latex-utensils

### PDF Text Extraction: **pdf-parse**
**Version:** ^1.1.1

**Reasoning:**
- Leichtgewichtig
- Funktioniert ohne Headless-Browser
- Reines Node.js

**Limitation:** Nur Text-PDFs (keine Bilder/OCR)

### OCR (Phase 2): **Tesseract.js**
**Version:** ^5.0.0

**Reasoning:**
- Pure JavaScript (keine Binaries)
- Läuft in Electron Renderer Process
- Multi-Language Support

---

## Export & Reporting

### PDF Generation: **puppeteer**
**Version:** ^21.0.0

**Reasoning:**
- HTML → PDF Rendering
- Volle CSS-Kontrolle (Layout, Styling)
- Screenshots möglich (für Diagramme)

**Alternative:** pdfmake (komplexer für komplexe Layouts)

### CSV Export: **papaparse**
**Version:** ^5.4.1

**Reasoning:**
- Robust CSV-Parsing & Generation
- UTF-8 Encoding korrekt
- Excel-kompatibel

---

## Utilities

### Date/Time: **date-fns**
**Version:** ^3.0.0

**Reasoning:**
- Leichtgewichtiger als moment.js
- Tree-shakable (nur genutzte Funktionen)
- Immutable

### Validation: **Zod**
**Version:** ^3.22.0

**Reasoning:**
- Type-safe Schema Validation
- Gute TypeScript-Integration
- API-Response Validation

### Logging: **electron-log**
**Version:** ^5.0.0

**Reasoning:**
- Automatic Log-File Rotation
- Console + File Logging
- Log-Levels (info, warn, error)

---

## Development Tools

### Build: **electron-builder**
**Version:** ^24.9.0

**Reasoning:**
- Generiert Installer (DMG, NSIS, AppImage)
- Auto-Update Support
- Code Signing

### Bundler: **Vite**
**Version:** ^5.0.0

**Reasoning:**
- Schneller als Webpack
- Hot Module Replacement (HMR)
- Einfache Electron-Integration (vite-plugin-electron)

### TypeScript: **^5.3.0**

**Reasoning:**
- Type-Safety (weniger Runtime-Errors)
- Bessere IDE-Unterstützung
- Refactoring sicherer

### Linting: **ESLint + Prettier**

**Config:**
```json
{
  "extends": [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier"
  ]
}
```

### Testing: **Vitest + React Testing Library**

**Reasoning:**
- Vitest: Schneller als Jest, Vite-native
- RTL: Best Practice für React-Tests
- Electron-Testing: **Spectron** (für E2E)

---

## Security

### API Key Storage: **keytar**
**Version:** ^7.9.0

**Reasoning:**
- Nutzt OS-Keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- Keine Plain-Text API-Keys in Dateien
- Electron-native Integration

**Fallback:** electron-store mit Verschlüsselung (für Systeme ohne Keychain)

### Environment Variables: **dotenv**
**Version:** ^16.3.0

**Reasoning:**
- Entwicklungs-API-Keys in `.env` (nicht committed)
- Production: Keys aus Keychain laden

**Example `.env`:**
```
CLAUDE_API_KEY=sk-ant-xxxxx
OPENROUTER_API_KEY=sk-or-xxxxx
DB_PATH=./data/jobmatcher.db
LOG_LEVEL=info
```

---

## Project Structure

```
job-match-checker/
├── src/
│   ├── main/                    # Electron Main Process
│   │   ├── database/
│   │   │   ├── migrations/      # Knex migrations
│   │   │   ├── schema.js        # Table definitions
│   │   │   └── db.js            # DB connection
│   │   ├── services/
│   │   │   ├── ai-matcher.js    # Claude API integration
│   │   │   ├── parser.js        # LaTeX/PDF parsing
│   │   │   └── backup.js        # Backup/Restore logic
│   │   ├── ipc/
│   │   │   └── handlers.js      # IPC request handlers
│   │   └── main.js              # Electron entry point
│   │
│   ├── renderer/                # React Frontend
│   │   ├── components/
│   │   │   ├── JobList/
│   │   │   ├── MatchingResult/
│   │   │   ├── ProfileEditor/
│   │   │   └── ...
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── JobDetail.tsx
│   │   │   ├── Settings.tsx
│   │   │   └── ...
│   │   ├── store/               # Zustand stores
│   │   │   ├── jobStore.ts
│   │   │   ├── profileStore.ts
│   │   │   └── ...
│   │   ├── utils/
│   │   │   ├── api.ts           # IPC wrappers
│   │   │   └── formatting.ts
│   │   ├── App.tsx
│   │   └── index.tsx
│   │
│   └── shared/                  # Shared types/utils
│       ├── types.ts             # TypeScript interfaces
│       └── constants.ts
│
├── resources/                   # App assets
│   ├── icons/
│   ├── logo.png
│   └── ...
│
├── backups/                     # Auto-generated SQL dumps
│   └── .gitkeep
│
├── data/                        # SQLite database (gitignored)
│   └── .gitkeep
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── .env.example                 # Template for .env
├── .gitignore
├── package.json
├── tsconfig.json
├── vite.config.ts
├── electron-builder.yml         # Build configuration
└── README.md
```

---

## Key Dependencies (package.json)

### Production Dependencies
```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "@mui/material": "^5.15.0",
    "@mui/icons-material": "^5.15.0",
    "better-sqlite3": "^9.2.0",
    "date-fns": "^3.0.0",
    "dotenv": "^16.3.0",
    "electron-better-ipc": "^2.0.1",
    "electron-log": "^5.0.0",
    "electron-store": "^8.1.0",
    "keytar": "^7.9.0",
    "knex": "^3.1.0",
    "papaparse": "^5.4.1",
    "pdf-parse": "^1.1.1",
    "puppeteer": "^21.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.21.0",
    "unified-latex": "^1.5.0",
    "zod": "^3.22.0",
    "zustand": "^4.5.0"
  }
}
```

### Dev Dependencies
```json
{
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.8",
    "@types/node": "^20.10.0",
    "@types/papaparse": "^5.3.14",
    "@types/react": "^18.2.45",
    "@types/react-dom": "^18.2.18",
    "@typescript-eslint/eslint-plugin": "^6.15.0",
    "@vitejs/plugin-react": "^4.2.1",
    "electron": "^28.0.0",
    "electron-builder": "^24.9.0",
    "eslint": "^8.56.0",
    "eslint-config-prettier": "^9.1.0",
    "prettier": "^3.1.1",
    "typescript": "^5.3.3",
    "vite": "^5.0.10",
    "vite-plugin-electron": "^0.28.2",
    "vitest": "^1.1.0",
    "@testing-library/react": "^14.1.2",
    "@testing-library/jest-dom": "^6.1.5"
  }
}
```

---

## Build & Deployment

### Development
```bash
npm install
npm run dev        # Starts Vite + Electron in dev mode
```

### Production Build
```bash
npm run build      # Builds renderer + main
npm run package    # Creates distributable (DMG/EXE/AppImage)
```

### electron-builder Configuration
```yaml
# electron-builder.yml
appId: com.jobmatchchecker.app
productName: Job Match Checker
copyright: Copyright © 2025

directories:
  output: dist
  buildResources: resources

files:
  - src/main/**/*
  - src/renderer/dist/**/*
  - package.json

mac:
  category: public.app-category.productivity
  target:
    - dmg
    - zip
  icon: resources/icon.icns

win:
  target:
    - nsis
    - portable
  icon: resources/icon.ico

linux:
  target:
    - AppImage
    - deb
  category: Office
  icon: resources/icon.png

nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
```

---

## Database Migration Strategy

### Migration Files Location
```
src/main/database/migrations/
  ├── 001_initial_schema.js
  ├── 002_add_deadline_to_jobs.js
  └── 003_add_soft_skills_table.js
```

### Knex Configuration
```javascript
// knexfile.js
module.exports = {
  development: {
    client: 'better-sqlite3',
    connection: {
      filename: './data/jobmatcher.db'
    },
    useNullAsDefault: true,
    migrations: {
      directory: './src/main/database/migrations'
    }
  },
  production: {
    client: 'better-sqlite3',
    connection: {
      filename: process.env.DB_PATH || './data/jobmatcher.db'
    },
    useNullAsDefault: true,
    migrations: {
      directory: './src/main/database/migrations'
    }
  }
};
```

### Migration Execution Flow
```javascript
// src/main/database/migrator.js
const knex = require('knex')(require('../../knexfile'));
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

async function migrateDatabase() {
  try {
    // 1. Check current version
    const currentVersion = await knex('app_settings')
      .where({ key: 'db_version' })
      .first();

    // 2. Create backup
    const backupPath = path.join(
      __dirname, 
      '../../backups',
      `pre_migration_${currentVersion.value}_${Date.now()}.sql`
    );
    
    await createBackup(backupPath);
    console.log(`Backup created: ${backupPath}`);

    // 3. Run pending migrations
    await knex.migrate.latest();
    
    // 4. Update version
    const newVersion = await getLatestMigrationVersion();
    await knex('app_settings')
      .where({ key: 'db_version' })
      .update({ value: newVersion, updated_at: new Date() });

    console.log(`Migration successful: ${currentVersion.value} → ${newVersion}`);
    return { success: true, oldVersion: currentVersion.value, newVersion };

  } catch (error) {
    console.error('Migration failed:', error);
    
    // Rollback option
    const shouldRollback = await showRollbackDialog();
    if (shouldRollback) {
      await restoreBackup(backupPath);
    }
    
    return { success: false, error: error.message };
  }
}

function createBackup(backupPath) {
  return new Promise((resolve, reject) => {
    const dbPath = process.env.DB_PATH || './data/jobmatcher.db';
    exec(`sqlite3 ${dbPath} .dump > ${backupPath}`, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
```

---

## API Rate Limiting & Cost Management

### Token Tracking
```javascript
// src/main/services/ai-matcher.js
class AIMatcherService {
  async matchJob(job, userProfile) {
    const startTime = Date.now();
    
    try {
      const response = await this.claudeClient.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        messages: [{ role: 'user', content: this.buildPrompt(job, userProfile) }]
      });

      // Track usage
      await this.db('api_usage_log').insert({
        model: 'claude-sonnet-4.5',
        tokens_input: response.usage.input_tokens,
        tokens_output: response.usage.output_tokens,
        cost_estimate: this.calculateCost(response.usage),
        processing_time_ms: Date.now() - startTime,
        created_at: new Date()
      });

      return this.parseMatchingResult(response.content[0].text);
      
    } catch (error) {
      if (error.status === 429) {
        // Rate limit hit → try fallback
        return await this.fallbackMatcher(job, userProfile);
      }
      throw error;
    }
  }

  calculateCost(usage) {
    // Claude Sonnet 4.5 pricing (example)
    const INPUT_COST_PER_1M = 3.00;  // $3 per 1M input tokens
    const OUTPUT_COST_PER_1M = 15.00; // $15 per 1M output tokens
    
    const inputCost = (usage.input_tokens / 1_000_000) * INPUT_COST_PER_1M;
    const outputCost = (usage.output_tokens / 1_000_000) * OUTPUT_COST_PER_1M;
    
    return inputCost + outputCost;
  }
}
```

### Daily Budget Checker
```javascript
// src/main/services/budget-checker.js
class BudgetChecker {
  async checkDailyLimit() {
    const today = new Date().toISOString().split('T')[0];
    
    const todayUsage = await db('api_usage_log')
      .where('created_at', '>=', today)
      .sum('cost_estimate as total_cost')
      .first();

    const dailyBudget = await this.getSettings('daily_api_budget') || 5.0; // $5 default

    if (todayUsage.total_cost >= dailyBudget) {
      throw new Error(`Daily API budget exceeded: ${todayUsage.total_cost.toFixed(2)} / ${dailyBudget}`);
    }

    return {
      spent: todayUsage.total_cost,
      remaining: dailyBudget - todayUsage.total_cost,
      percentage: (todayUsage.total_cost / dailyBudget) * 100
    };
  }
}
```

---

## Error Handling Strategy

### Global Error Boundaries

**Main Process:**
```javascript
// src/main/main.js
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error);
  dialog.showErrorBox('Fatal Error', error.message);
  app.quit();
});

process.on('unhandledRejection', (reason) => {
  log.error('Unhandled Rejection:', reason);
});
```

**Renderer Process:**
```typescript
// src/renderer/components/ErrorBoundary.tsx
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    log.error('React Error:', error, errorInfo);
    
    // Send to main process for logging
    window.ipc.send('log-error', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-screen">
          <h1>Oops! Etwas ist schiefgelaufen</h1>
          <button onClick={() => window.location.reload()}>
            App neu laden
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

---

## Performance Optimizations

### Database Indexing
```javascript
// Applied automatically via Knex migrations
CREATE INDEX idx_job_offers_source ON job_offers(source_id);
CREATE INDEX idx_job_offers_posted ON job_offers(posted_date DESC);
CREATE INDEX idx_matching_results_score ON matching_results(match_score DESC);
```

### React Optimization
```typescript
// Memoization for expensive computations
const MemoizedJobList = React.memo(JobList, (prev, next) => {
  return prev.jobs.length === next.jobs.length;
});

// Virtual scrolling for large lists (react-window)
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={jobs.length}
  itemSize={80}
>
  {JobRow}
</FixedSizeList>
```

### Lazy Loading
```typescript
// Code splitting for routes
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Settings = lazy(() => import('./pages/Settings'));

<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route path="/" element={<Dashboard />} />
    <Route path="/settings" element={<Settings />} />
  </Routes>
</Suspense>
```

---

## Testing Strategy

### Unit Tests (Vitest)
```typescript
// tests/unit/parser.test.ts
import { parseLatexCV } from '@/main/services/parser';

describe('LaTeX Parser', () => {
  it('should extract name from moderncv', () => {
    const latex = `\\name{Max}{Mustermann}`;
    const result = parseLatexCV(latex);
    expect(result.firstName).toBe('Max');
    expect(result.lastName).toBe('Mustermann');
  });
});
```

### Integration Tests
```typescript
// tests/integration/matching.test.ts
import { AIMatcherService } from '@/main/services/ai-matcher';

describe('Job Matching', () => {
  it('should return valid match result', async () => {
    const matcher = new AIMatcherService(mockDB, mockClaudeClient);
    const result = await matcher.matchJob(mockJob, mockProfile);
    
    expect(result.match_score).toBeGreaterThanOrEqual(0);
    expect(result.match_score).toBeLessThanOrEqual(100);
    expect(result.gap_analysis).toBeDefined();
  });
});
```

### E2E Tests (Spectron)
```typescript
// tests/e2e/job-creation.test.ts
import { Application } from 'spectron';

describe('Job Creation Flow', () => {
  let app: Application;

  beforeEach(async () => {
    app = new Application({ path: electronPath });
    await app.start();
  });

  it('should create job via copy-paste', async () => {
    await app.client.click('#add-job-btn');
    await app.client.setValue('#job-text', 'Senior Developer at ACME...');
    await app.client.click('#parse-btn');
    
    const title = await app.client.getText('#job-title-input');
    expect(title).toContain('Senior Developer');
  });

  afterEach(async () => {
    await app.stop();
  });
});
```

---

## CI/CD Pipeline (GitHub Actions - Optional)

```yaml
# .github/workflows/build.yml
name: Build & Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node-version: [18.x]

    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Build app
        run: npm run build
      
      - name: Package app
        run: npm run package
        if: github.ref == 'refs/heads/main'
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: app-${{ matrix.os }}
          path: dist/*
```

---

## Documentation Standards

### Code Comments
```typescript
/**
 * Matches a job offer against user profile using Claude AI
 * 
 * @param job - The job offer to match
 * @param userProfile - The user's skills and preferences
 * @param options - Optional matching parameters
 * @returns Matching result with score and gap analysis
 * @throws {APIError} When Claude API call fails
 * @throws {ValidationError} When input data is invalid
 * 
 * @example
 * ```ts
 * const result = await matchJob(job, profile);
 * console.log(`Match score: ${result.match_score}%`);
 * ```
 */
async function matchJob(
  job: JobOffer,
  userProfile: UserProfile,
  options?: MatchingOptions
): Promise<MatchingResult>
```

### README Structure
```markdown
# Job Match Checker

## Installation
## Quick Start
## Features
## Configuration
## Development
## Troubleshooting
## Contributing
## License
```

---

## Security Checklist

- [x] API Keys nicht in Git committen (`.env` in `.gitignore`)
- [x] SQL-Injection Prevention (Prepared Statements via Knex)
- [x] XSS-Protection (React escapet automatisch)
- [x] Content Security Policy (CSP) in Electron
- [x] Keychain-Integration für sensible Daten
- [x] HTTPS für alle API-Calls
- [x] Regular Security Audits (`npm audit`)

---

## Next Steps for Development

1. ✅ Setup Projektstruktur (siehe oben)
2. ✅ Initialize Git Repository
3. ✅ Create `package.json` mit Dependencies
4. ✅ Setup TypeScript + ESLint + Prettier
5. ✅ Implement Datenbank-Schema (Knex Migrations)
6. ✅ Build Basic Electron Window
7. ✅ Implement IPC Communication
8. ✅ Create React Routing
9. ✅ Implement LaTeX Parser
10. ✅ Integrate Claude API
11. ✅ Build UI Components (MUI)
12. ✅ Testing Setup
13. ✅ Build & Package Configuration

---

*Version: 1.0 | Zuletzt aktualisiert: 2025-09-30*