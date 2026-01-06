import { ipcMain, dialog } from 'electron';
import * as log from 'electron-log';
import * as fs from 'fs';
import Store from 'electron-store';
import Anthropic from '@anthropic-ai/sdk';
import { IPC_CHANNELS } from '../../shared/constants';
import { getDatabase } from '../database/db';
import { backupDatabase, restoreDatabase, runMigrations } from '../database/db';
import * as jobService from '../services/jobService';
import * as aiExtractionService from '../services/aiExtractionService';
import * as matchingService from '../services/matchingService';
import * as importService from '../services/importService';
import * as skillsImportService from '../services/skillsImportService';
import * as exportService from '../services/exportService';
import { BrowserWindow } from 'electron';

const store = new Store();

/**
 * Register all IPC handlers
 */
export function registerIpcHandlers() {
  log.info('Registering IPC handlers...');

  const db = getDatabase();

  // Job operations (Feature 005 - using jobService)
  ipcMain.handle('getJobs', async (_, filters, sort, pagination) => {
    try {
      return await jobService.getJobs(filters, sort, pagination);
    } catch (error: any) {
      log.error('Error in getJobs:', error);
      throw error;
    }
  });

  ipcMain.handle('getJobById', async (_, id) => {
    try {
      return await jobService.getJobById(id);
    } catch (error: any) {
      log.error('Error in getJobById:', error);
      throw error;
    }
  });

  ipcMain.handle('createJob', async (_, data) => {
    try {
      return await jobService.createJob(data);
    } catch (error: any) {
      log.error('Error in createJob:', error);
      throw error;
    }
  });

  ipcMain.handle('updateJob', async (_, id, data) => {
    try {
      return await jobService.updateJob(id, data);
    } catch (error: any) {
      log.error('Error in updateJob:', error);
      throw error;
    }
  });

  ipcMain.handle('deleteJob', async (_, id) => {
    try {
      await jobService.deleteJob(id);
      // Return void (no content) as per contract
    } catch (error: any) {
      log.error('Error in deleteJob:', error);
      throw error;
    }
  });

  ipcMain.handle('getJobSources', async () => {
    try {
      return await jobService.getJobSources();
    } catch (error: any) {
      log.error('Error in getJobSources:', error);
      throw error;
    }
  });

  ipcMain.handle('getJobStatusOptions', async () => {
    try {
      return await jobService.getJobStatusOptions();
    } catch (error: any) {
      log.error('Error in getJobStatusOptions:', error);
      throw error;
    }
  });

  // Merge operations (Issue #28)
  ipcMain.handle('job:createMergePreview', async (_, existingJobId, newData) => {
    try {
      return await jobService.createMergePreview(existingJobId, newData);
    } catch (error: any) {
      log.error('Error in job:createMergePreview:', error);
      throw error;
    }
  });

  ipcMain.handle('job:merge', async (_, existingJobId, fields) => {
    try {
      return await jobService.mergeJobs(existingJobId, fields);
    } catch (error: any) {
      log.error('Error in job:merge:', error);
      throw error;
    }
  });

  ipcMain.handle('extractJobFields', async (_, text) => {
    try {
      return await aiExtractionService.extractJobFields(text);
    } catch (error: any) {
      log.error('Error in extractJobFields:', error);
      throw error;
    }
  });

  // Profile operations
  ipcMain.handle(IPC_CHANNELS.PROFILE_CREATE, async (_, data) => {
    try {
      const stmt = db.prepare(`
        INSERT INTO user_profile (id, first_name, last_name, email, phone, location)
        VALUES (1, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          first_name = excluded.first_name,
          last_name = excluded.last_name,
          email = excluded.email,
          phone = excluded.phone,
          location = excluded.location,
          updated_at = CURRENT_TIMESTAMP
      `);

      stmt.run(
        data.firstName,
        data.lastName,
        data.email || null,
        data.phone || null,
        data.location || null
      );

      return { id: 1, ...data };
    } catch (error) {
      log.error('Error creating/updating profile:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.PROFILE_UPDATE, async (_, data) => {
    try {
      // Use INSERT ... ON CONFLICT with COALESCE to preserve existing values
      const stmt = db.prepare(`
        INSERT INTO user_profile (id, first_name, last_name, email, phone, location)
        VALUES (1, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          first_name = COALESCE(excluded.first_name, user_profile.first_name),
          last_name = COALESCE(excluded.last_name, user_profile.last_name),
          email = COALESCE(excluded.email, user_profile.email),
          phone = COALESCE(excluded.phone, user_profile.phone),
          location = COALESCE(excluded.location, user_profile.location),
          updated_at = CURRENT_TIMESTAMP
      `);

      stmt.run(
        data.firstName ?? null,
        data.lastName ?? null,
        data.email ?? null,
        data.phone ?? null,
        data.location ?? null
      );

      return { id: 1, ...data };
    } catch (error) {
      log.error('Error updating profile:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.PROFILE_GET, async () => {
    try {
      const profileStmt = db.prepare('SELECT * FROM user_profile WHERE id = 1');
      const profile = profileStmt.get();

      if (!profile) {
        return null;
      }

      const skillsStmt = db.prepare(`
        SELECT s.*, sc.name as category_name
        FROM skills s
        LEFT JOIN skill_categories sc ON s.category_id = sc.id
        ORDER BY sc.sort_order, s.name
      `);
      const skills = skillsStmt.all();

      const prefsStmt = db.prepare('SELECT * FROM user_preferences WHERE id = 1');
      const rawPrefs = prefsStmt.get() as any;
      
      // Transform preferences to match frontend expectations (camelCase)
      const preferences = rawPrefs ? {
        minSalary: rawPrefs.desired_salary_min,
        maxSalary: rawPrefs.desired_salary_max,
        preferredLocations: rawPrefs.desired_locations
          ? JSON.parse(rawPrefs.desired_locations)
          : [],
        remoteWorkPreference: rawPrefs.remote_work_preference ?? rawPrefs.remote_preference,
        preferredRemotePercentage: rawPrefs.preferred_remote_percentage,
        acceptableRemoteMin: rawPrefs.acceptable_remote_min,
        acceptableRemoteMax: rawPrefs.acceptable_remote_max,
      } : null;

      return {
        ...profile,
        skills,
        preferences
      };
    } catch (error) {
      log.error('Error getting profile:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.PROFILE_DELETE, async () => {
    try {
      // Delete all profile-related data
      // Note: Skills and preferences are linked with CASCADE DELETE in schema
      const stmt = db.prepare('DELETE FROM user_profile WHERE id = 1');
      stmt.run();

      log.info('Profile deleted successfully');
      return { success: true };
    } catch (error) {
      log.error('Error deleting profile:', error);
      throw error;
    }
  });

  // Matching operations
  ipcMain.handle('matchJob', async (_, jobId: number) => {
    try {
      // Get API key from electron-store
      const apiKey = store.get('anthropic_api_key') as string;

      if (!apiKey) {
        throw new Error('Anthropic API-Key nicht konfiguriert. Bitte in Einstellungen hinterlegen.');
      }

      const result = await matchingService.matchJob(jobId, apiKey);
      return { success: true, data: result };
    } catch (error: any) {
      log.error('Error in matchJob:', error);
      throw error;
    }
  });

  // Get matching history for a job
  ipcMain.handle('getMatchingHistory', async (_, jobId: number) => {
    try {
      return matchingService.getMatchingHistory(jobId);
    } catch (error: any) {
      log.error('Error getting matching history:', error);
      throw error;
    }
  });

  // Bulk match all jobs
  ipcMain.handle('bulkMatchJobs', async (_, rematchAll: boolean) => {
    try {
      const apiKey = store.get('anthropic_api_key') as string;

      if (!apiKey) {
        throw new Error('Anthropic API-Key nicht konfiguriert. Bitte in Einstellungen hinterlegen.');
      }

      const result = await matchingService.bulkMatchJobs(apiKey, rematchAll);
      return { success: true, data: result };
    } catch (error: any) {
      log.error('Error in bulkMatchJobs:', error);
      throw error;
    }
  });

  // Get count of unmatched jobs
  ipcMain.handle('getUnmatchedJobCount', async () => {
    try {
      return matchingService.getUnmatchedJobCount();
    } catch (error: any) {
      log.error('Error getting unmatched job count:', error);
      throw error;
    }
  });

  // API Key management
  ipcMain.handle('saveApiKey', async (_, apiKey: string) => {
    try {
      store.set('anthropic_api_key', apiKey);
      log.info('API key saved successfully');
      return { success: true };
    } catch (error: any) {
      log.error('Error saving API key:', error);
      throw error;
    }
  });

  ipcMain.handle('getApiKey', async () => {
    try {
      return store.get('anthropic_api_key', null);
    } catch (error: any) {
      log.error('Error getting API key:', error);
      return null;
    }
  });

  ipcMain.handle('verifyApiKey', async (_, apiKey: string) => {
    try {
      const client = new Anthropic({ apiKey });

      // Mini-Test-Call to verify API key
      await client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }]
      });

      log.info('API key verified successfully');
      return { success: true };
    } catch (error: any) {
      log.error('Error verifying API key:', error);
      return { success: false, error: error.message };
    }
  });

  // Settings operations
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async (_, key) => {
    try {
      const stmt = db.prepare('SELECT value FROM app_settings WHERE key = ?');
      const result = stmt.get(key) as { value: string } | undefined;
      return result ? result.value : null;
    } catch (error) {
      log.error('Error getting setting:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_UPDATE, async (_, key, value) => {
    try {
      const stmt = db.prepare(`
        INSERT INTO app_settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = CURRENT_TIMESTAMP
      `);

      stmt.run(key, value);
      return { success: true };
    } catch (error) {
      log.error('Error updating setting:', error);
      throw error;
    }
  });

  // Database operations
  ipcMain.handle(IPC_CHANNELS.DB_BACKUP, async () => {
    try {
      const backupPath = await backupDatabase();
      return backupPath;
    } catch (error) {
      log.error('Error creating backup:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DB_RESTORE, async (_, backupPath) => {
    try {
      await restoreDatabase(backupPath);
      return { success: true };
    } catch (error) {
      log.error('Error restoring backup:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.DB_MIGRATE, async () => {
    try {
      await runMigrations();
      return { success: true };
    } catch (error) {
      log.error('Error running migrations:', error);
      throw error;
    }
  });

  // Skills operations
  ipcMain.handle(IPC_CHANNELS.SKILLS_GET_ALL, async () => {
    try {
      const stmt = db.prepare(`
        SELECT s.*, sc.name as category_name
        FROM skills s
        LEFT JOIN skill_categories sc ON s.category_id = sc.id
        ORDER BY sc.sort_order, s.name
      `);

      const skills = stmt.all();
      return skills.map((skill: any) => ({
        id: skill.id,
        name: skill.name,
        category: skill.category_name || '',
        level: skill.level,
        yearsOfExperience: skill.years_experience,
      }));
    } catch (error) {
      log.error('Error getting skills:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SKILLS_UPSERT, async (_, skill) => {
    try {
      // Check if skill exists in database (not just has an ID)
      let existingSkill = null;
      if (skill.id) {
        const checkStmt = db.prepare('SELECT id FROM skills WHERE id = ?');
        existingSkill = checkStmt.get(skill.id);
      }

      if (existingSkill) {
        // Update existing skill
        const stmt = db.prepare(`
          UPDATE skills
          SET name = ?, level = ?, category_id = ?, years_experience = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);

        stmt.run(
          skill.name,
          skill.level,
          skill.categoryId ?? null,
          skill.yearsOfExperience ?? null,
          skill.id
        );

        return {
          id: skill.id,
          name: skill.name,
          category: skill.category,
          level: skill.level,
          yearsOfExperience: skill.yearsOfExperience
        };
      } else {
        // Check 500-item limit before inserting
        const countStmt = db.prepare('SELECT COUNT(*) as count FROM skills');
        const { count } = countStmt.get() as { count: number };
        if (count >= 500) {
          throw new Error('Cannot add more than 500 skills');
        }

        // Insert new skill (ignore incoming ID, let DB assign)
        const stmt = db.prepare(`
          INSERT INTO skills (name, level, category_id, years_experience)
          VALUES (?, ?, ?, ?)
        `);

        const result = stmt.run(
          skill.name,
          skill.level,
          skill.categoryId ?? null,
          skill.yearsOfExperience ?? null
        );

        return {
          id: result.lastInsertRowid,
          name: skill.name,
          category: skill.category,
          level: skill.level,
          yearsOfExperience: skill.yearsOfExperience
        };
      }
    } catch (error) {
      log.error('Error upserting skill:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SKILLS_DELETE, async (_, id) => {
    try {
      const stmt = db.prepare('DELETE FROM skills WHERE id = ?');
      stmt.run(id);
      return { success: true };
    } catch (error) {
      log.error('Error deleting skill:', error);
      throw error;
    }
  });

  // Skills import operations
  ipcMain.handle('skills:selectFile', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'CSV or JSON Files', extensions: ['csv', 'json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true };
      }

      const filePath = result.filePaths[0];
      const filename = filePath.split(/[\\/]/).pop() || '';
      const content = fs.readFileSync(filePath, 'utf-8');

      return {
        canceled: false,
        filePath,
        filename,
        content
      };
    } catch (error: any) {
      log.error('Error selecting skills file:', error);
      throw error;
    }
  });

  ipcMain.handle('skills:importFromCsv', async (_, csvContent) => {
    try {
      return skillsImportService.importSkillsFromCsv(csvContent);
    } catch (error: any) {
      log.error('Error importing skills from CSV:', error);
      throw error;
    }
  });

  ipcMain.handle('skills:importFromJson', async (_, jsonContent) => {
    try {
      return skillsImportService.importSkillsFromJson(jsonContent);
    } catch (error: any) {
      log.error('Error importing skills from JSON:', error);
      throw error;
    }
  });

  // Skills conflict detection
  ipcMain.handle('skills:detectConflicts', async (_, csvContent) => {
    try {
      const rows = skillsImportService.parseSkillsCsv(csvContent);
      return skillsImportService.detectConflicts(rows);
    } catch (error: any) {
      log.error('Error detecting skill conflicts:', error);
      throw error;
    }
  });

  // Apply skill conflict resolutions
  ipcMain.handle('skills:applyResolutions', async (_, conflicts, resolutions) => {
    try {
      return skillsImportService.applyResolutions(conflicts, resolutions);
    } catch (error: any) {
      log.error('Error applying skill resolutions:', error);
      throw error;
    }
  });

  // Import only new skills (skip conflicts)
  ipcMain.handle('skills:importNewOnly', async (_, csvContent) => {
    try {
      const rows = skillsImportService.parseSkillsCsv(csvContent);
      return skillsImportService.importNewSkillsOnly(rows);
    } catch (error: any) {
      log.error('Error importing new skills only:', error);
      throw error;
    }
  });

  // Preferences operations
  ipcMain.handle(IPC_CHANNELS.PREFERENCES_GET, async () => {
    try {
      const stmt = db.prepare('SELECT * FROM user_preferences WHERE id = 1');
      const prefs = stmt.get() as any;

      if (!prefs) {
        return null;
      }

      // Map DB column names to frontend expected names (camelCase)
      return {
        minSalary: prefs.desired_salary_min,
        maxSalary: prefs.desired_salary_max,
        preferredLocations: prefs.desired_locations
          ? JSON.parse(prefs.desired_locations)
          : [],
        remoteWorkPreference: prefs.remote_work_preference ?? prefs.remote_preference,
        preferredRemotePercentage: prefs.preferred_remote_percentage,
        acceptableRemoteMin: prefs.acceptable_remote_min,
        acceptableRemoteMax: prefs.acceptable_remote_max,
      };
    } catch (error) {
      log.error('Error getting preferences:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.PREFERENCES_UPDATE, async (_, data) => {
    try {
      const stmt = db.prepare(`
        INSERT INTO user_preferences (
          id, desired_salary_min, desired_salary_max, desired_locations,
          remote_work_preference, preferred_remote_percentage,
          acceptable_remote_min, acceptable_remote_max
        )
        VALUES (1, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          desired_salary_min = excluded.desired_salary_min,
          desired_salary_max = excluded.desired_salary_max,
          desired_locations = excluded.desired_locations,
          remote_work_preference = excluded.remote_work_preference,
          preferred_remote_percentage = excluded.preferred_remote_percentage,
          acceptable_remote_min = excluded.acceptable_remote_min,
          acceptable_remote_max = excluded.acceptable_remote_max,
          updated_at = CURRENT_TIMESTAMP
      `);

      stmt.run(
        data.minSalary ?? null,
        data.maxSalary ?? null,
        data.preferredLocations ? JSON.stringify(data.preferredLocations) : null,
        data.remoteWorkPreference ?? 'flexible',
        data.preferredRemotePercentage ?? null,
        data.acceptableRemoteMin ?? null,
        data.acceptableRemoteMax ?? null
      );

      return { id: 1, ...data };
    } catch (error) {
      log.error('Error updating preferences:', error);
      throw error;
    }
  });

  // Test migration handler
  ipcMain.handle(IPC_CHANNELS.TEST_MIGRATION, async () => {
    try {
      const results: any = { tests: [] };

      // Test 1: Check schema
      const columns = db.prepare("PRAGMA table_info(user_preferences)").all();
      const columnNames = columns.map((r: any) => r.name);
      const expectedColumns = ['remote_work_preference', 'remote_work_updated_at'];
      const missingColumns = expectedColumns.filter(col => !columnNames.includes(col));

      results.tests.push({
        name: 'Schema Check',
        passed: missingColumns.length === 0,
        details: missingColumns.length === 0
          ? `All columns exist: ${expectedColumns.join(', ')}`
          : `Missing columns: ${missingColumns.join(', ')}`
      });

      if (missingColumns.length > 0) {
        return results;
      }

      // Test 2: Check current values
      const row = db.prepare("SELECT remote_work_preference, remote_work_updated_at FROM user_preferences LIMIT 1").get() as any;

      results.tests.push({
        name: 'Current Values',
        passed: true,
        details: row ? `remote_work_preference: ${row.remote_work_preference}, updated_at: ${row.remote_work_updated_at}` : 'No rows yet'
      });

      if (!row) {
        return results;
      }

      // Test 3: Test trigger
      const beforeTimestamp = row.remote_work_updated_at;
      const originalPreference = row.remote_work_preference;

      // Wait to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 100));

      db.prepare("UPDATE user_preferences SET remote_work_preference = ?").run('remote_only');

      const afterRow = db.prepare("SELECT remote_work_preference, remote_work_updated_at FROM user_preferences LIMIT 1").get() as any;

      const triggerWorked = afterRow.remote_work_updated_at !== beforeTimestamp;

      // Restore original value to prevent database state mutation
      db.prepare("UPDATE user_preferences SET remote_work_preference = ?").run(originalPreference);

      results.tests.push({
        name: 'Trigger Test',
        passed: triggerWorked,
        details: triggerWorked
          ? `Timestamp updated from ${beforeTimestamp} to ${afterRow.remote_work_updated_at}`
          : `Timestamp NOT updated (still ${afterRow.remote_work_updated_at})`
      });

      results.allPassed = results.tests.every((t: any) => t.passed);
      return results;
    } catch (error) {
      log.error('Error testing migration:', error);
      throw error;
    }
  });

  // ==========================================================================
  // Import operations (CSV Import from external sources)
  // ==========================================================================

  // Open file dialog and select CSV file
  ipcMain.handle('import:selectCsvFile', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'CSV-Datei zum Importieren auswählen',
        filters: [
          { name: 'CSV Files', extensions: ['csv'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { canceled: true };
      }

      const filePath = result.filePaths[0];
      const filename = filePath.split(/[\\/]/).pop() || 'import.csv';

      // Read file content
      const content = fs.readFileSync(filePath, 'utf-8');

      return {
        canceled: false,
        filePath,
        filename,
        content
      };
    } catch (error: any) {
      log.error('Error selecting CSV file:', error);
      throw error;
    }
  });

  // Process CSV content and create import session
  ipcMain.handle('import:processCsv', async (_, filename: string, csvContent: string) => {
    try {
      const session = importService.processImportCsv(filename, csvContent);
      return session;
    } catch (error: any) {
      log.error('Error processing CSV:', error);
      throw error;
    }
  });

  // Get all import sessions
  ipcMain.handle('import:getSessions', async () => {
    try {
      return importService.getImportSessions();
    } catch (error: any) {
      log.error('Error getting import sessions:', error);
      throw error;
    }
  });

  // Get a single import session
  ipcMain.handle('import:getSession', async (_, sessionId: number) => {
    try {
      return importService.getImportSession(sessionId);
    } catch (error: any) {
      log.error('Error getting import session:', error);
      throw error;
    }
  });

  // Get staging rows for a session
  ipcMain.handle('import:getStagingRows', async (_, sessionId: number) => {
    try {
      return importService.getStagingRows(sessionId);
    } catch (error: any) {
      log.error('Error getting staging rows:', error);
      throw error;
    }
  });

  // Import a single staging row (with AI extraction)
  ipcMain.handle('import:importRow', async (_, rowId: number) => {
    try {
      const jobId = await importService.importStagingRow(rowId);
      return { success: true, jobId };
    } catch (error: any) {
      log.error('Error importing row:', error);
      throw error;
    }
  });

  // Import all new rows from a session
  ipcMain.handle('import:importAllNew', async (_, sessionId: number) => {
    try {
      const result = await importService.importAllNewRows(sessionId);
      return result;
    } catch (error: any) {
      log.error('Error importing all new rows:', error);
      throw error;
    }
  });

  // Skip a staging row
  ipcMain.handle('import:skipRow', async (_, rowId: number) => {
    try {
      importService.skipStagingRow(rowId);
      return { success: true };
    } catch (error: any) {
      log.error('Error skipping row:', error);
      throw error;
    }
  });

  // Update staging row status
  ipcMain.handle('import:updateRowStatus', async (_, rowId: number, status: string) => {
    try {
      // Validate status parameter
      const validStatuses = ['pending', 'duplicate', 'likely_duplicate', 'new', 'imported', 'skipped'] as const;
      if (!validStatuses.includes(status as typeof validStatuses[number])) {
        throw new Error(`Invalid status: ${status}. Valid values: ${validStatuses.join(', ')}`);
      }
      importService.updateStagingRowStatus(rowId, status as typeof validStatuses[number]);
      return { success: true };
    } catch (error: any) {
      log.error('Error updating row status:', error);
      throw error;
    }
  });

  // Delete an import session
  ipcMain.handle('import:deleteSession', async (_, sessionId: number) => {
    try {
      importService.deleteImportSession(sessionId);
      return { success: true };
    } catch (error: any) {
      log.error('Error deleting import session:', error);
      throw error;
    }
  });

  // ==========================================================================
  // Export operations (Markdown & PDF)
  // ==========================================================================

  // Export job to Markdown
  ipcMain.handle('export:toMarkdown', async (_, jobId: number) => {
    try {
      return await exportService.exportToMarkdown(jobId);
    } catch (error: any) {
      log.error('Error exporting to Markdown:', error);
      throw error;
    }
  });

  // Export job to PDF
  ipcMain.handle('export:toPdf', async (event, jobId: number) => {
    try {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) {
        throw new Error('No window found');
      }
      return await exportService.exportToPdf(jobId, window.webContents);
    } catch (error: any) {
      log.error('Error exporting to PDF:', error);
      throw error;
    }
  });

  log.info('IPC handlers registered successfully');
}
