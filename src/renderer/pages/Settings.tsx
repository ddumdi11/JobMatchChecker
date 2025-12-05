import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Box,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Stack,
  Divider,
  IconButton,
  InputAdornment
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Save as SaveIcon,
  Check as CheckIcon
} from '@mui/icons-material';

/**
 * Settings Page - API Key Management
 * Sunday Block 1 - Task 3.7
 */
export default function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'none' | 'valid' | 'invalid'>('none');

  // Load API key on mount
  useEffect(() => {
    loadApiKey();
  }, []);

  const loadApiKey = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const key = await window.api.getApiKey();
      if (key) {
        setApiKey(key);
        setVerificationStatus('none'); // Don't auto-verify on load
      }
    } catch (err) {
      console.error('Failed to load API key:', err);
      setError('Fehler beim Laden des API-Keys');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      setError('Bitte geben Sie einen API-Key ein');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      await window.api.saveApiKey(apiKey.trim());
      setSaveSuccess(true);
      setVerificationStatus('none');

      // Hide success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save API key:', err);
      setError('Fehler beim Speichern des API-Keys');
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerify = async () => {
    if (!apiKey.trim()) {
      setError('Bitte geben Sie einen API-Key ein');
      return;
    }

    setIsVerifying(true);
    setError(null);
    setVerificationStatus('none');

    try {
      const result = await window.api.verifyApiKey(apiKey.trim());

      if (result.success) {
        setVerificationStatus('valid');
      } else {
        setVerificationStatus('invalid');
        const errorMsg = result.error || 'API-Key ist ungültig';
        setError(errorMsg);
      }
    } catch (err: any) {
      setVerificationStatus('invalid');
      setError(err.message || 'Fehler bei der Verifizierung des API-Keys');
    } finally {
      setIsVerifying(false);
    }
  };

  const toggleShowApiKey = () => {
    setShowApiKey(!showApiKey);
  };

  if (isLoading) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Einstellungen
      </Typography>

      {/* API Key Section */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h5" gutterBottom>
          Anthropic API-Key
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Der API-Key wird benötigt, um Jobs mit Ihrem Profil zu matchen. Sie erhalten ihn auf{' '}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'inherit' }}
          >
            console.anthropic.com
          </a>
        </Typography>

        <Divider sx={{ mb: 3 }} />

        {/* API Key Input */}
        <Box sx={{ mb: 3 }}>
          <TextField
            fullWidth
            label="API-Key"
            type={showApiKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setVerificationStatus('none');
              setError(null);
            }}
            placeholder="sk-ant-..."
            disabled={isSaving || isVerifying}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={toggleShowApiKey}
                    edge="end"
                    disabled={!apiKey}
                    title={showApiKey ? 'API-Key verbergen' : 'API-Key anzeigen'}
                  >
                    {showApiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
        </Box>

        {/* Verification Status */}
        {verificationStatus === 'valid' && (
          <Alert severity="success" sx={{ mb: 2 }}>
            API-Key ist gültig und funktioniert!
          </Alert>
        )}

        {verificationStatus === 'invalid' && (
          <Alert severity="error" sx={{ mb: 2 }}>
            API-Key ist ungültig oder konnte nicht verifiziert werden
          </Alert>
        )}

        {/* Error Message */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Success Message */}
        {saveSuccess && (
          <Alert severity="success" sx={{ mb: 2 }} icon={<CheckIcon />}>
            API-Key erfolgreich gespeichert!
          </Alert>
        )}

        {/* Action Buttons */}
        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            startIcon={isSaving ? <CircularProgress size={20} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={!apiKey.trim() || isSaving || isVerifying}
          >
            {isSaving ? 'Speichern...' : 'Speichern'}
          </Button>

          <Button
            variant="outlined"
            startIcon={isVerifying ? <CircularProgress size={20} /> : <CheckIcon />}
            onClick={handleVerify}
            disabled={!apiKey.trim() || isSaving || isVerifying}
          >
            {isVerifying ? 'Prüfen...' : 'Verifizieren'}
          </Button>
        </Stack>

        {/* Help Text */}
        <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Hinweis zur Nutzung:
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • Der API-Key wird sicher lokal auf Ihrem Gerät gespeichert
            <br />
            • Pro Job-Matching fallen ca. 0,01-0,03€ an (abhängig von der Komplexität)
            <br />
            • Mit "Verifizieren" können Sie testen, ob der Key funktioniert
            <br />• Sie können den Key jederzeit ändern oder entfernen
          </Typography>
        </Box>
      </Paper>

      {/* Future Settings Placeholder */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Weitere Einstellungen
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Zusätzliche Optionen werden in zukünftigen Versionen hinzugefügt.
        </Typography>
      </Paper>
    </Container>
  );
}
