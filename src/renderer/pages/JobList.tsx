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
  DialogActions
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Sort as SortIcon
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

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<number | null>(null);

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

  // Client-side filtering for search (until backend supports it)
  const filteredJobs = React.useMemo(() => {
    if (!searchTerm.trim()) {
      return jobs;
    }

    const term = searchTerm.toLowerCase();
    return jobs.filter(job =>
      job.title.toLowerCase().includes(term) ||
      job.company.toLowerCase().includes(term) ||
      (job.location && job.location.toLowerCase().includes(term))
    );
  }, [jobs, searchTerm]);

  // Handle sort change
  const handleSortChange = (field: string) => {
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortDirection(newDirection);
    setSortConfig({ field: field as any, direction: newDirection as any });
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
        </Box>
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
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : filteredJobs.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            {jobs.length === 0 ? (
              <>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Keine Jobs gefunden
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Fügen Sie Ihren ersten Job hinzu, um loszulegen!
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => navigate('/jobs/add')}
                >
                  Ersten Job hinzufügen
                </Button>
              </>
            ) : (
              <>
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Keine passenden Jobs gefunden
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Versuchen Sie es mit anderen Suchbegriffen oder Filtern.
                </Typography>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setSearchTerm('');
                    setStatusFilter('all');
                    handleApplyFilters();
                  }}
                >
                  Filter zurücksetzen
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
                          <IconButton
                            size="small"
                            onClick={() => job.id && handleEdit(job.id)}
                            color="primary"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => job.id && handleDeleteClick(job.id)}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
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
