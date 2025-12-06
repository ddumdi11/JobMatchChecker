import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  Skeleton,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Avatar
} from '@mui/material';
import {
  Work as WorkIcon,
  TrendingUp as TrendingUpIcon,
  CheckCircle as CheckCircleIcon,
  NewReleases as NewReleasesIcon,
  Add as AddIcon,
  ArrowForward as ArrowForwardIcon,
  Star as StarIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { JobOffer } from '../store/jobStore';

/**
 * Dashboard Page - Overview with statistics and quick access to jobs
 * Feature: Dashboard Improvements
 *
 * Note: Dashboard fetches ALL jobs directly from API (not via store pagination)
 * to ensure accurate statistics. This is acceptable as expected max is ~200-300 jobs.
 */
function Dashboard() {
  const navigate = useNavigate();

  // Local state for all jobs (bypasses store pagination)
  const [jobs, setJobs] = useState<JobOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch ALL jobs on mount (high limit to get everything)
  useEffect(() => {
    const fetchAllJobs = async () => {
      setIsLoading(true);
      try {
        // Fetch with high limit to get all jobs for accurate stats
        const result = await window.api.getJobs(
          {},
          { field: 'created_at', direction: 'desc' },
          { page: 1, limit: 1000 }
        );
        setJobs(result.jobs);
      } catch (error) {
        console.error('Failed to fetch jobs for dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllJobs();
  }, []);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalJobs = jobs.length;

    // Calculate average match score (only for jobs with a score)
    const jobsWithScore = jobs.filter(job =>
      job.matchScore !== null && job.matchScore !== undefined
    );
    const avgMatchScore = jobsWithScore.length > 0
      ? Math.round(jobsWithScore.reduce((sum, job) => sum + (job.matchScore || 0), 0) / jobsWithScore.length)
      : null;

    // Count by status
    const statusCounts = {
      new: jobs.filter(j => j.status === 'new').length,
      applied: jobs.filter(j => j.status === 'applied').length,
      reviewing: jobs.filter(j => j.status === 'reviewing').length,
      rejected: jobs.filter(j => j.status === 'rejected').length
    };

    return { totalJobs, avgMatchScore, statusCounts, jobsWithScore: jobsWithScore.length };
  }, [jobs]);

  // Get top matches (sorted by match score, top 3)
  const topMatches = useMemo(() => {
    return [...jobs]
      .filter(job => job.matchScore !== null && job.matchScore !== undefined)
      .sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0))
      .slice(0, 3);
  }, [jobs]);

  // Get recently added jobs (top 5)
  const recentJobs = useMemo(() => {
    return [...jobs].slice(0, 5);
  }, [jobs]);

  // Get match score color
  const getMatchScoreColor = (score: number): string => {
    if (score >= 80) return 'success.main';
    if (score >= 60) return 'primary.main';
    if (score >= 40) return 'warning.main';
    return 'error.main';
  };

  // Format date
  const formatDate = (date?: Date | null): string => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('de-DE');
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Übersicht über deine Job-Suche
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/jobs/add')}
        >
          Neuen Job hinzufügen
        </Button>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Total Jobs */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                  <WorkIcon />
                </Avatar>
                <Typography variant="h6" color="text.secondary">
                  Jobs gesamt
                </Typography>
              </Box>
              {isLoading ? (
                <Skeleton variant="text" width={60} height={48} />
              ) : (
                <Typography variant="h3" component="div">
                  {stats.totalJobs}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Average Match Score */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Avatar sx={{ bgcolor: 'success.main', mr: 2 }}>
                  <TrendingUpIcon />
                </Avatar>
                <Typography variant="h6" color="text.secondary">
                  Ø Match-Score
                </Typography>
              </Box>
              {isLoading ? (
                <Skeleton variant="text" width={80} height={48} />
              ) : stats.avgMatchScore !== null ? (
                <Box sx={{ display: 'flex', alignItems: 'baseline' }}>
                  <Typography variant="h3" component="div" sx={{ color: getMatchScoreColor(stats.avgMatchScore) }}>
                    {stats.avgMatchScore}
                  </Typography>
                  <Typography variant="h5" color="text.secondary" sx={{ ml: 0.5 }}>
                    %
                  </Typography>
                </Box>
              ) : (
                <Typography variant="body1" color="text.secondary">
                  Keine Daten
                </Typography>
              )}
              {stats.jobsWithScore > 0 && (
                <Typography variant="caption" color="text.secondary">
                  aus {stats.jobsWithScore} Jobs
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* New Jobs */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Avatar sx={{ bgcolor: 'info.main', mr: 2 }}>
                  <NewReleasesIcon />
                </Avatar>
                <Typography variant="h6" color="text.secondary">
                  Neue Jobs
                </Typography>
              </Box>
              {isLoading ? (
                <Skeleton variant="text" width={60} height={48} />
              ) : (
                <Typography variant="h3" component="div">
                  {stats.statusCounts.new}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Applied Jobs */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Avatar sx={{ bgcolor: 'warning.main', mr: 2 }}>
                  <CheckCircleIcon />
                </Avatar>
                <Typography variant="h6" color="text.secondary">
                  Beworben
                </Typography>
              </Box>
              {isLoading ? (
                <Skeleton variant="text" width={60} height={48} />
              ) : (
                <Typography variant="h3" component="div">
                  {stats.statusCounts.applied}
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Two Column Layout: Top Matches & Recent Jobs */}
      <Grid container spacing={3}>
        {/* Top Matches */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <StarIcon sx={{ color: 'warning.main', mr: 1 }} />
                <Typography variant="h6">
                  Top Matches
                </Typography>
              </Box>
              <Button
                size="small"
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/jobs')}
              >
                Alle anzeigen
              </Button>
            </Box>
            <Divider sx={{ mb: 2 }} />

            {isLoading ? (
              <Box>
                {[1, 2, 3].map(i => (
                  <Box key={i} sx={{ mb: 2 }}>
                    <Skeleton variant="text" width="80%" height={24} />
                    <Skeleton variant="text" width="60%" height={20} />
                  </Box>
                ))}
              </Box>
            ) : topMatches.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <TrendingUpIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography variant="body1" color="text.secondary">
                  Noch keine Jobs gematcht
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Füge Jobs hinzu und starte das Matching
                </Typography>
              </Box>
            ) : (
              <List disablePadding>
                {topMatches.map((job, index) => (
                  <ListItem
                    key={job.id}
                    component={CardActionArea}
                    onClick={() => navigate(`/jobs/${job.id}`)}
                    sx={{
                      borderRadius: 1,
                      mb: 1,
                      bgcolor: index === 0 ? 'action.hover' : 'transparent'
                    }}
                  >
                    <Box sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      bgcolor: index === 0 ? 'warning.main' : 'grey.300',
                      color: index === 0 ? 'warning.contrastText' : 'text.secondary',
                      mr: 2,
                      fontWeight: 'bold'
                    }}>
                      {index + 1}
                    </Box>
                    <ListItemText
                      primary={job.title}
                      secondary={job.company}
                      primaryTypographyProps={{ fontWeight: index === 0 ? 'bold' : 'normal' }}
                    />
                    <ListItemSecondaryAction>
                      <Chip
                        label={`${Math.round(job.matchScore || 0)}%`}
                        size="small"
                        sx={{
                          bgcolor: getMatchScoreColor(job.matchScore || 0),
                          color: 'white',
                          fontWeight: 'bold'
                        }}
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>

        {/* Recently Added */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ScheduleIcon sx={{ color: 'info.main', mr: 1 }} />
                <Typography variant="h6">
                  Zuletzt hinzugefügt
                </Typography>
              </Box>
              <Button
                size="small"
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/jobs')}
              >
                Alle anzeigen
              </Button>
            </Box>
            <Divider sx={{ mb: 2 }} />

            {isLoading ? (
              <Box>
                {[1, 2, 3, 4, 5].map(i => (
                  <Box key={i} sx={{ mb: 2 }}>
                    <Skeleton variant="text" width="80%" height={24} />
                    <Skeleton variant="text" width="40%" height={20} />
                  </Box>
                ))}
              </Box>
            ) : recentJobs.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <WorkIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography variant="body1" color="text.secondary">
                  Noch keine Jobs vorhanden
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => navigate('/jobs/add')}
                  sx={{ mt: 2 }}
                >
                  Ersten Job hinzufügen
                </Button>
              </Box>
            ) : (
              <List disablePadding>
                {recentJobs.map((job) => (
                  <ListItem
                    key={job.id}
                    component={CardActionArea}
                    onClick={() => navigate(`/jobs/${job.id}`)}
                    sx={{ borderRadius: 1, mb: 1 }}
                  >
                    <ListItemText
                      primary={job.title}
                      secondary={
                        <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <span>{job.company}</span>
                          <span>•</span>
                          <span>{formatDate(job.created_at || job.postedDate)}</span>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Chip
                        label={job.status}
                        size="small"
                        color={
                          job.status === 'new' ? 'info' :
                          job.status === 'applied' ? 'warning' :
                          job.status === 'reviewing' ? 'primary' :
                          'default'
                        }
                      />
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}

export default Dashboard;
