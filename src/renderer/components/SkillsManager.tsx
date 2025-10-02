import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  TextField,
  Paper,
  Typography,
  IconButton,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Alert,
  Snackbar
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon
} from '@mui/icons-material';
import { HardSkill, SkillLevel, MAX_SKILLS_PER_PROFILE } from '../../shared/types';

const PREDEFINED_CATEGORIES = [
  'Programming Languages',
  'Frameworks & Libraries',
  'Databases',
  'DevOps & Cloud',
  'Tools & IDEs',
  'Soft Skills',
  'Domain Knowledge'
];

interface SkillsManagerProps {
  skills?: HardSkill[];
  onSave?: (skills: HardSkill[]) => Promise<void>;
}

export const SkillsManager: React.FC<SkillsManagerProps> = ({ skills = [], onSave }) => {
  const [localSkills, setLocalSkills] = useState<HardSkill[]>(skills);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<HardSkill | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form state for new/edit skill
  const [skillForm, setSkillForm] = useState({
    name: '',
    category: PREDEFINED_CATEGORIES[0],
    customCategory: '',
    level: 5 as SkillLevel,
    yearsOfExperience: undefined as number | undefined
  });

  // Track unsaved changes
  useEffect(() => {
    const changed = JSON.stringify(localSkills) !== JSON.stringify(skills);
    setHasUnsavedChanges(changed);
  }, [localSkills, skills]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleOpenDialog = (skill?: HardSkill) => {
    if (skill) {
      setEditingSkill(skill);
      const isCustomCategory = !PREDEFINED_CATEGORIES.includes(skill.category);
      setSkillForm({
        name: skill.name,
        category: isCustomCategory ? 'Custom' : skill.category,
        customCategory: isCustomCategory ? skill.category : '',
        level: skill.level,
        yearsOfExperience: skill.yearsOfExperience
      });
    } else {
      setEditingSkill(null);
      setSkillForm({
        name: '',
        category: PREDEFINED_CATEGORIES[0],
        customCategory: '',
        level: 5 as SkillLevel,
        yearsOfExperience: undefined
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingSkill(null);
  };

  const handleAddOrUpdateSkill = () => {
    // Validate max skills
    if (!editingSkill && localSkills.length >= MAX_SKILLS_PER_PROFILE) {
      setError(`Maximum ${MAX_SKILLS_PER_PROFILE} skills allowed`);
      return;
    }

    const category = skillForm.category === 'Custom'
      ? skillForm.customCategory
      : skillForm.category;

    const newSkill: HardSkill = {
      id: editingSkill?.id || Date.now(),
      name: skillForm.name,
      category,
      level: skillForm.level,
      yearsOfExperience: skillForm.yearsOfExperience
    };

    if (editingSkill) {
      setLocalSkills(prev => prev.map(s => s.id === editingSkill.id ? newSkill : s));
    } else {
      setLocalSkills(prev => [...prev, newSkill]);
    }

    handleCloseDialog();
  };

  const handleDeleteSkill = (id: number) => {
    setLocalSkills(prev => prev.filter(s => s.id !== id));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      await onSave?.(localSkills);

      setSuccess(true);
      setHasUnsavedChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save skills');
    } finally {
      setLoading(false);
    }
  };

  const handleSnackbarClose = () => {
    setSuccess(false);
    setError(null);
  };

  // Group skills by category
  const groupedSkills = localSkills.reduce((acc, skill) => {
    if (!acc[skill.category]) {
      acc[skill.category] = [];
    }
    acc[skill.category].push(skill);
    return acc;
  }, {} as Record<string, HardSkill[]>);

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Skills & Competencies
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mr: 2 }}>
          {localSkills.length} / {MAX_SKILLS_PER_PROFILE}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          disabled={localSkills.length >= MAX_SKILLS_PER_PROFILE}
        >
          Add Skill
        </Button>
      </Box>

      {/* Grouped skills display */}
      {Object.keys(groupedSkills).length === 0 ? (
        <Alert severity="info">No skills added yet. Click "Add Skill" to get started.</Alert>
      ) : (
        Object.entries(groupedSkills).map(([category, categorySkills]) => (
          <Box key={category} sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
              {category}
            </Typography>
            <List dense>
              {categorySkills.map(skill => (
                <ListItem key={skill.id} sx={{ bgcolor: 'background.default', mb: 1, borderRadius: 1 }}>
                  <ListItemText
                    primary={skill.name}
                    secondary={
                      <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                        <Chip label={`Level ${skill.level}/10`} size="small" color="primary" />
                        {skill.yearsOfExperience && (
                          <Chip label={`${skill.yearsOfExperience} years`} size="small" variant="outlined" />
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" onClick={() => handleOpenDialog(skill)} sx={{ mr: 1 }}>
                      <EditIcon />
                    </IconButton>
                    <IconButton edge="end" onClick={() => handleDeleteSkill(skill.id)}>
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>
        ))
      )}

      {/* Save button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={!hasUnsavedChanges || loading}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </Button>
      </Box>

      {hasUnsavedChanges && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          You have unsaved changes. Click "Save Changes" to persist your updates.
        </Alert>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingSkill ? 'Edit Skill' : 'Add New Skill'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Skill Name"
              value={skillForm.name}
              onChange={e => setSkillForm(prev => ({ ...prev, name: e.target.value }))}
              required
              fullWidth
            />

            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={skillForm.category}
                onChange={e => setSkillForm(prev => ({ ...prev, category: e.target.value }))}
                label="Category"
              >
                {PREDEFINED_CATEGORIES.map(cat => (
                  <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                ))}
                <MenuItem value="Custom">Custom Category</MenuItem>
              </Select>
            </FormControl>

            {skillForm.category === 'Custom' && (
              <TextField
                label="Custom Category Name"
                value={skillForm.customCategory}
                onChange={e => setSkillForm(prev => ({ ...prev, customCategory: e.target.value }))}
                required
                fullWidth
              />
            )}

            <Box>
              <Typography gutterBottom>Skill Level: {skillForm.level}/10</Typography>
              <Slider
                value={skillForm.level}
                onChange={(_, value) => setSkillForm(prev => ({ ...prev, level: value as SkillLevel }))}
                min={0}
                max={10}
                step={1}
                marks
                valueLabelDisplay="auto"
              />
            </Box>

            <TextField
              label="Years of Experience"
              type="number"
              value={skillForm.yearsOfExperience || ''}
              onChange={e => setSkillForm(prev => ({
                ...prev,
                yearsOfExperience: e.target.value ? Number(e.target.value) : undefined
              }))}
              helperText="Optional"
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleAddOrUpdateSkill}
            variant="contained"
            disabled={!skillForm.name || (skillForm.category === 'Custom' && !skillForm.customCategory)}
          >
            {editingSkill ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success notification */}
      <Snackbar
        open={success}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleSnackbarClose} severity="success" sx={{ width: '100%' }}>
          Skills saved successfully!
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
