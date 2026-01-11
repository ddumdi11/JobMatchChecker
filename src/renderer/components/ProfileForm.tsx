import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  TextField,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Snackbar
} from '@mui/material';
import { useProfileStore } from '../store/profileStore';
import { useUnsavedChangesContext } from './Layout';

export const ProfileForm: React.FC = () => {
  // Use Zustand store instead of props
  const profile = useProfileStore((state) => state.profile);
  const updateProfile = useProfileStore((state) => state.updateProfile);
  const isLoading = useProfileStore((state) => state.isLoadingProfile);
  const profileError = useProfileStore((state) => state.profileError);
  const resetErrors = useProfileStore((state) => state.resetErrors);

  // Unsaved changes context (Issue #12)
  const { setIsDirty: setContextDirty, setOnSave } = useUnsavedChangesContext();
  const [formData, setFormData] = useState({
    firstName: profile?.firstName || '',
    lastName: profile?.lastName || '',
    email: profile?.email || '',
    location: profile?.location || ''
  });

  const [success, setSuccess] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [initialData, setInitialData] = useState(formData);
  const formDataRef = useRef(formData);

  // Sync incoming profile data - handle both populated and empty profiles
  useEffect(() => {
    const newData = profile ? {
      firstName: profile.firstName ?? '',
      lastName: profile.lastName ?? '',
      email: profile.email ?? '',
      location: profile.location ?? ''
    } : {
      firstName: '',
      lastName: '',
      email: '',
      location: ''
    };
    
    setFormData(newData);
    formDataRef.current = newData;
    setInitialData(newData);
    setIsDirty(false);
    setEmailError(null);
  }, [profile]);

  // Email validation
  const validateEmail = (email: string): boolean => {
    if (!email) return true; // Optional field
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Check if data has actually changed
  const hasChanges = (): boolean => {
    return (
      formData.firstName !== initialData.firstName ||
      formData.lastName !== initialData.lastName ||
      formData.email !== initialData.email ||
      formData.location !== initialData.location
    );
  };

  // Sync dirty state with UnsavedChangesContext (Issue #12)
  useEffect(() => {
    const hasPendingChanges = isDirty && hasChanges();
    setContextDirty(hasPendingChanges);

    // Provide save action if there are unsaved changes
    if (hasPendingChanges && !emailError) {
      setOnSave(handleAutoSave);
    } else {
      setOnSave(undefined);
    }
  }, [isDirty, formData, emailError, setContextDirty, setOnSave]);

  // Debounced auto-save (2 seconds) - only if dirty, valid, and not already saving
  useEffect(() => {
    if (!isDirty || !hasChanges() || isLoading) {
      return; // Don't save if nothing changed or save in progress
    }

    const timer = setTimeout(() => {
      if (!emailError && !isLoading) {
        handleAutoSave();
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [formData, emailError, isDirty, isLoading]);

  const handleAutoSave = async () => {
    if (isLoading) return; // Prevent overlapping saves

    try {
      // Capture snapshot to preserve in-flight edits
      const snapshot = { ...formDataRef.current };
      await updateProfile(snapshot);

      // Update initial data after successful save
      setInitialData(snapshot);
      setIsDirty(false);
      setSuccess(true);
    } catch (err) {
      // Error is handled by store, just show error state
      console.error('Failed to save profile:', err);
    }
  };

  const handleChange = (field: keyof typeof formData) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;
    const newData = { ...formData, [field]: value };
    setFormData(newData);
    formDataRef.current = newData; // Keep ref in sync
    setIsDirty(true); // Mark as dirty on any change

    // Validate email on change
    if (field === 'email') {
      if (!validateEmail(value)) {
        setEmailError('Please enter a valid email address');
      } else {
        setEmailError(null);
      }
    }
  };

  const handleSnackbarClose = () => {
    setSuccess(false);
    resetErrors(); // Clear profileError so error snackbar closes properly
  };

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Personal Information
        </Typography>
        {isLoading && <CircularProgress size={20} />}
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="First Name"
          value={formData.firstName}
          onChange={handleChange('firstName')}
          required
          fullWidth
        />

        <TextField
          label="Last Name"
          value={formData.lastName}
          onChange={handleChange('lastName')}
          required
          fullWidth
        />

        <TextField
          label="Email"
          type="email"
          value={formData.email}
          onChange={handleChange('email')}
          error={!!emailError}
          helperText={emailError || 'Optional'}
          fullWidth
        />

        <TextField
          label="Location"
          value={formData.location}
          onChange={handleChange('location')}
          helperText="City or region"
          fullWidth
        />
      </Box>

      {/* Success notification */}
      <Snackbar
        open={success}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleSnackbarClose} severity="success" sx={{ width: '100%' }}>
          Profile saved successfully!
        </Alert>
      </Snackbar>

      {/* Error notification */}
      <Snackbar
        open={!!profileError}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleSnackbarClose} severity="error" sx={{ width: '100%' }}>
          {profileError}
        </Alert>
      </Snackbar>
    </Paper>
  );
};
