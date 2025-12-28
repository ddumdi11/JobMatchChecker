import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Tabs,
  Tab,
  Box,
  LinearProgress,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import {
  Person as PersonIcon,
  Psychology as SkillsIcon,
  Tune as PreferencesIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { ProfileForm } from '../components/ProfileForm';
import { SkillsManager } from '../components/SkillsManager';
import { PreferencesPanel } from '../components/PreferencesPanel';
import { useProfileStore } from '../store/profileStore';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

/**
 * Renders an accessible tab panel whose content is shown only when its index matches the current tab value.
 */
function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`profile-tabpanel-${index}`}
      aria-labelledby={`profile-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

/**
 * Accessibility attributes for a tab at the given index.
 */
function a11yProps(index: number) {
  return {
    id: `profile-tab-${index}`,
    'aria-controls': `profile-tabpanel-${index}`,
  };
}

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Profile page error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert severity="error" sx={{ m: 2 }}>
          <Typography variant="h6">Something went wrong</Typography>
          <Typography variant="body2">{this.state.error?.message}</Typography>
        </Alert>
      );
    }

    return this.props.children;
  }
}

/**
 * Renders the user Profile page with profile completion indicator and tabbed sections.
 */
function Profile() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Get state from store for profile completion calculation
  const profile = useProfileStore(state => state.profile);
  const skills = useProfileStore(state => state.skills);
  const preferences = useProfileStore(state => state.preferences);
  const deleteProfile = useProfileStore(state => state.deleteProfile);
  const loadProfile = useProfileStore(state => state.loadProfile);
  const loadSkills = useProfileStore(state => state.loadSkills);
  const loadPreferences = useProfileStore(state => state.loadPreferences);
  const isLoadingProfile = useProfileStore(state => state.isLoadingProfile);

  // Only show loading if we're still loading the profile (most critical data)
  // Skills and preferences can be empty, so we don't block on them
  const loading = isLoadingProfile;

  // Load profile data on component mount
  useEffect(() => {
    const loadData = async () => {
      await loadProfile();
      await loadSkills();
      await loadPreferences();
    };
    loadData();
  }, [loadProfile, loadSkills, loadPreferences]);

  // Calculate profile completion percentage
  const calculateCompletion = (): number => {
    let completed = 0;
    const total = 5;

    if (profile?.firstName && profile?.lastName) completed++;
    if (profile?.email) completed++;
    if (skills.length > 0) completed++;
    if (preferences?.preferredRemotePercentage !== undefined) completed++;
    if (preferences?.minSalary !== undefined || preferences?.maxSalary !== undefined) completed++;

    return Math.round((completed / total) * 100);
  };

  const completion = calculateCompletion();

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteProfile();
      setDeleteDialogOpen(false);
      navigate('/');
    } catch (error) {
      console.error('Failed to delete profile:', error);
      // Error is already set in store, will be displayed
    }
  };

  return (
    <ErrorBoundary>
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            My Profile
          </Typography>

          {/* Profile completion indicator */}
          <Paper sx={{ p: 2, mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" sx={{ flexGrow: 1 }}>
                Profile Completion
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {completion}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={completion}
              sx={{ height: 8, borderRadius: 4 }}
            />
          </Paper>
        </Box>

        {loading ? (
          <Paper sx={{ p: 3 }}>
            <LinearProgress />
            <Typography variant="body2" sx={{ mt: 2, textAlign: 'center' }}>
              Loading profile...
            </Typography>
          </Paper>
        ) : (
          <Paper sx={{ width: '100%' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs
                value={activeTab}
                onChange={handleTabChange}
                aria-label="profile sections"
                variant="fullWidth"
              >
                <Tab
                  icon={<PersonIcon />}
                  label="Personal Info"
                  {...a11yProps(0)}
                />
                <Tab
                  icon={<SkillsIcon />}
                  label="Skills"
                  {...a11yProps(1)}
                />
                <Tab
                  icon={<PreferencesIcon />}
                  label="Preferences"
                  {...a11yProps(2)}
                />
              </Tabs>
            </Box>

            <Box sx={{ p: 3 }}>
              <TabPanel value={activeTab} index={0}>
                <ProfileForm />

                {/* Delete Profile Section - Only in Personal Info tab */}
                {profile && (
                  <Paper sx={{ p: 3, mt: 3, backgroundColor: 'error.lighter' }}>
                    <Typography variant="h6" gutterBottom color="error.main">
                      Danger Zone
                    </Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      Once you delete your profile, all data including skills and preferences will be permanently removed. This action cannot be undone.
                    </Typography>
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={handleDeleteClick}
                    >
                      Delete Profile
                    </Button>
                  </Paper>
                )}
              </TabPanel>

              <TabPanel value={activeTab} index={1}>
                <SkillsManager />
              </TabPanel>

              <TabPanel value={activeTab} index={2}>
                <PreferencesPanel />
              </TabPanel>
            </Box>
          </Paper>
        )}

        {/* Global info */}
        {!loading && (
          <Alert severity="info" sx={{ mt: 3 }}>
            <Typography variant="body2">
              <strong>Note:</strong> All changes are automatically saved to the database.
              Your profile data is managed through a centralized state store.
            </Typography>
          </Alert>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={handleDeleteCancel}
          aria-labelledby="delete-dialog-title"
          aria-describedby="delete-dialog-description"
        >
          <DialogTitle id="delete-dialog-title">
            Delete Profile?
          </DialogTitle>
          <DialogContent>
            <DialogContentText id="delete-dialog-description">
              Are you sure you want to delete your entire profile? This will permanently remove:
              <ul>
                <li>Your personal information</li>
                <li>All skills ({skills.length} total)</li>
                <li>All preferences</li>
              </ul>
              This action cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDeleteCancel} color="primary">
              Cancel
            </Button>
            <Button onClick={handleDeleteConfirm} color="error" variant="contained">
              Delete Permanently
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </ErrorBoundary>
  );
}

export default Profile;
