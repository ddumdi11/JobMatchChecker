import React, { useState } from 'react';
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
  Clear as ClearIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useJobStore } from '../store/jobStore';

/**
 * JobAdd Page - Add new job offers with AI extraction
 * Samstag Block 1 - Task 2.2
 *
 * Features:
 * - Paste job text from clipboard
 * - AI extraction via Claude
 * - Manual form editing
 * - Save to database
 */
export default function JobAdd() {
  const navigate = useNavigate();

  // Store hooks
  const extractJobFromText = useJobStore(state => state.extractJobFromText);
  const createJob = useJobStore(state => state.createJob);
  const extractionResult = useJobStore(state => state.extractionResult);
  const isExtracting = useJobStore(state => state.isExtracting);
  const isLoading = useJobStore(state => state.isLoading);
  const error = useJobStore(state => state.error);
  const clearExtractionResult = useJobStore(state => state.clearExtractionResult);

  // Local state
  const [jobText, setJobText] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Form state (initialized from extraction or empty)
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    location: '',
    description: '',
    requirements: '',
    salary_min: undefined as number | undefined,
    salary_max: undefined as number | undefined,
    remote_percentage: undefined as number | undefined,
    source: '',
    source_url: '',
    status: 'new' as const
  });

  // Handle paste from clipboard
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setJobText(text);
    } catch (err) {
      console.error('Failed to read clipboard:', err);
    }
  };

  // Handle AI extraction
  const handleExtract = async () => {
    if (!jobText.trim()) {
      return;
    }

    try {
      await extractJobFromText(jobText);
      // Form will auto-update via useEffect when extractionResult changes
    } catch (err) {
      console.error('Extraction failed:', err);
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

      // Parse remote percentage from remoteOption (e.g., "80% remote", "hybrid")
      let remotePercentage: number | undefined;
      if (fields.remoteOption) {
        const remoteMatch = fields.remoteOption.match(/(\d+)%/);
        if (remoteMatch) {
          remotePercentage = parseInt(remoteMatch[1]);
        } else if (fields.remoteOption.toLowerCase().includes('100%') ||
                   fields.remoteOption.toLowerCase().includes('full') ||
                   fields.remoteOption.toLowerCase().includes('vollständig')) {
          remotePercentage = 100;
        } else if (fields.remoteOption.toLowerCase().includes('hybrid')) {
          remotePercentage = 50; // Default for hybrid
        }
      }

      setFormData({
        title: fields.title || '',
        company: fields.company || '',
        location: fields.location || '',
        description: fields.fullText || '',
        requirements: '',
        salary_min: salaryMin,
        salary_max: salaryMax,
        remote_percentage: remotePercentage,
        source: '',
        source_url: fields.url || '',
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
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle number field changes
  const handleNumberChange = (field: string) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value ? Number(event.target.value) : undefined;
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle save
  const handleSave = async () => {
    if (!formData.title || !formData.company) {
      return;
    }

    try {
      await createJob(formData);
      // Navigate to jobs list on success
      navigate('/jobs');
    } catch (err) {
      console.error('Failed to save job:', err);
    }
  };

  // Handle clear
  const handleClear = () => {
    setJobText('');
    setFormData({
      title: '',
      company: '',
      location: '',
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
    clearExtractionResult();
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Neuen Job hinzufügen
      </Typography>

      {/* Step 1: Paste Job Text */}
      {!showForm && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Schritt 1: Stellenanzeige einfügen
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Kopiere die Stellenanzeige und füge sie hier ein. Claude AI wird die wichtigsten Informationen automatisch extrahieren.
            </Typography>
          </Box>

          <TextField
            fullWidth
            multiline
            rows={12}
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            placeholder="Füge hier die Stellenanzeige ein..."
            variant="outlined"
            sx={{ mb: 2 }}
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<PasteIcon />}
              onClick={handlePaste}
            >
              Aus Zwischenablage einfügen
            </Button>

            <Button
              variant="contained"
              startIcon={isExtracting ? <CircularProgress size={20} /> : <AIIcon />}
              onClick={handleExtract}
              disabled={!jobText.trim() || isExtracting}
            >
              {isExtracting ? 'Analysiere mit AI...' : 'Mit AI analysieren'}
            </Button>
          </Box>

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

            {/* Salary Range */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Gehalt Min (€)"
                type="number"
                value={formData.salary_min || ''}
                onChange={handleNumberChange('salary_min')}
                fullWidth
                InputProps={{ inputProps: { min: 0, step: 1000 } }}
              />
              <TextField
                label="Gehalt Max (€)"
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
              startIcon={isLoading ? <CircularProgress size={20} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={!formData.title || !formData.company || isLoading}
            >
              {isLoading ? 'Speichere...' : 'Job speichern'}
            </Button>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Paper>
      )}
    </Container>
  );
}
