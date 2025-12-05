import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Stepper,
  Step,
  StepLabel,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';

/**
 * First Run Dialog - Onboarding Wizard
 * Sunday Block 1 - Task 3.8
 */

interface FirstRunDialogProps {
  open: boolean;
  onComplete: () => void;
}

const steps = ['Willkommen', 'Profil erstellen', 'API-Key', 'Fertig'];

export default function FirstRunDialog({ open, onComplete }: FirstRunDialogProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [skipped, setSkipped] = useState(new Set<number>());

  // Profile form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');

  // API Key state
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'none' | 'valid' | 'invalid'>('none');

  // General state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user already has profile on mount
  useEffect(() => {
    checkExistingProfile();
  }, []);

  const checkExistingProfile = async () => {
    try {
      const profile = await window.api.getProfile();
      if (profile && profile.id) {
        // User already has a profile, skip onboarding
        onComplete();
      }
    } catch (err) {
      // No profile exists, continue with onboarding
      console.log('No existing profile, showing onboarding');
    }
  };

  const isStepSkipped = (step: number) => {
    return skipped.has(step);
  };

  const handleNext = async () => {
    setError(null);

    // Step 1: Profile creation
    if (activeStep === 1) {
      if (!firstName.trim() || !lastName.trim()) {
        setError('Bitte geben Sie mindestens Vor- und Nachname ein');
        return;
      }

      setIsSaving(true);
      try {
        const result = await window.api.createProfile({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          location: location.trim() || null
        });
        setIsSaving(false);
        setActiveStep((prevActiveStep) => prevActiveStep + 1);
      } catch (err: any) {
        console.error('Error creating profile:', err);
        setError(err.message || 'Fehler beim Erstellen des Profils');
        setIsSaving(false);
        return;
      }
    }
    // Step 2: API Key (optional)
    else if (activeStep === 2) {
      if (apiKey.trim()) {
        // Verify before saving
        setIsVerifying(true);
        try {
          const result = await window.api.verifyApiKey(apiKey.trim());

          if (result.success) {
            await window.api.saveApiKey(apiKey.trim());
            setVerificationStatus('valid');
            setIsVerifying(false);
            setActiveStep((prevActiveStep) => prevActiveStep + 1);
          } else {
            setVerificationStatus('invalid');
            const errorMsg = result.error
              ? `API-Key ist ungültig: ${result.error}`
              : 'API-Key ist ungültig. Bitte überprüfen Sie den Key.';
            setError(errorMsg);
            setIsVerifying(false);
            return;
          }
        } catch (err: any) {
          console.error('Error during verification:', err);
          setVerificationStatus('invalid');
          setError(err.message || 'Fehler bei der Verifizierung des API-Keys');
          setIsVerifying(false);
          return;
        }
      } else {
        // Skip API key setup
        setActiveStep((prevActiveStep) => prevActiveStep + 1);
      }
    }
    // Other steps
    else {
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
    setError(null);
  };

  const handleSkip = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
    setSkipped((prevSkipped) => {
      const newSkipped = new Set(prevSkipped.values());
      newSkipped.add(activeStep);
      return newSkipped;
    });
    setError(null);
  };

  const handleFinish = () => {
    onComplete();
  };

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography variant="h5" gutterBottom>
              Willkommen bei JobMatchChecker!
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 2, mb: 3 }}>
              Diese App hilft Ihnen, Jobangebote intelligent mit Ihrem Profil abzugleichen und die besten Matches zu finden.
            </Typography>
            <Box sx={{ mt: 4, textAlign: 'left', bgcolor: 'grey.50', p: 3, borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Was Sie mit dieser App können:
              </Typography>
              <Typography variant="body2" component="div" color="text.secondary">
                • Job-Angebote erfassen und verwalten
                <br />
                • Ihr Profil und Skills pflegen
                <br />
                • KI-gestütztes Job-Matching durchführen
                <br />
                • Skill-Lücken identifizieren und Empfehlungen erhalten
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
              Lassen Sie uns mit der Einrichtung beginnen!
            </Typography>
          </Box>
        );

      case 1:
        return (
          <Box sx={{ py: 2 }}>
            <Typography variant="h6" gutterBottom>
              Erstellen Sie Ihr Profil
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Diese Informationen werden für das Job-Matching verwendet.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                required
                fullWidth
                label="Vorname"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={isSaving}
              />
              <TextField
                required
                fullWidth
                label="Nachname"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={isSaving}
              />
              <TextField
                fullWidth
                label="E-Mail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSaving}
              />
              <TextField
                fullWidth
                label="Telefon"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isSaving}
              />
              <TextField
                fullWidth
                label="Standort"
                placeholder="z.B. Berlin, Deutschland"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={isSaving}
              />
            </Box>

            <Alert severity="info" sx={{ mt: 2 }}>
              Sie können Ihr Profil später jederzeit unter "Profil" erweitern und Skills hinzufügen.
            </Alert>
          </Box>
        );

      case 2:
        return (
          <Box sx={{ py: 2 }}>
            <Typography variant="h6" gutterBottom>
              API-Key einrichten (optional)
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Für das KI-gestützte Job-Matching benötigen Sie einen Anthropic API-Key. Sie können diesen Schritt überspringen und später einrichten.
            </Typography>

            <TextField
              fullWidth
              label="Anthropic API-Key"
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setVerificationStatus('none');
                setError(null);
              }}
              placeholder="sk-ant-..."
              disabled={isVerifying}
              sx={{ mb: 2 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowApiKey(!showApiKey)}
                      edge="end"
                      disabled={!apiKey}
                    >
                      {showApiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            {verificationStatus === 'valid' && (
              <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
                API-Key ist gültig!
              </Alert>
            )}

            {verificationStatus === 'invalid' && (
              <Alert severity="error" sx={{ mb: 2 }}>
                API-Key ist ungültig
              </Alert>
            )}

            <Box sx={{ bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Wo bekomme ich einen API-Key?
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Besuchen Sie{' '}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'inherit' }}
                >
                  console.anthropic.com
                </a>{' '}
                und erstellen Sie einen neuen API-Key. Pro Job-Matching fallen ca. 0,01-0,03€ an.
              </Typography>
            </Box>

            <Alert severity="info" sx={{ mt: 2 }}>
              Sie können den API-Key auch später unter "Einstellungen" hinzufügen.
            </Alert>
          </Box>
        );

      case 3:
        return (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CheckCircleIcon color="success" sx={{ fontSize: 80, mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              Alles bereit!
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 2, mb: 3 }}>
              Ihr Profil wurde erfolgreich erstellt. Sie können jetzt mit dem Job-Matching beginnen.
            </Typography>

            <Box sx={{ mt: 4, textAlign: 'left', bgcolor: 'grey.50', p: 3, borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Nächste Schritte:
              </Typography>
              <Typography variant="body2" component="div" color="text.secondary">
                1. Fügen Sie Ihre Skills unter "Profil" hinzu
                <br />
                2. Erfassen Sie Jobangebote unter "Jobs"
                <br />
                3. Nutzen Sie das KI-Matching, um die besten Matches zu finden
                {!apiKey && (
                  <>
                    <br />
                    4. Richten Sie Ihren API-Key unter "Einstellungen" ein
                  </>
                )}
              </Typography>
            </Box>
          </Box>
        );

      default:
        return 'Unknown step';
    }
  };

  const canProceed = () => {
    if (activeStep === 1) {
      return firstName.trim() && lastName.trim() && !isSaving;
    }
    if (activeStep === 2) {
      return !isVerifying;
    }
    return true;
  };

  const isSkippable = () => {
    return activeStep === 2; // Only API Key step is skippable
  };

  return (
    <Dialog
      open={open}
      maxWidth="md"
      fullWidth
      disableEscapeKeyDown
      aria-labelledby="first-run-dialog-title"
    >
      <DialogTitle id="first-run-dialog-title">
        Ersteinrichtung
      </DialogTitle>

      <DialogContent dividers>
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label, index) => {
            const stepProps: { completed?: boolean } = {};
            const labelProps: { optional?: React.ReactNode } = {};

            if (isStepSkipped(index)) {
              stepProps.completed = false;
            }

            return (
              <Step key={label} {...stepProps}>
                <StepLabel {...labelProps}>{label}</StepLabel>
              </Step>
            );
          })}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {getStepContent(activeStep)}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button
          color="inherit"
          disabled={activeStep === 0 || activeStep === steps.length - 1}
          onClick={handleBack}
        >
          Zurück
        </Button>

        <Box sx={{ flex: '1 1 auto' }} />

        {isSkippable() && (
          <Button color="inherit" onClick={handleSkip}>
            Überspringen
          </Button>
        )}

        {activeStep === steps.length - 1 ? (
          <Button variant="contained" onClick={handleFinish}>
            Fertig
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={!canProceed()}
            startIcon={isSaving || isVerifying ? <CircularProgress size={20} /> : null}
          >
            {isSaving ? 'Speichern...' : isVerifying ? 'Prüfen...' : 'Weiter'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
