# Job Match Checker

> AI-powered desktop application for systematic job offer analysis and matching

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Electron-28.0-blue.svg)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18.2-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)

---

## 📖 Overview

Job Match Checker is a desktop application that helps you systematically capture, manage, and analyze job offers from various job boards. Using AI-powered matching (Claude Sonnet 4.5), it provides intelligent gap analysis and helps you make data-driven decisions in your job search.

### Key Features

- 🎯 **AI-Powered Matching**: Analyze job offers against your profile using Claude Sonnet 4.5
- 📊 **Gap Analysis**: Understand what's missing and how to close skill gaps
- 🗂️ **Multi-Source Management**: Track jobs from LinkedIn, XING, Stepstone, and more
- 📈 **Statistics & Reports**: Generate weekly/monthly reports in PDF or CSV
- 🔒 **Privacy First**: All data stays local in SQLite database
- 🔄 **Continuous Learning**: Re-match jobs as your profile improves

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Claude API Key** (from Anthropic)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/JobMatchChecker.git
   cd JobMatchChecker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and add your Claude API key
   ```

4. **Initialize database**
   ```bash
   npm run migrate:latest
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

The app will open automatically in a new Electron window.

---

## 🛠️ Development

### Project Structure

```
JobMatchChecker/
├── .claude/              # Claude Code context files
├── .specify/             # GitHub SpecKit configuration
│   └── memory/
│       └── constitution.md
├── specs/                # Technical specifications
│   ├── data-model.md
│   ├── features.md
│   └── tech-stack.md
├── src/
│   ├── main/            # Electron main process
│   │   ├── database/    # SQLite + Knex migrations
│   │   ├── services/    # Business logic (AI, parsing)
│   │   └── ipc/         # IPC handlers
│   └── renderer/        # React frontend
│       ├── components/
│       ├── pages/
│       ├── store/       # Zustand state management
│       └── utils/
├── resources/           # App icons and assets
├── backups/             # Auto-generated SQL dumps
├── data/                # SQLite database (gitignored)
└── tests/               # Unit, integration, E2E tests
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (hot reload) |
| `npm run build` | Build for production |
| `npm run package` | Create distributable (DMG/EXE/AppImage) |
| `npm run package:win` | Build for Windows only |
| `npm run package:mac` | Build for macOS only |
| `npm run package:linux` | Build for Linux only |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Auto-fix ESLint issues |
| `npm run format` | Format code with Prettier |
| `npm test` | Run tests with Vitest |
| `npm run migrate:latest` | Run pending database migrations |
| `npm run migrate:rollback` | Rollback last migration |

### Tech Stack

- **Frontend**: React 18, Material-UI (MUI), Zustand
- **Backend**: Electron, Node.js, SQLite (better-sqlite3)
- **AI**: Claude Sonnet 4.5 (Anthropic API)
- **Build**: Vite, TypeScript, electron-builder
- **Database**: Knex.js (migrations), better-sqlite3
- **Testing**: Vitest, React Testing Library

See [`specs/tech-stack.md`](./specs/tech-stack.md) for detailed rationale.

---

## 📝 Usage

### 1. Import Your CV

Go to **Profile > Import CV** and upload your LaTeX CV. The parser will extract:
- Personal information
- Skills (categorized, with levels 0-10)
- Work experience
- Education

You can manually edit and extend your profile afterwards.

### 2. Add Job Offers

Three ways to add jobs:

**A) Copy-Paste**
1. Copy job description from any website
2. Click **"+ Add Job"**
3. Paste text → AI extracts fields automatically
4. Review and save

**B) Import File**
- Plain text (`.txt`)
- PDF (text-based, no OCR yet)

**C) Manual Entry**
- Fill out form manually

### 3. Match a Job

1. Open job details
2. Click **"Match Job"**
3. Wait for AI analysis (~5-10 seconds)
4. View results:
   - **Match Score** (0-100%)
   - **Strengths** (what fits well)
   - **Gaps** (what's missing)
   - **Recommendations** (how to close gaps)

### 4. Generate Reports

Go to **Reports** and select:
- **Weekly/Monthly Overview**: List of checked jobs with scores
- **Export Format**: PDF or CSV
- **Time Range**: Custom date range

---

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Required
CLAUDE_API_KEY=sk-ant-xxxxx

# Optional
OPENROUTER_API_KEY=sk-or-xxxxx
DB_PATH=./data/jobmatcher.db
LOG_LEVEL=info
DAILY_API_BUDGET=5.0
```

### API Keys

**Claude API Key:**
1. Sign up at [console.anthropic.com](https://console.anthropic.com)
2. Create new API key
3. Add to `.env` file

The app will automatically use your OS keychain for secure storage after first launch.

### Matching Prompts

You can customize AI matching behavior via **Settings > Admin > Prompts**:
1. Edit default prompt
2. Test with sample data
3. Activate new version

All prompts are versioned and stored in the database.

---

## 📊 Roadmap

### MVP (Phase 1) ✅
- [x] LaTeX CV import
- [x] Manual job entry (copy-paste)
- [x] AI matching with Claude
- [x] Basic reports (PDF/CSV)
- [x] Skills management
- [x] Job list with filtering

### Phase 2 (Q3 2025)
- [ ] Screenshot OCR (Tesseract.js)
- [ ] API integration for job boards
- [ ] Advanced statistics dashboard
- [ ] Soft skills profile
- [ ] Automatic training suggestions

### Phase 3 (Q4 2025)
- [ ] Multi-language support
- [ ] Collaboration features
- [ ] Mobile companion app

See [`specs/features.md`](./specs/features.md) for full feature list.

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with UI
npm run test:ui

# Run specific test file
npm test src/main/services/parser.test.ts
```

Test coverage is tracked and should stay above 70%.

---

## 🔒 Security

- **API Keys**: Stored in OS keychain (keytar)
- **SQL Injection**: Prevented via Knex.js prepared statements
- **XSS**: Mitigated by React's automatic escaping
- **Data**: All local, no cloud sync
- **Backups**: Automatic SQL dumps before each update

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please ensure:
- ✅ Code follows ESLint/Prettier rules
- ✅ Tests pass (`npm test`)
- ✅ Documentation is updated

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Anthropic** for Claude API
- **Electron** team for the framework
- **React** and **Material-UI** communities
- **GitHub SpecKit** for project structure

---

## 📬 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/JobMatchChecker/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/JobMatchChecker/discussions)
- **Email**: your.email@example.com

---

## 🌟 Star History

If this project helps you, please consider giving it a ⭐!

---

**Built with ❤️ using Claude Sonnet 4.5**
