import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Paper,
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Alert,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Skeleton,
  Tooltip,
  LinearProgress,
  Card,
  CardContent,
  Collapse
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  PlayArrow as ImportIcon,
  SkipNext as SkipIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Info as InfoIcon,
  ContentCopy as DuplicateIcon
} from '@mui/icons-material';

// Types for import data
interface ImportSession {
  id: number;
  filename: string;
  totalRows: number;
  processedRows: number;
  importedRows: number;
  skippedRows: number;
  duplicateRows: number;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: Date;
  completedAt?: Date;
}

interface StagingRow {
  id: number;
  sessionId: number;
  csvRowId?: number;
  csvUrl?: string;
  csvTitle?: string;
  csvContent?: string;
  csvFromEmail?: string;
  csvEmailDate?: string;
  status: 'pending' | 'duplicate' | 'likely_duplicate' | 'new' | 'imported' | 'skipped';
  matchedJobId?: number;
  matchedJobTitle?: string;
  duplicateScore?: number;
  duplicateReason?: string;
  extractedTitle?: string;
  extractedCompany?: string;
}

/**
 * Import Page - CSV Import for job offers
 */
export default function Import() {
  const navigate = useNavigate();

  // State
  const [sessions, setSessions] = useState<ImportSession[]>([]);
  const [activeSession, setActiveSession] = useState<ImportSession | null>(null);
  const [stagingRows, setStagingRows] = useState<StagingRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<number | null>(null);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, []);

  // Load all import sessions
  const loadSessions = async () => {
    try {
      setIsLoading(true);
      const result = await window.api.importGetSessions();
      setSessions(result);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden der Import-Sessions');
    } finally {
      setIsLoading(false);
    }
  };

  // Load staging rows for a session
  const loadStagingRows = async (sessionId: number) => {
    try {
      setIsLoading(true);
      const rows = await window.api.importGetStagingRows(sessionId);
      setStagingRows(rows);

      // Also refresh the session
      const session = await window.api.importGetSession(sessionId);
      setActiveSession(session);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Laden der Staging-Daten');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle file selection and processing
  const handleSelectFile = async () => {
    try {
      setError(null);
      setSuccessMessage(null);

      // Open file dialog
      const result = await window.api.importSelectCsvFile();

      if (result.canceled) {
        return;
      }

      setIsLoading(true);

      // Process the CSV
      const session = await window.api.importProcessCsv(result.filename!, result.content!);

      setSuccessMessage(`${session.totalRows} Einträge aus "${result.filename}" geladen`);

      // Refresh sessions and load the new one
      await loadSessions();
      setActiveSession(session);
      await loadStagingRows(session.id);

    } catch (err: any) {
      setError(err.message || 'Fehler beim Verarbeiten der CSV-Datei');
    } finally {
      setIsLoading(false);
    }
  };

  // Import a single row
  const handleImportRow = async (rowId: number) => {
    try {
      setError(null);
      const result = await window.api.importRow(rowId);

      if (result.success) {
        setSuccessMessage(`Job erfolgreich importiert (ID: ${result.jobId})`);
        // Refresh staging rows
        if (activeSession) {
          await loadStagingRows(activeSession.id);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Fehler beim Importieren');
    }
  };

  // Skip a row
  const handleSkipRow = async (rowId: number) => {
    try {
      await window.api.importSkipRow(rowId);
      // Refresh staging rows
      if (activeSession) {
        await loadStagingRows(activeSession.id);
      }
    } catch (err: any) {
      setError(err.message || 'Fehler beim Überspringen');
    }
  };

  // Import all new rows
  const handleImportAllNew = async () => {
    if (!activeSession) return;

    try {
      setError(null);
      setIsImporting(true);

      const result = await window.api.importAllNew(activeSession.id);

      setSuccessMessage(`${result.imported} Jobs importiert, ${result.failed} fehlgeschlagen`);

      // Refresh
      await loadStagingRows(activeSession.id);
      await loadSessions();

    } catch (err: any) {
      setError(err.message || 'Fehler beim Massenimport');
    } finally {
      setIsImporting(false);
    }
  };

  // Delete session
  const handleDeleteSession = async () => {
    if (!sessionToDelete) return;

    try {
      await window.api.importDeleteSession(sessionToDelete);

      // Clear active session if it was deleted
      if (activeSession?.id === sessionToDelete) {
        setActiveSession(null);
        setStagingRows([]);
      }

      await loadSessions();
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
    } catch (err: any) {
      setError(err.message || 'Fehler beim Löschen');
    }
  };

  // Get status chip
  const getStatusChip = (status: string, duplicateScore?: number) => {
    switch (status) {
      case 'new':
        return <Chip size="small" color="success" label="Neu" icon={<CheckIcon />} />;
      case 'duplicate':
        return <Chip size="small" color="error" label="Duplikat" icon={<DuplicateIcon />} />;
      case 'likely_duplicate':
        return (
          <Chip
            size="small"
            color="warning"
            label={`Wahrsch. Duplikat (${duplicateScore}%)`}
            icon={<WarningIcon />}
          />
        );
      case 'imported':
        return <Chip size="small" color="primary" label="Importiert" icon={<CheckIcon />} />;
      case 'skipped':
        return <Chip size="small" color="default" label="Übersprungen" icon={<SkipIcon />} />;
      default:
        return <Chip size="small" label={status} />;
    }
  };

  // Get source name from email
  const getSourceFromEmail = (email?: string): string => {
    if (!email) return 'Unbekannt';
    const lower = email.toLowerCase();
    if (lower.includes('xing')) return 'XING';
    if (lower.includes('linkedin')) return 'LinkedIn';
    if (lower.includes('stepstone')) return 'Stepstone';
    if (lower.includes('indeed')) return 'Indeed';
    if (lower.includes('arbeitsagentur')) return 'Arbeitsagentur';
    return 'Sonstige';
  };

  // Calculate stats
  const newCount = stagingRows.filter(r => r.status === 'new').length;
  const duplicateCount = stagingRows.filter(r => r.status === 'duplicate' || r.status === 'likely_duplicate').length;
  const importedCount = stagingRows.filter(r => r.status === 'imported').length;

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          CSV Import
        </Typography>
        <Button
          variant="contained"
          startIcon={<UploadIcon />}
          onClick={handleSelectFile}
          disabled={isLoading}
        >
          CSV-Datei auswählen
        </Button>
      </Box>

      {/* Messages */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      {/* Session list (collapsed) */}
      {sessions.length > 0 && (
        <Paper sx={{ mb: 3, p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Bisherige Imports ({sessions.length})
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {sessions.map(session => (
              <Chip
                key={session.id}
                label={`${session.filename} (${session.importedRows}/${session.totalRows})`}
                onClick={() => {
                  setActiveSession(session);
                  loadStagingRows(session.id);
                }}
                onDelete={() => {
                  setSessionToDelete(session.id);
                  setDeleteDialogOpen(true);
                }}
                color={activeSession?.id === session.id ? 'primary' : 'default'}
                variant={activeSession?.id === session.id ? 'filled' : 'outlined'}
              />
            ))}
          </Stack>
        </Paper>
      )}

      {/* Active session */}
      {activeSession && (
        <>
          {/* Stats */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Gesamt
                </Typography>
                <Typography variant="h4">{stagingRows.length}</Typography>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Neu
                </Typography>
                <Typography variant="h4" color="success.main">{newCount}</Typography>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Duplikate
                </Typography>
                <Typography variant="h4" color="warning.main">{duplicateCount}</Typography>
              </CardContent>
            </Card>
            <Card sx={{ flex: 1 }}>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Importiert
                </Typography>
                <Typography variant="h4" color="primary.main">{importedCount}</Typography>
              </CardContent>
            </Card>
          </Box>

          {/* Action bar */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Button
              variant="contained"
              color="success"
              startIcon={<ImportIcon />}
              onClick={handleImportAllNew}
              disabled={isImporting || newCount === 0}
            >
              Alle neuen importieren ({newCount})
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => loadStagingRows(activeSession.id)}
              disabled={isLoading}
            >
              Aktualisieren
            </Button>
          </Box>

          {/* Progress bar */}
          {isImporting && (
            <Box sx={{ mb: 2 }}>
              <LinearProgress />
              <Typography variant="caption" color="text.secondary">
                Importiere Jobs mit AI-Extraktion...
              </Typography>
            </Box>
          )}

          {/* Staging rows table */}
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width={50}>#</TableCell>
                  <TableCell>Titel</TableCell>
                  <TableCell>Quelle</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Aktionen</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  // Loading skeleton
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                      <TableCell><Skeleton /></TableCell>
                    </TableRow>
                  ))
                ) : stagingRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography color="text.secondary" sx={{ py: 4 }}>
                        Keine Einträge vorhanden
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  stagingRows.map((row, index) => (
                    <React.Fragment key={row.id}>
                      <TableRow
                        hover
                        sx={{
                          backgroundColor: row.status === 'duplicate' ? 'error.light' :
                            row.status === 'likely_duplicate' ? 'warning.light' :
                            row.status === 'imported' ? 'action.selected' : 'inherit',
                          opacity: row.status === 'skipped' ? 0.5 : 1
                        }}
                      >
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <IconButton
                              size="small"
                              onClick={() => setExpandedRow(expandedRow === row.id ? null : row.id)}
                            >
                              {expandedRow === row.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </IconButton>
                            <Box>
                              <Typography variant="body2" fontWeight="medium">
                                {row.csvTitle || 'Kein Titel'}
                              </Typography>
                              {row.csvUrl && (
                                <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 300, display: 'block' }}>
                                  {row.csvUrl}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={getSourceFromEmail(row.csvFromEmail)} />
                        </TableCell>
                        <TableCell>
                          {getStatusChip(row.status, row.duplicateScore)}
                          {row.duplicateReason && (
                            <Tooltip title={row.duplicateReason}>
                              <InfoIcon fontSize="small" color="action" sx={{ ml: 0.5, verticalAlign: 'middle' }} />
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {(row.status === 'new' || row.status === 'likely_duplicate') && (
                            <>
                              <Tooltip title="Importieren">
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={() => handleImportRow(row.id)}
                                >
                                  <ImportIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Überspringen">
                                <IconButton
                                  size="small"
                                  onClick={() => handleSkipRow(row.id)}
                                >
                                  <SkipIcon />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                          {row.status === 'imported' && row.matchedJobId && (
                            <Button
                              size="small"
                              onClick={() => navigate(`/jobs/${row.matchedJobId}`)}
                            >
                              Anzeigen
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* Expanded content */}
                      <TableRow>
                        <TableCell colSpan={5} sx={{ py: 0 }}>
                          <Collapse in={expandedRow === row.id} timeout="auto" unmountOnExit>
                            <Box sx={{ py: 2, px: 4, backgroundColor: 'grey.50' }}>
                              {row.duplicateReason && (
                                <Alert severity="warning" sx={{ mb: 2 }}>
                                  {row.duplicateReason}
                                </Alert>
                              )}
                              <Typography variant="subtitle2" gutterBottom>
                                Inhalt (Vorschau):
                              </Typography>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                  whiteSpace: 'pre-wrap',
                                  maxHeight: 200,
                                  overflow: 'auto',
                                  backgroundColor: 'background.paper',
                                  p: 1,
                                  borderRadius: 1
                                }}
                              >
                                {row.csvContent?.substring(0, 1000) || 'Kein Inhalt'}
                                {row.csvContent && row.csvContent.length > 1000 && '...'}
                              </Typography>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* Empty state */}
      {!activeSession && sessions.length === 0 && !isLoading && (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <UploadIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Noch keine Imports vorhanden
          </Typography>
          <Typography color="text.secondary">
            Klicken Sie oben rechts auf "CSV-Datei auswählen", um Job-Angebote zu importieren.
          </Typography>
        </Paper>
      )}

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Import-Session löschen?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Möchten Sie diese Import-Session und alle zugehörigen Staging-Daten wirklich löschen?
            Bereits importierte Jobs bleiben erhalten.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Abbrechen</Button>
          <Button onClick={handleDeleteSession} color="error" variant="contained">
            Löschen
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
