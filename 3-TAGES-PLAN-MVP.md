# 🎯 3-Tages-Plan: JobMatchChecker MVP (Option A)

**Erstellt:** 2025-12-04
**Status:** In Arbeit 🚧
**Ziel:** Funktionierende App mit Profil-Verwaltung, Job-Eingabe und Matching

## ⏰ Zeitbudget

- **Freitag (05.12):** 6 Stunden
- **Samstag (06.12):** 8 Stunden
- **Sonntag (07.12):** 8 Stunden
- **GESAMT:** 22 Stunden

---

## 📊 Fortschritts-Tracking

**Feature 001 (Profile Management UI):** 88% → Ziel: 100% ✅
**Feature 005 (Job Offer Management):** Backend 100%, UI 0% → Ziel: UI 100% ✅
**Matching-Feature:** 0% → Ziel: 100% ✅

---

# 📅 FREITAG (05.12.2025) - 6 Stunden

**Hauptziel:** Feature 001 (Profile Management) zu 100% fertigstellen

## Block 1: TypeScript-Fehler fixen + Cleanup (1h)

**Ziel:** Projekt kompiliert ohne Fehler

### Tasks

- [ ] **Task 1.1: BackupManager.ts - Unused Import** (15 Min)
  - **Datei:** [src/main/backup/BackupManager.ts](src/main/backup/BackupManager.ts#L21)
  - **Problem:** `hasSufficientDiskSpace` is declared but never used
  - **Lösung:** Entweder nutzen oder `@ts-expect-error` hinzufügen

- [ ] **Task 1.2: BackupVerifier.ts - Unused Import** (15 Min)
  - **Datei:** [src/main/backup/BackupVerifier.ts](src/main/backup/BackupVerifier.ts#L18)
  - **Problem:** `path` is declared but never used
  - **Lösung:** Import entfernen oder nutzen

- [ ] **Task 1.3: Test-Dateien aufräumen** (30 Min)
  - **Problem:** 12 Test-Suites haben "No test suite found"
  - **Betroffene Dateien:**
    - `tests/contract/job-ai-extraction.test.ts`
    - `tests/contract/job-crud.test.ts`
    - `tests/unit/aiExtractionService.test.ts`
    - `tests/unit/jobService.test.ts`
    - `tests/main/backup/*.test.ts` (8 Dateien)
  - **Lösung:** Tests auskommentieren oder `.skip` nutzen für MVP

**✅ Erfolgskriterium:** `npm run dev:main` startet ohne Fehler

---

## Block 2: Feature 001 - Store-Integration (3h)

**Ziel:** Alle Komponenten nutzen Zustand Store (wie ProfileForm bereits)

### Task 1.4: SkillsManager Store-Integration (1h)

**Dateien:**
- [src/renderer/store/profileStore.ts](src/renderer/store/profileStore.ts)
- [src/renderer/components/SkillsManager.tsx](src/renderer/components/SkillsManager.tsx)

**Schritte:**
1. **Store erweitern** (30 Min):
   ```typescript
   // profileStore.ts - neue Actions hinzufügen
   skills: Skill[]
   isLoadingSkills: boolean
   skillsError: string | null

   fetchSkills: async () => { /* IPC call */ }
   addSkill: async (skill) => { /* IPC call */ }
   updateSkill: async (id, skill) => { /* IPC call */ }
   deleteSkill: async (id) => { /* IPC call */ }
   ```

2. **SkillsManager umbauen** (30 Min):
   - Props-Interface entfernen
   - Store-Hooks einbauen:
     ```typescript
     const skills = useProfileStore((state) => state.skills)
     const addSkill = useProfileStore((state) => state.addSkill)
     const isLoading = useProfileStore((state) => state.isLoadingSkills)
     const error = useProfileStore((state) => state.skillsError)
     ```
   - Error-Handling in Snackbar

**✅ Erfolgskriterium:** SkillsManager funktioniert ohne Props

---

### Task 1.5: PreferencesPanel Store-Integration (1h)

**Dateien:**
- [src/renderer/store/profileStore.ts](src/renderer/store/profileStore.ts)
- [src/renderer/components/PreferencesPanel.tsx](src/renderer/components/PreferencesPanel.tsx)

**Schritte:**
1. **Store erweitern** (30 Min):
   ```typescript
   // profileStore.ts
   preferences: UserPreferences | null
   isLoadingPreferences: boolean
   preferencesError: string | null

   fetchPreferences: async () => { /* IPC call */ }
   updatePreferences: async (prefs) => { /* IPC call */ }
   ```

2. **PreferencesPanel umbauen** (30 Min):
   - Props entfernen
   - Store-Hooks nutzen
   - Validation mit Store-State

**✅ Erfolgskriterium:** PreferencesPanel funktioniert ohne Props

---

### Task 1.6: Profile.tsx Store-Integration (45 Min)

**Datei:** [src/renderer/pages/Profile.tsx](src/renderer/pages/Profile.tsx)

**Schritte:**
1. Alle Props-Passing entfernen
2. Nur zentrales Error-Handling für Store-Errors
3. Completion-Indicator basierend auf Store-State

**✅ Erfolgskriterium:** Profile.tsx ist deutlich schlanker, keine Props mehr

---

## Block 3: Feature 001 - Delete Profile (T017) (2h)

**Ziel:** Profil-Löschung mit Confirmation Dialog

### Task 1.7: IPC Handler für PROFILE_DELETE (30 Min)

**Datei:** [src/main/ipc/handlers.ts](src/main/ipc/handlers.ts)

**Implementation:**
```typescript
ipcMain.handle('PROFILE_DELETE', async () => {
  const db = getDatabase()

  // Transaction: Alle zugehörigen Daten löschen
  db.transaction(() => {
    db.prepare('DELETE FROM skills').run()
    db.prepare('DELETE FROM user_preferences').run()
    db.prepare('DELETE FROM user_profile').run()
  })()

  return { success: true }
})
```

**Test:** Manuell mit DevTools Console testen

---

### Task 1.8: Store-Action deleteProfile() (15 Min)

**Datei:** [src/renderer/store/profileStore.ts](src/renderer/store/profileStore.ts)

**Implementation:**
```typescript
deleteProfile: async () => {
  set({ isLoadingProfile: true })

  try {
    await window.electron.ipcRenderer.invoke('PROFILE_DELETE')

    // Store komplett zurücksetzen
    set({
      profile: null,
      skills: [],
      preferences: null,
      profileError: null,
      skillsError: null,
      preferencesError: null
    })
  } catch (error) {
    set({ profileError: error.message })
  } finally {
    set({ isLoadingProfile: false })
  }
}
```

---

### Task 1.9: UI - Delete Button + Confirmation Dialog (1h)

**Datei:** [src/renderer/pages/Profile.tsx](src/renderer/pages/Profile.tsx)

**Features:**
1. **Delete-Button** in AppBar (nur wenn Profil existiert)
2. **Material-UI Dialog** mit:
   - Warnung: "Alle Daten (Profil, Skills, Preferences) werden gelöscht!"
   - Zweistufige Bestätigung:
     - Checkbox: "Ich verstehe, dass dies nicht rückgängig gemacht werden kann"
     - Button erst aktiv wenn Checkbox gecheckt
3. **Nach Löschung:** Snackbar "Profil gelöscht" + Reload der Seite

**UI-Mockup:**
```
┌────────────────────────────────────┐
│ ⚠ Profil löschen                   │
├────────────────────────────────────┤
│ WARNUNG: Diese Aktion löscht:     │
│ • Dein Profil (Name, Email, etc.) │
│ • Alle Skills (X gespeichert)     │
│ • Alle Präferenzen                │
│                                    │
│ ☐ Ich verstehe, dass dies nicht   │
│   rückgängig gemacht werden kann  │
│                                    │
│ [Abbrechen]  [LÖSCHEN] (disabled) │
└────────────────────────────────────┘
```

---

### Task 1.10: Manueller Test (15 Min)

**Testschritte:**
1. Profil erstellen mit 5 Skills und Preferences
2. Delete-Button klicken
3. Checkbox NICHT anklicken → Löschen-Button disabled ✓
4. Checkbox anklicken → Löschen-Button enabled ✓
5. Löschen → Bestätigen
6. Verify: Profil-Seite zeigt "Erstelle dein Profil"
7. Verify DB: `sqlite3 data/app.db "SELECT COUNT(*) FROM user_profile"` → 0

**✅ Erfolgskriterium:** Profil-Löschung funktioniert sicher

---

## ✅ Ende Freitag - Checkpoint

**Was erreicht:**
- [x] TypeScript-Fehler behoben
- [x] Feature 001 zu 100% fertig
  - [x] T011B: Store-Integration (3 Komponenten)
  - [x] T017: Delete Profile
- [x] App kompiliert und startet
- [x] Manueller Test erfolgreich

**Was funktioniert jetzt:**
- Profil erstellen (auto-save)
- Skills verwalten (max 500, mit Kategorien)
- Präferenzen setzen (Remote-Range, Salary, etc.)
- Profil löschen (mit Sicherheitsabfrage)

**Nächster Tag:** Feature 005 UI (Job-Management)

---

# 📅 SAMSTAG (06.12.2025) - 8 Stunden

**Hauptziel:** Feature 005 UI komplett (Job-Eingabe, Liste, Detail)

## Block 1: Job-Eingabe mit AI-Extraktion (3h)

### Task 2.1: Zustand Store für Jobs erstellen (45 Min)

**Datei:** [src/renderer/store/jobStore.ts](src/renderer/store/jobStore.ts) **(NEU)**

**State-Structure:**
```typescript
interface JobState {
  // Data
  jobs: JobOffer[]
  currentJob: JobOffer | null

  // Filters & Sort
  filters: JobFilters
  sortConfig: JobSortConfig
  pagination: { page: number; limit: number; total: number }

  // UI State
  isLoading: boolean
  error: string | null

  // Actions
  fetchJobs: (filters?, sort?, pagination?) => Promise<void>
  getJobById: (id: number) => Promise<void>
  createJob: (data: Partial<JobOffer>) => Promise<JobOffer>
  updateJob: (id: number, data: Partial<JobOffer>) => Promise<void>
  deleteJob: (id: number) => Promise<void>

  // AI Extraction
  extractJobFromText: (text: string) => Promise<AIExtractionResult>

  // Filters
  setFilters: (filters: JobFilters) => void
  resetFilters: () => void
}
```

**Backend bereits fertig:**
- IPC Channels: `getJobs`, `getJobById`, `createJob`, `updateJob`, `deleteJob`
- Service: [src/main/services/jobService.ts](src/main/services/jobService.ts) ✅
- AI Service: [src/main/services/aiExtractionService.ts](src/main/services/aiExtractionService.ts) ✅

---

### Task 2.2: JobAddPage - Paste-Textfeld (1h)

**Datei:** [src/renderer/pages/JobAdd.tsx](src/renderer/pages/JobAdd.tsx) **(NEU)**

**Step 1: Paste-View**
```tsx
<Box>
  <Typography variant="h5">Neuen Job hinzufügen</Typography>

  <TextField
    multiline
    rows={15}
    fullWidth
    placeholder="Jobbeschreibung hier einfügen (Copy-Paste)..."
    value={pastedText}
    onChange={(e) => setPastedText(e.target.value)}
  />

  <Button
    variant="contained"
    onClick={handleExtract}
    disabled={!pastedText || isExtracting}
  >
    {isExtracting ? <CircularProgress size={24} /> : 'Mit AI extrahieren'}
  </Button>
</Box>
```

**Funktion:**
```typescript
const handleExtract = async () => {
  setIsExtracting(true)

  try {
    const result = await jobStore.extractJobFromText(pastedText)

    if (result.success) {
      setExtractedData(result.fields)
      setExtractionWarnings(result.warnings)
      setStep('review') // Wechsel zu Review-Formular
    }
  } catch (error) {
    // Error-Snackbar
  } finally {
    setIsExtracting(false)
  }
}
```

---

### Task 2.3: JobAddPage - Review-Formular (1h 15 Min)

**Datei:** [src/renderer/pages/JobAdd.tsx](src/renderer/pages/JobAdd.tsx) (fortsetzung)

**Step 2: Review & Edit**
```tsx
<Box>
  <Typography variant="h6">Extrahierte Felder überprüfen</Typography>

  {extractionWarnings.length > 0 && (
    <Alert severity="warning">
      {extractionWarnings.map(w => <div key={w}>{w}</div>)}
    </Alert>
  )}

  <TextField
    label="Job Title *"
    required
    value={formData.title}
    onChange={(e) => setFormData({...formData, title: e.target.value})}
    error={!formData.title}
  />

  <TextField label="Company *" required ... />
  <TextField label="Location" ... />
  <TextField label="Remote Option" ... />
  <TextField label="Salary Range" ... />

  <FormControl required>
    <InputLabel>Job Source *</InputLabel>
    <Select value={formData.sourceId} ...>
      {sources.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
    </Select>
  </FormControl>

  <DatePicker label="Posted Date" ... />

  <Box sx={{ display: 'flex', gap: 2 }}>
    <Button onClick={() => setStep('paste')}>Zurück</Button>
    <Button
      variant="contained"
      onClick={handleSave}
      disabled={!formData.title || !formData.company || !formData.sourceId}
    >
      Job speichern
    </Button>
  </Box>
</Box>
```

**Validierung:**
- Title: Pflicht
- Company: Pflicht
- Source: Pflicht
- Alle anderen: Optional

**Save-Funktion:**
```typescript
const handleSave = async () => {
  try {
    await jobStore.createJob({
      ...formData,
      fullText: pastedText, // Original-Text speichern
      importMethod: 'ai_paste'
    })

    // Snackbar: "Job erfolgreich erstellt"
    navigate('/jobs') // Zurück zur Liste
  } catch (error) {
    // Error-Snackbar
  }
}
```

**✅ Erfolgskriterium:** Job per Copy-Paste + AI-Extraktion erstellen funktioniert

---

## Block 2: Job-Liste mit Filterung (3h)

### Task 2.4: JobListPage - Tabellen-View (1h 30 Min)

**Datei:** [src/renderer/pages/JobList.tsx](src/renderer/pages/JobList.tsx) **(NEU)**

**Features:**
1. **Material-UI Table** mit Spalten:
   - Title (klickbar → Detail)
   - Company
   - Source (Name, nicht ID)
   - Posted Date (formatiert: "vor 3 Tagen")
   - Status (Badge mit Farbe)
   - Match Score (Progress-Bar oder Badge)
   - Actions (Edit, Delete Icons)

2. **Pagination:**
   ```tsx
   <TablePagination
     count={pagination.total}
     page={pagination.page}
     rowsPerPage={pagination.limit}
     onPageChange={handlePageChange}
   />
   ```

3. **Row-Click → Navigation:**
   ```tsx
   <TableRow
     hover
     onClick={() => navigate(`/jobs/${job.id}`)}
     sx={{ cursor: 'pointer' }}
   >
   ```

4. **Loading-State:** Skeleton-Rows während `isLoading`

**Daten laden:**
```typescript
useEffect(() => {
  jobStore.fetchJobs(filters, sortConfig, pagination)
}, [filters, sortConfig, pagination.page])
```

---

### Task 2.5: JobListPage - Filter-Panel (1h)

**Datei:** [src/renderer/pages/JobList.tsx](src/renderer/pages/JobList.tsx) (fortsetzung)

**Filter-UI (Drawer oder Accordion):**
```tsx
<Box sx={{ p: 2 }}>
  <Typography variant="h6">Filter</Typography>

  <FormControl fullWidth>
    <InputLabel>Job Source</InputLabel>
    <Select
      value={filters.sourceId || ''}
      onChange={(e) => handleFilterChange('sourceId', e.target.value)}
    >
      <MenuItem value="">Alle</MenuItem>
      {sources.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
    </Select>
  </FormControl>

  <FormControl fullWidth>
    <InputLabel>Status</InputLabel>
    <Select value={filters.status || ''} ...>
      <MenuItem value="">Alle</MenuItem>
      <MenuItem value="new">Neu</MenuItem>
      <MenuItem value="interesting">Interessant</MenuItem>
      <MenuItem value="applied">Beworben</MenuItem>
      <MenuItem value="rejected">Abgelehnt</MenuItem>
    </Select>
  </FormControl>

  <DatePicker
    label="Posted ab"
    value={filters.postedDateFrom}
    onChange={(date) => handleFilterChange('postedDateFrom', date)}
  />

  <DatePicker
    label="Posted bis"
    value={filters.postedDateTo}
    onChange={(date) => handleFilterChange('postedDateTo', date)}
  />

  <TextField
    type="number"
    label="Min. Match Score (%)"
    value={filters.matchScoreMin || ''}
    onChange={(e) => handleFilterChange('matchScoreMin', e.target.value)}
  />

  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
    <Button variant="contained" onClick={applyFilters}>Anwenden</Button>
    <Button onClick={resetFilters}>Zurücksetzen</Button>
  </Box>
</Box>
```

**Filter-State:**
```typescript
const applyFilters = () => {
  jobStore.setFilters(localFilters)
  // fetchJobs wird automatisch durch useEffect getriggert
}

const resetFilters = () => {
  jobStore.resetFilters()
  setLocalFilters({})
}
```

---

### Task 2.6: Navigation & Routing (30 Min)

**Dateien:**
- [src/renderer/components/Sidebar.tsx](src/renderer/components/Sidebar.tsx)
- [src/renderer/App.tsx](src/renderer/App.tsx)

**Sidebar erweitern:**
```tsx
<ListItem button onClick={() => navigate('/jobs')}>
  <ListItemIcon><WorkIcon /></ListItemIcon>
  <ListItemText primary="Jobs" />
</ListItem>

<ListItem button onClick={() => navigate('/jobs/add')}>
  <ListItemIcon><AddIcon /></ListItemIcon>
  <ListItemText primary="Job hinzufügen" />
</ListItem>
```

**App.tsx - Routes:**
```tsx
<Routes>
  <Route path="/" element={<Dashboard />} />
  <Route path="/profile" element={<Profile />} />
  <Route path="/jobs" element={<JobList />} />
  <Route path="/jobs/add" element={<JobAdd />} />
  <Route path="/jobs/:id" element={<JobDetail />} />
  <Route path="/settings" element={<Settings />} />
</Routes>
```

**✅ Erfolgskriterium:** Job-Liste zeigt alle Jobs, Filter funktionieren

---

## Block 3: Job-Detail-Ansicht (2h)

### Task 2.7: JobDetailPage - Basis-Layout (1h)

**Datei:** [src/renderer/pages/JobDetail.tsx](src/renderer/pages/JobDetail.tsx) **(NEU)**

**Layout:**
```tsx
function JobDetail() {
  const { id } = useParams()
  const job = useJobStore(state => state.currentJob)

  useEffect(() => {
    jobStore.getJobById(Number(id))
  }, [id])

  if (!job) return <CircularProgress />

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="h4">{job.title}</Typography>

        <Box>
          <IconButton onClick={handleEdit}><EditIcon /></IconButton>
          <IconButton onClick={handleDelete}><DeleteIcon /></IconButton>
        </Box>
      </Box>

      {/* Metadata Grid */}
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Typography variant="subtitle2">Firma</Typography>
          <Typography>{job.company}</Typography>
        </Grid>

        <Grid item xs={6}>
          <Typography variant="subtitle2">Quelle</Typography>
          <Typography>{job.sourceName}</Typography>
        </Grid>

        <Grid item xs={6}>
          <Typography variant="subtitle2">Standort</Typography>
          <Typography>{job.location || 'Nicht angegeben'}</Typography>
        </Grid>

        <Grid item xs={6}>
          <Typography variant="subtitle2">Remote</Typography>
          <Typography>{job.remoteOption || 'Nicht angegeben'}</Typography>
        </Grid>

        <Grid item xs={6}>
          <Typography variant="subtitle2">Gehalt</Typography>
          <Typography>{job.salaryRange || 'Nicht angegeben'}</Typography>
        </Grid>

        <Grid item xs={6}>
          <Typography variant="subtitle2">Posted</Typography>
          <Typography>{formatDate(job.postedDate)}</Typography>
        </Grid>
      </Grid>

      {/* Status-Änderung */}
      <FormControl fullWidth sx={{ mt: 2 }}>
        <InputLabel>Status</InputLabel>
        <Select
          value={job.status}
          onChange={(e) => handleStatusChange(e.target.value)}
        >
          <MenuItem value="new">Neu</MenuItem>
          <MenuItem value="interesting">Interessant</MenuItem>
          <MenuItem value="applied">Beworben</MenuItem>
          <MenuItem value="rejected">Abgelehnt</MenuItem>
          <MenuItem value="archived">Archiviert</MenuItem>
        </Select>
      </FormControl>

      {/* Full Text */}
      <Paper sx={{ mt: 2, p: 2 }}>
        <Typography variant="h6">Jobbeschreibung</Typography>
        <Typography sx={{ whiteSpace: 'pre-wrap', mt: 1 }}>
          {job.fullText || 'Keine Beschreibung vorhanden'}
        </Typography>
      </Paper>

      {/* URL */}
      {job.url && (
        <Button
          startIcon={<OpenInNewIcon />}
          onClick={() => window.open(job.url, '_blank')}
        >
          Zur Original-Anzeige
        </Button>
      )}
    </Box>
  )
}
```

**Status-Change:**
```typescript
const handleStatusChange = async (newStatus: JobStatus) => {
  await jobStore.updateJob(job.id, { status: newStatus })
  // Snackbar: "Status aktualisiert"
}
```

---

### Task 2.8: JobDetailPage - Notes-Sektion (30 Min)

**Datei:** [src/renderer/pages/JobDetail.tsx](src/renderer/pages/JobDetail.tsx) (fortsetzung)

**Notes-Bereich:**
```tsx
<Paper sx={{ mt: 2, p: 2 }}>
  <Typography variant="h6">Notizen</Typography>

  <TextField
    multiline
    rows={4}
    fullWidth
    placeholder="Deine Notizen zu diesem Job..."
    value={notes}
    onChange={handleNotesChange}
    sx={{ mt: 1 }}
  />

  <Typography variant="caption" color="text.secondary">
    Automatisches Speichern nach 2 Sekunden Inaktivität
  </Typography>
</Paper>
```

**Auto-Save mit Debounce:**
```typescript
const [notes, setNotes] = useState(job.notes || '')
const debouncedNotes = useDebounce(notes, 2000)

useEffect(() => {
  if (debouncedNotes !== job.notes) {
    jobStore.updateJob(job.id, { notes: debouncedNotes })
  }
}, [debouncedNotes])

const handleNotesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  setNotes(e.target.value)
}
```

**Debounce-Hook (falls nicht vorhanden):**
```typescript
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}
```

---

### Task 2.9: Manueller End-to-End Test (30 Min)

**Testschritte:**

1. **Job erstellen via AI-Paste:**
   - Navigiere zu "Job hinzufügen"
   - Paste Beispiel-Jobbeschreibung (vorbereiten!)
   - Klick "Mit AI extrahieren"
   - Verify: Felder werden gefüllt
   - Korrigiere ggf. Fehler
   - Speichern

2. **Zweiten Job manuell erstellen:**
   - Navigiere zu "Job hinzufügen"
   - Paste anderen Job
   - AI-Extraktion
   - Speichern

3. **Dritten Job erstellen (Fehlerfall testen):**
   - Paste nur "Hallo Welt" (unvollständige Daten)
   - Verify: AI zeigt Warnings
   - Felder manuell ausfüllen
   - Speichern

4. **Job-Liste testen:**
   - Navigiere zu "Jobs"
   - Verify: 3 Jobs sichtbar
   - Sortierung ändern (nach Datum, Company)
   - Filter: Status = "new" → nur neue Jobs

5. **Job-Detail testen:**
   - Klick auf ersten Job
   - Status ändern: "new" → "interesting"
   - Notiz hinzufügen: "Sehr interessant, bewerben!"
   - Warte 3 Sekunden (Auto-Save)
   - Zurück zur Liste
   - Wieder zum Job → Verify Notiz gespeichert

6. **Job löschen:**
   - Delete-Icon klicken
   - Bestätigen
   - Verify: Job verschwindet aus Liste

**✅ Erfolgskriterium:** Jobs können erstellt, angezeigt, gefiltert, bearbeitet und gelöscht werden

---

## ✅ Ende Samstag - Checkpoint

**Was erreicht:**
- [x] Job-Eingabe via Copy-Paste + AI-Extraktion
- [x] Job-Liste mit Filterung und Sortierung
- [x] Job-Detail-Ansicht mit Status und Notes
- [x] Komplettes CRUD für Jobs funktioniert

**Was funktioniert jetzt:**
- Jobs per AI-Paste erstellen
- Jobs filtern (Source, Status, Date, Score)
- Job-Details ansehen und bearbeiten
- Status-Änderung (New → Interesting → Applied)
- Notes mit Auto-Save

**Nächster Tag:** Matching-Feature + Polish

---

# 📅 SONNTAG (07.12.2025) - 8 Stunden

**Hauptziel:** AI-Matching funktionsfähig + App-Polish

---

## ⚠️ WICHTIG: GIT WORKFLOW AB JETZT

**🚨 NIEMALS mehr direkt auf `main` pushen! 🚨**

**Korrekt Workflow ab Montag:**
1. Feature Branch erstellen: `git checkout -b feature/name`
2. Änderungen committen
3. Branch pushen: `git push origin feature/name`
4. Pull Request auf GitHub erstellen
5. Code Rabbit Review abwarten
6. PR mergen nach Approval

**Hinweis:** Sonntag Block 1 wurde ausnahmsweise direkt auf `main` gepusht (keine Code Rabbit Review). Dies war ein Fehler und darf NICHT wiederholt werden!

---

## ✅ Block 1: Matching-Feature + First-Run Dialog (ERLEDIGT)

**Status:** Komplett implementiert und getestet ✅
**Zeit:** ~6 Stunden (inkl. E2E Testing & Bug Fixes)
**Commits:**

- `feat: Implement Sunday Block 1 - Matching Feature & First-Run Dialog` (1d2578f)
- `Fix: E2E testing bug fixes - Profile, Jobs, Sorting, and Routing` (43195c9)

**Implementierte Features:**

- ✅ Backend Matching Service (`matchingService.ts`)
  - Claude API Integration (Anthropic SDK)
  - Job-Profil-Matching mit detaillierter Gap-Analyse
  - Persistierung in `matching_results` Tabelle
  - Matching History Support

- ✅ Frontend Matching UI in JobDetail
  - Matching-Button & "Erneut matchen" Funktionalität
  - Score-Badge mit Farbcodierung (rot/orange/grün)
  - Detaillierte Skill-Gap-Tabelle
  - Experience-Gaps Anzeige
  - AI-Empfehlungen & Reasoning (collapsible)

- ✅ First-Run Dialog mit Guided Setup
  - Automatische Erkennung: Kein Profil vorhanden
  - 3-Step Setup: Profil → Skills → API-Key
  - Blockiert App-Nutzung bis Setup komplett

**E2E Testing & Bug Fixes (8 kritische Bugs behoben):**

1. Profile Loading Bug - Loading blockierte unnötig
2. Danger Zone Placement - Erschien auf allen Tabs
3. Skills Delete Button - Immer disabled
4. JobList Sorting - Funktionierte nicht
5. Backend Sort Parameters - Fehlende Unterstützung
6. JobStore fetchJobs - Parameter-Mismatch
7. Job Edit Route - 404 Fehler
8. JobAdd State Reset - Form behielt Daten

**Testing Coverage:**

- ✅ Dashboard Navigation
- ✅ Profile CRUD (Personal Info, Skills, Preferences)
- ✅ Job List (Sortierung, Filterung)
- ✅ Job Add mit AI Extraction
- ✅ Job Edit Funktionalität
- ✅ Job Details mit Matching
- ✅ Settings API-Key Management

---

### Task 3.1: Matching-Service erstellen ✅ ERLEDIGT

**Datei:** [src/main/services/matchingService.ts](src/main/services/matchingService.ts) **(NEU)**

**Service-Struktur:**
```typescript
import Anthropic from '@anthropic-ai/sdk'
import { getDatabase } from '../database/db'

interface MatchingResult {
  matchScore: number
  matchCategory: 'perfect' | 'good' | 'needs_work' | 'poor'
  strengths: string[]
  gaps: {
    missingSkills: Array<{
      skill: string
      requiredLevel: number
      currentLevel: number
      gap: number
    }>
    experienceGaps: Array<{
      area: string
      requiredYears: number
      actualYears: number
    }>
  }
  recommendations: string[]
  reasoning: string
}

export async function matchJob(jobId: number, apiKey: string): Promise<MatchingResult> {
  const db = getDatabase()

  // 1. Load User Profile
  const profile = db.prepare('SELECT * FROM user_profile LIMIT 1').get()
  const skills = db.prepare('SELECT * FROM skills').all()
  const preferences = db.prepare('SELECT * FROM user_preferences LIMIT 1').get()

  // 2. Load Job
  const job = db.prepare('SELECT * FROM job_offers WHERE id = ?').get(jobId)

  // 3. Construct Prompt
  const prompt = buildMatchingPrompt(profile, skills, preferences, job)

  // 4. Call Claude API
  const client = new Anthropic({ apiKey })

  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: prompt
    }]
  })

  // 5. Parse Response
  const result = parseMatchingResponse(response.content[0].text)

  // 6. Save to matching_results table
  db.prepare(`
    INSERT INTO matching_results (
      job_id, match_score, match_category, strengths_json,
      gaps_json, recommendations_json, reasoning, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    jobId,
    result.matchScore,
    result.matchCategory,
    JSON.stringify(result.strengths),
    JSON.stringify(result.gaps),
    JSON.stringify(result.recommendations),
    result.reasoning
  )

  return result
}

function buildMatchingPrompt(profile, skills, preferences, job): string {
  return `Du bist ein Experte für Job-Matching. Analysiere, wie gut das folgende Jobprofil zum Kandidatenprofil passt.

**Kandidaten-Profil:**
Name: ${profile.first_name} ${profile.last_name}
Email: ${profile.email}
Standort: ${profile.location}

**Skills (${skills.length}):**
${skills.map(s => `- ${s.name} (Level ${s.level}/10, ${s.years_experience} Jahre, Kategorie: ${s.category})`).join('\n')}

**Präferenzen:**
- Gehalt: ${preferences.min_salary}€ - ${preferences.max_salary}€
- Remote: ${preferences.remote_work_preference} (${preferences.preferred_remote_percentage}%)
- Standorte: ${preferences.locations?.join(', ')}
- Vertragsarten: ${preferences.employment_types?.join(', ')}

**Job-Angebot:**
Titel: ${job.title}
Firma: ${job.company}
Standort: ${job.location}
Remote: ${job.remote_option}
Gehalt: ${job.salary_range}

Beschreibung:
${job.full_text}

---

**Aufgabe:**
Gib eine strukturierte Analyse als JSON zurück mit folgenden Feldern:

{
  "match_score": <0-100>,
  "match_category": "perfect" | "good" | "needs_work" | "poor",
  "strengths": ["Stärke 1", "Stärke 2", ...],
  "gaps": {
    "missing_skills": [
      {"skill": "AWS", "required_level": 7, "current_level": 3, "gap": 4}
    ],
    "experience_gaps": [
      {"area": "Team Lead", "required_years": 2, "actual_years": 0}
    ]
  },
  "recommendations": ["Empfehlung 1", "Empfehlung 2", ...],
  "reasoning": "Begründung des Scores in 2-3 Sätzen"
}

**Bewertungskriterien:**
- Skills-Match (40%)
- Gehalts-Match (20%)
- Standort/Remote-Match (20%)
- Erfahrungs-Match (20%)

Antworte NUR mit dem JSON-Objekt, ohne zusätzlichen Text.`
}

function parseMatchingResponse(text: string): MatchingResult {
  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = text.match(/```json\n?(.*?)\n?```/s) || text.match(/\{.*\}/s)

  if (!jsonMatch) {
    throw new Error('Failed to parse AI response as JSON')
  }

  const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0])

  return {
    matchScore: parsed.match_score,
    matchCategory: parsed.match_category,
    strengths: parsed.strengths,
    gaps: {
      missingSkills: parsed.gaps.missing_skills || [],
      experienceGaps: parsed.gaps.experience_gaps || []
    },
    recommendations: parsed.recommendations,
    reasoning: parsed.reasoning
  }
}
```

---

### Task 3.2: IPC Handler für MATCH_JOB (30 Min)

**Datei:** [src/main/ipc/handlers.ts](src/main/ipc/handlers.ts)

**Handler hinzufügen:**
```typescript
import * as matchingService from '../services/matchingService'
import Store from 'electron-store'

const store = new Store()

ipcMain.handle('matchJob', async (_, jobId: number) => {
  try {
    // API-Key aus electron-store laden
    const apiKey = store.get('anthropic_api_key') as string

    if (!apiKey) {
      throw new Error('Anthropic API-Key nicht konfiguriert. Bitte in Einstellungen hinterlegen.')
    }

    const result = await matchingService.matchJob(jobId, apiKey)

    return { success: true, data: result }
  } catch (error: any) {
    log.error('Error in matchJob:', error)
    throw error
  }
})

// Matching-Historie abrufen
ipcMain.handle('getMatchingHistory', async (_, jobId: number) => {
  const db = getDatabase()

  const history = db.prepare(`
    SELECT * FROM matching_results
    WHERE job_id = ?
    ORDER BY created_at DESC
  `).all(jobId)

  return history.map(h => ({
    ...h,
    strengths: JSON.parse(h.strengths_json),
    gaps: JSON.parse(h.gaps_json),
    recommendations: JSON.parse(h.recommendations_json)
  }))
})
```

---

### Task 3.3: JobStore erweitern - Matching Actions (15 Min)

**Datei:** [src/renderer/store/jobStore.ts](src/renderer/store/jobStore.ts)

**State erweitern:**
```typescript
interface JobState {
  // ... existing state

  // Matching
  currentMatching: MatchingResult | null
  matchingHistory: MatchingResult[]
  isMatching: boolean
  matchingError: string | null

  // Actions
  matchJob: (jobId: number) => Promise<MatchingResult>
  getMatchingHistory: (jobId: number) => Promise<void>
}
```

**Actions implementieren:**
```typescript
matchJob: async (jobId) => {
  set({ isMatching: true, matchingError: null })

  try {
    const result = await window.electron.ipcRenderer.invoke('matchJob', jobId)

    if (result.success) {
      set({ currentMatching: result.data })
      return result.data
    } else {
      throw new Error('Matching failed')
    }
  } catch (error: any) {
    set({ matchingError: error.message })
    throw error
  } finally {
    set({ isMatching: false })
  }
},

getMatchingHistory: async (jobId) => {
  try {
    const history = await window.electron.ipcRenderer.invoke('getMatchingHistory', jobId)
    set({ matchingHistory: history })
  } catch (error: any) {
    console.error('Failed to load matching history:', error)
  }
}
```

---

### Task 3.4: JobDetail - Match-Button hinzufügen (30 Min)

**Datei:** [src/renderer/pages/JobDetail.tsx](src/renderer/pages/JobDetail.tsx)

**Match-Button:**
```tsx
<Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
  <Button
    variant="contained"
    color="primary"
    size="large"
    onClick={handleMatch}
    disabled={isMatching}
    startIcon={isMatching ? <CircularProgress size={20} /> : <AutoAwesomeIcon />}
  >
    {isMatching ? 'Matching läuft...' : 'Job matchen'}
  </Button>

  {currentMatching && (
    <Button
      variant="outlined"
      onClick={handleReMatch}
      startIcon={<RefreshIcon />}
    >
      Erneut matchen
    </Button>
  )}
</Box>

{matchingError && (
  <Alert severity="error" sx={{ mt: 2 }}>
    {matchingError}
  </Alert>
)}
```

**Handler:**
```typescript
const isMatching = useJobStore(state => state.isMatching)
const matchingError = useJobStore(state => state.matchingError)
const currentMatching = useJobStore(state => state.currentMatching)

const handleMatch = async () => {
  try {
    await jobStore.matchJob(job.id)
    // Snackbar: "Matching erfolgreich!"
  } catch (error) {
    // Error wird in Store gesetzt, Alert zeigt ihn an
  }
}

const handleReMatch = () => {
  if (confirm('Erneutes Matching kostet zusätzliche API-Tokens. Fortfahren?')) {
    handleMatch()
  }
}
```

---

### Task 3.5: JobDetail - Matching-Ergebnis-Anzeige (1h 30 Min)

**Datei:** [src/renderer/pages/JobDetail.tsx](src/renderer/pages/JobDetail.tsx)

**Ergebnis-Komponente:**
```tsx
{currentMatching && (
  <Paper sx={{ mt: 3, p: 3 }}>
    <Typography variant="h5" gutterBottom>
      Matching-Ergebnis
    </Typography>

    {/* Score-Badge */}
    <Box sx={{ textAlign: 'center', my: 3 }}>
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 120,
          height: 120,
          borderRadius: '50%',
          bgcolor: getScoreColor(currentMatching.matchScore),
          color: 'white',
          fontSize: '2.5rem',
          fontWeight: 'bold'
        }}
      >
        {currentMatching.matchScore}%
      </Box>

      <Chip
        label={getCategoryLabel(currentMatching.matchCategory)}
        color={getCategoryColor(currentMatching.matchCategory)}
        size="large"
        sx={{ mt: 1 }}
      />
    </Box>

    {/* Strengths */}
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        ✓ Stärken
      </Typography>
      <List>
        {currentMatching.strengths.map((strength, idx) => (
          <ListItem key={idx}>
            <ListItemIcon><CheckCircleIcon color="success" /></ListItemIcon>
            <ListItemText primary={strength} />
          </ListItem>
        ))}
      </List>
    </Box>

    {/* Gaps */}
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        ⚠ Skill-Lücken
      </Typography>

      {currentMatching.gaps.missingSkills.length === 0 ? (
        <Typography color="text.secondary">Keine Skill-Lücken identifiziert</Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Skill</TableCell>
                <TableCell align="center">Benötigt</TableCell>
                <TableCell align="center">Du hast</TableCell>
                <TableCell align="center">Lücke</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {currentMatching.gaps.missingSkills.map((gap, idx) => (
                <TableRow key={idx}>
                  <TableCell>{gap.skill}</TableCell>
                  <TableCell align="center">{gap.requiredLevel}/10</TableCell>
                  <TableCell align="center">{gap.currentLevel}/10</TableCell>
                  <TableCell align="center">
                    <Chip
                      label={`${gap.gap} Levels`}
                      color={gap.gap > 5 ? 'error' : 'warning'}
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {currentMatching.gaps.experienceGaps.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>Erfahrungs-Lücken:</Typography>
          <List dense>
            {currentMatching.gaps.experienceGaps.map((gap, idx) => (
              <ListItem key={idx}>
                <ListItemText
                  primary={gap.area}
                  secondary={`Benötigt: ${gap.requiredYears} Jahre, Du hast: ${gap.actualYears} Jahre`}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Box>

    {/* Recommendations */}
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        💡 Empfehlungen
      </Typography>
      <List>
        {currentMatching.recommendations.map((rec, idx) => (
          <ListItem key={idx}>
            <ListItemIcon><LightbulbIcon color="primary" /></ListItemIcon>
            <ListItemText primary={rec} />
          </ListItem>
        ))}
      </List>
    </Box>

    {/* AI Reasoning (Collapsible) */}
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography>AI-Begründung anzeigen</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Typography>{currentMatching.reasoning}</Typography>
      </AccordionDetails>
    </Accordion>
  </Paper>
)}
```

**Helper-Funktionen:**
```typescript
function getScoreColor(score: number): string {
  if (score >= 70) return '#4caf50' // green
  if (score >= 40) return '#ff9800' // orange
  return '#f44336' // red
}

function getCategoryLabel(category: string): string {
  const labels = {
    perfect: 'Perfekter Match',
    good: 'Guter Fit',
    needs_work: 'Lücken schließbar',
    poor: 'Schwacher Match'
  }
  return labels[category] || category
}

function getCategoryColor(category: string): any {
  const colors = {
    perfect: 'success',
    good: 'success',
    needs_work: 'warning',
    poor: 'error'
  }
  return colors[category] || 'default'
}
```

---

### Task 3.6: Matching-History anzeigen (45 Min)

**Datei:** [src/renderer/pages/JobDetail.tsx](src/renderer/pages/JobDetail.tsx)

**History-Komponente:**
```tsx
{matchingHistory.length > 0 && (
  <Paper sx={{ mt: 2, p: 2 }}>
    <Typography variant="h6" gutterBottom>
      Matching-Historie
    </Typography>

    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Datum</TableCell>
            <TableCell align="center">Score</TableCell>
            <TableCell>Kategorie</TableCell>
            <TableCell align="right">Aktionen</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {matchingHistory.map((match) => (
            <TableRow key={match.id} hover>
              <TableCell>{formatDateTime(match.createdAt)}</TableCell>
              <TableCell align="center">
                <Chip label={`${match.matchScore}%`} size="small" />
              </TableCell>
              <TableCell>{getCategoryLabel(match.matchCategory)}</TableCell>
              <TableCell align="right">
                <IconButton
                  size="small"
                  onClick={() => setSelectedHistoryMatch(match)}
                >
                  <VisibilityIcon />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  </Paper>
)}

{/* History-Detail-Dialog */}
<Dialog
  open={!!selectedHistoryMatch}
  onClose={() => setSelectedHistoryMatch(null)}
  maxWidth="md"
  fullWidth
>
  <DialogTitle>Matching vom {formatDateTime(selectedHistoryMatch?.createdAt)}</DialogTitle>
  <DialogContent>
    {/* Render same matching result as above, but with selectedHistoryMatch data */}
  </DialogContent>
</Dialog>
```

**Load History on Mount:**
```typescript
useEffect(() => {
  if (job?.id) {
    jobStore.getMatchingHistory(job.id)
  }
}, [job?.id])
```

**✅ Erfolgskriterium:** Matching funktioniert, Ergebnis wird angezeigt, History verfügbar

---

## 🔄 Block 2: UI-Verbesserungen (verschoben auf Montag)

**Status:** Verschoben auf Montag (Task 3.9)
**Grund:** Block 1 inkl. E2E Testing & Bug Fixes dauerte länger als geplant

**Geplante Tasks für Montag:**

- Dashboard Stats & Charts
- JobList erweiterte Filterung
- Animationen & Transitions
- Responsive Design Optimierungen

**⚠️ WICHTIG: Als Pull Request umsetzen!**

```bash
# Montag starten mit:
git checkout -b feature/ui-improvements
# ... Änderungen machen ...
git push origin feature/ui-improvements
# PR erstellen, Code Rabbit reviewt, dann mergen
```

---

## ~~Block 2: Settings & API-Key~~ ✅ ERLEDIGT (Teil von Block 1)

### Task 3.7: Settings-Page - API-Key-Input ✅ ERLEDIGT

**Datei:** [src/renderer/pages/Settings.tsx](src/renderer/pages/Settings.tsx)

**Erweitern:**
```tsx
function Settings() {
  const [apiKey, setApiKey] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<'success' | 'error' | null>(null)

  useEffect(() => {
    // Load existing API key (masked)
    window.electron.ipcRenderer.invoke('getApiKey').then(key => {
      if (key) setApiKey('•'.repeat(20)) // Masked display
    })
  }, [])

  const handleSave = async () => {
    try {
      await window.electron.ipcRenderer.invoke('saveApiKey', apiKey)
      // Snackbar: "API-Key gespeichert"
    } catch (error) {
      // Error-Snackbar
    }
  }

  const handleVerify = async () => {
    setIsVerifying(true)
    setVerifyResult(null)

    try {
      const result = await window.electron.ipcRenderer.invoke('verifyApiKey', apiKey)
      setVerifyResult(result.success ? 'success' : 'error')
    } catch (error) {
      setVerifyResult('error')
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Einstellungen</Typography>

      <Paper sx={{ p: 3, mt: 2 }}>
        <Typography variant="h6" gutterBottom>
          Anthropic API-Key
        </Typography>

        <Typography variant="body2" color="text.secondary" gutterBottom>
          Benötigt für AI-Matching und Job-Extraktion.
          Erhältlich auf: <Link href="https://console.anthropic.com" target="_blank">console.anthropic.com</Link>
        </Typography>

        <TextField
          fullWidth
          type="password"
          label="API-Key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-..."
          sx={{ mt: 2 }}
        />

        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!apiKey}
          >
            Speichern
          </Button>

          <Button
            variant="outlined"
            onClick={handleVerify}
            disabled={!apiKey || isVerifying}
          >
            {isVerifying ? <CircularProgress size={20} /> : 'Testen'}
          </Button>
        </Box>

        {verifyResult === 'success' && (
          <Alert severity="success" sx={{ mt: 2 }}>
            API-Key ist gültig! ✓
          </Alert>
        )}

        {verifyResult === 'error' && (
          <Alert severity="error" sx={{ mt: 2 }}>
            API-Key ungültig oder Verbindungsfehler.
          </Alert>
        )}
      </Paper>
    </Box>
  )
}
```

**IPC Handler hinzufügen:**
```typescript
// handlers.ts
import Store from 'electron-store'
const store = new Store()

ipcMain.handle('saveApiKey', async (_, apiKey: string) => {
  store.set('anthropic_api_key', apiKey)
  return { success: true }
})

ipcMain.handle('getApiKey', async () => {
  return store.get('anthropic_api_key', null)
})

ipcMain.handle('verifyApiKey', async (_, apiKey: string) => {
  try {
    const client = new Anthropic({ apiKey })

    // Mini-Test-Call
    await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }]
    })

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})
```

---

### Task 3.8: First-Run-Dialog (45 Min)

**Datei:** [src/renderer/App.tsx](src/renderer/App.tsx) oder eigene Komponente

**Dialog:**
```tsx
function FirstRunDialog() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // Check if API key is set
    window.electron.ipcRenderer.invoke('getApiKey').then(key => {
      if (!key) setOpen(true)
    })
  }, [])

  return (
    <Dialog open={open} disableEscapeKeyDown>
      <DialogTitle>Willkommen bei JobMatchChecker!</DialogTitle>
      <DialogContent>
        <Typography gutterBottom>
          Um die AI-Features nutzen zu können, benötigst du einen Anthropic API-Key.
        </Typography>

        <Typography variant="body2" color="text.secondary">
          Du kannst den Key jederzeit in den Einstellungen hinterlegen.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setOpen(false)}>Später</Button>
        <Button
          variant="contained"
          onClick={() => {
            setOpen(false)
            navigate('/settings')
          }}
        >
          Zu Einstellungen
        </Button>
      </DialogActions>
    </Dialog>
  )
}
```

**Matching ohne API-Key abfangen:**
```typescript
// In JobDetail.tsx
const handleMatch = async () => {
  const apiKey = await window.electron.ipcRenderer.invoke('getApiKey')

  if (!apiKey) {
    if (confirm('Kein API-Key hinterlegt. Zu Einstellungen?')) {
      navigate('/settings')
    }
    return
  }

  // ... normal matching
}
```

**✅ Erfolgskriterium:** API-Key-Management funktioniert, First-Run-Dialog erscheint

---

## Block 3: Polish & Testing (2h 30 Min)

### Task 3.9: UI-Verbesserungen (1h)

**Empty States:**

```tsx
// JobList.tsx - Keine Jobs
{jobs.length === 0 && !isLoading && (
  <Box sx={{ textAlign: 'center', py: 8 }}>
    <WorkOffIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
    <Typography variant="h6" gutterBottom>
      Noch keine Jobs vorhanden
    </Typography>
    <Typography color="text.secondary" gutterBottom>
      Erstelle deinen ersten Job, um zu starten!
    </Typography>
    <Button
      variant="contained"
      onClick={() => navigate('/jobs/add')}
      sx={{ mt: 2 }}
    >
      Job hinzufügen
    </Button>
  </Box>
)}

// Profile.tsx - Kein Profil
{!profile && !isLoading && (
  <Alert severity="info" sx={{ mb: 2 }}>
    Erstelle zunächst dein Profil, um mit dem Matching beginnen zu können.
  </Alert>
)}
```

**Loading-Skeletons:**

```tsx
// JobList.tsx
{isLoading && (
  <>
    {[1, 2, 3, 4, 5].map(i => (
      <TableRow key={i}>
        <TableCell><Skeleton width={200} /></TableCell>
        <TableCell><Skeleton width={150} /></TableCell>
        <TableCell><Skeleton width={100} /></TableCell>
        <TableCell><Skeleton width={80} /></TableCell>
        <TableCell><Skeleton width={60} /></TableCell>
      </TableRow>
    ))}
  </>
)}
```

**Error-Boundaries:**

```tsx
// src/renderer/components/ErrorBoundary.tsx (NEU)
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <ErrorIcon color="error" sx={{ fontSize: 60 }} />
          <Typography variant="h5" gutterBottom>
            Etwas ist schiefgelaufen
          </Typography>
          <Typography color="text.secondary">
            {this.state.error?.message}
          </Typography>
          <Button
            variant="contained"
            onClick={() => window.location.reload()}
            sx={{ mt: 2 }}
          >
            Neu laden
          </Button>
        </Box>
      )
    }

    return this.props.children
  }
}

// In App.tsx wrappen
<ErrorBoundary>
  <Routes>...</Routes>
</ErrorBoundary>
```

**Tooltips:**

```tsx
// Wichtige Icons mit Tooltips
<Tooltip title="Job löschen">
  <IconButton onClick={handleDelete}>
    <DeleteIcon />
  </IconButton>
</Tooltip>

<Tooltip title="Erneut matchen (kostet API-Tokens)">
  <IconButton onClick={handleReMatch}>
    <RefreshIcon />
  </IconButton>
</Tooltip>
```

---

### Task 3.10: Manuelle End-to-End Tests (1h)

**Testplan:**

**1. Setup (5 Min):**
- [ ] App starten
- [ ] First-Run-Dialog erscheint
- [ ] API-Key in Settings eintragen
- [ ] Verify-Button testen → Success

**2. Profil (10 Min):**
- [ ] Profil erstellen (Name, Email, Location)
- [ ] 10 Skills hinzufügen mit verschiedenen Kategorien
- [ ] Skill-Level-Slider testen
- [ ] Preferences setzen (Gehalt, Remote, Locations)
- [ ] Completion-Indicator prüfen → 100%
- [ ] Profil löschen → Confirmation → Verify DB leer
- [ ] Profil erneut erstellen

**3. Jobs (20 Min):**
- [ ] Job 1 via AI-Paste erstellen:
  - Text: "Senior Backend Developer bei ACME Corp, Python, Django, 60.000-80.000€, Remote 80%, Berlin"
  - Verify: Felder werden extrahiert
  - Speichern

- [ ] Job 2 erstellen (anderer Text)
- [ ] Job 3 erstellen (unvollständiger Text)
  - Verify: Warnings erscheinen
  - Felder manuell korrigieren

- [ ] Job-Liste:
  - Verify: 3 Jobs sichtbar
  - Filter: Status = "new" → funktioniert
  - Filter: Date-Range testen
  - Sortierung ändern

- [ ] Job-Detail:
  - Job 1 öffnen
  - Status ändern → "interesting"
  - Notes hinzufügen → Auto-Save testen (warten 3s)
  - Zurück → Wieder öffnen → Notes noch da

**4. Matching (15 Min):**
- [ ] Job 1 öffnen
- [ ] "Job matchen" klicken
- [ ] Warte auf Ergebnis (10-20 Sekunden)
- [ ] Verify:
  - Score angezeigt (z.B. 75%)
  - Badge (z.B. "Guter Fit")
  - Strengths-Liste gefüllt
  - Gaps-Tabelle (falls vorhanden)
  - Recommendations vorhanden
  - AI-Reasoning ausklappbar

- [ ] Re-Match testen:
  - Button klicken
  - Confirmation-Dialog → OK
  - Neues Ergebnis erscheint

- [ ] Matching-History:
  - Verify: 2 Einträge (erstes + zweites Matching)
  - Altes Matching öffnen → Verify Daten korrekt

**5. Edge Cases (10 Min):**
- [ ] Job-Detail ohne Matching öffnen → Kein Ergebnis, nur Button
- [ ] Job ohne Full-Text → Matching schlägt fehl (Error-Handling)
- [ ] API-Key löschen → Matching → Error "Kein API-Key"
- [ ] Profil löschen → Job matchen → Error "Kein Profil"

**Bugs dokumentieren:**
- Erstelle Liste mit allen gefundenen Bugs
- Priorisierung: Critical / High / Low

---

### Task 3.11: Bugfixes aus Testing (30 Min)

**Critical Bugs sofort fixen:**
- App-Crashes
- Datenverlust
- Matching funktioniert nicht

**High Bugs wenn Zeit:**
- UI-Layout-Probleme
- Validierungs-Fehler
- Fehlende Error-Messages

**Low Bugs dokumentieren:**
- In TODO.md für später

**✅ Erfolgskriterium:** Alle Critical & High Bugs gefixt, App stabil

---

## ✅ Ende Sonntag - FINALE

**Was erreicht:**
- [x] AI-Matching funktioniert
- [x] Matching-Ergebnis-Anzeige (Score, Gaps, Recommendations)
- [x] Matching-History verfügbar
- [x] API-Key-Management in Settings
- [x] First-Run-Dialog
- [x] UI-Polish (Empty States, Skeletons, Tooltips)
- [x] Manuelle Tests durchgeführt
- [x] Critical Bugs gefixt

**Die App kann jetzt:**
1. ✅ Profil erstellen mit Skills und Preferences
2. ✅ Jobs per AI-Paste hinzufügen
3. ✅ Jobs verwalten (Liste, Filter, Detail, Status, Notes)
4. ✅ Jobs mit AI matchen (Score + Gap-Analyse)
5. ✅ Matching-Ergebnisse anzeigen und Historie einsehen
6. ✅ Daten persistent speichern (SQLite + Backup-System)

---

# 🎉 MVP FERTIG!

## Was du jetzt hast:

Eine **funktionierende Desktop-App**, mit der du:
- Dein Profil verwaltest
- Jobs per Copy-Paste erfasst (AI extrahiert Felder)
- Jobs mit deinem Profil matchst (Claude AI)
- Gap-Analysen erhältst ("Dir fehlt Skill X mit Level Y")
- Empfehlungen bekommst ("Mache Kurs Z")

## Nächste Schritte (Optional, nach MVP):

**Phase 2 (wenn du weitermachen willst):**
- [ ] CSV/PDF-Export für Reports
- [ ] Dashboard mit Statistiken
- [ ] Tests reparieren/ergänzen
- [ ] LaTeX-CV-Import
- [ ] PDF-Job-Upload mit Text-Extraktion
- [ ] Matching-Prompt-Editor

---

# 📊 Zeiterfassung

| Tag | Geplant | Tatsächlich | Status |
|-----|---------|-------------|--------|
| Freitag | 6h | ___ h | ⏳ |
| Samstag | 8h | ___ h | ⏳ |
| Sonntag | 8h | ___ h | ⏳ |
| **TOTAL** | **22h** | **___ h** | ⏳ |

---

**Viel Erfolg! 🚀**

*Erstellt von Claude Code am 2025-12-04*
