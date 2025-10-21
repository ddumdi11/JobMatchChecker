import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * Profile Store - Zustand state management for user profile, skills, and preferences
 * Feature 001 - Task T011
 */

export interface Skill {
  id?: number;
  name: string;
  category: string;
  level: number; // 0-10
  yearsOfExperience?: number;
}

export interface Preferences {
  minSalary?: number;
  maxSalary?: number;
  preferredLocations: string[];
  remoteWorkPreference: 'remote_only' | 'hybrid' | 'on_site' | 'flexible';
  preferredRemotePercentage?: number; // 0-100
  acceptableRemoteMin?: number; // 0-100
  acceptableRemoteMax?: number; // 0-100
}

export interface Profile {
  id?: number;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  location?: string;
}

interface ProfileState {
  // State
  profile: Profile | null;
  skills: Skill[];
  preferences: Preferences | null;

  // Loading states
  isLoadingProfile: boolean;
  isLoadingSkills: boolean;
  isLoadingPreferences: boolean;

  // Error states
  profileError: string | null;
  skillsError: string | null;
  preferencesError: string | null;

  // Unsaved changes tracking
  hasUnsavedProfileChanges: boolean;
  hasUnsavedSkillsChanges: boolean;
  hasUnsavedPreferencesChanges: boolean;

  // Actions - Profile
  loadProfile: () => Promise<void>;
  updateProfile: (profile: Partial<Profile>) => Promise<void>;
  setProfile: (profile: Profile) => void;
  markProfileAsSaved: () => void;

  // Actions - Skills
  loadSkills: () => Promise<void>;
  addSkill: (skill: Skill) => Promise<void>;
  updateSkill: (skill: Skill) => Promise<void>;
  deleteSkill: (id: number) => Promise<void>;
  saveAllSkills: () => Promise<void>;
  setSkills: (skills: Skill[]) => void;
  markSkillsAsSaved: () => void;

  // Actions - Preferences
  loadPreferences: () => Promise<void>;
  updatePreferences: (preferences: Partial<Preferences>) => Promise<void>;
  setPreferences: (preferences: Preferences) => void;
  markPreferencesAsSaved: () => void;

  // Utility
  hasUnsavedChanges: () => boolean;
  resetErrors: () => void;
}

const MAX_SKILLS = 500;

export const useProfileStore = create<ProfileState>()(
  devtools(
    (set, get) => ({
      // Initial state
      profile: null,
      skills: [],
      preferences: null,

      isLoadingProfile: false,
      isLoadingSkills: false,
      isLoadingPreferences: false,

      profileError: null,
      skillsError: null,
      preferencesError: null,

      hasUnsavedProfileChanges: false,
      hasUnsavedSkillsChanges: false,
      hasUnsavedPreferencesChanges: false,

      // Profile actions
      loadProfile: async () => {
        set({ isLoadingProfile: true, profileError: null });
        try {
          const data = await window.api.getProfile();
          if (data) {
            set({
              profile: {
                id: data.id,
                firstName: data.first_name,
                lastName: data.last_name,
                email: data.email,
                phone: data.phone,
                location: data.location
              },
              isLoadingProfile: false
            });
          } else {
            set({ profile: null, isLoadingProfile: false });
          }
        } catch (error: any) {
          set({
            profileError: error.message || 'Failed to load profile',
            isLoadingProfile: false
          });
        }
      },

      updateProfile: async (profileUpdate: Partial<Profile>) => {
        const currentProfile = get().profile;
        const updatedProfile = { ...currentProfile, ...profileUpdate };

        set({ isLoadingProfile: true, profileError: null });
        try {
          await window.api.updateProfile({
            firstName: updatedProfile.firstName,
            lastName: updatedProfile.lastName,
            email: updatedProfile.email,
            phone: updatedProfile.phone,
            location: updatedProfile.location
          });

          set({
            profile: updatedProfile as Profile,
            hasUnsavedProfileChanges: false,
            isLoadingProfile: false
          });
        } catch (error: any) {
          set({
            profileError: error.message || 'Failed to update profile',
            isLoadingProfile: false
          });
          throw error;
        }
      },

      setProfile: (profile: Profile) => {
        set({ profile, hasUnsavedProfileChanges: true });
      },

      markProfileAsSaved: () => {
        set({ hasUnsavedProfileChanges: false });
      },

      // Skills actions
      loadSkills: async () => {
        set({ isLoadingSkills: true, skillsError: null });
        try {
          const skills = await window.api.getAllSkills();
          set({ skills, isLoadingSkills: false });
        } catch (error: any) {
          set({
            skillsError: error.message || 'Failed to load skills',
            isLoadingSkills: false
          });
        }
      },

      addSkill: async (skill: Skill) => {
        const currentSkills = get().skills;

        // Validate max skills limit
        if (currentSkills.length >= MAX_SKILLS) {
          set({ skillsError: `Cannot add more than ${MAX_SKILLS} skills` });
          throw new Error(`Cannot add more than ${MAX_SKILLS} skills`);
        }

        set({ isLoadingSkills: true, skillsError: null });
        try {
          const newSkill = await window.api.upsertSkill(skill);
          set({
            skills: [...currentSkills, newSkill],
            hasUnsavedSkillsChanges: false,
            isLoadingSkills: false
          });
        } catch (error: any) {
          set({
            skillsError: error.message || 'Failed to add skill',
            isLoadingSkills: false
          });
          throw error;
        }
      },

      updateSkill: async (skill: Skill) => {
        const currentSkills = get().skills;

        set({ isLoadingSkills: true, skillsError: null });
        try {
          const updatedSkill = await window.api.upsertSkill(skill);
          set({
            skills: currentSkills.map(s => s.id === skill.id ? updatedSkill : s),
            hasUnsavedSkillsChanges: false,
            isLoadingSkills: false
          });
        } catch (error: any) {
          set({
            skillsError: error.message || 'Failed to update skill',
            isLoadingSkills: false
          });
          throw error;
        }
      },

      deleteSkill: async (id: number) => {
        const currentSkills = get().skills;

        set({ isLoadingSkills: true, skillsError: null });
        try {
          await window.api.deleteSkill(id);
          set({
            skills: currentSkills.filter(s => s.id !== id),
            hasUnsavedSkillsChanges: false,
            isLoadingSkills: false
          });
        } catch (error: any) {
          set({
            skillsError: error.message || 'Failed to delete skill',
            isLoadingSkills: false
          });
          throw error;
        }
      },

      saveAllSkills: async () => {
        const currentSkills = get().skills;

        set({ isLoadingSkills: true, skillsError: null });
        try {
          // Save all skills via upsert
          await Promise.all(
            currentSkills.map(skill => window.api.upsertSkill(skill))
          );
          set({
            hasUnsavedSkillsChanges: false,
            isLoadingSkills: false
          });
        } catch (error: any) {
          set({
            skillsError: error.message || 'Failed to save skills',
            isLoadingSkills: false
          });
          throw error;
        }
      },

      setSkills: (skills: Skill[]) => {
        if (skills.length > MAX_SKILLS) {
          set({ skillsError: `Cannot have more than ${MAX_SKILLS} skills` });
          return;
        }
        set({ skills, hasUnsavedSkillsChanges: true });
      },

      markSkillsAsSaved: () => {
        set({ hasUnsavedSkillsChanges: false });
      },

      // Preferences actions
      loadPreferences: async () => {
        set({ isLoadingPreferences: true, preferencesError: null });
        try {
          const prefs = await window.api.getPreferences();
          if (prefs) {
            set({
              preferences: {
                minSalary: prefs.minSalary,
                maxSalary: prefs.maxSalary,
                preferredLocations: prefs.preferredLocations || [],
                remoteWorkPreference: prefs.remoteWorkPreference || 'flexible',
                preferredRemotePercentage: prefs.preferredRemotePercentage,
                acceptableRemoteMin: prefs.acceptableRemoteMin,
                acceptableRemoteMax: prefs.acceptableRemoteMax
              },
              isLoadingPreferences: false
            });
          } else {
            set({
              preferences: {
                preferredLocations: [],
                remoteWorkPreference: 'flexible'
              },
              isLoadingPreferences: false
            });
          }
        } catch (error: any) {
          set({
            preferencesError: error.message || 'Failed to load preferences',
            isLoadingPreferences: false
          });
        }
      },

      updatePreferences: async (preferencesUpdate: Partial<Preferences>) => {
        const currentPreferences = get().preferences;
        const updatedPreferences = { ...currentPreferences, ...preferencesUpdate } as Preferences;

        // Validate remote range: min <= preferred <= max
        if (
          updatedPreferences.acceptableRemoteMin !== undefined &&
          updatedPreferences.preferredRemotePercentage !== undefined &&
          updatedPreferences.acceptableRemoteMax !== undefined
        ) {
          if (
            updatedPreferences.acceptableRemoteMin > updatedPreferences.preferredRemotePercentage ||
            updatedPreferences.preferredRemotePercentage > updatedPreferences.acceptableRemoteMax
          ) {
            const error = 'Remote range validation failed: min ≤ preferred ≤ max';
            set({ preferencesError: error });
            throw new Error(error);
          }
        }

        set({ isLoadingPreferences: true, preferencesError: null });
        try {
          await window.api.updatePreferences(updatedPreferences);
          set({
            preferences: updatedPreferences,
            hasUnsavedPreferencesChanges: false,
            isLoadingPreferences: false
          });
        } catch (error: any) {
          set({
            preferencesError: error.message || 'Failed to update preferences',
            isLoadingPreferences: false
          });
          throw error;
        }
      },

      setPreferences: (preferences: Preferences) => {
        set({ preferences, hasUnsavedPreferencesChanges: true });
      },

      markPreferencesAsSaved: () => {
        set({ hasUnsavedPreferencesChanges: false });
      },

      // Utility
      hasUnsavedChanges: () => {
        const state = get();
        return (
          state.hasUnsavedProfileChanges ||
          state.hasUnsavedSkillsChanges ||
          state.hasUnsavedPreferencesChanges
        );
      },

      resetErrors: () => {
        set({
          profileError: null,
          skillsError: null,
          preferencesError: null
        });
      }
    }),
    { name: 'ProfileStore' }
  )
);
