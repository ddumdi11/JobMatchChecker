import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Paper,
  Typography,
  Slider,
  Alert,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import {
  RemoteWorkPreference,
  isValidRemoteWorkRange
} from '../../shared/types';
import { useProfileStore, Preferences } from '../store/profileStore';
import { useUnsavedChangesContext } from './Layout';

const REMOTE_WORK_OPTIONS: { value: RemoteWorkPreference; label: string }[] = [
  { value: 'remote_only', label: 'Remote Only' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'on_site', label: 'On-Site' },
  { value: 'flexible', label: 'Flexible' }
];

// Helper: Extract only persistent preferences (exclude UI-only locationInput)
const getPreferencesPayload = (data: {
  minSalary?: number;
  maxSalary?: number;
  preferredLocations: string[];
  locationInput: string;
  remoteWorkPreference: RemoteWorkPreference;
  preferredRemotePercentage: number;
  acceptableRemoteMin: number;
  acceptableRemoteMax: number;
}) => ({
  minSalary: data.minSalary,
  maxSalary: data.maxSalary,
  preferredLocations: data.preferredLocations,
  remoteWorkPreference: data.remoteWorkPreference,
  preferredRemotePercentage: data.preferredRemotePercentage,
  acceptableRemoteMin: data.acceptableRemoteMin,
  acceptableRemoteMax: data.acceptableRemoteMax
});

export const PreferencesPanel: React.FC = () => {
  // Unsaved changes context (Issue #12)
  const { setIsDirty, setOnSave } = useUnsavedChangesContext();

  // Store hooks
  const preferences = useProfileStore(state => state.preferences);
  const isLoading = useProfileStore(state => state.isLoadingPreferences);
  const error = useProfileStore(state => state.preferencesError);
  const updatePreferences = useProfileStore(state => state.updatePreferences);
  const loadPreferences = useProfileStore(state => state.loadPreferences);

  // Local form state
  const [formData, setFormData] = useState({
    minSalary: preferences?.minSalary ?? undefined,
    maxSalary: preferences?.maxSalary ?? undefined,
    preferredLocations: preferences?.preferredLocations ?? [],
    locationInput: '',
    remoteWorkPreference: (preferences?.remoteWorkPreference ?? 'flexible') as RemoteWorkPreference,
    preferredRemotePercentage: preferences?.preferredRemotePercentage ?? 50,
    acceptableRemoteMin: preferences?.acceptableRemoteMin ?? 0,
    acceptableRemoteMax: preferences?.acceptableRemoteMax ?? 100
  });

  const [success, setSuccess] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [initialFormData, setInitialFormData] = useState(formData);

  // Load preferences on mount
  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // Sync preferences from store to form
  useEffect(() => {
    if (preferences) {
      const loadedData = {
        minSalary: preferences.minSalary ?? undefined,
        maxSalary: preferences.maxSalary ?? undefined,
        preferredLocations: preferences.preferredLocations ?? [],
        locationInput: '',
        remoteWorkPreference: preferences.remoteWorkPreference ?? 'flexible',
        preferredRemotePercentage: preferences.preferredRemotePercentage ?? 50,
        acceptableRemoteMin: preferences.acceptableRemoteMin ?? 0,
        acceptableRemoteMax: preferences.acceptableRemoteMax ?? 100
      };

      // Only update if data actually changed (avoid overwriting after save)
      const currentPayload = getPreferencesPayload(formData);
      const loadedPayload = getPreferencesPayload(loadedData);

      if (JSON.stringify(currentPayload) !== JSON.stringify(loadedPayload)) {
        setFormData(loadedData);
        setInitialFormData(loadedData);
      }
      setValidationError(null);
    }
  }, [preferences]);

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

  // Sync dirty state with UnsavedChangesContext (Issue #12)
  useEffect(() => {
    // Compare only persistent preferences (locationInput is UI-only)
    const currentPayload = getPreferencesPayload(formData);
    const initialPayload = getPreferencesPayload(initialFormData);
    const hasChanges = JSON.stringify(currentPayload) !== JSON.stringify(initialPayload);
    setIsDirty(hasChanges);

    // Provide save action only if form is valid and has changes
    if (hasChanges && !validationError) {
      setOnSave(handleSave);
    } else {
      setOnSave(undefined);
    }
  }, [formData, initialFormData, validationError, setIsDirty, setOnSave]);

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
      return;
    }

    try {
      const preferencesToSave: Preferences = {
        minSalary: formData.minSalary,
        maxSalary: formData.maxSalary,
        preferredLocations: formData.preferredLocations,
        remoteWorkPreference: formData.remoteWorkPreference,
        preferredRemotePercentage: formData.preferredRemotePercentage,
        acceptableRemoteMin: formData.acceptableRemoteMin,
        acceptableRemoteMax: formData.acceptableRemoteMax
      };

      await updatePreferences(preferencesToSave);
      setInitialFormData(formData); // Reset dirty state (Issue #12)
      setIsDirty(false); // Immediately clear dirty flag to prevent re-trigger
      setSuccess(true);
    } catch (err) {
      // Error is handled by store
    }
  };

  const handleSnackbarClose = () => {
    setSuccess(false);
  };

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 3 }}>
        Job Preferences
      </Typography>

      {/* Error display */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => useProfileStore.setState({ preferencesError: null })}>
          {error}
        </Alert>
      )}

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
              disabled={isLoading}
            />
            <TextField
              label="Maximum Salary"
              type="number"
              value={formData.maxSalary || ''}
              onChange={handleSalaryChange('maxSalary')}
              fullWidth
              InputProps={{ inputProps: { min: 0 } }}
              disabled={isLoading}
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
              disabled={isLoading}
            />
            <Button onClick={handleLocationAdd} variant="outlined" disabled={isLoading}>
              Add
            </Button>
          </Box>
          {formData.preferredLocations.length > 0 && (
            <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {formData.preferredLocations.map((loc, idx) => (
                <Chip
                  key={idx}
                  label={loc}
                  onDelete={() => setFormData(prev => ({
                    ...prev,
                    preferredLocations: prev.preferredLocations.filter((_, i) => i !== idx)
                  }))}
                  color="primary"
                  disabled={isLoading}
                />
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
              disabled={isLoading}
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
            disabled={isLoading}
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
            disabled={isLoading}
          />

          {validationError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {validationError}
            </Alert>
          )}
        </Box>

        {/* Save Button */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={isLoading || !!validationError}
          >
            {isLoading ? 'Saving...' : 'Save Preferences'}
          </Button>
        </Box>
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
    </Paper>
  );
};
