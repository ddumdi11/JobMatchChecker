import { contextBridge, ipcRenderer, webUtils } from 'electron';
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
  getOrCreateJobSource: (name: string) => ipcRenderer.invoke('getOrCreateJobSource', name),
  getJobStatusOptions: () => ipcRenderer.invoke('getJobStatusOptions'),
  extractJobFields: (text: string) => ipcRenderer.invoke('extractJobFields', text),

  // Merge operations (Issue #28)
  createMergePreview: (existingJobId: number, newData: any) => ipcRenderer.invoke('job:createMergePreview', existingJobId, newData),
  mergeJobs: (existingJobId: number, fields: any[]) => ipcRenderer.invoke('job:merge', existingJobId, fields),

  // Profile operations
  createProfile: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.PROFILE_CREATE, data),
  updateProfile: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.PROFILE_UPDATE, data),
  deleteProfile: () => ipcRenderer.invoke(IPC_CHANNELS.PROFILE_DELETE),
  getProfile: () => ipcRenderer.invoke(IPC_CHANNELS.PROFILE_GET),

  // Skills operations
  getAllSkills: () => ipcRenderer.invoke(IPC_CHANNELS.SKILLS_GET_ALL),
  upsertSkill: (skill: any) => ipcRenderer.invoke(IPC_CHANNELS.SKILLS_UPSERT, skill),
  deleteSkill: (id: number) => ipcRenderer.invoke(IPC_CHANNELS.SKILLS_DELETE, id),

  // Skills import operations
  skillsSelectFile: () => ipcRenderer.invoke('skills:selectFile'),
  skillsImportFromCsv: (csvContent: string) => ipcRenderer.invoke('skills:importFromCsv', csvContent),
  skillsImportFromJson: (jsonContent: string) => ipcRenderer.invoke('skills:importFromJson', jsonContent),
  skillsDetectConflicts: (csvContent: string) => ipcRenderer.invoke('skills:detectConflicts', csvContent),
  skillsApplyResolutions: (conflicts: any[], resolutions: any[]) => ipcRenderer.invoke('skills:applyResolutions', conflicts, resolutions),
  skillsImportNewOnly: (csvContent: string) => ipcRenderer.invoke('skills:importNewOnly', csvContent),
  skillsExportToCsv: (csvContent: string) => ipcRenderer.invoke('skills:exportToCsv', csvContent),

  // Preferences operations
  getPreferences: () => ipcRenderer.invoke(IPC_CHANNELS.PREFERENCES_GET),
  updatePreferences: (data: any) => ipcRenderer.invoke(IPC_CHANNELS.PREFERENCES_UPDATE, data),

  // Matching operations
  matchJob: (jobId: number) => ipcRenderer.invoke('matchJob', jobId),
  getMatchingHistory: (jobId: number) => ipcRenderer.invoke('getMatchingHistory', jobId),
  bulkMatchJobs: (rematchAll: boolean) => ipcRenderer.invoke('bulkMatchJobs', rematchAll),
  matchSelectedJobs: (jobIds: number[]) => ipcRenderer.invoke('matchSelectedJobs', jobIds),
  getUnmatchedJobCount: () => ipcRenderer.invoke('getUnmatchedJobCount'),

  // API Key management
  saveApiKey: (apiKey: string) => ipcRenderer.invoke('saveApiKey', apiKey),
  getApiKey: () => ipcRenderer.invoke('getApiKey'),
  verifyApiKey: (apiKey: string) => ipcRenderer.invoke('verifyApiKey', apiKey),

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
  migrateDatabase: () => ipcRenderer.invoke(IPC_CHANNELS.DB_MIGRATE),

  // Job file import (Markdown, Text, PDF)
  jobSelectFile: () => ipcRenderer.invoke('job:selectFile'),
  jobReadFile: (filePath: string) => ipcRenderer.invoke('job:readFile', filePath),
  getFilePath: (file: File) => webUtils.getPathForFile(file),

  // Import operations (CSV Import)
  importSelectCsvFile: () => ipcRenderer.invoke('import:selectCsvFile'),
  importProcessCsv: (filename: string, csvContent: string) => ipcRenderer.invoke('import:processCsv', filename, csvContent),
  importGetSessions: () => ipcRenderer.invoke('import:getSessions'),
  importGetSession: (sessionId: number) => ipcRenderer.invoke('import:getSession', sessionId),
  importGetStagingRows: (sessionId: number) => ipcRenderer.invoke('import:getStagingRows', sessionId),
  importRow: (rowId: number) => ipcRenderer.invoke('import:importRow', rowId),
  importAllNew: (sessionId: number) => ipcRenderer.invoke('import:importAllNew', sessionId),
  importSkipRow: (rowId: number) => ipcRenderer.invoke('import:skipRow', rowId),
  importUpdateRowStatus: (rowId: number, status: string) => ipcRenderer.invoke('import:updateRowStatus', rowId, status),
  importDeleteSession: (sessionId: number) => ipcRenderer.invoke('import:deleteSession', sessionId),

  // Export operations
  exportToMarkdown: (jobId: number) => ipcRenderer.invoke('export:toMarkdown', jobId),
  exportToPdf: (jobId: number) => ipcRenderer.invoke('export:toPdf', jobId),
  exportBulkToPdf: (jobIds: number[]) => ipcRenderer.invoke('export:bulkToPdf', jobIds),
  exportBulkToZip: (jobIds: number[]) => ipcRenderer.invoke('export:bulkToZip', jobIds)
});
