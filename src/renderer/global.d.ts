/**
 * Global type definitions for Electron API exposed via preload
 */

interface Window {
  api: {
    // Job operations
    getJobs: (filters?: any, sort?: any, pagination?: any) => Promise<any>;
    getJobById: (id: number) => Promise<any>;
    createJob: (data: any) => Promise<any>;
    updateJob: (id: number, data: any) => Promise<any>;
    deleteJob: (id: number) => Promise<void>;
    getJobSources: () => Promise<Array<{ id: number; name: string }>>;
    getJobStatusOptions: () => Promise<Array<{ value: string; label: string }>>;
    extractJobFields: (text: string) => Promise<any>;
    // Merge operations
    createMergePreview: (existingJobId: number, newData: any) => Promise<any>;
    mergeJobs: (existingJobId: number, fields: any[]) => Promise<any>;
    // Profile operations
    createProfile: (data: any) => Promise<any>;
    updateProfile: (data: any) => Promise<any>;
    deleteProfile: () => Promise<void>;
    getProfile: () => Promise<any>;
    // Skills operations
    getAllSkills: () => Promise<any[]>;
    upsertSkill: (skill: any) => Promise<any>;
    deleteSkill: (id: number) => Promise<void>;
    // Skills import operations
    skillsSelectFile: () => Promise<{ canceled: boolean; filePath?: string; filename?: string; content?: string }>;
    skillsImportFromCsv: (csvContent: string) => Promise<any>;
    skillsImportFromJson: (jsonContent: string) => Promise<any>;
    skillsDetectConflicts: (csvContent: string) => Promise<any>;
    skillsApplyResolutions: (conflicts: any[], resolutions: any[]) => Promise<any>;
    skillsImportNewOnly: (csvContent: string) => Promise<any>;
    // Preferences operations
    getPreferences: () => Promise<any>;
    updatePreferences: (data: any) => Promise<any>;
    // Matching operations
    matchJob: (jobId: number) => Promise<any>;
    getMatchingHistory: (jobId: number) => Promise<any[]>;
    bulkMatchJobs: (rematchAll: boolean) => Promise<{ success: boolean; data: { matched: number; failed: number; skipped: number; errors: string[] } }>;
    matchSelectedJobs: (jobIds: number[]) => Promise<{ success: boolean; data: { matched: number; failed: number; skipped: number; errors: string[] } }>;
    getUnmatchedJobCount: () => Promise<number>;
    // API Key management
    saveApiKey: (apiKey: string) => Promise<any>;
    getApiKey: () => Promise<string | null>;
    verifyApiKey: (apiKey: string) => Promise<{ success: boolean; error?: string }>;
    // Parser operations
    parseLatexCV: (content: string) => Promise<any>;
    parseJobText: (text: string) => Promise<any>;
    parsePDF: (filePath: string) => Promise<any>;
    // Settings
    getSettings: (key: string) => Promise<any>;
    updateSettings: (key: string, value: any) => Promise<void>;
    // Database
    backupDatabase: () => Promise<string>;
    restoreDatabase: (backupPath: string) => Promise<void>;
    migrateDatabase: () => Promise<void>;
    // Import operations
    importSelectCsvFile: () => Promise<{ canceled: boolean; filePath?: string; filename?: string; content?: string }>;
    importProcessCsv: (filename: string, csvContent: string) => Promise<any>;
    importGetSessions: () => Promise<any[]>;
    importGetSession: (sessionId: number) => Promise<any>;
    importGetStagingRows: (sessionId: number) => Promise<any[]>;
    importRow: (rowId: number) => Promise<{ success: boolean; jobId?: number }>;
    importAllNew: (sessionId: number) => Promise<{ imported: number; failed: number }>;
    importSkipRow: (rowId: number) => Promise<{ success: boolean }>;
    importUpdateRowStatus: (rowId: number, status: string) => Promise<{ success: boolean }>;
    importDeleteSession: (sessionId: number) => Promise<{ success: boolean }>;
    // Export operations
    exportToMarkdown: (jobId: number) => Promise<{ success: boolean; filePath?: string; error?: string }>;
    exportToPdf: (jobId: number) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  };
}
