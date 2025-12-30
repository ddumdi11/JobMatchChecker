/**
 * Skills Import Component - CSV/JSON Bulk Import
 * Supports Future Skills Framework 2030
 */

import React, { useState } from 'react';
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
  Chip
} from '@mui/material';
import {
  Upload as UploadIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import type { SkillImportResult } from '../../shared/types';

export function SkillsImport() {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<SkillImportResult | null>(null);
  const [filename, setFilename] = useState<string>('');

  const handleSelectAndImport = async () => {
    try {
      setImporting(true);
      setResult(null);

      // Open file dialog
      const fileSelection = await window.api.skillsSelectFile();

      if (fileSelection.canceled || !fileSelection.content) {
        setImporting(false);
        return;
      }

      setFilename(fileSelection.filename || 'file');

      // Determine file type and import
      const isJson = fileSelection.filename?.endsWith('.json');
      const importResult = isJson
        ? await window.api.skillsImportFromJson(fileSelection.content)
        : await window.api.skillsImportFromCsv(fileSelection.content);

      setResult(importResult);

      // Reload skills in parent component (trigger re-render)
      if (importResult.success && importResult.imported > 0) {
        // Give a small delay for the parent component to refresh
        setTimeout(() => {
          window.location.reload();
        }, 2000);
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
          name, category, level, [yearsOfExperience], [skillType], [futureSkillCategory], [assessmentMethod], [certifications], [notes]
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
          Level: 0-10 numerisch oder Anfänger/Fortgeschritten/Erfahren/Experte
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
        onClick={handleSelectAndImport}
        disabled={importing}
        fullWidth
      >
        {importing ? 'Importiere...' : 'Datei auswählen und importieren'}
      </Button>

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
    </Paper>
  );
}
