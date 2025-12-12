import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  Typography,
  Box,
  CircularProgress,
  Alert
} from '@mui/material';
import { MergePreview, MergeFieldComparison, MergeFieldSource } from '../../shared/types';

/**
 * MergeDialog - Smart merge duplicate jobs
 * Feature: Issue #28 - Merge Feature for Duplicate Jobs
 */

interface MergeDialogProps {
  open: boolean;
  existingJobId: number | null;
  newData: any | null;
  onClose: () => void;
  onMergeComplete: () => void;
}

// Field labels for display
const FIELD_LABELS: Record<string, string> = {
  title: 'Titel',
  company: 'Firma',
  url: 'URL',
  postedDate: 'Veröffentlicht',
  deadline: 'Bewerbungsfrist',
  location: 'Standort',
  remoteOption: 'Remote-Option',
  salaryRange: 'Gehalt',
  contractType: 'Vertragsart',
  fullText: 'Volltext',
  rawImportData: 'Importdaten',
  importMethod: 'Import-Methode',
  notes: 'Notizen',
  status: 'Status',
  matchScore: 'Match-Score',
  sourceId: 'Quelle'
};

export default function MergeDialog({
  open,
  existingJobId,
  newData,
  onClose,
  onMergeComplete
}: MergeDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [fields, setFields] = useState<MergeFieldComparison[]>([]);

  // Load merge preview
  useEffect(() => {
    if (open && existingJobId && newData) {
      loadPreview();
    }
  }, [open, existingJobId, newData]);

  const loadPreview = async () => {
    if (!existingJobId || !newData) return;

    setLoading(true);
    setError(null);

    try {
      const result = await window.api.createMergePreview(existingJobId, newData);
      setPreview(result);
      setFields(result.fields);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden der Vorschau');
    } finally {
      setLoading(false);
    }
  };

  // Toggle field source
  const handleToggleField = (fieldName: string, source: MergeFieldSource) => {
    setFields(prev =>
      prev.map(f =>
        f.field === fieldName ? { ...f, selectedSource: source } : f
      )
    );
  };

  // Smart merge: Auto-select best values
  const handleSmartMerge = () => {
    setFields(prev =>
      prev.map(field => {
        if (!field.isDifferent) return field;

        const dbEmpty = isEmpty(field.dbValue);
        const csvEmpty = isEmpty(field.csvValue);

        // If DB is empty and CSV has value → use CSV
        if (dbEmpty && !csvEmpty) {
          return { ...field, selectedSource: 'csv' };
        }
        // If CSV is empty but DB has value → keep DB
        if (!dbEmpty && csvEmpty) {
          return { ...field, selectedSource: 'db' };
        }
        // If both have values → prefer CSV (newer data)
        if (!dbEmpty && !csvEmpty) {
          // Special case: for dates, prefer more recent
          if (field.field === 'postedDate' &&
              field.dbValue instanceof Date &&
              field.csvValue instanceof Date) {
            return {
              ...field,
              selectedSource: field.dbValue > field.csvValue ? 'db' : 'csv'
            };
          }
          return { ...field, selectedSource: 'csv' };
        }

        return field;
      })
    );
  };

  // Execute merge
  const handleMerge = async () => {
    if (!existingJobId) return;

    setLoading(true);
    setError(null);

    try {
      await window.api.mergeJobs(existingJobId, fields);
      onMergeComplete();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Fehler beim Mergen');
    } finally {
      setLoading(false);
    }
  };

  // Format value for display
  const formatValue = (value: any): string => {
    if (value == null || value === '') return '(leer)';
    if (value instanceof Date) return value.toLocaleDateString('de-DE');
    if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
    if (typeof value === 'string' && value.length > 60) {
      return value.substring(0, 60) + '...';
    }
    return String(value);
  };

  // Helper: Check if value is empty
  const isEmpty = (value: any): boolean => {
    if (value == null) return true;
    if (typeof value === 'string' && value.trim() === '') return true;
    if (typeof value === 'number' && isNaN(value)) return true;
    return false;
  };

  // Only show fields that are different
  const differentFields = fields.filter(f => f.isDifferent);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        Jobs zusammenführen
        {preview && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {preview.existingJob.title} bei {preview.existingJob.company}
          </Typography>
        )}
      </DialogTitle>

      <DialogContent>
        {loading && (
          <Box display="flex" justifyContent="center" p={4}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!loading && preview && (
          <>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Wähle für jedes Feld, welchen Wert du behalten möchtest.
                Nur unterschiedliche Felder werden angezeigt.
              </Typography>
            </Box>

            {differentFields.length === 0 ? (
              <Alert severity="info">
                Keine Unterschiede gefunden. Die Jobs sind identisch.
              </Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Feld</strong></TableCell>
                      <TableCell><strong>Datenbank</strong></TableCell>
                      <TableCell><strong>CSV Import</strong></TableCell>
                      <TableCell align="center"><strong>Auswahl</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {differentFields.map(field => (
                      <TableRow key={field.field as string}>
                        <TableCell>
                          {FIELD_LABELS[field.field as string] || field.field}
                        </TableCell>
                        <TableCell>
                          {formatValue(field.dbValue)}
                          {isEmpty(field.dbValue) && (
                            <Chip label="Leer" size="small" sx={{ ml: 1 }} />
                          )}
                        </TableCell>
                        <TableCell>
                          {formatValue(field.csvValue)}
                          {isEmpty(field.csvValue) && (
                            <Chip label="Leer" size="small" sx={{ ml: 1 }} />
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <ToggleButtonGroup
                            value={field.selectedSource}
                            exclusive
                            onChange={(_, value) => {
                              if (value !== null) {
                                handleToggleField(field.field as string, value);
                              }
                            }}
                            size="small"
                          >
                            <ToggleButton value="db">DB</ToggleButton>
                            <ToggleButton value="csv">CSV</ToggleButton>
                          </ToggleButtonGroup>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Abbrechen
        </Button>
        <Button
          onClick={handleSmartMerge}
          disabled={loading || !preview || differentFields.length === 0}
        >
          Smart Merge
        </Button>
        <Button
          onClick={handleMerge}
          variant="contained"
          disabled={loading || !preview}
        >
          {loading ? 'Wird zusammengeführt...' : 'Zusammenführen'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
