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
import { useUnsavedChangesContext } from '../components/Layout';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

/**
 * Renders an accessible tab panel whose content is shown only when its index matches the current tab value.
 *
 * The container uses `role="tabpanel"` and sets `id` / `aria-labelledby` attributes for accessibility. When active,
 * children are wrapped in a Box with top padding; when inactive the panel is hidden.
 *
 * @param props.children - The content to render inside the panel.
 * @param props.value - The currently selected tab index.
 * @param props.index - The index of this tab panel.
 * @returns The tab panel React element.
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
 *
 * @param index - The tab index used to compose the `id` and `aria-controls` values
 * @returns An object containing `id` for the tab and `aria-controls` for the corresponding tabpanel
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
 * Renders the user Profile page with a profile completion indicator and tabbed sections for Personal Info, Skills, and Preferences.
 *
 * The component loads profile-related data, displays a loading state while fetching, and provides per-section save handlers:
 * - Personal Info (auto-save behavior)
 * - Skills (explicit save)
 * - Preferences (explicit save)
 *
 * @returns The rendered Profile page React element.
 */
function Profile() {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [skills, setSkills] = useState<HardSkill[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);

  // Integrate with unsaved changes context
  // Note: Child components (ProfileForm, SkillsManager, PreferencesPanel) track their own unsaved state
  // In future iterations, we can lift this state here and aggregate it
  const unsavedChangesContext = useUnsavedChangesContext();

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

  // Transform DB snake_case to camelCase
  const transformProfile = (dbProfile: any): UserProfile => ({
    id: dbProfile.id,
    firstName: dbProfile.first_name || '',
    lastName: dbProfile.last_name || '',
    email: dbProfile.email || '',
    phone: dbProfile.phone || '',
    location: dbProfile.location || '',
    createdAt: dbProfile.created_at ? new Date(dbProfile.created_at) : new Date(),
    updatedAt: dbProfile.updated_at ? new Date(dbProfile.updated_at) : new Date()
  });

  const transformSkills = (dbSkills: any[]): HardSkill[] =>
    dbSkills.map(skill => ({
      id: skill.id,
      name: skill.name,
      level: skill.level,
      categoryId: skill.category_id,
      categoryName: skill.category_name,
      yearsOfExperience: skill.years_experience
    }));

  const transformPreferences = (dbPrefs: any): UserPreferences => ({
    minSalary: dbPrefs.min_salary,
    maxSalary: dbPrefs.max_salary,
    preferredLocations: dbPrefs.preferred_locations
      ? JSON.parse(dbPrefs.preferred_locations)
      : [],
    willingToRelocate: Boolean(dbPrefs.willing_to_relocate),
    remoteWorkPreference: dbPrefs.remote_work_preference,
    preferredRemotePercentage: dbPrefs.preferred_remote_percentage,
    acceptableRemoteMin: dbPrefs.acceptable_remote_min,
    acceptableRemoteMax: dbPrefs.acceptable_remote_max,
    remoteWorkUpdatedAt: dbPrefs.remote_work_updated_at
      ? new Date(dbPrefs.remote_work_updated_at)
      : undefined
  });

  // Load profile data
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);

        // Load profile with skills and preferences
        const profileData = await window.api.getProfile();

        if (profileData) {
          const { skills: profileSkills, preferences: profilePrefs, ...dbProfile } = profileData;

          setProfile(transformProfile(dbProfile));
          setSkills(profileSkills ? transformSkills(profileSkills) : []);
          setPreferences(profilePrefs ? transformPreferences(profilePrefs) : null);
        } else {
          setProfile(null);
          setSkills([]);
          setPreferences(null);
        }
      } catch (error) {
        console.error('Failed to load profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleProfileSave = async (profileData: Partial<UserProfile>) => {
    try {
      await window.api.updateProfile(profileData);
      // Update local state optimistically
      setProfile(prev => prev ? { ...prev, ...profileData } : null);
    } catch (error) {
      console.error('Failed to save profile:', error);
      throw error;
    }
  };

  const handleSkillsSave = async (skillsData: HardSkill[]) => {
    try {
      // Save all skills via upsert
      const savedSkills = await Promise.all(
        skillsData.map(skill => window.api.upsertSkill(skill))
      );
      setSkills(savedSkills);
    } catch (error) {
      console.error('Failed to save skills:', error);
      throw error;
    }
  };

  const handlePreferencesSave = async (preferencesData: UserPreferences) => {
    try {
      await window.api.updatePreferences(preferencesData);
      // Update local state optimistically
      setPreferences(preferencesData);
    } catch (error) {
      console.error('Failed to save preferences:', error);
      throw error;
    }
  };

  const handleTabChange = async (_event: React.SyntheticEvent, newValue: number) => {
    console.log('Tab change: from', activeTab, 'to', newValue);
    // Reload profile data when switching tabs to ensure fresh data
    try {
      const profileData = await window.api.getProfile();
      console.log('Loaded profile data:', profileData);
      if (profileData) {
        const { skills: profileSkills, preferences: profilePrefs, ...dbProfile } = profileData;
        console.log('Raw preferences from API:', profilePrefs);
        const transformedProfile = transformProfile(dbProfile);
        const transformedPrefs = profilePrefs ? transformPreferences(profilePrefs) : null;
        console.log('Transformed preferences:', transformedPrefs);
        setProfile(transformedProfile);
        setSkills(profileSkills ? transformSkills(profileSkills) : []);
        setPreferences(transformedPrefs);
      }
    } catch (error) {
      console.error('Failed to reload profile on tab change:', error);
    }

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
