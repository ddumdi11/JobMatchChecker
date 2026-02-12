import React, { useState, useEffect, useMemo } from 'react';
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
  InputAdornment,
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
  Download as DownloadIcon,
  Search as SearchIcon,
  Clear as ClearIcon
} from '@mui/icons-material';
import { SkillLevel, MAX_SKILLS_PER_PROFILE } from '../../shared/types';
import { useProfileStore, Skill } from '../store/profileStore';
import { useUnsavedChangesContext } from './Layout';

const PREDEFINED_CATEGORIES = [
  'Programming Languages',
  'Frameworks & Libraries',
  'Databases',
  'DevOps & Cloud',
  'Tools & IDEs',
  'Soft Skills',
  'Domain Knowledge'
];

export const SkillsManager: React.FC = () => {
  // Unsaved changes context (Issue #12)
  const { setIsDirty, setOnSave } = useUnsavedChangesContext();

  // Store hooks
  const skills = useProfileStore(state => state.skills);
  const isLoading = useProfileStore(state => state.isLoadingSkills);
  const error = useProfileStore(state => state.skillsError);
  const addSkill = useProfileStore(state => state.addSkill);
  const updateSkill = useProfileStore(state => state.updateSkill);
  const deleteSkill = useProfileStore(state => state.deleteSkill);
  const loadSkills = useProfileStore(state => state.loadSkills);

  // Local UI state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Form state for new/edit skill
  const [skillForm, setSkillForm] = useState({
    name: '',
    category: PREDEFINED_CATEGORIES[0],
    customCategory: '',
    level: 5 as SkillLevel,
    yearsOfExperience: undefined as number | undefined
  });

  // Load skills on mount
  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  // Sync dirty state with UnsavedChangesContext (Issue #12)
  useEffect(() => {
    // Dialog is open AND form has content = unsaved changes
    const hasUnsavedChanges = dialogOpen && skillForm.name.trim() !== '';
    setIsDirty(hasUnsavedChanges);

    // Provide save action only when there are changes to save
    if (hasUnsavedChanges) {
      setOnSave(handleAddOrUpdateSkill);
    } else {
      setOnSave(undefined);
    }
  }, [dialogOpen, skillForm.name, setIsDirty, setOnSave]);

  const handleOpenDialog = (skill?: Skill) => {
    if (skill) {
      setEditingSkill(skill);
      const isCustomCategory = !PREDEFINED_CATEGORIES.includes(skill.category);
      setSkillForm({
        name: skill.name,
        category: isCustomCategory ? 'Custom' : skill.category,
        customCategory: isCustomCategory ? skill.category : '',
        level: skill.level as SkillLevel,
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

  const handleAddOrUpdateSkill = async () => {
    // Validate max skills
    if (!editingSkill && skills.length >= MAX_SKILLS_PER_PROFILE) {
      return; // Error is handled by store
    }

    const category = skillForm.category === 'Custom'
      ? skillForm.customCategory
      : skillForm.category;

    const newSkill: Skill = {
      id: editingSkill?.id,
      name: skillForm.name,
      category,
      level: skillForm.level,
      yearsOfExperience: skillForm.yearsOfExperience
    };

    try {
      if (editingSkill && editingSkill.id) {
        await updateSkill({ ...newSkill, id: editingSkill.id });
        setSuccessMessage('Skill erfolgreich aktualisiert');
      } else {
        await addSkill(newSkill);
        setSuccessMessage('Skill erfolgreich hinzugefügt');
      }
      handleCloseDialog();
    } catch (err) {
      // Error is handled by store
    }
  };

  const handleDeleteSkill = async (id: number) => {
    try {
      await deleteSkill(id);
      setSuccessMessage('Skill erfolgreich gelöscht');
    } catch (err) {
      // Error is handled by store
    }
  };

  const handleSnackbarClose = () => {
    setSuccessMessage(null);
  };

  // Get unique categories from actual skills for the filter dropdown
  const skillCategories = useMemo(() => {
    const cats = new Set(skills.map(s => s.category));
    return Array.from(cats).sort();
  }, [skills]);

  // Filter and group skills
  const filteredSkills = useMemo(() => {
    return skills.filter(skill => {
      const matchesSearch = searchTerm === '' ||
        skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        skill.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || skill.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [skills, searchTerm, categoryFilter]);

  const groupedSkills = useMemo(() => {
    return filteredSkills.reduce((acc, skill) => {
      if (!acc[skill.category]) {
        acc[skill.category] = [];
      }
      acc[skill.category].push(skill);
      return acc;
    }, {} as Record<string, Skill[]>);
  }, [filteredSkills]);

  // CSV Export handler
  const handleExportCsv = async () => {
    const header = 'name,category,level,yearsOfExperience';
    const rows = skills.map(skill => {
      const name = skill.name.includes(',') ? `"${skill.name}"` : skill.name;
      const category = skill.category.includes(',') ? `"${skill.category}"` : skill.category;
      const years = skill.yearsOfExperience ?? '';
      return `${name},${category},${skill.level},${years}`;
    });
    const csvContent = [header, ...rows].join('\n');

    try {
      const result = await window.api.skillsExportToCsv(csvContent);
      if (result.success) {
        setSuccessMessage(`${skills.length} Skills als CSV exportiert`);
      }
    } catch (err) {
      // Error handled silently - user cancelled dialog
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Skills & Competencies
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mr: 2 }}>
          {skills.length} / {MAX_SKILLS_PER_PROFILE}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={handleExportCsv}
          disabled={skills.length === 0 || isLoading}
          sx={{ mr: 1 }}
        >
          CSV Export
        </Button>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenDialog()}
          disabled={skills.length >= MAX_SKILLS_PER_PROFILE || isLoading}
        >
          Add Skill
        </Button>
      </Box>

      {/* Search and filter bar */}
      {skills.length > 0 && (
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            size="small"
            placeholder="Skills durchsuchen..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            sx={{ flexGrow: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: searchTerm && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchTerm('')}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <Select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              displayEmpty
            >
              <MenuItem value="all">Alle Kategorien</MenuItem>
              {skillCategories.map(cat => (
                <MenuItem key={cat} value={cat}>{cat}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}

      {/* Error display */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => useProfileStore.setState({ skillsError: null })}>
          {error}
        </Alert>
      )}

      {/* Filtered count indicator */}
      {(searchTerm || categoryFilter !== 'all') && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {filteredSkills.length} von {skills.length} Skills angezeigt
        </Typography>
      )}

      {/* Grouped skills display */}
      {Object.keys(groupedSkills).length === 0 ? (
        skills.length === 0 ? (
          <Alert severity="info">Noch keine Skills vorhanden. Klicke &quot;Add Skill&quot; um zu starten.</Alert>
        ) : (
          <Alert severity="info">Keine Skills gefunden für die aktuelle Suche.</Alert>
        )
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
                    <IconButton
                      edge="end"
                      onClick={() => skill.id && handleDeleteSkill(skill.id)}
                      disabled={!skill.id}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          </Box>
        ))
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
            disabled={!skillForm.name || (skillForm.category === 'Custom' && !skillForm.customCategory) || isLoading}
          >
            {editingSkill ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success notification */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleSnackbarClose} severity="success" sx={{ width: '100%' }}>
          {successMessage}
        </Alert>
      </Snackbar>
    </Paper>
  );
};
