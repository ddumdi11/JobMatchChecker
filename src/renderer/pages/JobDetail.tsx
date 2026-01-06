import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Paper,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  Card,
  CardContent,
  IconButton,
  CircularProgress,
  Alert,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Snackbar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  LocationOn as LocationIcon,
  CalendarToday as DateIcon,
  AttachMoney as SalaryIcon,
  Home as RemoteIcon,
  Link as LinkIcon,
  Description as DescriptionIcon,
  AutoAwesome as AutoAwesomeIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Lightbulb as LightbulbIcon,
  ExpandMore as ExpandMoreIcon,
  Download as DownloadIcon,
  PictureAsPdf as PdfIcon,
  Code as MarkdownIcon
} from '@mui/icons-material';
import { useJobStore } from '../store/jobStore';

/**
 * JobDetail Page - Display full details of a single job offer
 * Saturday Block 2 - Task 2.4
 */
export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Store state
  const currentJob = useJobStore(state => state.currentJob);
  const getJobById = useJobStore(state => state.getJobById);
  const deleteJob = useJobStore(state => state.deleteJob);
  const isLoading = useJobStore(state => state.isLoading);
  const error = useJobStore(state => state.error);

  // Matching state
  const matchJob = useJobStore(state => state.matchJob);
  const currentMatching = useJobStore(state => state.currentMatching);
  const matchingHistory = useJobStore(state => state.matchingHistory);
  const getMatchingHistory = useJobStore(state => state.getMatchingHistory);
  const isMatching = useJobStore(state => state.isMatching);
  const matchingError = useJobStore(state => state.matchingError);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletionError, setDeletionError] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [matchSnackbarOpen, setMatchSnackbarOpen] = useState(false);

  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportSnackbarOpen, setExportSnackbarOpen] = useState(false);
  const [exportSnackbarMessage, setExportSnackbarMessage] = useState('');
  const [exportSnackbarSeverity, setExportSnackbarSeverity] = useState<'success' | 'error'>('success');

  // Fetch job on mount
  useEffect(() => {
    if (id) {
      const jobId = parseInt(id, 10);
      getJobById(jobId);
      getMatchingHistory(jobId);
    }
  }, [id, getJobById, getMatchingHistory]);

  // Handle match
  const handleMatch = async () => {
    if (!currentJob?.id) return;

    // Check if API key is configured
    const apiKey = await window.api.getApiKey();
    if (!apiKey) {
      if (window.confirm('Kein API-Key hinterlegt. Zu Einstellungen?')) {
        navigate('/settings');
      }
      return;
    }

    try {
      await matchJob(currentJob.id);
      setMatchSnackbarOpen(true);
    } catch (error) {
      console.error('Match failed:', error);
      // Error is already in store, will be displayed
    }
  };

  // Handle re-match
  const handleReMatch = () => {
    if (window.confirm('Erneutes Matching kostet zusätzliche API-Tokens. Fortfahren?')) {
      handleMatch();
    }
  };

  // Handle export to Markdown
  const handleExportMarkdown = async () => {
    if (!currentJob?.id) return;

    setIsExporting(true);
    try {
      const result = await window.api.exportToMarkdown(currentJob.id);
      if (result.success) {
        setExportSnackbarMessage('Markdown-Export erfolgreich erstellt');
        setExportSnackbarSeverity('success');
      } else {
        setExportSnackbarMessage(result.error || 'Export fehlgeschlagen');
        setExportSnackbarSeverity('error');
      }
      setExportSnackbarOpen(true);
    } catch (error: any) {
      setExportSnackbarMessage(error.message || 'Export fehlgeschlagen');
      setExportSnackbarSeverity('error');
      setExportSnackbarOpen(true);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle export to PDF
  const handleExportPdf = async () => {
    if (!currentJob?.id) return;

    setIsExporting(true);
    try {
      const result = await window.api.exportToPdf(currentJob.id);
      if (result.success) {
        setExportSnackbarMessage('PDF-Export erfolgreich erstellt');
        setExportSnackbarSeverity('success');
      } else {
        setExportSnackbarMessage(result.error || 'Export fehlgeschlagen');
        setExportSnackbarSeverity('error');
      }
      setExportSnackbarOpen(true);
    } catch (error: any) {
      setExportSnackbarMessage(error.message || 'Export fehlgeschlagen');
      setExportSnackbarSeverity('error');
      setExportSnackbarOpen(true);
    } finally {
      setIsExporting(false);
    }
  };

  // Handle delete - open dialog
  const handleDeleteClick = () => {
    setDeletionError(null); // Clear any previous errors
    setDeleteDialogOpen(true);
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (!currentJob?.id) return;

    try {
      await deleteJob(currentJob.id);
      setDeleteDialogOpen(false);
      navigate('/jobs');
    } catch (err) {
      console.error('Failed to delete job:', err);
      // Keep dialog open and show error to user
      const errorMessage = err instanceof Error ? err.message : 'Fehler beim Löschen des Jobs';
      setDeletionError(errorMessage);
      setSnackbarOpen(true);
    }
  };

  // Handle delete cancel
  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setDeletionError(null); // Clear error when canceling
  };

  // Handle snackbar close
  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  // Handle edit
  const handleEdit = () => {
    if (currentJob?.id) {
      navigate(`/jobs/${currentJob.id}/edit`);
    }
  };

  // Format date
  const formatDate = (date?: Date | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Helper functions for matching UI
  const getScoreColor = (score: number): string => {
    if (score >= 70) return '#4caf50'; // green
    if (score >= 40) return '#ff9800'; // orange
    return '#f44336'; // red
  };

  const getCategoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      perfect: 'Perfekter Match',
      good: 'Guter Fit',
      needs_work: 'Lücken schließbar',
      poor: 'Schwacher Match'
    };
    return labels[category] || category;
  };

  const getCategoryColor = (category: string): 'success' | 'warning' | 'error' | 'default' => {
    const colors: Record<string, 'success' | 'warning' | 'error'> = {
      perfect: 'success',
      good: 'success',
      needs_work: 'warning',
      poor: 'error'
    };
    return colors[category] || 'default';
  };

  // Get the matching result to display (current or latest from history)
  const displayedMatching = currentMatching || (matchingHistory.length > 0 ? matchingHistory[0] : null);

  // Get status display
  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' }> = {
      'new': { label: 'Neu', color: 'info' },
      'reviewing': { label: 'In Prüfung', color: 'primary' },
      'applied': { label: 'Beworben', color: 'warning' },
      'rejected': { label: 'Abgelehnt', color: 'error' },
      'offer': { label: 'Angebot', color: 'success' },
      'accepted': { label: 'Angenommen', color: 'success' }
    };
    return statusMap[status] || { label: status, color: 'default' };
  };

  // Loading state
  if (isLoading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  // Error state
  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Button
          startIcon={<BackIcon />}
          onClick={() => navigate('/jobs')}
        >
          Zurück zur Übersicht
        </Button>
      </Container>
    );
  }

  // No job found
  if (!currentJob) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="warning" sx={{ mb: 3 }}>
          Job nicht gefunden
        </Alert>
        <Button
          startIcon={<BackIcon />}
          onClick={() => navigate('/jobs')}
        >
          Zurück zur Übersicht
        </Button>
      </Container>
    );
  }

  const statusInfo = getStatusInfo(currentJob.status);

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header with actions */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Button
            startIcon={<BackIcon />}
            onClick={() => navigate('/jobs')}
            sx={{ mb: 2 }}
          >
            Zurück zur Übersicht
          </Button>
          <Typography variant="h4" component="h1" gutterBottom>
            {currentJob.title}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="h6" color="text.secondary">
              {currentJob.company}
            </Typography>
            <Chip
              label={statusInfo.label}
              color={statusInfo.color}
              size="medium"
            />
          </Box>
        </Box>

        <Stack direction="row" spacing={1}>
          <Tooltip title="Job bearbeiten">
            <IconButton
              color="primary"
              onClick={handleEdit}
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Job löschen">
            <IconButton
              color="error"
              onClick={handleDeleteClick}
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* Key Information Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Location */}
        {currentJob.location && (
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <LocationIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="subtitle2" color="text.secondary">
                    Standort
                  </Typography>
                </Box>
                <Typography variant="body1" fontWeight="medium">
                  {currentJob.location}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Salary */}
        {currentJob.salaryRange && (
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <SalaryIcon sx={{ mr: 1, color: 'success.main' }} />
                  <Typography variant="subtitle2" color="text.secondary">
                    Gehalt
                  </Typography>
                </Box>
                <Typography variant="body1" fontWeight="medium">
                  {currentJob.salaryRange}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Remote Option */}
        {currentJob.remoteOption && (
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <RemoteIcon sx={{ mr: 1, color: 'info.main' }} />
                  <Typography variant="subtitle2" color="text.secondary">
                    Remote
                  </Typography>
                </Box>
                <Typography variant="body1" fontWeight="medium">
                  {currentJob.remoteOption}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Posted Date */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <DateIcon sx={{ mr: 1, color: 'text.secondary' }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Veröffentlicht
                </Typography>
              </Box>
              <Typography variant="body1" fontWeight="medium">
                {formatDate(currentJob.postedDate)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Left Column - Details */}
        <Grid item xs={12} md={8}>
          {/* Full Description */}
          {currentJob.fullText && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <DescriptionIcon sx={{ mr: 1 }} />
                <Typography variant="h6">
                  Stellenbeschreibung
                </Typography>
              </Box>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                {currentJob.fullText}
              </Typography>
            </Paper>
          )}

          {/* Contract Type */}
          {currentJob.contractType && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Vertragsart
              </Typography>
              <Typography variant="body1">
                {currentJob.contractType}
              </Typography>
            </Paper>
          )}

          {/* Source & URL */}
          {(currentJob.sourceName || currentJob.url) && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Quelle
              </Typography>
              {currentJob.sourceName && (
                <Typography variant="body1" gutterBottom>
                  <strong>Plattform:</strong> {currentJob.sourceName}
                </Typography>
              )}
              {currentJob.url && (
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                  <LinkIcon sx={{ mr: 1, color: 'primary.main' }} />
                  <a
                    href={currentJob.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'inherit', textDecoration: 'underline' }}
                  >
                    Zur Stellenanzeige
                  </a>
                </Box>
              )}
            </Paper>
          )}

          {/* Notes */}
          {currentJob.notes && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Notizen
              </Typography>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                {currentJob.notes}
              </Typography>
            </Paper>
          )}
        </Grid>

        {/* Right Column - Metadata */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Details
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Match Score */}
              {currentJob.matchScore !== null && currentJob.matchScore !== undefined && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Match Score
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography variant="h4" color="primary.main" sx={{ mr: 1 }}>
                      {Math.round(currentJob.matchScore)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      / 100
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* Deadline */}
              {currentJob.deadline && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Bewerbungsfrist
                  </Typography>
                  <Typography variant="body1">
                    {formatDate(currentJob.deadline)}
                  </Typography>
                </Box>
              )}

              {/* Import Method */}
              {currentJob.importMethod && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Importmethode
                  </Typography>
                  <Chip
                    label={currentJob.importMethod}
                    size="small"
                    variant="outlined"
                  />
                </Box>
              )}

              {/* Timestamps */}
              <Divider />
              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Erstellt
                </Typography>
                <Typography variant="body2">
                  {formatDate(currentJob.createdAt)}
                </Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Zuletzt aktualisiert
                </Typography>
                <Typography variant="body2">
                  {formatDate(currentJob.updatedAt)}
                </Typography>
              </Box>
            </Box>
          </Paper>

          {/* Actions */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Aktionen
            </Typography>
            <Stack spacing={2}>
              <Button
                variant="contained"
                startIcon={<EditIcon />}
                onClick={handleEdit}
                fullWidth
              >
                Bearbeiten
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleDeleteClick}
                fullWidth
              >
                Löschen
              </Button>
            </Stack>
          </Paper>

          {/* Export Actions */}
          <Paper sx={{ p: 3, mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              <DownloadIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
              Exportieren
            </Typography>
            <Stack spacing={2}>
              <Button
                variant="outlined"
                startIcon={isExporting ? <CircularProgress size={18} /> : <MarkdownIcon />}
                onClick={handleExportMarkdown}
                disabled={isExporting}
                fullWidth
              >
                Als Markdown
              </Button>
              <Button
                variant="outlined"
                startIcon={isExporting ? <CircularProgress size={18} /> : <PdfIcon />}
                onClick={handleExportPdf}
                disabled={isExporting}
                color="primary"
                fullWidth
              >
                Als PDF
              </Button>
            </Stack>
          </Paper>

          {/* Matching Section */}
          <Box sx={{ mt: 4 }}>
            <Typography variant="h5" gutterBottom>
              Job Matching
            </Typography>

            {/* Match Button */}
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

              {displayedMatching && (
                <Tooltip title="Erneut matchen (kostet API-Tokens)">
                  <Button
                    variant="outlined"
                    onClick={handleReMatch}
                    startIcon={<RefreshIcon />}
                  >
                    Erneut matchen
                  </Button>
                </Tooltip>
              )}
            </Box>

            {matchingError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {matchingError}
              </Alert>
            )}

            {/* Matching Result */}
            {displayedMatching && (
              <Paper sx={{ mt: 3, p: 3 }}>
                <Typography variant="h5" gutterBottom>
                  Matching-Ergebnis
                </Typography>

                {/* Score Badge */}
                <Box sx={{ textAlign: 'center', my: 3 }}>
                  <Box
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 120,
                      height: 120,
                      borderRadius: '50%',
                      bgcolor: getScoreColor(displayedMatching.matchScore),
                      color: 'white',
                      fontSize: '2.5rem',
                      fontWeight: 'bold'
                    }}
                  >
                    {displayedMatching.matchScore}%
                  </Box>

                  <Chip
                    label={getCategoryLabel(displayedMatching.matchCategory)}
                    color={getCategoryColor(displayedMatching.matchCategory)}
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
                    {displayedMatching.strengths.map((strength, idx) => (
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

                  {displayedMatching.gaps.missingSkills.length === 0 ? (
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
                          {displayedMatching.gaps.missingSkills.map((gap, idx) => (
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

                  {displayedMatching.gaps.experienceGaps.length > 0 && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="subtitle2" gutterBottom>Erfahrungs-Lücken:</Typography>
                      <List dense>
                        {displayedMatching.gaps.experienceGaps.map((gap, idx) => (
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
                    {displayedMatching.recommendations.map((rec, idx) => (
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
                    <Typography>{displayedMatching.reasoning}</Typography>
                  </AccordionDetails>
                </Accordion>
              </Paper>
            )}

            {/* Matching Success Snackbar */}
            <Snackbar
              open={matchSnackbarOpen}
              autoHideDuration={6000}
              onClose={() => setMatchSnackbarOpen(false)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
              <Alert onClose={() => setMatchSnackbarOpen(false)} severity="success" sx={{ width: '100%' }}>
                Matching erfolgreich abgeschlossen!
              </Alert>
            </Snackbar>
          </Box>
        </Grid>
      </Grid>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Job löschen?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Möchten Sie diesen Job wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
          </DialogContentText>
          {deletionError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {deletionError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} color="primary">
            Abbrechen
          </Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Löschen
          </Button>
        </DialogActions>
      </Dialog>

      {/* Error Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity="error" sx={{ width: '100%' }}>
          {deletionError || 'Ein Fehler ist aufgetreten'}
        </Alert>
      </Snackbar>

      {/* Export Snackbar */}
      <Snackbar
        open={exportSnackbarOpen}
        autoHideDuration={6000}
        onClose={() => setExportSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setExportSnackbarOpen(false)} severity={exportSnackbarSeverity} sx={{ width: '100%' }}>
          {exportSnackbarMessage}
        </Alert>
      </Snackbar>
    </Container>
  );
}
