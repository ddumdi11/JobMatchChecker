/**
 * Shared type definitions for Job Match Checker
 */

// Constants
export const MAX_SKILLS_PER_PROFILE = 500;

// Skill level range (0-10 scale)
export type SkillLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

// Skill type classification (Future Skills Framework 2030 alignment)
export type SkillType = 'technical' | 'transformative' | 'foundational' | 'digital' | 'community';

// Future Skills categories based on Stifterverband Future Skills Framework 2030
export type FutureSkillCategory =
  | 'grundlegend'        // Foundational (critical thinking, communication, cooperation, etc.)
  | 'transformativ'      // Transformative (innovation, sustainability competencies)
  | 'gemeinschaft'       // Community-oriented (dialogue, democracy, participation, diversity)
  | 'digital'            // Digital (AI literacy, data literacy, media competence)
  | 'technologisch'      // Technological (AI expertise, cybersecurity, specialized tech)
  | 'traditional';       // Traditional technical/domain skills (pre-Framework)

// Assessment method for skill validation
export type AssessmentMethod = 'self' | 'verified' | 'tested' | 'certified';

// Confidence from Multi-LLM analysis (Skills Hub)
export type SkillConfidence = 'very_likely' | 'possible';

// Market relevance of the skill
export type MarketRelevance = 'high' | 'medium' | 'low';

// Remote work preference types
export type RemoteWorkPreference = 'remote_only' | 'hybrid' | 'on_site' | 'flexible';

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
  level: SkillLevel; // 0-10 scale
  yearsOfExperience?: number;

  // Future Skills Framework 2030 extensions
  skillType?: SkillType;                    // Classification: technical/transformative/foundational/digital/community
  futureSkillCategory?: FutureSkillCategory; // Specific Future Skills 2030 category
  assessmentMethod?: AssessmentMethod;       // How the skill level was determined
  certifications?: string;                   // JSON array or comma-separated certifications
  lastAssessed?: Date;                       // When the skill was last evaluated
  notes?: string;                            // Additional context, learning goals, etc.

  // Skills Hub Multi-LLM analysis fields
  confidence?: SkillConfidence;             // How certain the LLM analysis is (very_likely, possible)
  marketRelevance?: MarketRelevance;        // Job market relevance (high, medium, low)
}

export interface UserPreferences {
  minSalary?: number;
  maxSalary?: number;
  preferredLocations: string[];
  willingToRelocate: boolean;

  // Remote work preferences (new fields from migration 20251002000001)
  remoteWorkPreference?: RemoteWorkPreference;
  remoteWorkUpdatedAt?: Date;
  preferredRemotePercentage?: number; // 0-100
  acceptableRemoteMin?: number; // 0-100
  acceptableRemoteMax?: number; // 0-100

  // Job type preferences
  jobTypes?: {
    fullTime: boolean;
    partTime: boolean;
    contract: boolean;
  };
}

// Validation helper type for remote work range
export interface RemoteWorkRange {
  min: number; // 0-100
  preferred: number; // 0-100
  max: number; // 0-100
}

/**
 * Validates that a remote-work percentage range is well-formed.
 *
 * @param range - Partial object that may contain `min`, `preferred`, and `max` percentage values
 * @returns `true` if `min`, `preferred`, and `max` are present, each is between 0 and 100 inclusive, and `min <= preferred <= max`; `false` otherwise. When `true`, narrows `range` to `RemoteWorkRange`.
 */
export function isValidRemoteWorkRange(range: Partial<RemoteWorkRange>): range is RemoteWorkRange {
  if (range.min === undefined || range.preferred === undefined || range.max === undefined) {
    return false;
  }
  // Reject non-finite numbers (NaN, Infinity, -Infinity)
  if (!Number.isFinite(range.min) || !Number.isFinite(range.preferred) || !Number.isFinite(range.max)) {
    return false;
  }
  // Check bounds: 0 <= all values <= 100
  if (range.min < 0 || range.min > 100) return false;
  if (range.preferred < 0 || range.preferred > 100) return false;
  if (range.max < 0 || range.max > 100) return false;
  // Check constraint: min <= preferred <= max
  return range.min <= range.preferred && range.preferred <= range.max;
}

// Job Management Types (Feature 005)

export type JobStatus = 'new' | 'interesting' | 'applied' | 'rejected' | 'archived';
export type ImportMethod = 'manual' | 'ai_paste' | 'bulk' | 'copy_paste';

export interface JobOffer {
  id: number;
  sourceId: number;
  sourceName?: string;        // Joined from job_sources (read-only)
  title: string;
  company: string;
  url?: string | null;
  postedDate: Date;
  deadline?: Date | null;
  location?: string | null;
  remoteOption?: string | null;
  salaryRange?: string | null;
  contractType?: string | null;
  fullText?: string | null;
  rawImportData?: string | null;
  importMethod?: ImportMethod | null;
  notes?: string | null;
  status: JobStatus;
  matchScore?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// Input type for creating/updating jobs (omits system-generated fields)
export type JobOfferInput = Omit<JobOffer, 'id' | 'createdAt' | 'updatedAt' | 'sourceName'>;

// Partial input for updates (all fields optional except id)
export type JobOfferUpdate = Partial<JobOfferInput> & { id: number };

export interface JobSource {
  id: number;
  name: string;
  url?: string;
  apiConfig?: string;
  createdAt: Date;
}

// AI Extraction types
export interface AIExtractionResult {
  success: boolean;
  fields: Partial<JobOffer>;
  confidence: 'high' | 'medium' | 'low';
  missingRequired: string[];
  warnings?: string[];
  error?: string;
}

// Filter types
export interface JobFilters {
  status?: JobStatus | null;
  sourceId?: number | null;
  postedDateFrom?: Date | null;
  postedDateTo?: Date | null;
  matchScoreMin?: number | null;
  matchScoreMax?: number | null;
}

// Sort types
export interface JobSortConfig {
  sortBy: 'postedDate' | 'company' | 'status' | 'matchScore';
  sortOrder: 'asc' | 'desc';
}

// Pagination types
export interface PaginationParams {
  page: number;      // 1-based
  limit: number;     // Items per page
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedJobsResponse {
  jobs: JobOffer[];
  pagination: PaginationMeta;
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

// Merge Feature types (Issue #28)
export type MergeFieldSource = 'db' | 'csv';

export interface MergeFieldComparison {
  field: keyof JobOffer;
  dbValue: any;
  csvValue: any;
  selectedSource: MergeFieldSource;
  isDifferent: boolean;
}

export interface MergePreview {
  existingJob: JobOffer;
  newData: Partial<JobOffer>;
  fields: MergeFieldComparison[];
}

// Skills Import types
export interface SkillImportResult {
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; skill: string; error: string }>;
}
