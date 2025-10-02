import React, { useState, useEffect, useCallback } from 'react';
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

  // Sync incoming profile data
  useEffect(() => {
    if (!profile) return;
    setFormData({
      firstName: profile.firstName ?? '',
      lastName: profile.lastName ?? '',
      email: profile.email ?? '',
      location: profile.location ?? ''
    });
    setEmailError(null);
  }, [profile]);

  // Email validation
  const validateEmail = (email: string): boolean => {
    if (!email) return true; // Optional field
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // ...rest of the component
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
          disabled={loading}
        />

        <TextField
          label="Last Name"
          value={formData.lastName}
          onChange={handleChange('lastName')}
          required
          fullWidth
          disabled={loading}
        />

        <TextField
          label="Email"
          type="email"
          value={formData.email}
          onChange={handleChange('email')}
          error={!!emailError}
          helperText={emailError || 'Optional'}
          fullWidth
          disabled={loading}
        />

        <TextField
          label="Location"
          value={formData.location}
          onChange={handleChange('location')}
          helperText="City or region"
          fullWidth
          disabled={loading}
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
