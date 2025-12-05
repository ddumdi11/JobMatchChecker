import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/**
 * Job Store - Zustand state management for job offers
 * Samstag Block 1 - Task 2.1
 */

export interface JobOffer {
  id?: number;
  title: string;
  company: string;
  location?: string;
  description?: string;
  requirements?: string;
  salary_min?: number;
  salary_max?: number;
  remote_percentage?: number;
  source?: string;
  source_url?: string;
  status?: 'new' | 'reviewing' | 'applied' | 'rejected' | 'offer' | 'accepted';
  match_score?: number;
  matchScore?: number; // API returns camelCase
  created_at?: Date;
  updated_at?: Date;
  postedDate?: Date;
  salaryRange?: string;
  remoteOption?: string;
}

export interface JobFilters {
  status?: string;
  minSalary?: number;
  maxSalary?: number;
  remotePercentage?: number;
  searchTerm?: string;
}

export interface JobSortConfig {
  field: 'created_at' | 'title' | 'company' | 'match_score' | 'matchScore' | 'salary_min' | 'status' | 'postedDate';
  direction: 'asc' | 'desc';
}

// Import the shared type from backend
export interface AIExtractionResult {
  success: boolean;
  fields: Partial<JobOffer>;
  confidence: 'high' | 'medium' | 'low';
  missingRequired: string[];
  warnings?: string[];
  error?: string;
}

export interface MatchingResult {
  matchScore: number;
  matchCategory: 'perfect' | 'good' | 'needs_work' | 'poor';
  strengths: string[];
  gaps: {
    missingSkills: Array<{
      skill: string;
      requiredLevel: number;
      currentLevel: number;
      gap: number;
    }>;
    experienceGaps: Array<{
      area: string;
      requiredYears: number;
      actualYears: number;
    }>;
  };
  recommendations: string[];
  reasoning: string;
}

interface JobState {
  // Data
  jobs: JobOffer[];
  currentJob: JobOffer | null;

  // Filters & Sort
  filters: JobFilters;
  sortConfig: JobSortConfig;
  pagination: { page: number; limit: number; total: number };

  // UI State
  isLoading: boolean;
  isExtracting: boolean;
  error: string | null;
  extractionResult: AIExtractionResult | null;

  // Matching State
  currentMatching: MatchingResult | null;
  matchingHistory: any[];
  isMatching: boolean;
  matchingError: string | null;

  // Actions - CRUD
  fetchJobs: (filters?: JobFilters, sort?: JobSortConfig, page?: number) => Promise<void>;
  getJobById: (id: number) => Promise<void>;
  createJob: (data: Partial<JobOffer>) => Promise<JobOffer>;
  updateJob: (id: number, data: Partial<JobOffer>) => Promise<void>;
  deleteJob: (id: number) => Promise<void>;

  // Actions - AI Extraction
  extractJobFromText: (text: string) => Promise<void>;
  clearExtractionResult: () => void;

  // Actions - Matching
  matchJob: (jobId: number) => Promise<MatchingResult>;
  getMatchingHistory: (jobId: number) => Promise<void>;
  clearMatchingResult: () => void;

  // Actions - Filters
  setFilters: (filters: JobFilters) => void;
  resetFilters: () => void;
  setSortConfig: (sort: JobSortConfig) => void;

  // Utility
  resetErrors: () => void;
}

export const useJobStore = create<JobState>()(
  devtools(
    (set, get) => ({
      // Initial state
      jobs: [],
      currentJob: null,

      filters: {},
      sortConfig: { field: 'created_at', direction: 'desc' },
      pagination: { page: 1, limit: 20, total: 0 },

      isLoading: false,
      isExtracting: false,
      error: null,
      extractionResult: null,

      // Matching State
      currentMatching: null,
      matchingHistory: [],
      isMatching: false,
      matchingError: null,

      // CRUD Actions
      fetchJobs: async (filters = {}, sort, page = 1) => {
        set({ isLoading: true, error: null });
        try {
          const currentSort = sort || get().sortConfig;
          const limit = get().pagination.limit;

          const result = await window.api.getJobs({
            filters,
            sort: currentSort,
            pagination: { page, limit }
          });

          set({
            jobs: result.jobs,
            pagination: {
              page: result.pagination.page,
              limit: result.pagination.limit,
              total: result.pagination.total
            },
            filters,
            sortConfig: currentSort,
            isLoading: false
          });
        } catch (error: any) {
          set({
            error: error.message || 'Failed to fetch jobs',
            isLoading: false
          });
        }
      },

      getJobById: async (id: number) => {
        set({ isLoading: true, error: null });
        try {
          const job = await window.api.getJobById(id);
          set({ currentJob: job, isLoading: false });
        } catch (error: any) {
          set({
            error: error.message || 'Failed to fetch job',
            isLoading: false
          });
        }
      },

      createJob: async (data: Partial<JobOffer>) => {
        set({ isLoading: true, error: null });
        try {
          // Transform frontend data to backend format
          const backendData: any = {
            ...data,
            // Add required fields with defaults if missing
            postedDate: data.postedDate || new Date(), // Default to today
            sourceId: data.sourceId || 1, // Default to first source (TODO: make this configurable)
            importMethod: 'ai_paste',
            status: data.status || 'new'
          };

          // Transform salary_min/max to salaryRange string if present
          if ((data as any).salary_min || (data as any).salary_max) {
            const min = (data as any).salary_min;
            const max = (data as any).salary_max;
            if (min && max) {
              backendData.salaryRange = `${min}-${max}`;
            } else if (max) {
              backendData.salaryRange = `up to ${max}`;
            } else if (min) {
              backendData.salaryRange = `from ${min}`;
            }
            // Remove the frontend-only fields
            delete backendData.salary_min;
            delete backendData.salary_max;
          }

          // Transform remote_percentage to remoteOption string if present
          if ((data as any).remote_percentage !== undefined) {
            const percentage = (data as any).remote_percentage;
            if (percentage === 100) {
              backendData.remoteOption = '100% remote';
            } else if (percentage === 0) {
              backendData.remoteOption = 'on-site';
            } else {
              backendData.remoteOption = `hybrid (${percentage}% remote)`;
            }
            // Remove the frontend-only field
            delete backendData.remote_percentage;
          }

          // Rename fields to match backend expectations
          if (backendData.description) {
            backendData.fullText = backendData.description;
            delete backendData.description;
          }
          if (backendData.source_url) {
            backendData.url = backendData.source_url;
            delete backendData.source_url;
          }

          const newJob = await window.api.createJob(backendData);

          // Add to local state
          set(state => ({
            jobs: [newJob, ...state.jobs],
            isLoading: false
          }));

          return newJob;
        } catch (error: any) {
          set({
            error: error.message || 'Failed to create job',
            isLoading: false
          });
          throw error;
        }
      },

      updateJob: async (id: number, data: Partial<JobOffer>) => {
        set({ isLoading: true, error: null });
        try {
          await window.api.updateJob(id, data);

          // Update local state
          set(state => ({
            jobs: state.jobs.map(job =>
              job.id === id ? { ...job, ...data } : job
            ),
            currentJob: state.currentJob?.id === id
              ? { ...state.currentJob, ...data }
              : state.currentJob,
            isLoading: false
          }));
        } catch (error: any) {
          set({
            error: error.message || 'Failed to update job',
            isLoading: false
          });
          throw error;
        }
      },

      deleteJob: async (id: number) => {
        set({ isLoading: true, error: null });
        try {
          await window.api.deleteJob(id);

          // Remove from local state
          set(state => ({
            jobs: state.jobs.filter(job => job.id !== id),
            currentJob: state.currentJob?.id === id ? null : state.currentJob,
            isLoading: false
          }));
        } catch (error: any) {
          set({
            error: error.message || 'Failed to delete job',
            isLoading: false
          });
          throw error;
        }
      },

      // AI Extraction
      extractJobFromText: async (text: string) => {
        set({ isExtracting: true, error: null, extractionResult: null });
        try {
          const result = await window.api.extractJobFields(text);

          set({
            extractionResult: result,
            isExtracting: false
          });
        } catch (error: any) {
          set({
            error: error.message || 'Failed to extract job data',
            isExtracting: false
          });
          throw error;
        }
      },

      clearExtractionResult: () => {
        set({ extractionResult: null });
      },

      // Matching Actions
      matchJob: async (jobId: number) => {
        set({ isMatching: true, matchingError: null });
        try {
          const result = await window.api.matchJob(jobId);

          if (result.success) {
            set({
              currentMatching: result.data,
              isMatching: false
            });

            // Also update the job's match_score in current job if it's loaded
            const currentJob = get().currentJob;
            if (currentJob && currentJob.id === jobId) {
              set({
                currentJob: {
                  ...currentJob,
                  matchScore: result.data.matchScore
                }
              });
            }

            return result.data;
          } else {
            throw new Error('Matching failed');
          }
        } catch (error: any) {
          set({
            matchingError: error.message || 'Failed to match job',
            isMatching: false
          });
          throw error;
        }
      },

      getMatchingHistory: async (jobId: number) => {
        try {
          const history = await window.api.getMatchingHistory(jobId);
          set({ matchingHistory: history });
        } catch (error: any) {
          console.error('Failed to load matching history:', error);
        }
      },

      clearMatchingResult: () => {
        set({ currentMatching: null, matchingError: null });
      },

      // Filters
      setFilters: (filters: JobFilters) => {
        set({ filters });
        // Auto-fetch with new filters
        get().fetchJobs(filters);
      },

      resetFilters: () => {
        const defaultFilters = {};
        set({ filters: defaultFilters });
        get().fetchJobs(defaultFilters);
      },

      setSortConfig: (sort: JobSortConfig) => {
        set({ sortConfig: sort });
        // Auto-fetch with new sort
        get().fetchJobs(get().filters, sort);
      },

      // Utility
      resetErrors: () => {
        set({ error: null });
      }
    }),
    { name: 'JobStore' }
  )
);
