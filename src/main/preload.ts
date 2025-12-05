import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/constants';

/**
 * Preload script that exposes a safe API to the renderer process
 */

contextBridge.exposeInMainWorld('api', {
  // Job operations (Feature 005)
  getJobs: (filters?: any, sort?: any, pagination?: any) => ipcRenderer.invoke('getJobs', filters, sort, pagination),
  getJobById: (id: number) => ipcRenderer.invoke('getJobById', id),
  createJob: (data: any) => ipcRenderer.invoke('createJob', data),
  updateJob: (id: number, data: any) => ipcRenderer.invoke('updateJob', id, data),
  deleteJob: (id: number) => ipcRenderer.invoke('deleteJob', id),
  getJobSources: () => ipcRenderer.invoke('getJobSources'),
  getJobStatusOptions: () => ipcRenderer.invoke('getJobStatusOptions'),
  extractJobFields: (text: string) => ipcRenderer.invoke('extractJobFields', text),

  // Profile operations
  createProfile: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.PROFILE_CREATE, data),
  updateProfile: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.PROFILE_UPDATE, data),
  deleteProfile: () => ipcRenderer.invoke(IPC_CHANNELS.PROFILE_DELETE),
  getProfile: () => ipcRenderer.invoke(IPC_CHANNELS.PROFILE_GET),

  // Skills operations
  getAllSkills: () => ipcRenderer.invoke(IPC_CHANNELS.SKILLS_GET_ALL),
  upsertSkill: (skill: any) => ipcRenderer.invoke(IPC_CHANNELS.SKILLS_UPSERT, skill),
  deleteSkill: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.SKILLS_DELETE, id),

  // Preferences operations
  getPreferences: () => ipcRenderer.invoke(IPC_CHANNELS.PREFERENCES_GET),
  updatePreferences: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.PREFERENCES_UPDATE, data),

  // Matching operations
  runMatch: (jobId: number, profileId: number) => ipcRenderer.invoke(IPC_CHANNELS.MATCH_RUN, jobId, profileId),
  getMatchResults: (jobId: number) => ipcRenderer.invoke(IPC_CHANNELS.MATCH_GET_RESULTS, jobId),

  // Parser operations
  parseLatexCV: (content: string) => ipcRenderer.invoke(IPC_CHANNELS.PARSE_LATEX_CV, content),
  parseJobText: (text: string) => ipcRenderer.invoke(IPC_CHANNELS.PARSE_JOB_TEXT, text),
  parsePDF: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.PARSE_PDF, filePath),

  // Settings
  getSettings: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET, key),
  updateSettings: (key: string, value: any) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_UPDATE, key, value),

  // Database
  backupDatabase: () => ipcRenderer.invoke(IPC_CHANNELS.DB_BACKUP),
  restoreDatabase: (backupPath: string) => ipcRenderer.invoke(IPC_CHANNELS.DB_RESTORE, backupPath),
  migrateDatabase: () => ipcRenderer.invoke(IPC_CHANNELS.DB_MIGRATE)
});

// Type definition for window.api
declare global {
  interface Window {
    api: {
      // Job operations (Feature 005)
      getJobs: (filters?: any, sort?: any, pagination?: any) => Promise<any>;
      getJobById: (id: number) => Promise<any>;
      createJob: (data: any) => Promise<any>;
      updateJob: (id: number, data: any) => Promise<any>;
      deleteJob: (id: number) => Promise<void>;
      getJobSources: () => Promise<Array<{ id: number; name: string }>>;
      getJobStatusOptions: () => Promise<Array<{ value: string; label: string }>>;
      extractJobFields: (text: string) => Promise<any>;
      createProfile: (data: any) => Promise<any>;
      updateProfile: (data: any) => Promise<any>;
      deleteProfile: () => Promise<void>;
      getProfile: () => Promise<any>;
      getAllSkills: () => Promise<any[]>;
      upsertSkill: (skill: any) => Promise<any>;
      deleteSkill: (id: number) => Promise<void>;
      getPreferences: () => Promise<any>;
      updatePreferences: (data: any) => Promise<any>;
      runMatch: (jobId: number, profileId: number) => Promise<any>;
      getMatchResults: (jobId: number) => Promise<any>;
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
}
