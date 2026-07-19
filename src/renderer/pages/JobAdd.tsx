import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Chip,
  Divider
} from '@mui/material';
import {
  ContentPaste as PasteIcon,
  AutoAwesome as AIIcon,
  Save as SaveIcon,
  Clear as ClearIcon,
  UploadFile as UploadFileIcon
} from '@mui/icons-material';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { useJobStore } from '../store/jobStore';
import { useUnsavedChangesContext } from '../components/Layout';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';
import DuplicateWarningDialog from '../components/DuplicateWarningDialog';
import { extractUrls } from '../../shared/urlUtils';
import { formatGermanDate, formatScore } from '../../shared/formatUtils';
import type { JobDuplicateMatch, JobDuplicateCheckResult } from '../../shared/types';

/**
 * JobAdd Page - Add new job offers with AI extraction
 * Samstag Block 1 - Task 2.2
 *
 * Features:
 * - Paste job text from clipboard
 * - AI extraction via Claude
 * - Manual form editing
 * - Save to database
 * - Edit existing jobs
 */
export default function JobAdd() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();

  // Determine if we're in edit mode
  const isEditMode = !!id;

  // Unsaved changes context (Issue #12)
  const { setIsDirty, setOnSave } = useUnsavedChangesContext();

  // Store hooks
  const extractJobFromText = useJobStore(state => state.extractJobFromText);
  const createJob = useJobStore(state => state.createJob);
  const updateJob = useJobStore(state => state.updateJob);
  const getJobById = useJobStore(state => state.getJobById);
  const currentJob = useJobStore(state => state.currentJob);
  const extractionResult = useJobStore(state => state.extractionResult);
  const isExtracting = useJobStore(state => state.isExtracting);
  const isLoading = useJobStore(state => state.isLoading);
  const error = useJobStore(state => state.error);
  const clearExtractionResult = useJobStore(state => state.clearExtractionResult);

  // Local state
  const [jobText, setJobText] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false); // Prevent double-save
  const [saveSuccessful, setSaveSuccessful] = useState(false); // Track successful save for navigation
  const [fileWarning, setFileWarning] = useState<string | null>(null);

  // Dubletten-Erkennung (feat/job-duplicate-handling)
  const [dupDialogOpen, setDupDialogOpen] = useState(false);
  // Treffer, die im Dialog hervorgehoben werden (save: sicherer Treffer;
  // extract: URL-Treffer mit noch unbekanntem Titel = widersprüchlich)
  const [dupMatches, setDupMatches] = useState<JobDuplicateMatch[]>([]);
  // Mögliche Treffer aus derselben Prüfung (für den save-Kontext)
  const [dupPossible, setDupPossible] = useState<JobDuplicateMatch[]>([]);
  const [dupContext, setDupContext] = useState<'extract' | 'save'>('save');
  // Live-Hinweise im Formular (sicher + möglich), nicht blockierend
  const [formDuplicates, setFormDuplicates] = useState<JobDuplicateCheckResult | null>(null);
  // Verhindert parallele Dubletten-Checks/AI-Calls (Doppelklick, Ctrl+S/Enter)
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const dupCheckInFlightRef = useRef(false);
  // Merkt, dass die (nicht-blockierende) Widersprüchlich-Warnung beim Speichern
  // schon einmal gezeigt wurde – so hält der erste Save-Klick an (Warnung wird
  // sichtbar), der nächste speichert. Wird bei Feldänderungen zurückgesetzt.
  const conflictWarnedRef = useRef(false);

  // Form state (initialized from extraction or empty)
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    location: '',
    postedDate: '',
    description: '',
    requirements: '',
    salary_min: undefined as number | undefined,
    salary_max: undefined as number | undefined,
    remote_percentage: undefined as number | undefined,
    source: '',
    source_url: '',
    status: 'new' as const
  });

  // Track initial data to detect changes (Issue #12)
  const [initialFormData, setInitialFormData] = useState(formData);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load job data in edit mode, or reset form in add mode
  useEffect(() => {
    if (isEditMode && id) {
      // Edit mode: Load existing job
      const jobId = parseInt(id, 10);
      getJobById(jobId);
    } else {
      // Add mode: Reset form
      setJobText('');
      setShowForm(false);
      setFormData({
        title: '',
        company: '',
        location: '',
        postedDate: '',
        description: '',
        requirements: '',
        salary_min: undefined,
        salary_max: undefined,
        remote_percentage: undefined,
        source: '',
        source_url: '',
        status: 'new'
      });
      clearExtractionResult();
    }
  }, [location.pathname, isEditMode, id, getJobById, clearExtractionResult]);

  // Populate form when job is loaded (edit mode)
  useEffect(() => {
    if (isEditMode && currentJob) {
      // Map camelCase JobOffer properties to snake_case form fields
      // Format date to YYYY-MM-DD for HTML date input (using local timezone)
      const formatDateForInput = (date?: Date | null) => {
        if (!date) return '';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const loadedData = {
        title: currentJob.title || '',
        company: currentJob.company || '',
        location: currentJob.location || '',
        postedDate: formatDateForInput(currentJob.postedDate),
        description: currentJob.fullText || '',
        requirements: '',
        salary_min: undefined as number | undefined,
        salary_max: undefined as number | undefined,
        remote_percentage: undefined as number | undefined,
        source: currentJob.sourceName || '',
        source_url: currentJob.url || '',
        status: (currentJob.status || 'new') as 'new'
      };
      setShowForm(true);
      setFormData(loadedData);
      setInitialFormData(loadedData); // Track initial state (Issue #12)
      setHasUnsavedChanges(false);
    }
  }, [isEditMode, currentJob]);

  // Detect form changes (Issue #12)
  useEffect(() => {
    const hasChanges = JSON.stringify(formData) !== JSON.stringify(initialFormData);
    setHasUnsavedChanges(hasChanges);
  }, [formData, initialFormData]);

  // Sync with UnsavedChangesContext (Issue #12)
  // Don't mark as dirty if save was successful (prevents blocker during navigation)
  useEffect(() => {
    const shouldBeDirty = hasUnsavedChanges && showForm && !saveSuccessful;
    setIsDirty(shouldBeDirty);

    // Provide save action only if form is valid
    if (shouldBeDirty && formData.title && formData.company) {
      setOnSave(handleSave);
    } else {
      setOnSave(undefined);
    }
  }, [hasUnsavedChanges, showForm, saveSuccessful, formData.title, formData.company, setIsDirty, setOnSave]);

  // Drag & drop state
  const [isDragging, setIsDragging] = useState(false);

  // Check if imported content is usable (detects image-based PDFs)
  const handleImportedContent = (content: string, filename: string) => {
    setFileWarning(null);
    const isPdf = filename.toLowerCase().endsWith('.pdf');
    if (isPdf && content.trim().length < 50) {
      setFileWarning(
        'Das PDF scheint bildbasiert (gescannt) zu sein – es konnte kaum Text extrahiert werden. ' +
        'Bitte verwende stattdessen eine Markdown- oder Text-Datei.'
      );
      return;
    }
    setJobText(content);
  };

  // Handle file import via dialog
  const handleFileImport = async () => {
    try {
      const result = await window.api.jobSelectFile();
      if (!result.canceled && result.content != null) {
        handleImportedContent(result.content, result.filename || '');
      }
    } catch (err) {
      console.error('Failed to import file:', err);
    }
  };

  // Handle drag & drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['md', 'txt', 'pdf'].includes(ext || '')) {
      return;
    }

    try {
      const filePath = window.api.getFilePath(file);
      if (filePath) {
        const result = await window.api.jobReadFile(filePath);
        handleImportedContent(result.content, result.filename);
      }
    } catch (err) {
      console.error('Failed to read dropped file:', err);
    }
  };

  // Handle paste from clipboard
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setJobText(text);
    } catch (err) {
      console.error('Failed to read clipboard:', err);
    }
  };

  // Run the actual AI extraction (form auto-updates via useEffect on extractionResult)
  const runExtraction = async () => {
    try {
      await extractJobFromText(jobText);
    } catch (err) {
      console.error('Extraction failed:', err);
    }
  };

  // Handle AI extraction – prüft VOR dem API-Call auf sichere Dubletten
  // (spart Tokens): alle http(s)-URLs aus dem Rohtext extrahieren, bereinigen
  // und gegen den Bestand prüfen. Treffer bei irgendeiner URL = sicherer Verdacht.
  //
  // Ein In-flight-Guard umschließt den gesamten Check-und-Extract-Flow, damit
  // ein zweiter Klick keinen parallelen (kostenpflichtigen) AI-Call auslöst.
  const handleExtract = async () => {
    if (!jobText.trim()) {
      return;
    }
    if (dupCheckInFlightRef.current) {
      return; // bereits ein Check/Extract in Arbeit
    }

    dupCheckInFlightRef.current = true;
    setIsCheckingDuplicate(true);
    try {
      try {
        const urls = extractUrls(jobText);
        if (urls.length > 0) {
          const res = await window.api.checkJobDuplicate({ urls });
          // Ohne Titel kann es keinen "sicheren" Treffer geben – ein URL-Treffer
          // landet in `conflicting`. Vor dem (kostenpflichtigen) AI-Call einen
          // nicht-blockierenden Hinweis geben.
          const hits = res.safe ? [res.safe, ...res.conflicting] : res.conflicting;
          if (hits.length > 0) {
            setDupMatches(hits);
            setDupPossible([]);
            setDupContext('extract');
            setDupDialogOpen(true);
            return; // auf Nutzerentscheidung warten, kein API-Call
          }
        }
      } catch (err) {
        // Prüfung ist "best effort" – bei Fehler normal weiter analysieren
        console.error('Pre-AI duplicate check failed:', err);
      }

      await runExtraction();
    } finally {
      dupCheckInFlightRef.current = false;
      setIsCheckingDuplicate(false);
    }
  };

  // Sync extraction result to form
  React.useEffect(() => {
    if (extractionResult && extractionResult.success) {
      const fields = extractionResult.fields;

      // Parse salary range if available
      // Formats: "50000-70000", "50k-70k", "75.000 - 95.000", "up to 95000"
      let salaryMin: number | undefined;
      let salaryMax: number | undefined;
      if (fields.salaryRange) {
        // Remove common separators and normalize
        const normalized = fields.salaryRange.replace(/\./g, '').replace(/,/g, '');

        // Try to match a range first (e.g., "50k-70k", "50000-70000", "75000 - 95000")
        const rangeMatch = normalized.match(/(\d+)\s*k?\s*-\s*(\d+)\s*k?/i);
        if (rangeMatch) {
          const val1 = parseInt(rangeMatch[1]);
          const val2 = parseInt(rangeMatch[2]);
          // Detect if values are in thousands (e.g., "50k-70k" or "50-70")
          const multiplier = (val1 < 1000 && val2 < 1000) ? 1000 : 1;
          salaryMin = val1 * multiplier;
          salaryMax = val2 * multiplier;
        } else {
          // Try to match single value (e.g., "up to 95000" or "95000")
          const singleMatch = normalized.match(/(\d+)\s*k?/i);
          if (singleMatch) {
            const value = parseInt(singleMatch[1]);
            const multiplier = (value < 1000) ? 1000 : 1;
            const finalValue = value * multiplier;

            // If it says "up to" or "bis zu", it's a max, otherwise assume it's a rough estimate
            if (fields.salaryRange.toLowerCase().includes('up to') ||
                fields.salaryRange.toLowerCase().includes('bis zu') ||
                fields.salaryRange.toLowerCase().includes('max')) {
              salaryMax = finalValue;
            } else {
              // Single value - use as approximate midpoint, create a range ±10%
              salaryMin = Math.round(finalValue * 0.9);
              salaryMax = Math.round(finalValue * 1.1);
            }
          }
        }
      }

      // Parse remote percentage from remoteOption (e.g., "80% remote", "hybrid", "überwiegend remote")
      let remotePercentage: number | undefined;
      if (fields.remoteOption) {
        const remoteOption = fields.remoteOption.toLowerCase();
        const remoteMatch = fields.remoteOption.match(/(\d+)\s*%/);
        if (remoteMatch) {
          remotePercentage = parseInt(remoteMatch[1]);
        } else if (remoteOption.includes('100%') ||
                   remoteOption.includes('full') ||
                   remoteOption.includes('vollständig') ||
                   remoteOption.includes('komplett remote') ||
                   remoteOption.includes('fully remote')) {
          remotePercentage = 100;
        } else if (remoteOption.includes('überwiegend') ||
                   remoteOption.includes('mostly') ||
                   remoteOption.includes('größtenteils')) {
          remotePercentage = 80; // "überwiegend" = mostly = ~80%
        } else if (remoteOption.includes('hybrid') ||
                   remoteOption.includes('teilweise') ||
                   remoteOption.includes('partly')) {
          remotePercentage = 50; // Default for hybrid/teilweise
        } else if (remoteOption.includes('gelegentlich') ||
                   remoteOption.includes('occasional')) {
          remotePercentage = 20; // Gelegentlich = occasional = ~20%
        } else if (remoteOption.includes('remote') ||
                   remoteOption.includes('homeoffice') ||
                   remoteOption.includes('telearbeit') ||
                   remoteOption.includes('heim-/telearbeit')) {
          remotePercentage = 50; // Generic remote mention - assume hybrid
        }
      }

      // Format extracted date to YYYY-MM-DD for HTML date input (using local timezone)
      let extractedDate = '';
      if (fields.postedDate) {
        const d = new Date(fields.postedDate as any);
        if (!isNaN(d.getTime())) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          extractedDate = `${year}-${month}-${day}`;
        }
      }

      setFormData({
        title: fields.title || '',
        company: fields.company || '',
        location: fields.location || '',
        postedDate: extractedDate,
        description: (fields as any).fullText || '',
        requirements: (fields as any).notes || '', // AI extracts requirements into notes field
        salary_min: salaryMin,
        salary_max: salaryMax,
        remote_percentage: remotePercentage,
        source: '',
        source_url: (fields as any).url || '',
        status: 'new'
      });
      setShowForm(true);
    } else if (extractionResult && !extractionResult.success) {
      // Show form anyway if extraction failed, but user can fill manually
      setShowForm(true);
    }
  }, [extractionResult]);

  // Handle form field changes
  const handleFieldChange = (field: string) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = event.target.value;
    // Geänderte Eingaben → Widersprüchlich-Warnung ggf. erneut zeigen
    conflictWarnedRef.current = false;
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle number field changes
  const handleNumberChange = (field: string) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value ? Number(event.target.value) : undefined;
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Perform the actual save (create/update) – nach evtl. Dubletten-Bestätigung
  const doSave = useCallback(async () => {
    setIsSaving(true);

    try {
      if (isEditMode && id) {
        // Update existing job
        await updateJob(parseInt(id, 10), formData);
      } else {
        // Create new job
        await createJob(formData);
      }

      // Mark save as successful - this will trigger useEffect to clear dirty state
      setSaveSuccessful(true);
      setInitialFormData(formData);
      setHasUnsavedChanges(false);
      setIsDirty(false); // Explicitly clear context dirty state

      // Clear extraction result to prevent form re-population if user navigates back
      clearExtractionResult();

      // Navigate to jobs list on success (after state updates)
      // Use replace to prevent back-button returning to filled form
      setTimeout(() => navigate('/jobs', { replace: true }), 0);
    } catch (err) {
      console.error('Failed to save job:', err);
      setIsSaving(false); // Re-enable save button on error
    }
  }, [formData, isEditMode, id, updateJob, createJob, setIsDirty, navigate, clearExtractionResult]);

  // Handle save – prüft beim Neuanlegen VOR dem Speichern auf sichere Dubletten
  // (blockierend). Mögliche Dubletten sind nicht blockierend (Hinweis im Formular).
  //
  // Der In-flight-Guard wird VOR dem await gesetzt, damit ein zweiter Klick /
  // Ctrl+S während der laufenden Prüfung sofort abbricht. Er wird auf jedem
  // Pfad, der NICHT direkt in doSave() übergeht, zuverlässig zurückgesetzt.
  const handleSave = useCallback(async () => {
    // Prevent double-save / parallele Prüfung
    if (isSaving || dupCheckInFlightRef.current || !formData.title || !formData.company) {
      return;
    }

    if (!isEditMode) {
      dupCheckInFlightRef.current = true;
      setIsCheckingDuplicate(true);
      let blocked = false;
      try {
        const res = await window.api.checkJobDuplicate({
          title: formData.title,
          company: formData.company,
          url: formData.source_url || undefined
        });
        // Save-Zeit-Ergebnis in die Inline-Hinweise übernehmen – so ist die
        // Anzeige (safe/conflicting/possible) auch dann aktuell, wenn der
        // debounced Live-Check noch nicht gelaufen ist.
        setFormDuplicates(res);

        if (res.safe) {
          // SICHER (Key + Titel): hart blockieren, auf Bestätigung warten.
          setDupMatches([res.safe]);
          setDupPossible(res.possible);
          setDupContext('save');
          setDupDialogOpen(true);
          blocked = true;
        } else if (res.conflicting.length > 0 && !conflictWarnedRef.current) {
          // WIDERSPRÜCHLICH (URL gleich, Titel abweichend): nicht-blockierend,
          // aber sichtbar machen – ersten Save-Klick anhalten, damit der Nutzer
          // die Warnung sieht; der nächste Klick speichert.
          conflictWarnedRef.current = true;
          blocked = true;
        }
      } catch (err) {
        console.error('Pre-save duplicate check failed:', err);
      } finally {
        dupCheckInFlightRef.current = false;
        setIsCheckingDuplicate(false);
      }

      if (blocked) {
        return;
      }
    }

    await doSave();
  }, [isSaving, formData.title, formData.company, formData.source_url, isEditMode, doSave]);

  // Keyboard shortcut: Ctrl+S for save
  const canSave = showForm && formData.title && formData.company && !isSaving;
  useKeyboardShortcut('ctrl+s', handleSave, { disabled: !canSave });

  // Live-Dublettenprüfung im Formular (debounced, nicht blockierend).
  // Zeigt sichere Treffer als Warnung und mögliche Treffer als Hinweis an.
  useEffect(() => {
    const title = formData.title.trim();
    const company = formData.company.trim();

    if (!showForm || !title || !company) {
      setFormDuplicates(null);
      return;
    }

    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const res = await window.api.checkJobDuplicate({
          title,
          company,
          url: formData.source_url || undefined,
          excludeJobId: isEditMode && id ? parseInt(id, 10) : undefined
        });
        if (!cancelled) setFormDuplicates(res);
      } catch (err) {
        if (!cancelled) console.error('Duplicate check failed:', err);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [showForm, formData.title, formData.company, formData.source_url, isEditMode, id]);

  // Dialog: "Trotzdem hinzufügen" – kontextabhängig weiter analysieren bzw. speichern
  const handleDupProceed = async () => {
    setDupDialogOpen(false);
    if (dupContext === 'extract') {
      await runExtraction();
    } else {
      await doSave();
    }
  };

  const handleDupCancel = () => {
    setDupDialogOpen(false);
  };

  // Handle clear
  const handleClear = () => {
    setJobText('');
    setFormData({
      title: '',
      company: '',
      location: '',
      postedDate: '',
      description: '',
      requirements: '',
      salary_min: undefined,
      salary_max: undefined,
      remote_percentage: undefined,
      source: '',
      source_url: '',
      status: 'new'
    });
    setShowForm(false);
    setFormDuplicates(null);
    conflictWarnedRef.current = false;
    clearExtractionResult();
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {isEditMode ? 'Job bearbeiten' : 'Neuen Job hinzufügen'}
      </Typography>

      {/* Step 1: Paste Job Text (only in add mode) */}
      {!showForm && !isEditMode && (
        <Paper
          sx={{
            p: 3,
            mb: 3,
            border: isDragging ? '2px dashed' : '2px solid transparent',
            borderColor: isDragging ? 'primary.main' : 'transparent',
            bgcolor: isDragging ? 'action.hover' : 'background.paper',
            transition: 'all 0.2s ease'
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Schritt 1: Stellenanzeige einfügen
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Kopiere die Stellenanzeige, lade eine Datei (.md, .txt, .pdf) oder ziehe sie hierher.
            </Typography>
          </Box>

          <TextField
            fullWidth
            multiline
            rows={12}
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            placeholder={isDragging ? 'Datei hier ablegen...' : 'Füge hier die Stellenanzeige ein...'}
            variant="outlined"
            sx={{ mb: 2 }}
          />

          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              startIcon={<PasteIcon />}
              onClick={handlePaste}
            >
              Aus Zwischenablage einfügen
            </Button>

            <Button
              variant="outlined"
              startIcon={<UploadFileIcon />}
              onClick={handleFileImport}
            >
              Datei laden
            </Button>

            <Button
              variant="contained"
              startIcon={(isExtracting || isCheckingDuplicate) ? <CircularProgress size={20} /> : <AIIcon />}
              onClick={handleExtract}
              disabled={!jobText.trim() || isExtracting || isCheckingDuplicate}
            >
              {isExtracting
                ? 'Analysiere mit AI...'
                : isCheckingDuplicate
                  ? 'Prüfe auf Dubletten...'
                  : 'Mit AI analysieren'}
            </Button>
          </Box>

          {fileWarning && (
            <Alert severity="warning" sx={{ mt: 2 }} onClose={() => setFileWarning(null)}>
              {fileWarning}
            </Alert>
          )}

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Paper>
      )}

      {/* Step 2: Review & Edit Extracted Data */}
      {showForm && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Schritt 2: Daten prüfen und speichern
            </Typography>

            {/* AI Extraction Info */}
            {extractionResult && (
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                  <Chip
                    label={`AI Confidence: ${extractionResult.confidence}`}
                    color={extractionResult.confidence === 'high' ? 'success' : extractionResult.confidence === 'medium' ? 'warning' : 'error'}
                    size="small"
                  />
                  {extractionResult.missingRequired.length > 0 && (
                    <Chip
                      label={`${extractionResult.missingRequired.length} fehlende Felder`}
                      color="warning"
                      size="small"
                    />
                  )}
                  {extractionResult.warnings && extractionResult.warnings.length > 0 && (
                    <Chip
                      label={`${extractionResult.warnings.length} Hinweise`}
                      color="info"
                      size="small"
                    />
                  )}
                </Box>

                {extractionResult.error && (
                  <Alert severity="error" sx={{ mt: 1 }}>
                    {extractionResult.error}
                  </Alert>
                )}

                {extractionResult.warnings && extractionResult.warnings.length > 0 && (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    <Typography variant="body2" fontWeight="bold" gutterBottom>
                      Hinweise:
                    </Typography>
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {extractionResult.warnings.map((warning, idx) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                  </Alert>
                )}

                {extractionResult.missingRequired.length > 0 && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    <Typography variant="body2" fontWeight="bold" gutterBottom>
                      Fehlende Pflichtfelder:
                    </Typography>
                    <Typography variant="body2">
                      {extractionResult.missingRequired.join(', ')}
                    </Typography>
                  </Alert>
                )}
              </Box>
            )}

            <Divider sx={{ mb: 3 }} />
          </Box>

          {/* Dubletten-Hinweise (nicht blockierend) */}
          {formDuplicates?.safe && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight="bold">
                Job bereits vorhanden
              </Typography>
              <Typography variant="body2">
                {formDuplicates.safe.job.title} – {formDuplicates.safe.job.company} (hinzugefügt am{' '}
                {formatGermanDate(formDuplicates.safe.job.createdAt)}, Score{' '}
                {formatScore(formDuplicates.safe.job.matchScore)})
              </Typography>
            </Alert>
          )}
          {formDuplicates && formDuplicates.conflicting.length > 0 && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight="bold" gutterBottom>
                Identische URL, aber anderer Titel — evtl. fehlerhafte Importdaten:
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {formDuplicates.conflicting.map(m => (
                  <li key={m.job.id}>
                    <Typography variant="body2">
                      {m.job.title} – {m.job.company} (hinzugefügt am {formatGermanDate(m.job.createdAt)})
                    </Typography>
                  </li>
                ))}
              </ul>
            </Alert>
          )}
          {formDuplicates && formDuplicates.possible.length > 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight="bold" gutterBottom>
                Mögliche Dublette von:
              </Typography>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {formDuplicates.possible.map(m => (
                  <li key={m.job.id}>
                    <Typography variant="body2">
                      {m.job.title} – {m.job.company} (hinzugefügt am {formatGermanDate(m.job.createdAt)})
                    </Typography>
                  </li>
                ))}
              </ul>
            </Alert>
          )}

          {/* Form Fields */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Title */}
            <TextField
              label="Jobtitel"
              value={formData.title}
              onChange={handleFieldChange('title')}
              required
              fullWidth
            />

            {/* Company */}
            <TextField
              label="Unternehmen"
              value={formData.company}
              onChange={handleFieldChange('company')}
              required
              fullWidth
            />

            {/* Location */}
            <TextField
              label="Standort"
              value={formData.location}
              onChange={handleFieldChange('location')}
              fullWidth
            />

            {/* Posted Date */}
            <TextField
              label="Veröffentlichungsdatum"
              type="date"
              value={formData.postedDate}
              onChange={handleFieldChange('postedDate')}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />

            {/* Salary Range */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Gehalt Min (€/Jahr)"
                type="number"
                value={formData.salary_min || ''}
                onChange={handleNumberChange('salary_min')}
                fullWidth
                InputProps={{ inputProps: { min: 0, step: 1000 } }}
              />
              <TextField
                label="Gehalt Max (€/Jahr)"
                type="number"
                value={formData.salary_max || ''}
                onChange={handleNumberChange('salary_max')}
                fullWidth
                InputProps={{ inputProps: { min: 0, step: 1000 } }}
              />
            </Box>

            {/* Remote Percentage */}
            <TextField
              label="Remote-Anteil (%)"
              type="number"
              value={formData.remote_percentage || ''}
              onChange={handleNumberChange('remote_percentage')}
              fullWidth
              InputProps={{ inputProps: { min: 0, max: 100, step: 10 } }}
              helperText="0% = vor Ort, 100% = vollständig remote"
            />

            {/* Description */}
            <TextField
              label="Beschreibung"
              value={formData.description}
              onChange={handleFieldChange('description')}
              multiline
              rows={4}
              fullWidth
            />

            {/* Requirements */}
            <TextField
              label="Anforderungen"
              value={formData.requirements}
              onChange={handleFieldChange('requirements')}
              multiline
              rows={4}
              fullWidth
            />

            {/* Source */}
            <TextField
              label="Quelle (z.B. LinkedIn, Indeed)"
              value={formData.source}
              onChange={handleFieldChange('source')}
              fullWidth
            />

            {/* Source URL */}
            <TextField
              label="Quell-URL"
              value={formData.source_url}
              onChange={handleFieldChange('source_url')}
              fullWidth
              type="url"
            />
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 3 }}>
            <Button
              variant="outlined"
              startIcon={<ClearIcon />}
              onClick={handleClear}
            >
              Verwerfen
            </Button>

            <Button
              variant="contained"
              startIcon={(isLoading || isSaving) ? <CircularProgress size={20} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={!formData.title || !formData.company || isLoading || isSaving}
            >
              {(isLoading || isSaving) ? 'Speichere...' : 'Job speichern'}
            </Button>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Paper>
      )}

      {/* Blockierender Dubletten-Dialog (sicherer Treffer) */}
      <DuplicateWarningDialog
        open={dupDialogOpen}
        title={dupContext === 'extract' ? 'Mögliche Dublette gefunden' : 'Job bereits vorhanden'}
        matches={dupMatches}
        possibleMatches={dupContext === 'save' ? dupPossible : []}
        proceedLabel={dupContext === 'extract' ? 'Trotzdem analysieren' : 'Trotzdem hinzufügen'}
        question={
          dupContext === 'extract'
            ? 'Es gibt bereits Job(s) mit dieser URL im Bestand (evtl. eine andere Stelle). Möchtest du den Text trotzdem mit AI analysieren?'
            : 'Dieser Job scheint bereits im Bestand zu sein (identische URL und gleicher Titel). Möchtest du ihn trotzdem hinzufügen?'
        }
        onCancel={handleDupCancel}
        onProceed={handleDupProceed}
      />
    </Container>
  );
}
