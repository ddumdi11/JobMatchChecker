import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  TextField,
  Paper,
  Typography,
  Slider,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Alert,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import {
  UserPreferences,
  RemoteWorkPreference,
  isValidRemoteWorkRange
} from '../../shared/types';

interface PreferencesPanelProps {
  preferences?: UserPreferences;
  onSave?: (preferences: UserPreferences) => Promise<void>;
}

const REMOTE_WORK_OPTIONS: { value: RemoteWorkPreference; label: string }[] = [
  { value: 'remote_only', label: 'Remote Only' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'on_site', label: 'On-Site' },
  { value: 'flexible', label: 'Flexible' }
];

export const PreferencesPanel: React.FC<PreferencesPanelProps> = ({ preferences, onSave }) => {
  const [formData, setFormData] = useState({
    minSalary: preferences?.minSalary ?? undefined,
    maxSalary: preferences?.maxSalary ?? undefined,
    preferredLocations: preferences?.preferredLocations ?? [],
    locationInput: '',
    remoteWorkPreference: (preferences?.remoteWorkPreference ?? 'flexible') as RemoteWorkPreference,
    preferredRemotePercentage: preferences?.preferredRemotePercentage ?? 50,
    acceptableRemoteMin: preferences?.acceptableRemoteMin ?? 0,
    acceptableRemoteMax: preferences?.acceptableRemoteMax ?? 100,
    willingToRelocate: preferences?.willingToRelocate ?? false,
    jobTypes: preferences?.jobTypes ?? {
      fullTime: true,
      partTime: false,
      contract: false
    }
  });

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isInitialMount, setIsInitialMount] = useState(true);
  const skipUnsavedRef = useRef(false);

  // Sync incoming preferences to formData
  useEffect(() => {
    if (preferences) {
      skipUnsavedRef.current = true;
      setFormData({
        minSalary: preferences.minSalary ?? undefined,
        maxSalary: preferences.maxSalary,
        preferredLocations: preferences.preferredLocations ?? [],
        locationInput: '',
        remoteWorkPreference: preferences.remoteWorkPreference ?? 'flexible',
        preferredRemotePercentage: preferences.preferredRemotePercentage ?? 50,
        acceptableRemoteMin: preferences.acceptableRemoteMin ?? 0,
        acceptableRemoteMax: preferences.acceptableRemoteMax ?? 100,
        willingToRelocate: preferences.willingToRelocate ?? false,
        jobTypes: preferences.jobTypes ? {
          fullTime: preferences.jobTypes.fullTime ?? true,
          partTime: preferences.jobTypes.partTime ?? false,
          contract: preferences.jobTypes.contract ?? false
        } : {
          fullTime: true,
          partTime: false,
          contract: false
        }
      });
      setValidationError(null);
      setHasUnsavedChanges(false);
      skipUnsavedRef.current = false;
    }
  }, [preferences]);

  // Track unsaved changes (skip initial mount and programmatic updates)
  useEffect(() => {
    if (skipUnsavedRef.current) {
      skipUnsavedRef.current = false;
      return;
    }
    if (isInitialMount) {
      setIsInitialMount(false);
    } else {
      setHasUnsavedChanges(true);
    }
  }, [formData]);

  // Validate remote work range
  useEffect(() => {
    const range = {
      min: formData.acceptableRemoteMin,
      preferred: formData.preferredRemotePercentage,
      max: formData.acceptableRemoteMax
    };

    if (!isValidRemoteWorkRange(range)) {
      setValidationError('Invalid range: Min ≤ Preferred ≤ Max (0-100%)');
    } else {
      setValidationError(null);
    }
  }, [formData.acceptableRemoteMin, formData.preferredRemotePercentage, formData.acceptableRemoteMax]);

  const handleSalaryChange = (field: 'minSalary' | 'maxSalary') => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value ? Number(event.target.value) : undefined;
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLocationAdd = () => {
    if (formData.locationInput.trim()) {
      setFormData(prev => ({
        ...prev,
        preferredLocations: [...prev.preferredLocations, prev.locationInput.trim()],
        locationInput: ''
      }));
    }
  };

  const handleRemotePercentageChange = (_: Event, value: number | number[]) => {
    const numValue = Array.isArray(value) ? value[0] : value;
    setFormData(prev => ({
      ...prev,
      preferredRemotePercentage: numValue
    }));
  };

  const handleRemoteRangeChange = (_: Event, value: number | number[]) => {
    if (Array.isArray(value)) {
      setFormData(prev => ({
        ...prev,
        acceptableRemoteMin: value[0],
        acceptableRemoteMax: value[1]
      }));
    }
  };

  const handleSave = async () => {
    // Validate before save
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const preferencesToSave: UserPreferences = {
        minSalary: formData.minSalary,
        maxSalary: formData.maxSalary,
        preferredLocations: formData.preferredLocations,
        willingToRelocate: formData.willingToRelocate,
        remoteWorkPreference: formData.remoteWorkPreference,
        preferredRemotePercentage: formData.preferredRemotePercentage,
        acceptableRemoteMin: formData.acceptableRemoteMin,
        acceptableRemoteMax: formData.acceptableRemoteMax,
        jobTypes: formData.jobTypes
      };

      await onSave?.(preferencesToSave);

      setSuccess(true);
      setHasUnsavedChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  const handleSnackbarClose = () => {
    setSuccess(false);
    setError(null);
  };

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 3 }}>
        Job Preferences
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Salary Range */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Salary Range
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Minimum Salary"
              type="number"
              value={formData.minSalary || ''}
              onChange={handleSalaryChange('minSalary')}
              fullWidth
              InputProps={{ inputProps: { min: 0 } }}
            />
            <TextField
              label="Maximum Salary"
              type="number"
              value={formData.maxSalary || ''}
              onChange={handleSalaryChange('maxSalary')}
              fullWidth
              InputProps={{ inputProps: { min: 0 } }}
            />
          </Box>
        </Box>

        {/* Location Preferences */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Preferred Location
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="City or Region"
              value={formData.locationInput}
              onChange={e => setFormData(prev => ({ ...prev, locationInput: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleLocationAdd()}
              fullWidth
            />
            <Button onClick={handleLocationAdd} variant="outlined">
              Add
            </Button>
          </Box>
          {formData.preferredLocations.length > 0 && (
            <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {formData.preferredLocations.map((loc, idx) => (
                <Typography key={idx} variant="body2" sx={{ bgcolor: 'primary.light', color: 'white', px: 1.5, py: 0.5, borderRadius: 2 }}>
                  {loc}
                </Typography>
              ))}
            </Box>
          )}
        </Box>

        {/* Remote Work Preference */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Remote Work Preference
          </Typography>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Preference Type</InputLabel>
            <Select
              value={formData.remoteWorkPreference}
              onChange={e => setFormData(prev => ({ ...prev, remoteWorkPreference: e.target.value as RemoteWorkPreference }))}
              label="Preference Type"
            >
              {REMOTE_WORK_OPTIONS.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Typography variant="body2" gutterBottom>
            Preferred Remote Work: {formData.preferredRemotePercentage}%
          </Typography>
          <Slider
            value={formData.preferredRemotePercentage}
            onChange={handleRemotePercentageChange}
            min={0}
            max={100}
            step={5}
            marks={[
              { value: 0, label: '0%' },
              { value: 50, label: '50%' },
              { value: 100, label: '100%' }
            ]}
            valueLabelDisplay="auto"
            valueLabelFormat={value => `${value}%`}
          />

          <Typography variant="body2" gutterBottom sx={{ mt: 2 }}>
            Acceptable Range: {formData.acceptableRemoteMin}% - {formData.acceptableRemoteMax}%
          </Typography>
          <Slider
            value={[formData.acceptableRemoteMin, formData.acceptableRemoteMax]}
            onChange={handleRemoteRangeChange}
            min={0}
            max={100}
            step={5}
            marks={[
              { value: 0, label: '0%' },
              { value: 50, label: '50%' },
              { value: 100, label: '100%' }
            ]}
            valueLabelDisplay="auto"
            valueLabelFormat={value => `${value}%`}
            sx={{ color: 'secondary.main' }}
          />

          {validationError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {validationError}
            </Alert>
          )}
        </Box>

        {/* Job Type Preferences */}
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Job Type
          </Typography>
          <FormGroup row>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.jobTypes.fullTime}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    jobTypes: { ...prev.jobTypes, fullTime: e.target.checked }
                  }))}
                />
              }
              label="Full-Time"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.jobTypes.partTime}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    jobTypes: { ...prev.jobTypes, partTime: e.target.checked }
                  }))}
                />
              }
              label="Part-Time"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.jobTypes.contract}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    jobTypes: { ...prev.jobTypes, contract: e.target.checked }
                  }))}
                />
              }
              label="Contract"
            />
          </FormGroup>
        </Box>

        {/* Relocation */}
        <FormControlLabel
          control={
            <Checkbox
              checked={formData.willingToRelocate}
              onChange={e => setFormData(prev => ({ ...prev, willingToRelocate: e.target.checked }))}
            />
          }
          label="Willing to relocate"
        />

        {/* Save Button */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={!hasUnsavedChanges || loading || !!validationError}
          >
            {loading ? 'Saving...' : 'Save Preferences'}
          </Button>
        </Box>

        {hasUnsavedChanges && !validationError && (
          <Alert severity="info">
            You have unsaved changes. Click "Save Preferences" to persist your updates.
          </Alert>
        )}
      </Box>

      {/* Success notification */}
      <Snackbar
        open={success}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleSnackbarClose} severity="success" sx={{ width: '100%' }}>
          Preferences saved successfully!
        </Alert>
      </Snackbar>

      {/* Error notification */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleSnackbarClose} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Paper>
  );
};
