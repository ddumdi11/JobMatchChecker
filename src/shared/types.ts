/**
 * Shared type definitions for Job Match Checker
 */

export interface UserProfile {
  id: number;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  location?: string;
  hardSkills: HardSkill[];
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface HardSkill {
  id: number;
  name: string;
  category: string;
  level: number; // 0-10
  yearsOfExperience?: number;
}

export interface UserPreferences {
  minSalary?: number;
  maxSalary?: number;
  preferredLocations: string[];
  remotePercentage: number; // 0-100
  willingToRelocate: boolean;
}

export interface JobOffer {
  id: number;
  sourceId: number;
  title: string;
  company: string;
  location: string;
  url: string;
  fullText: string;
  postedDate: Date;
  deadline?: Date;
  salaryMin?: number;
  salaryMax?: number;
  remoteOption: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobSource {
  id: number;
  name: string;
  url?: string;
  apiConfig?: string;
  createdAt: Date;
}

export interface MatchingResult {
  id: number;
  jobId: number;
  profileId: number;
  matchScore: number; // 0-100
  gapAnalysis: Gap[];
  reasoning: string;
  promptVersion: string;
  createdAt: Date;
}

export interface Gap {
  category: string;
  missingSkill: string;
  requiredLevel: number;
  currentLevel: number;
  priority: 'high' | 'medium' | 'low';
}

export interface MatchingPrompt {
  id: number;
  version: string;
  promptText: string;
  isActive: boolean;
  createdAt: Date;
}

export interface AppSettings {
  key: string;
  value: string;
  updatedAt: Date;
}
