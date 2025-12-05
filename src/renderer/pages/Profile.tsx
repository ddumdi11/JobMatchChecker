import React, { useState } from 'react';
import {
  Container,
  Typography,
  Paper,
  Tabs,
  Tab,
  Box,
  LinearProgress,
  Alert
} from '@mui/material';
import {
  Person as PersonIcon,
  Psychology as SkillsIcon,
  Tune as PreferencesIcon
} from '@mui/icons-material';
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
  const [activeTab, setActiveTab] = useState(0);

  // Get state from store for profile completion calculation
  const profile = useProfileStore(state => state.profile);
  const skills = useProfileStore(state => state.skills);
  const preferences = useProfileStore(state => state.preferences);
  const isLoadingProfile = useProfileStore(state => state.isLoadingProfile);
  const isLoadingSkills = useProfileStore(state => state.isLoadingSkills);
  const isLoadingPreferences = useProfileStore(state => state.isLoadingPreferences);

  const loading = isLoadingProfile || isLoadingSkills || isLoadingPreferences;

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
      </Container>
    </ErrorBoundary>
  );
}

export default Profile;
