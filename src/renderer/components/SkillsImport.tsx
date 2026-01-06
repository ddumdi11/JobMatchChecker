/**
 * Skills Import Component - CSV/JSON Bulk Import
 * Supports Future Skills Framework 2030
 * Includes conflict detection and resolution dialog
 */

import { useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Alert,
  AlertTitle,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip,
  ButtonGroup
} from '@mui/material';
import {
  Upload as UploadIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  MergeType as MergeIcon,
  SkipNext as SkipIcon
} from '@mui/icons-material';
import type { SkillImportResult } from '../../shared/types';
import SkillConflictDialog from './SkillConflictDialog';

interface ConflictDetectionResult {
  newSkills: any[];
  conflicts: any[];
  identical: number;
}

export function SkillsImport() {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<SkillImportResult | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [csvContent, setCsvContent] = useState<string>('');
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [detectionResult, setDetectionResult] = useState<ConflictDetectionResult | null>(null);

  // Select file and detect conflicts
  const handleSelectFile = async () => {
    try {
      setImporting(true);
      setResult(null);
      setDetectionResult(null);
      setConflicts([]);

      // Open file dialog
      const fileSelection = await window.api.skillsSelectFile();

      if (fileSelection.canceled || !fileSelection.content) {
        setImporting(false);
        return;
      }

      setFilename(fileSelection.filename || 'file');
      setCsvContent(fileSelection.content);

      // Detect conflicts first
      const isJson = fileSelection.filename?.endsWith('.json');

      if (isJson) {
        // For JSON, just import directly (no conflict detection yet)
        const importResult = await window.api.skillsImportFromJson(fileSelection.content);
        setResult(importResult);
        handleImportComplete(importResult);
      } else {
        // For CSV, detect conflicts
        const detection = await window.api.skillsDetectConflicts(fileSelection.content);
        setDetectionResult(detection);

        if (detection.conflicts.length > 0) {
          setConflicts(detection.conflicts);
          // Don't open dialog automatically, let user decide
        }
      }
    } catch (error: any) {
      setResult({
        success: false,
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: [{ row: 0, skill: '', error: error.message || 'Unknown error' }]
      });
    } finally {
      setImporting(false);
    }
  };

  // Import only new skills, skip conflicts
  const handleImportNewOnly = async () => {
    try {
      setImporting(true);
      const importResult = await window.api.skillsImportNewOnly(csvContent);
      setResult(importResult);
      handleImportComplete(importResult);
    } catch (error: any) {
      setResult({
        success: false,
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: [{ row: 0, skill: '', error: error.message || 'Unknown error' }]
      });
    } finally {
      setImporting(false);
    }
  };

  // Open conflict resolution dialog
  const handleOpenConflictDialog = () => {
    setConflictDialogOpen(true);
  };

  // Handle resolved conflicts
  const handleConflictsResolved = async (resolutions: any[]) => {
    setConflictDialogOpen(false);

    try {
      setImporting(true);

      // First import new skills
      const newResult = await window.api.skillsImportNewOnly(csvContent);

      // Then apply resolutions
      const resolveResult = await window.api.skillsApplyResolutions(conflicts, resolutions);

      // Combine results
      const combinedResult: SkillImportResult = {
        success: newResult.success && resolveResult.success,
        imported: newResult.imported,
        updated: newResult.updated + resolveResult.updated,
        skipped: newResult.skipped,
        errors: [...newResult.errors, ...resolveResult.errors]
      };

      setResult(combinedResult);
      handleImportComplete(combinedResult);
    } catch (error: any) {
      setResult({
        success: false,
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: [{ row: 0, skill: '', error: error.message || 'Unknown error' }]
      });
    } finally {
      setImporting(false);
    }
  };

  // Common completion handler
  const handleImportComplete = (importResult: SkillImportResult) => {
    if (importResult.success && (importResult.imported > 0 || importResult.updated > 0)) {
      // Give a small delay for the parent component to refresh
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  };

  // Legacy direct import (for backwards compatibility)
  const handleDirectImport = async () => {
    try {
      setImporting(true);
      const importResult = await window.api.skillsImportFromCsv(csvContent);
      setResult(importResult);
      handleImportComplete(importResult);
    } catch (error: any) {
      setResult({
        success: false,
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: [{ row: 0, skill: '', error: error.message || 'Unknown error' }]
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Paper sx={{ p: 3, mt: 2 }}>
      <Typography variant="h6" gutterBottom>
        Fähigkeiten Import
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Importieren Sie Fähigkeiten per CSV- oder JSON-Datei. Unterstützt Future Skills Framework 2030.
      </Typography>

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          CSV-Format (erforderliche Spalten):
        </Typography>
        <Typography variant="body2" color="text.secondary" component="pre" sx={{ fontSize: '0.75rem', overflowX: 'auto' }}>
          name, category, level, [yearsOfExperience], [skillType], [futureSkillCategory], [assessmentMethod], [certifications], [notes], [confidence], [marketRelevance]
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
          Level: 0-10 numerisch oder Anfänger/Fortgeschritten/Erfahren/Experte | Confidence: very_likely, possible | MarketRelevance: high, medium, low
        </Typography>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Future Skills Framework Kategorien:
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip label="grundlegend (Foundational)" size="small" />
          <Chip label="transformativ (Transformative)" size="small" />
          <Chip label="gemeinschaft (Community)" size="small" />
          <Chip label="digital (Digital)" size="small" />
          <Chip label="technologisch (Technological)" size="small" />
          <Chip label="traditional (Traditional)" size="small" />
        </Box>
      </Box>

      <Button
        variant="contained"
        startIcon={<UploadIcon />}
        onClick={handleSelectFile}
        disabled={importing}
        fullWidth
      >
        {importing ? 'Analysiere...' : 'Datei auswählen'}
      </Button>

      {/* Conflict detection results */}
      {detectionResult && !result && (
        <Box sx={{ mt: 3 }}>
          <Alert severity={detectionResult.conflicts.length > 0 ? 'warning' : 'success'} sx={{ mb: 2 }}>
            <AlertTitle>Analyse abgeschlossen</AlertTitle>
            <Typography variant="body2">
              <strong>{detectionResult.newSkills.length}</strong> neue Fähigkeiten |{' '}
              <strong>{detectionResult.conflicts.length}</strong> Konflikte |{' '}
              <strong>{detectionResult.identical}</strong> identisch
            </Typography>
          </Alert>

          {detectionResult.conflicts.length > 0 ? (
            <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Es wurden {detectionResult.conflicts.length} Konflikte gefunden. Was möchten Sie tun?
              </Typography>
              <ButtonGroup variant="contained" fullWidth>
                <Button
                  startIcon={<MergeIcon />}
                  onClick={handleOpenConflictDialog}
                  color="primary"
                >
                  Konflikte lösen
                </Button>
                <Button
                  startIcon={<SkipIcon />}
                  onClick={handleImportNewOnly}
                  color="secondary"
                >
                  Nur neue importieren
                </Button>
              </ButtonGroup>
              <Button
                variant="outlined"
                onClick={handleDirectImport}
                size="small"
                sx={{ mt: 1 }}
              >
                Direkt importieren (Auto-Update)
              </Button>
            </Box>
          ) : (
            <Button
              variant="contained"
              color="success"
              onClick={handleImportNewOnly}
              fullWidth
            >
              {detectionResult.newSkills.length} neue Fähigkeiten importieren
            </Button>
          )}
        </Box>
      )}

      {importing && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress />
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
            Verarbeite {filename}...
          </Typography>
        </Box>
      )}

      {result && (
        <Box sx={{ mt: 3 }}>
          {result.success ? (
            <Alert severity="success" icon={<SuccessIcon />}>
              <AlertTitle>Import erfolgreich</AlertTitle>
              <Typography variant="body2">
                Importiert: <strong>{result.imported}</strong> |
                Aktualisiert: <strong>{result.updated}</strong> |
                Übersprungen: <strong>{result.skipped}</strong>
              </Typography>
              {result.imported > 0 && (
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  Seite wird neu geladen, um neue Fähigkeiten anzuzeigen...
                </Typography>
              )}
            </Alert>
          ) : (
            <Alert severity="error" icon={<ErrorIcon />}>
              <AlertTitle>Import fehlgeschlagen</AlertTitle>
              <Typography variant="body2">
                Importiert: {result.imported} |
                Aktualisiert: {result.updated} |
                Übersprungen: {result.skipped} |
                Fehler: <strong>{result.errors.length}</strong>
              </Typography>
            </Alert>
          )}

          {result.errors.length > 0 && (
            <Paper variant="outlined" sx={{ mt: 2, maxHeight: 300, overflow: 'auto' }}>
              <Typography variant="subtitle2" sx={{ p: 2, pb: 1 }}>
                Fehlerdetails:
              </Typography>
              <Divider />
              <List dense>
                {result.errors.map((err, idx) => (
                  <ListItem key={idx}>
                    <ListItemText
                      primary={`Zeile ${err.row}: ${err.skill || 'Unbekannte Fähigkeit'}`}
                      secondary={err.error}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}
        </Box>
      )}

      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2">
          <strong>Hinweis:</strong> Doppelte Fähigkeiten (gleicher Name + Kategorie) werden nur aktualisiert, wenn das neue Level höher ist.
          Fähigkeiten mit zusätzlichen Future Skills Framework Daten werden ebenfalls aktualisiert.
        </Typography>
      </Alert>

      {/* Conflict Resolution Dialog */}
      <SkillConflictDialog
        open={conflictDialogOpen}
        conflicts={conflicts}
        onClose={() => setConflictDialogOpen(false)}
        onResolve={handleConflictsResolved}
      />
    </Paper>
  );
}
