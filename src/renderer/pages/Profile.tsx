import React, { useState, useEffect } from 'react';
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
import { UserProfile, HardSkill, UserPreferences } from '../../shared/types';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

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

function Profile() {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [skills, setSkills] = useState<HardSkill[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);

  // Calculate profile completion percentage
  const calculateCompletion = (): number => {
    let completed = 0;
    const total = 5;

    if (profile?.firstName && profile?.lastName) completed++;
    if (profile?.email) completed++;
    if (skills.length > 0) completed++;
    if (preferences?.preferredRemotePercentage !== undefined) completed++;
    if (preferences?.minSalary || preferences?.maxSalary) completed++;

    return Math.round((completed / total) * 100);
  };

  const completion = calculateCompletion();

  // Load profile data (will be replaced with actual IPC calls in T008-T010)
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        // TODO: Replace with actual IPC calls
        // const data = await window.electron.invoke('PROFILE_GET');
        // setProfile(data.profile);
        // setSkills(data.skills);
        // setPreferences(data.preferences);

        // Mock data for now
        setProfile(null);
        setSkills([]);
        setPreferences(null);
      } catch (error) {
        console.error('Failed to load profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleProfileSave = async (profileData: Partial<UserProfile>) => {
    // TODO: Replace with actual IPC call in T008
    console.log('Saving profile:', profileData);
    setProfile(prev => ({ ...prev, ...profileData } as UserProfile));
  };

  const handleSkillsSave = async (skillsData: HardSkill[]) => {
    // TODO: Replace with actual IPC call in T009
    console.log('Saving skills:', skillsData);
    setSkills(skillsData);
  };

  const handlePreferencesSave = async (preferencesData: UserPreferences) => {
    // TODO: Replace with actual IPC call in T010
    console.log('Saving preferences:', preferencesData);
    setPreferences(preferencesData);
  };

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
                <ProfileForm
                  profile={profile || undefined}
                  onSave={handleProfileSave}
                />
              </TabPanel>

              <TabPanel value={activeTab} index={1}>
                <SkillsManager
                  skills={skills}
                  onSave={handleSkillsSave}
                />
              </TabPanel>

              <TabPanel value={activeTab} index={2}>
                <PreferencesPanel
                  preferences={preferences || undefined}
                  onSave={handlePreferencesSave}
                />
              </TabPanel>
            </Box>
          </Paper>
        )}

        {/* Global unsaved changes warning */}
        {!loading && (
          <Alert severity="info" sx={{ mt: 3 }}>
            <Typography variant="body2">
              <strong>Note:</strong> Each section has its own save mechanism.
              Personal Info auto-saves after 2 seconds. Skills and Preferences require explicit save.
            </Typography>
          </Alert>
        )}
      </Container>
    </ErrorBoundary>
  );
}

export default Profile;
