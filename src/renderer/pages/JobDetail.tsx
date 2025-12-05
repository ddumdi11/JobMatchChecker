import { useEffect } from 'react';
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
  Stack
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  LocationOn as LocationIcon,
  Business as CompanyIcon,
  CalendarToday as DateIcon,
  AttachMoney as SalaryIcon,
  Home as RemoteIcon,
  Link as LinkIcon,
  Description as DescriptionIcon
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

  // Fetch job on mount
  useEffect(() => {
    if (id) {
      getJobById(parseInt(id, 10));
    }
  }, [id, getJobById]);

  // Handle delete
  const handleDelete = async () => {
    if (!currentJob?.id) return;

    if (window.confirm(`Möchten Sie "${currentJob.title}" wirklich löschen?`)) {
      try {
        await deleteJob(currentJob.id);
        navigate('/jobs');
      } catch (err) {
        console.error('Failed to delete job:', err);
      }
    }
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

  // Get status display
  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' }> = {
      'new': { label: 'Neu', color: 'info' },
      'interesting': { label: 'Interessant', color: 'primary' },
      'applied': { label: 'Beworben', color: 'warning' },
      'rejected': { label: 'Abgelehnt', color: 'error' },
      'archived': { label: 'Archiviert', color: 'default' }
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
          <IconButton
            color="primary"
            onClick={handleEdit}
            title="Bearbeiten"
          >
            <EditIcon />
          </IconButton>
          <IconButton
            color="error"
            onClick={handleDelete}
            title="Löschen"
          >
            <DeleteIcon />
          </IconButton>
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
                onClick={handleDelete}
                fullWidth
              >
                Löschen
              </Button>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}
