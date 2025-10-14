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
import { UserProfile } from '../../shared/types';

interface ProfileFormProps {
  profile?: UserProfile;
  onSave?: (profile: Partial<UserProfile>) => Promise<void>;
}

export const ProfileForm: React.FC<ProfileFormProps> = ({ profile, onSave }) => {
  const [formData, setFormData] = useState({
    firstName: profile?.firstName || '',
    lastName: profile?.lastName || '',
    email: profile?.email || '',
    location: profile?.location || ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  // Debounced auto-save (2 seconds) - only if dirty, valid, and not already saving
  useEffect(() => {
    if (!isDirty || !hasChanges() || loading) {
      return; // Don't save if nothing changed or save in progress
    }

    const timer = setTimeout(() => {
      if (!emailError && onSave && !loading) {
        handleAutoSave();
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [formData, emailError, onSave, isDirty, loading]);

  const handleAutoSave = async () => {
    if (loading) return; // Prevent overlapping saves
    
    try {
      setLoading(true);
      setError(null);

      // Capture snapshot to preserve in-flight edits
      const snapshot = { ...formDataRef.current };
      await onSave?.(snapshot);

      // Update initial data after successful save
      setInitialData(snapshot);
      setIsDirty(false);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setLoading(false);
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
    setError(null);
  };

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Personal Information
        </Typography>
        {loading && <CircularProgress size={20} />}
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
