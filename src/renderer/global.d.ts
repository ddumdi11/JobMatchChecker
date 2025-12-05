/**
 * Global type definitions for Electron API exposed via preload
 */

interface Window {
  api: {
    createJob: (data: any) => Promise<any>;
    updateJob: (id: number, data: any) => Promise<any>;
    deleteJob: (id: number) => Promise<void>;
    getAllJobs: () => Promise<any[]>;
    getJobById: (id: number) => Promise<any>;
    createProfile: (data: any) => Promise<any>;
    updateProfile: (data: any) => Promise<any>;
    getProfile: () => Promise<any>;
    getAllSkills: () => Promise<any[]>;
    upsertSkill: (skill: any) => Promise<any>;
    deleteSkill: (id: number) => Promise<void>;
    getPreferences: () => Promise<any>;
    updatePreferences: (data: any) => Promise<any>;
    // Matching operations
    matchJob: (jobId: number) => Promise<any>;
    getMatchingHistory: (jobId: number) => Promise<any[]>;
    // API Key management
    saveApiKey: (apiKey: string) => Promise<any>;
    getApiKey: () => Promise<string | null>;
    verifyApiKey: (apiKey: string) => Promise<{ success: boolean; error?: string }>;
    parseLatexCV: (content: string) => Promise<any>;
    parseJobText: (text: string) => Promise<any>;
    parsePDF: (filePath: string) => Promise<any>;
    getSettings: (key: string) => Promise<any>;
    updateSettings: (key: string, value: any) => Promise<void>;
    backupDatabase: () => Promise<string>;
    restoreDatabase: (backupPath: string) => Promise<void>;
    migrateDatabase: () => Promise<void>;
  };
}
