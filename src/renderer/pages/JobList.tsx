import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Paper,
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  InputAdornment,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Skeleton,
  Tooltip,
  Collapse,
  Slider,
  FormControlLabel,
  Checkbox,
  Divider
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Sort as SortIcon,
  WorkOff as WorkOffIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { useJobStore } from '../store/jobStore';

/**
 * JobList Page - Display all job offers with filtering, sorting, and pagination
 * Saturday Block 1 - Task 2.3
 */
export default function JobList() {
  const navigate = useNavigate();

  // Store state
  const jobs = useJobStore(state => state.jobs);
  const fetchJobs = useJobStore(state => state.fetchJobs);
  const deleteJob = useJobStore(state => state.deleteJob);
  const isLoading = useJobStore(state => state.isLoading);
  const error = useJobStore(state => state.error);
  const pagination = useJobStore(state => state.pagination);
  const sortConfig = useJobStore(state => state.sortConfig);
  const setSortConfig = useJobStore(state => state.setSortConfig);

  // Local filter state (before applying to store)
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<string>(sortConfig.field);
  const [sortDirection, setSortDirection] = useState<string>(sortConfig.direction);

  // Extended filter state
  const [showExtendedFilters, setShowExtendedFilters] = useState(false);
  const [matchScoreRange, setMatchScoreRange] = useState<number[]>([0, 100]);
  const [onlyWithMatchScore, setOnlyWithMatchScore] = useState(false);
  const [remoteFilter, setRemoteFilter] = useState<string>('all'); // 'all', 'remote', 'hybrid', 'onsite'

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<number | null>(null);

  // Check if any extended filters are active
  const hasActiveExtendedFilters =
    matchScoreRange[0] > 0 ||
    matchScoreRange[1] < 100 ||
    onlyWithMatchScore ||
    remoteFilter !== 'all';

  // Fetch jobs on mount
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Handle filter application
  const handleApplyFilters = () => {
    const filters: any = {};
    if (statusFilter !== 'all') {
      filters.status = statusFilter;
    }
    // Note: searchTerm is handled client-side (see filteredJobs)

    fetchJobs(filters, { field: sortField as any, direction: sortDirection as any });
  };

  // Client-side filtering for search and extended filters
  const filteredJobs = React.useMemo(() => {
    let result = jobs;

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(job =>
        job.title.toLowerCase().includes(term) ||
        job.company.toLowerCase().includes(term) ||
        (job.location && job.location.toLowerCase().includes(term))
      );
    }

    // Match score filter
    if (onlyWithMatchScore) {
      result = result.filter(job =>
        job.matchScore !== null && job.matchScore !== undefined
      );
    }

    // Match score range filter
    if (matchScoreRange[0] > 0 || matchScoreRange[1] < 100) {
      result = result.filter(job => {
        if (job.matchScore === null || job.matchScore === undefined) {
          return false; // Exclude jobs without match score when range is set
        }
        return job.matchScore >= matchScoreRange[0] && job.matchScore <= matchScoreRange[1];
      });
    }

    // Remote filter
    if (remoteFilter !== 'all') {
      result = result.filter(job => {
        const remote = job.remoteOption?.toLowerCase() || '';
        switch (remoteFilter) {
          case 'remote':
            return remote.includes('100%') || remote.includes('remote') || remote.includes('vollständig');
          case 'hybrid':
            return remote.includes('hybrid') || (remote.includes('%') && !remote.includes('100%'));
          case 'onsite':
            return remote.includes('on-site') || remote.includes('vor ort') || remote.includes('office') || remote === '' || remote === '-';
          default:
            return true;
        }
      });
    }

    return result;
  }, [jobs, searchTerm, matchScoreRange, onlyWithMatchScore, remoteFilter]);

  // Handle sort change
  const handleSortChange = (field: string) => {
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortDirection(newDirection);
    setSortConfig({ field: field as any, direction: newDirection as any });

    // Apply sort immediately
    const filters: any = {};
    if (statusFilter !== 'all') {
      filters.status = statusFilter;
    }
    fetchJobs(filters, { field: field as any, direction: newDirection as any });
  };

  // Handle page change
  const handleChangePage = (_event: unknown, newPage: number) => {
    fetchJobs(undefined, undefined, newPage + 1); // API uses 1-based pages
  };

  // Handle rows per page change
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newLimit = parseInt(event.target.value, 10);
    // TODO: Update pagination limit in store
    console.log('Change rows per page:', newLimit);
  };

  // Handle delete - open confirmation dialog
  const handleDeleteClick = (id: number) => {
    setJobToDelete(id);
    setDeleteDialogOpen(true);
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (jobToDelete === null) return;

    try {
      await deleteJob(jobToDelete);
      setDeleteDialogOpen(false);
      setJobToDelete(null);
      // Refresh list
      await fetchJobs();
    } catch (err) {
      console.error('Failed to delete job:', err);
      setDeleteDialogOpen(false);
      setJobToDelete(null);
    }
  };

  // Handle delete cancel
  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setJobToDelete(null);
  };

  // Handle edit
  const handleEdit = (id: number) => {
    navigate(`/jobs/${id}/edit`);
  };

  // Handle view details
  const handleView = (id: number) => {
    navigate(`/jobs/${id}`);
  };

  // Format salary range for display
  const formatSalary = (salaryRange?: string | null) => {
    if (!salaryRange) return '-';
    return salaryRange;
  };

  // Format date for display
  const formatDate = (date?: Date | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('de-DE');
  };

  // Get status color
  const getStatusColor = (status: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (status) {
      case 'new': return 'info';
      case 'interesting': return 'primary';
      case 'applied': return 'warning';
      case 'rejected': return 'error';
      case 'archived': return 'default';
      default: return 'default';
    }
  };

  // Reset all filters
  const handleResetAllFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setMatchScoreRange([0, 100]);
    setOnlyWithMatchScore(false);
    setRemoteFilter('all');
    fetchJobs();
  };

  // Reset extended filters only
  const handleResetExtendedFilters = () => {
    setMatchScoreRange([0, 100]);
    setOnlyWithMatchScore(false);
    setRemoteFilter('all');
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Job-Übersicht
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/jobs/add')}
        >
          Neuen Job hinzufügen
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        {/* Basic Filters Row */}
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            label="Suche"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Titel, Firma, Standort..."
            sx={{ minWidth: 300, flexGrow: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />

          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="all">Alle</MenuItem>
              <MenuItem value="new">Neu</MenuItem>
              <MenuItem value="interesting">Interessant</MenuItem>
              <MenuItem value="applied">Beworben</MenuItem>
              <MenuItem value="rejected">Abgelehnt</MenuItem>
              <MenuItem value="archived">Archiviert</MenuItem>
            </Select>
          </FormControl>

          <Button
            variant="contained"
            startIcon={<FilterIcon />}
            onClick={handleApplyFilters}
          >
            Filter anwenden
          </Button>

          <Button
            variant="outlined"
            onClick={() => setShowExtendedFilters(!showExtendedFilters)}
            endIcon={showExtendedFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            color={hasActiveExtendedFilters ? 'primary' : 'inherit'}
          >
            Erweiterte Filter
            {hasActiveExtendedFilters && (
              <Chip
                size="small"
                label="aktiv"
                color="primary"
                sx={{ ml: 1, height: 20 }}
              />
            )}
          </Button>
        </Box>

        {/* Extended Filters (Collapsible) */}
        <Collapse in={showExtendedFilters}>
          <Divider sx={{ my: 2 }} />
          <Box sx={{ pt: 1 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Erweiterte Filter
            </Typography>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ mt: 2 }}>
              {/* Match Score Range */}
              <Box sx={{ minWidth: 250, flexGrow: 1 }}>
                <Typography variant="body2" gutterBottom>
                  Match-Score: {matchScoreRange[0]}% - {matchScoreRange[1]}%
                </Typography>
                <Slider
                  value={matchScoreRange}
                  onChange={(_e, newValue) => setMatchScoreRange(newValue as number[])}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${value}%`}
                  min={0}
                  max={100}
                  marks={[
                    { value: 0, label: '0%' },
                    { value: 50, label: '50%' },
                    { value: 100, label: '100%' }
                  ]}
                  sx={{ mt: 1 }}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={onlyWithMatchScore}
                      onChange={(e) => setOnlyWithMatchScore(e.target.checked)}
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2">
                      Nur Jobs mit Match-Score
                    </Typography>
                  }
                />
              </Box>

              {/* Remote Filter */}
              <Box sx={{ minWidth: 180 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Remote-Option</InputLabel>
                  <Select
                    value={remoteFilter}
                    label="Remote-Option"
                    onChange={(e) => setRemoteFilter(e.target.value)}
                  >
                    <MenuItem value="all">Alle</MenuItem>
                    <MenuItem value="remote">100% Remote</MenuItem>
                    <MenuItem value="hybrid">Hybrid</MenuItem>
                    <MenuItem value="onsite">Vor Ort</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              {/* Reset Extended Filters */}
              <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
                <Tooltip title="Erweiterte Filter zurücksetzen">
                  <Button
                    variant="text"
                    color="inherit"
                    startIcon={<ClearIcon />}
                    onClick={handleResetExtendedFilters}
                    disabled={!hasActiveExtendedFilters}
                  >
                    Zurücksetzen
                  </Button>
                </Tooltip>
              </Box>
            </Stack>
          </Box>
        </Collapse>
      </Paper>

      {/* Error display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Jobs Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        {isLoading ? (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Titel</TableCell>
                  <TableCell>Firma</TableCell>
                  <TableCell>Standort</TableCell>
                  <TableCell>Gehalt</TableCell>
                  <TableCell>Remote</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Match</TableCell>
                  <TableCell>Datum</TableCell>
                  <TableCell align="right">Aktionen</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton width={180} /></TableCell>
                    <TableCell><Skeleton width={120} /></TableCell>
                    <TableCell><Skeleton width={100} /></TableCell>
                    <TableCell><Skeleton width={80} /></TableCell>
                    <TableCell><Skeleton width={60} /></TableCell>
                    <TableCell><Skeleton width={70} height={24} /></TableCell>
                    <TableCell align="center"><Skeleton width={40} /></TableCell>
                    <TableCell><Skeleton width={80} /></TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Skeleton variant="circular" width={28} height={28} />
                        <Skeleton variant="circular" width={28} height={28} />
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : filteredJobs.length === 0 ? (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            {jobs.length === 0 ? (
              <>
                <WorkOffIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Noch keine Jobs vorhanden
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Erstelle deinen ersten Job, um mit dem Matching zu starten!
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<AddIcon />}
                  onClick={() => navigate('/jobs/add')}
                >
                  Ersten Job hinzufügen
                </Button>
              </>
            ) : (
              <>
                <SearchIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  Keine passenden Jobs gefunden
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Versuche es mit anderen Suchbegriffen oder Filtern.
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<ClearIcon />}
                  onClick={handleResetAllFilters}
                >
                  Alle Filter zurücksetzen
                </Button>
              </>
            )}
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                           onClick={() => handleSortChange('title')}>
                        Titel
                        {sortField === 'title' && <SortIcon fontSize="small" />}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                           onClick={() => handleSortChange('company')}>
                        Firma
                        {sortField === 'company' && <SortIcon fontSize="small" />}
                      </Box>
                    </TableCell>
                    <TableCell>Standort</TableCell>
                    <TableCell>Gehalt</TableCell>
                    <TableCell>Remote</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                           onClick={() => handleSortChange('status')}>
                        Status
                        {sortField === 'status' && <SortIcon fontSize="small" />}
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                           onClick={() => handleSortChange('matchScore')}>
                        Match
                        {sortField === 'matchScore' && <SortIcon fontSize="small" />}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                           onClick={() => handleSortChange('postedDate')}>
                        Datum
                        {sortField === 'postedDate' && <SortIcon fontSize="small" />}
                      </Box>
                    </TableCell>
                    <TableCell align="right">Aktionen</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredJobs.map((job) => (
                    <TableRow
                      key={job.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => job.id && handleView(job.id)}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {job.title}
                        </Typography>
                      </TableCell>
                      <TableCell>{job.company}</TableCell>
                      <TableCell>{job.location || '-'}</TableCell>
                      <TableCell>{formatSalary(job.salaryRange)}</TableCell>
                      <TableCell>{job.remoteOption || '-'}</TableCell>
                      <TableCell>
                        <Chip
                          label={job.status}
                          color={getStatusColor(job.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        {job.matchScore !== null && job.matchScore !== undefined ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                            <Typography
                              variant="body2"
                              fontWeight="bold"
                              sx={{
                                color: job.matchScore >= 80 ? 'success.main' :
                                       job.matchScore >= 60 ? 'primary.main' :
                                       job.matchScore >= 40 ? 'warning.main' : 'error.main'
                              }}
                            >
                              {Math.round(job.matchScore)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              %
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            -
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(job.postedDate)}</TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Tooltip title="Job bearbeiten">
                            <IconButton
                              size="small"
                              onClick={() => job.id && handleEdit(job.id)}
                              color="primary"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Job löschen">
                            <IconButton
                              size="small"
                              onClick={() => job.id && handleDeleteClick(job.id)}
                              color="error"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              rowsPerPageOptions={[10, 20, 50]}
              component="div"
              count={pagination.total}
              rowsPerPage={pagination.limit}
              page={pagination.page - 1} // MUI uses 0-based pages
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              labelRowsPerPage="Jobs pro Seite:"
              labelDisplayedRows={({ from, to, count }) =>
                `${from}-${to} von ${count !== -1 ? count : `mehr als ${to}`}`
              }
            />
          </>
        )}
      </Paper>

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
    </Container>
  );
}
