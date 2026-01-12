import React, { useEffect, useState, useRef, useCallback } from 'react';
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
  Divider,
  Snackbar
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
  Clear as ClearIcon,
  Keyboard as KeyboardIcon,
  AutoAwesome as AutoAwesomeIcon,
  Refresh as RefreshIcon,
  PictureAsPdf as PdfIcon
} from '@mui/icons-material';
import { CircularProgress, LinearProgress } from '@mui/material';
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

  // Local pagination state (for client-side filtered results)
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<number | null>(null);

  // Keyboard navigation state
  const [focusedRowIndex, setFocusedRowIndex] = useState<number>(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Bulk matching state
  const [isBulkMatching, setIsBulkMatching] = useState(false);
  const [_bulkMatchProgress, setBulkMatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [bulkMatchResult, setBulkMatchResult] = useState<{ matched: number; failed: number; errors: string[] } | null>(null);
  const [bulkMatchDialogOpen, setBulkMatchDialogOpen] = useState(false);
  const [unmatchedCount, setUnmatchedCount] = useState<number>(0);

  // Selection state for selective matching
  const [selectedJobIds, setSelectedJobIds] = useState<Set<number>>(new Set());

  // Bulk export state
  const [isBulkExporting, setIsBulkExporting] = useState(false);
  const [exportSnackbarOpen, setExportSnackbarOpen] = useState(false);
  const [exportSnackbarMessage, setExportSnackbarMessage] = useState('');
  const [exportSnackbarSeverity, setExportSnackbarSeverity] = useState<'success' | 'error'>('success');

  // Check if any extended filters are active
  const hasActiveExtendedFilters =
    matchScoreRange[0] > 0 ||
    matchScoreRange[1] < 100 ||
    onlyWithMatchScore ||
    remoteFilter !== 'all';

  // Helper function to normalize and match remote option
  const matchRemoteOption = (remoteOption: string | undefined, filter: string): boolean => {
    const normalized = (remoteOption || '').toLowerCase().trim();

    switch (filter) {
      case 'remote':
        // Matches: "100% remote", "remote", "vollständig remote", "full remote"
        return normalized.includes('100%') ||
               normalized === 'remote' ||
               normalized.includes('vollständig') ||
               normalized.includes('full remote');
      case 'hybrid': {
        // Matches: "hybrid", or percentage values that are not 100% or 0%
        if (normalized.includes('hybrid')) return true;
        // Check for partial remote percentages (e.g., "50% remote", "80%")
        const percentMatch = normalized.match(/(\d+)%/);
        if (percentMatch) {
          const percent = parseInt(percentMatch[1], 10);
          return percent > 0 && percent < 100;
        }
        return false;
      }
      case 'onsite':
        // Matches: "on-site", "vor ort", "office", "0%", or empty/undefined
        return normalized.includes('on-site') ||
               normalized.includes('onsite') ||
               normalized.includes('vor ort') ||
               normalized.includes('office') ||
               normalized.includes('0%') ||
               normalized === '' ||
               normalized === '-';
      default:
        return true;
    }
  };

  // Fetch jobs on mount
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Fetch unmatched job count
  useEffect(() => {
    const loadUnmatchedCount = async () => {
      try {
        const count = await window.api.getUnmatchedJobCount();
        setUnmatchedCount(count);
      } catch (error) {
        console.error('Failed to load unmatched job count:', error);
      }
    };
    loadUnmatchedCount();
  }, [jobs]); // Refresh when jobs change

  // Selection handlers
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      // Select all visible (filtered) jobs
      const allIds = new Set(filteredJobs.map(job => job.id).filter((id): id is number => id !== undefined));
      setSelectedJobIds(allIds);
    } else {
      setSelectedJobIds(new Set());
    }
  };

  const handleSelectJob = (jobId: number, checked: boolean) => {
    setSelectedJobIds(prev => {
      const next = new Set(prev);
      if (checked) {
        next.add(jobId);
      } else {
        next.delete(jobId);
      }
      return next;
    });
  };

  // Handle matching selected jobs
  const handleMatchSelected = async () => {
    // Check if API key is configured
    const apiKey = await window.api.getApiKey();
    if (!apiKey) {
      if (window.confirm('Kein API-Key hinterlegt. Zu Einstellungen wechseln?')) {
        navigate('/settings');
      }
      return;
    }

    const jobIds = Array.from(selectedJobIds);
    if (jobIds.length === 0) {
      alert('Keine Jobs ausgewählt.');
      return;
    }

    const confirmMsg = `${jobIds.length} ausgewählte Jobs matchen? Dies kostet API-Tokens für jeden Job.`;
    if (!window.confirm(confirmMsg)) {
      return;
    }

    setIsBulkMatching(true);
    setBulkMatchProgress({ current: 0, total: jobIds.length });
    setBulkMatchResult(null);

    try {
      const result = await window.api.matchSelectedJobs(jobIds);

      if (result.success) {
        setBulkMatchResult(result.data);
        setBulkMatchDialogOpen(true);
        // Clear selection after successful matching
        setSelectedJobIds(new Set());
        // Refresh jobs to show new match scores
        await fetchJobs();
        // Update unmatched count
        const newCount = await window.api.getUnmatchedJobCount();
        setUnmatchedCount(newCount);
      }
    } catch (error: any) {
      console.error('Selected jobs matching failed:', error);
      alert(`Matching fehlgeschlagen: ${error.message}`);
    } finally {
      setIsBulkMatching(false);
      setBulkMatchProgress(null);
    }
  };

  // Handle bulk match
  const handleBulkMatch = async (rematchAll: boolean = false) => {
    // Check if API key is configured
    const apiKey = await window.api.getApiKey();
    if (!apiKey) {
      if (window.confirm('Kein API-Key hinterlegt. Zu Einstellungen wechseln?')) {
        navigate('/settings');
      }
      return;
    }

    const jobCount = rematchAll ? jobs.length : unmatchedCount;
    if (jobCount === 0) {
      alert(rematchAll ? 'Keine Jobs zum Matchen vorhanden.' : 'Alle Jobs haben bereits einen Match-Score.');
      return;
    }

    const confirmMsg = rematchAll
      ? `Alle ${jobCount} Jobs neu matchen? Dies kostet API-Tokens für jeden Job.`
      : `${jobCount} Jobs ohne Match-Score matchen? Dies kostet API-Tokens für jeden Job.`;

    if (!window.confirm(confirmMsg)) {
      return;
    }

    setIsBulkMatching(true);
    setBulkMatchProgress({ current: 0, total: jobCount });
    setBulkMatchResult(null);

    try {
      const result = await window.api.bulkMatchJobs(rematchAll);

      if (result.success) {
        setBulkMatchResult(result.data);
        setBulkMatchDialogOpen(true);
        // Refresh jobs to show new match scores
        await fetchJobs();
        // Update unmatched count
        const newCount = await window.api.getUnmatchedJobCount();
        setUnmatchedCount(newCount);
      }
    } catch (error: any) {
      console.error('Bulk matching failed:', error);
      alert(`Bulk-Matching fehlgeschlagen: ${error.message}`);
    } finally {
      setIsBulkMatching(false);
      setBulkMatchProgress(null);
    }
  };

  // Handle bulk export to PDF
  const handleBulkExport = async () => {
    const jobIds = Array.from(selectedJobIds);
    if (jobIds.length === 0) {
      setExportSnackbarMessage('Keine Jobs ausgewählt');
      setExportSnackbarSeverity('error');
      setExportSnackbarOpen(true);
      return;
    }

    setIsBulkExporting(true);
    try {
      const result = await window.api.exportBulkToPdf(jobIds);
      if (result.success) {
        setExportSnackbarMessage(`${result.exportedCount} Jobs erfolgreich als PDF exportiert`);
        setExportSnackbarSeverity('success');
        setSelectedJobIds(new Set()); // Clear selection after successful export
      } else {
        setExportSnackbarMessage(result.error || 'Export fehlgeschlagen');
        setExportSnackbarSeverity('error');
      }
      setExportSnackbarOpen(true);
    } catch (error: any) {
      console.error('Bulk export failed:', error);
      setExportSnackbarMessage(error.message || 'Export fehlgeschlagen');
      setExportSnackbarSeverity('error');
      setExportSnackbarOpen(true);
    } finally {
      setIsBulkExporting(false);
    }
  };

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [searchTerm, statusFilter, matchScoreRange, onlyWithMatchScore, remoteFilter]);

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

    // Remote filter (using normalized matching)
    if (remoteFilter !== 'all') {
      result = result.filter(job => matchRemoteOption(job.remoteOption, remoteFilter));
    }

    return result;
  }, [jobs, searchTerm, matchScoreRange, onlyWithMatchScore, remoteFilter]);

  // Paginated jobs for display (client-side pagination)
  const paginatedJobs = React.useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filteredJobs.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredJobs, page, rowsPerPage]);

  // Check if all visible jobs are selected (must be after filteredJobs is defined)
  const allVisibleSelected = filteredJobs.length > 0 &&
    filteredJobs.every(job => job.id !== undefined && selectedJobIds.has(job.id));
  const someVisibleSelected = filteredJobs.some(job => job.id !== undefined && selectedJobIds.has(job.id));

  // Reset focused row when paginated jobs change
  useEffect(() => {
    setFocusedRowIndex(-1);
  }, [page, rowsPerPage, filteredJobs.length]);

  // Scroll focused row into view
  const scrollRowIntoView = useCallback((index: number) => {
    const tableContainer = tableContainerRef.current;
    if (!tableContainer) return;

    const rows = tableContainer.querySelectorAll('tbody tr');
    if (rows[index]) {
      rows[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, []);

  // Handle view details
  const handleView = useCallback((id: number) => {
    navigate(`/jobs/${id}`);
  }, [navigate]);

  // Handle edit
  const handleEdit = useCallback((id: number) => {
    navigate(`/jobs/${id}/edit`);
  }, [navigate]);

  // Handle delete - open confirmation dialog
  const handleDeleteClick = useCallback((id: number) => {
    setJobToDelete(id);
    setDeleteDialogOpen(true);
  }, []);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't handle shortcuts when dialog is open
    if (deleteDialogOpen) return;

    // Check if focus is in an input field (except for Escape)
    const activeElement = document.activeElement;
    const isInputFocused = activeElement instanceof HTMLInputElement ||
                           activeElement instanceof HTMLTextAreaElement ||
                           activeElement instanceof HTMLSelectElement;

    // Handle Escape - always works
    if (event.key === 'Escape') {
      if (isInputFocused) {
        (activeElement as HTMLElement).blur();
      }
      setFocusedRowIndex(-1);
      return;
    }

    // Don't handle other shortcuts when typing in input
    if (isInputFocused) return;

    const jobCount = paginatedJobs.length;
    if (jobCount === 0) return;

    switch (event.key) {
      case 'ArrowDown':
      case 'j': // vim-style
        event.preventDefault();
        setFocusedRowIndex(prev => {
          const newIndex = prev < jobCount - 1 ? prev + 1 : prev;
          scrollRowIntoView(newIndex);
          return newIndex;
        });
        break;

      case 'ArrowUp':
      case 'k': // vim-style
        event.preventDefault();
        setFocusedRowIndex(prev => {
          const newIndex = prev > 0 ? prev - 1 : 0;
          scrollRowIntoView(newIndex);
          return newIndex;
        });
        break;

      case 'Home':
        event.preventDefault();
        setFocusedRowIndex(0);
        scrollRowIntoView(0);
        break;

      case 'End':
        event.preventDefault();
        setFocusedRowIndex(jobCount - 1);
        scrollRowIntoView(jobCount - 1);
        break;

      case 'Enter':
        if (focusedRowIndex >= 0 && focusedRowIndex < jobCount) {
          const job = paginatedJobs[focusedRowIndex];
          if (job.id) {
            handleView(job.id);
          }
        }
        break;

      case 'e':
        event.preventDefault();
        if (focusedRowIndex >= 0 && focusedRowIndex < jobCount) {
          const job = paginatedJobs[focusedRowIndex];
          if (job.id) {
            handleEdit(job.id);
          }
        }
        break;

      case 'Delete':
      case 'Backspace':
        if (focusedRowIndex >= 0 && focusedRowIndex < jobCount) {
          event.preventDefault();
          const job = paginatedJobs[focusedRowIndex];
          if (job.id) {
            handleDeleteClick(job.id);
          }
        }
        break;

      case 'n':
        event.preventDefault();
        navigate('/jobs/add');
        break;

      case '/':
        event.preventDefault();
        searchInputRef.current?.focus();
        break;
    }
  }, [deleteDialogOpen, paginatedJobs, focusedRowIndex, navigate, scrollRowIntoView, handleView, handleEdit, handleDeleteClick]);

  // Attach keyboard listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

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

  // Handle page change (client-side pagination)
  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  // Handle rows per page change (client-side pagination)
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0); // Reset to first page when changing rows per page
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
    setPage(0);
    fetchJobs();
  };

  // Reset extended filters only
  const handleResetExtendedFilters = () => {
    setMatchScoreRange([0, 100]);
    setOnlyWithMatchScore(false);
    setRemoteFilter('all');
    setPage(0);
  };

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1">
            Job-Übersicht
          </Typography>
          <Tooltip
            title={
              <Box sx={{ p: 1 }}>
                <Typography variant="subtitle2" gutterBottom>Tastaturkürzel:</Typography>
                <Typography variant="body2">↑/↓ oder j/k - Navigation</Typography>
                <Typography variant="body2">Enter - Job öffnen</Typography>
                <Typography variant="body2">e - Bearbeiten</Typography>
                <Typography variant="body2">Delete - Löschen</Typography>
                <Typography variant="body2">n - Neuer Job</Typography>
                <Typography variant="body2">/ - Suche fokussieren</Typography>
                <Typography variant="body2">Esc - Fokus entfernen</Typography>
              </Box>
            }
            arrow
            placement="right"
          >
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.5, cursor: 'help' }}>
              <KeyboardIcon fontSize="small" color="action" />
              <Typography variant="caption" color="text.secondary">
                Tastaturkürzel verfügbar
              </Typography>
            </Box>
          </Tooltip>
        </Box>
        <Stack direction="row" spacing={1}>
          {/* Bulk Export Button */}
          {selectedJobIds.size > 0 && (
            <Tooltip title={`${selectedJobIds.size} ausgewählte Jobs als PDF exportieren`}>
              <span>
                <Button
                  variant="outlined"
                  startIcon={isBulkExporting ? <CircularProgress size={18} /> : <PdfIcon />}
                  onClick={handleBulkExport}
                  disabled={isBulkExporting}
                  color="primary"
                >
                  Bulk exportieren ({selectedJobIds.size})
                </Button>
              </span>
            </Tooltip>
          )}
          {/* Match Selected Button */}
          {selectedJobIds.size > 0 && (
            <Tooltip title={`${selectedJobIds.size} ausgewählte Jobs matchen`}>
              <span>
                <Button
                  variant="contained"
                  startIcon={isBulkMatching ? <CircularProgress size={18} /> : <AutoAwesomeIcon />}
                  onClick={handleMatchSelected}
                  disabled={isBulkMatching}
                  color="success"
                >
                  Ausgewählte matchen ({selectedJobIds.size})
                </Button>
              </span>
            </Tooltip>
          )}
          {/* Bulk Match Buttons */}
          <Tooltip title={`${unmatchedCount} Jobs ohne Match-Score matchen`}>
            <span>
              <Button
                variant="outlined"
                startIcon={isBulkMatching ? <CircularProgress size={18} /> : <AutoAwesomeIcon />}
                onClick={() => handleBulkMatch(false)}
                disabled={isBulkMatching || unmatchedCount === 0}
                color="secondary"
              >
                {unmatchedCount > 0 ? `Neue matchen (${unmatchedCount})` : 'Alle gematcht'}
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="Alle Jobs neu matchen (kostet API-Tokens)">
            <span>
              <Button
                variant="outlined"
                startIcon={isBulkMatching ? <CircularProgress size={18} /> : <RefreshIcon />}
                onClick={() => handleBulkMatch(true)}
                disabled={isBulkMatching || jobs.length === 0}
                color="warning"
              >
                Alle neu matchen
              </Button>
            </span>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/jobs/add')}
          >
            Neuen Job hinzufügen
          </Button>
        </Stack>
      </Box>

      {/* Bulk Matching Progress */}
      {isBulkMatching && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={20} />
            <Typography>
              Matching läuft... Bitte warten Sie, bis alle Jobs verarbeitet wurden.
            </Typography>
          </Box>
          <LinearProgress sx={{ mt: 1 }} />
        </Alert>
      )}

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
            inputRef={searchInputRef}
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
                <Typography variant="body2" gutterBottom id="match-score-slider-label">
                  Match-Score: {matchScoreRange[0]}% - {matchScoreRange[1]}%
                </Typography>
                <Slider
                  value={matchScoreRange}
                  onChange={(_e, newValue) => setMatchScoreRange(newValue as number[])}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${value}%`}
                  aria-labelledby="match-score-slider-label"
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
                  <TableCell padding="checkbox"></TableCell>
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
                    <TableCell padding="checkbox"><Skeleton variant="rectangular" width={24} height={24} /></TableCell>
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
            <TableContainer ref={tableContainerRef}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        indeterminate={someVisibleSelected && !allVisibleSelected}
                        checked={allVisibleSelected}
                        onChange={handleSelectAll}
                        inputProps={{ 'aria-label': 'Alle auswählen' }}
                      />
                    </TableCell>
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
                  {paginatedJobs.map((job, index) => (
                    <TableRow
                      key={job.id}
                      hover
                      selected={focusedRowIndex === index}
                      sx={{
                        cursor: 'pointer',
                        ...(focusedRowIndex === index && {
                          bgcolor: 'action.selected',
                          outline: '2px solid',
                          outlineColor: 'primary.main',
                          outlineOffset: '-2px'
                        })
                      }}
                      onClick={() => job.id && handleView(job.id)}
                    >
                      <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={job.id !== undefined && selectedJobIds.has(job.id)}
                          onChange={(e) => job.id !== undefined && handleSelectJob(job.id, e.target.checked)}
                          inputProps={{ 'aria-label': `Job ${job.title} auswählen` }}
                        />
                      </TableCell>
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
              count={filteredJobs.length}
              rowsPerPage={rowsPerPage}
              page={page}
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

      {/* Bulk Match Result Dialog */}
      <Dialog
        open={bulkMatchDialogOpen}
        onClose={() => setBulkMatchDialogOpen(false)}
        aria-labelledby="bulk-match-result-title"
      >
        <DialogTitle id="bulk-match-result-title">
          Bulk-Matching abgeschlossen
        </DialogTitle>
        <DialogContent>
          {bulkMatchResult && (
            <Box>
              <Typography variant="body1" gutterBottom>
                <strong>{bulkMatchResult.matched}</strong> Jobs erfolgreich gematcht
              </Typography>
              {bulkMatchResult.failed > 0 && (
                <Typography variant="body1" color="error" gutterBottom>
                  <strong>{bulkMatchResult.failed}</strong> Jobs fehlgeschlagen
                </Typography>
              )}
              {bulkMatchResult.errors.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Fehler:
                  </Typography>
                  <Box sx={{ maxHeight: 200, overflow: 'auto', bgcolor: 'grey.100', p: 1, borderRadius: 1 }}>
                    {bulkMatchResult.errors.slice(0, 10).map((err, idx) => (
                      <Typography key={idx} variant="body2" color="error" sx={{ fontSize: '0.75rem' }}>
                        {err}
                      </Typography>
                    ))}
                    {bulkMatchResult.errors.length > 10 && (
                      <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                        ... und {bulkMatchResult.errors.length - 10} weitere Fehler
                      </Typography>
                    )}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkMatchDialogOpen(false)} variant="contained">
            Schließen
          </Button>
        </DialogActions>
      </Dialog>

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
