import { useState, useEffect, useCallback } from 'react';
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
  InputAdornment,
  RadioGroup,
  Radio,
  FormControlLabel,
  FormControl,
  FormLabel,
  Select,
  MenuItem,
  Checkbox,
  Chip
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Save as SaveIcon,
  Check as CheckIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

interface OpenRouterModel {
  id: string;
  name: string;
  contextLength: number;
  pricing: { prompt: string; completion: string };
  isFree: boolean;
}

export default function Settings() {
  // Provider state
  const [provider, setProvider] = useState<'anthropic' | 'openrouter'>('anthropic');
  const [selectedModel, setSelectedModel] = useState('');

  // Anthropic state
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  // OpenRouter state
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false);
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [freeOnly, setFreeOnly] = useState(true);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // General state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'none' | 'valid' | 'invalid'>('none');

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [config, anthropicKey, orKey] = await Promise.all([
        window.api.getAiProviderConfig(),
        window.api.getApiKey(),
        window.api.getOpenRouterApiKey(),
      ]);

      setProvider(config.provider as 'anthropic' | 'openrouter');
      setSelectedModel(config.model);
      if (anthropicKey) setApiKey(anthropicKey);
      if (orKey) setOpenRouterKey(orKey);

      // Load models if OpenRouter is the provider
      if (config.provider === 'openrouter') {
        loadModels();
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
      setError('Fehler beim Laden der Einstellungen');
    } finally {
      setIsLoading(false);
    }
  };

  const loadModels = useCallback(async (forceRefresh = false) => {
    setIsLoadingModels(true);
    try {
      const result = await window.api.getAiModels(forceRefresh);
      setModels(result);

      // Auto-select first free model if no valid OpenRouter model is selected
      setSelectedModel(prev => {
        const isValidSelection = result.some((m: OpenRouterModel) => m.id === prev);
        if (!isValidSelection && result.length > 0) {
          const firstFree = result.find((m: OpenRouterModel) => m.isFree);
          return firstFree ? firstFree.id : result[0].id;
        }
        return prev;
      });
    } catch (err: any) {
      console.error('Failed to load models:', err);
      setError(`Modelle konnten nicht geladen werden: ${err.message || 'Unbekannter Fehler'}`);
    } finally {
      setIsLoadingModels(false);
    }
  }, []);

  const handleProviderChange = async (newProvider: 'anthropic' | 'openrouter') => {
    setProvider(newProvider);
    setError(null);
    setVerificationStatus('none');

    // Load models when switching to OpenRouter
    if (newProvider === 'openrouter' && models.length === 0) {
      loadModels();
    }
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      // Save provider + model
      await window.api.setAiProviderConfig({ provider, model: selectedModel });

      // Save Anthropic key if present
      if (apiKey.trim()) {
        await window.api.saveApiKey(apiKey.trim());
      }

      // Save OpenRouter key if present
      if (openRouterKey.trim()) {
        await window.api.saveOpenRouterApiKey(openRouterKey.trim());
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      setError(`Fehler beim Speichern: ${err.message || 'Unbekannter Fehler'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerify = async () => {
    const currentKey = provider === 'anthropic' ? apiKey.trim() : openRouterKey.trim();
    if (!currentKey) {
      setError('Bitte geben Sie einen API-Key ein');
      return;
    }

    setIsVerifying(true);
    setError(null);
    setVerificationStatus('none');

    try {
      const result = await window.api.testAiConnection(provider, currentKey, selectedModel || undefined);
      if (result.success) {
        setVerificationStatus('valid');
      } else {
        setVerificationStatus('invalid');
        setError(result.error || 'API-Key ist ungültig');
      }
    } catch (err: any) {
      setVerificationStatus('invalid');
      setError(err.message || 'Fehler bei der Verifizierung');
    } finally {
      setIsVerifying(false);
    }
  };

  // Filter models based on freeOnly toggle
  const filteredModels = freeOnly ? models.filter(m => m.isFree) : models;

  // Find selected model details
  const selectedModelInfo = models.find(m => m.id === selectedModel);

  const formatContextLength = (length: number): string => {
    if (length >= 1_000_000) return `${(length / 1_000_000).toFixed(1)}M`;
    if (length >= 1_000) return `${(length / 1_000).toFixed(0)}K`;
    return `${length}`;
  };

  const formatPricing = (model: OpenRouterModel): string => {
    if (model.isFree) return 'KOSTENLOS';
    const promptCost = parseFloat(model.pricing.prompt) * 1_000_000;
    const completionCost = parseFloat(model.pricing.completion) * 1_000_000;
    return `$${promptCost.toFixed(2)} / $${completionCost.toFixed(2)} pro 1M Tokens`;
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

      {/* AI Provider Section */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h5" gutterBottom>
          AI-Provider Konfiguration
        </Typography>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Wählen Sie den AI-Provider für Job-Matching und Textextraktion.
        </Typography>

        <Divider sx={{ mb: 3 }} />

        {/* Provider Selection */}
        <FormControl component="fieldset" sx={{ mb: 3 }}>
          <FormLabel component="legend">Provider</FormLabel>
          <RadioGroup
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value as 'anthropic' | 'openrouter')}
          >
            <FormControlLabel
              value="anthropic"
              control={<Radio />}
              label={
                <Box>
                  <Typography variant="body1">Anthropic (Claude)</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Hochwertige Ergebnisse mit Claude Sonnet 4.5
                  </Typography>
                </Box>
              }
            />
            <FormControlLabel
              value="openrouter"
              control={<Radio />}
              label={
                <Box>
                  <Typography variant="body1">OpenRouter (200+ Modelle)</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Zugang zu vielen Modellen, inklusive kostenloser Optionen
                  </Typography>
                </Box>
              }
            />
          </RadioGroup>
        </FormControl>

        <Divider sx={{ mb: 3 }} />

        {/* Anthropic Section */}
        {provider === 'anthropic' && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Anthropic API-Key
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Erhältlich auf{' '}
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                console.anthropic.com
              </a>
            </Typography>

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
              sx={{ mb: 2 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowApiKey(!showApiKey)} edge="end" disabled={!apiKey}>
                      {showApiKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </Box>
        )}

        {/* OpenRouter Section */}
        {provider === 'openrouter' && (
          <Box>
            <Typography variant="h6" gutterBottom>
              OpenRouter API-Key
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Erhältlich auf{' '}
              <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                openrouter.ai/keys
              </a>
            </Typography>

            <TextField
              fullWidth
              label="OpenRouter API-Key"
              type={showOpenRouterKey ? 'text' : 'password'}
              value={openRouterKey}
              onChange={(e) => {
                setOpenRouterKey(e.target.value);
                setVerificationStatus('none');
                setError(null);
              }}
              placeholder="sk-or-..."
              disabled={isSaving || isVerifying}
              sx={{ mb: 3 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowOpenRouterKey(!showOpenRouterKey)} edge="end" disabled={!openRouterKey}>
                      {showOpenRouterKey ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            {/* Model Selection */}
            <Typography variant="h6" gutterBottom>
              Modell-Auswahl
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={freeOnly}
                    onChange={(e) => setFreeOnly(e.target.checked)}
                  />
                }
                label="Nur kostenlose Modelle"
              />
              <Button
                size="small"
                variant="outlined"
                startIcon={isLoadingModels ? <CircularProgress size={16} /> : <RefreshIcon />}
                onClick={() => loadModels(true)}
                disabled={isLoadingModels}
              >
                Aktualisieren
              </Button>
            </Box>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <Select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                displayEmpty
                disabled={isLoadingModels || filteredModels.length === 0}
              >
                {filteredModels.length === 0 && (
                  <MenuItem value="" disabled>
                    {isLoadingModels ? 'Modelle werden geladen...' : 'Keine Modelle verfügbar'}
                  </MenuItem>
                )}
                {filteredModels.map(m => (
                  <MenuItem key={m.id} value={m.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                      <Typography variant="body2" sx={{ flexGrow: 1 }}>
                        {m.name}
                      </Typography>
                      <Chip
                        label={formatContextLength(m.contextLength)}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: '0.7rem' }}
                      />
                      {m.isFree && (
                        <Chip label="FREE" size="small" color="success" sx={{ fontSize: '0.7rem' }} />
                      )}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Model Info */}
            {selectedModelInfo && (
              <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 1, mb: 2 }}>
                <Typography variant="body2">
                  <strong>Kontextfenster:</strong> {formatContextLength(selectedModelInfo.contextLength)} Tokens
                </Typography>
                <Typography variant="body2">
                  <strong>Kosten:</strong> {formatPricing(selectedModelInfo)}
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Verification Status */}
        {verificationStatus === 'valid' && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Verbindung erfolgreich! Der API-Key funktioniert.
          </Alert>
        )}
        {verificationStatus === 'invalid' && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Verbindungstest fehlgeschlagen.
          </Alert>
        )}

        {/* Error / Success Messages */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {saveSuccess && (
          <Alert severity="success" sx={{ mb: 2 }} icon={<CheckIcon />}>
            Einstellungen erfolgreich gespeichert!
          </Alert>
        )}

        {/* Action Buttons */}
        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
          <Button
            variant="contained"
            startIcon={isSaving ? <CircularProgress size={20} /> : <SaveIcon />}
            onClick={handleSaveConfig}
            disabled={isSaving || isVerifying}
          >
            {isSaving ? 'Speichern...' : 'Speichern'}
          </Button>

          <Button
            variant="outlined"
            startIcon={isVerifying ? <CircularProgress size={20} /> : <CheckIcon />}
            onClick={handleVerify}
            disabled={
              isSaving || isVerifying ||
              (provider === 'anthropic' ? !apiKey.trim() : !openRouterKey.trim())
            }
          >
            {isVerifying ? 'Prüfen...' : 'Verbindung testen'}
          </Button>
        </Stack>

        {/* Help Text */}
        <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Hinweis zur Nutzung:
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {provider === 'anthropic' ? (
              <>
                • Der API-Key wird sicher lokal auf Ihrem Gerät gespeichert
                <br />
                • Pro Job-Matching fallen ca. 0,01-0,03€ an (abhängig von der Komplexität)
                <br />
                • Mit &quot;Verbindung testen&quot; können Sie prüfen, ob der Key funktioniert
              </>
            ) : (
              <>
                • OpenRouter bietet Zugang zu 200+ AI-Modellen über eine einheitliche API
                <br />
                • Kostenlose Modelle (z.B. DeepSeek, Qwen) eignen sich zum Testen und Bulk-Matching
                <br />
                • Der API-Key wird sicher lokal auf Ihrem Gerät gespeichert
                <br />
                • Kostenlose Modelle können langsamer sein als bezahlte
              </>
            )}
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}
