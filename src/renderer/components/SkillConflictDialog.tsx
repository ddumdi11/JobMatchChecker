/**
 * SkillConflictDialog - Dialog for resolving skill import conflicts
 *
 * Shows side-by-side comparison of existing vs. new skill data
 * Allows user to choose per-field which value to keep/replace/discard
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  RadioGroup,
  Radio,
  FormControlLabel,
  Typography,
  Box,
  Chip,
  Divider,
  Alert,
  LinearProgress
} from '@mui/material';
import {
  MergeType as MergeIcon,
  CheckCircle as CheckIcon,
  ArrowForward as ArrowIcon
} from '@mui/icons-material';

// Field resolution type
type FieldResolution = 'keep' | 'replace' | 'none';

// Field configuration for display
interface FieldConfig {
  key: string;
  label: string;
  existingKey: string;
  newKey: string;
}

const FIELD_CONFIGS: FieldConfig[] = [
  { key: 'level', label: 'Level', existingKey: 'level', newKey: 'level' },
  { key: 'yearsOfExperience', label: 'Jahre Erfahrung', existingKey: 'yearsOfExperience', newKey: 'yearsOfExperience' },
  { key: 'skillType', label: 'Skill-Typ', existingKey: 'skillType', newKey: 'skillType' },
  { key: 'futureSkillCategory', label: 'Future Skills Kategorie', existingKey: 'futureSkillCategory', newKey: 'futureSkillCategory' },
  { key: 'assessmentMethod', label: 'Bewertungsmethode', existingKey: 'assessmentMethod', newKey: 'assessmentMethod' },
  { key: 'certifications', label: 'Zertifikate', existingKey: 'certifications', newKey: 'certifications' },
  { key: 'confidence', label: 'Konfidenz', existingKey: 'confidence', newKey: 'confidence' },
  { key: 'marketRelevance', label: 'Marktrelevanz', existingKey: 'marketRelevance', newKey: 'marketRelevance' },
  { key: 'notes', label: 'Notizen', existingKey: 'notes', newKey: 'notes' }
];

interface SkillConflict {
  existingSkill: any;
  newSkill: any;
  categoryId: number;
}

interface SkillResolution {
  skillName: string;
  categoryId: number;
  fields: Record<string, FieldResolution>;
}

interface Props {
  open: boolean;
  conflicts: SkillConflict[];
  onClose: () => void;
  onResolve: (resolutions: SkillResolution[]) => void;
}

export default function SkillConflictDialog({ open, conflicts, onClose, onResolve }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [resolutions, setResolutions] = useState<SkillResolution[]>([]);
  const [fieldChoices, setFieldChoices] = useState<Record<string, FieldResolution>>({});

  // Initialize resolutions when conflicts change
  useEffect(() => {
    if (conflicts.length > 0) {
      setCurrentIndex(0);
      setResolutions([]);
      initializeFieldChoices(conflicts[0]);
    }
  }, [conflicts]);

  const initializeFieldChoices = (_conflict: SkillConflict) => {
    const choices: Record<string, FieldResolution> = {};
    FIELD_CONFIGS.forEach(config => {
      // Default: keep existing value
      choices[config.key] = 'keep';
    });
    setFieldChoices(choices);
  };

  const currentConflict = conflicts[currentIndex];

  const handleFieldChange = (field: string, value: FieldResolution) => {
    setFieldChoices(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSmartMerge = () => {
    if (!currentConflict) return;

    const choices: Record<string, FieldResolution> = {};
    FIELD_CONFIGS.forEach(config => {
      const existingVal = currentConflict.existingSkill[config.existingKey];
      const newVal = currentConflict.newSkill[config.newKey];

      // Smart merge logic:
      // - If new value exists and existing is empty: replace
      // - If new level is higher: replace
      // - If both exist and different: prefer new (for metadata)
      // - Otherwise: keep

      if (config.key === 'level') {
        const newLevel = typeof newVal === 'number' ? newVal : parseInt(newVal) || 5;
        choices[config.key] = newLevel > existingVal ? 'replace' : 'keep';
      } else if (!existingVal && newVal) {
        choices[config.key] = 'replace';
      } else if (existingVal && newVal && existingVal !== newVal) {
        // For metadata fields, prefer new values
        choices[config.key] = 'replace';
      } else {
        choices[config.key] = 'keep';
      }
    });

    setFieldChoices(choices);
  };

  const handleKeepAll = () => {
    const choices: Record<string, FieldResolution> = {};
    FIELD_CONFIGS.forEach(config => {
      choices[config.key] = 'keep';
    });
    setFieldChoices(choices);
  };

  const handleReplaceAll = () => {
    const choices: Record<string, FieldResolution> = {};
    FIELD_CONFIGS.forEach(config => {
      choices[config.key] = 'replace';
    });
    setFieldChoices(choices);
  };

  const handleNext = () => {
    if (!currentConflict) return;

    // Save current resolution
    const resolution: SkillResolution = {
      skillName: currentConflict.existingSkill.name,
      categoryId: currentConflict.categoryId,
      fields: { ...fieldChoices }
    };

    const newResolutions = [...resolutions, resolution];
    setResolutions(newResolutions);

    if (currentIndex < conflicts.length - 1) {
      // Move to next conflict
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      initializeFieldChoices(conflicts[nextIndex]);
    } else {
      // All conflicts resolved
      onResolve(newResolutions);
    }
  };

  const handleSkip = () => {
    if (currentIndex < conflicts.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      initializeFieldChoices(conflicts[nextIndex]);
    } else {
      // Skip last one, just submit what we have
      onResolve(resolutions);
    }
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined || value === '') return '(leer)';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const getValueChip = (value: any, isNew: boolean) => {
    const displayValue = formatValue(value);
    const isEmpty = displayValue === '(leer)';

    return (
      <Chip
        size="small"
        label={displayValue.length > 30 ? displayValue.substring(0, 30) + '...' : displayValue}
        color={isEmpty ? 'default' : (isNew ? 'primary' : 'secondary')}
        variant={isEmpty ? 'outlined' : 'filled'}
        sx={{ maxWidth: 150 }}
      />
    );
  };

  if (!currentConflict) return null;

  const progress = ((currentIndex + 1) / conflicts.length) * 100;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <MergeIcon />
          <Typography variant="h6">
            Skill-Konflikte lösen ({currentIndex + 1} / {conflicts.length})
          </Typography>
        </Box>
        <LinearProgress variant="determinate" value={progress} sx={{ mt: 1 }} />
      </DialogTitle>

      <DialogContent dividers>
        <Alert severity="info" sx={{ mb: 2 }}>
          <strong>{currentConflict.existingSkill.name}</strong> existiert bereits.
          Wähle für jedes Feld, ob du den bestehenden Wert behalten, den neuen übernehmen oder keinen setzen möchtest.
        </Alert>

        {/* Quick actions */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button size="small" variant="outlined" onClick={handleKeepAll}>
            Alle behalten
          </Button>
          <Button size="small" variant="outlined" onClick={handleReplaceAll}>
            Alle ersetzen
          </Button>
          <Button size="small" variant="contained" color="primary" onClick={handleSmartMerge}>
            Smart Merge
          </Button>
        </Box>

        <Divider sx={{ mb: 2 }} />

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Feld</strong></TableCell>
                <TableCell><strong>Bestehend</strong></TableCell>
                <TableCell><strong>Neu</strong></TableCell>
                <TableCell><strong>Aktion</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {FIELD_CONFIGS.map(config => {
                const existingVal = currentConflict.existingSkill[config.existingKey];
                const newVal = currentConflict.newSkill[config.newKey];
                const isDifferent = formatValue(existingVal) !== formatValue(newVal);

                return (
                  <TableRow
                    key={config.key}
                    sx={{
                      backgroundColor: isDifferent ? 'action.hover' : 'inherit'
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2" fontWeight={isDifferent ? 'bold' : 'normal'}>
                        {config.label}
                        {isDifferent && ' *'}
                      </Typography>
                    </TableCell>
                    <TableCell>{getValueChip(existingVal, false)}</TableCell>
                    <TableCell>{getValueChip(newVal, true)}</TableCell>
                    <TableCell>
                      <RadioGroup
                        row
                        value={fieldChoices[config.key] || 'keep'}
                        onChange={(e) => handleFieldChange(config.key, e.target.value as FieldResolution)}
                      >
                        <FormControlLabel
                          value="keep"
                          control={<Radio size="small" />}
                          label="Behalten"
                        />
                        <FormControlLabel
                          value="replace"
                          control={<Radio size="small" />}
                          label="Ersetzen"
                        />
                        <FormControlLabel
                          value="none"
                          control={<Radio size="small" />}
                          label="Keins"
                        />
                      </RadioGroup>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          * Felder mit Unterschieden sind hervorgehoben
        </Typography>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Abbrechen
        </Button>
        <Button onClick={handleSkip} color="warning">
          Überspringen
        </Button>
        <Button
          onClick={handleNext}
          variant="contained"
          color="primary"
          startIcon={currentIndex < conflicts.length - 1 ? <ArrowIcon /> : <CheckIcon />}
        >
          {currentIndex < conflicts.length - 1 ? 'Weiter' : 'Fertig'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
