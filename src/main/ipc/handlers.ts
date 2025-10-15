import { ipcMain } from 'electron';
import * as log from 'electron-log';
import { IPC_CHANNELS } from '../../shared/constants';
import { getDatabase } from '../database/db';
import { backupDatabase, restoreDatabase, runMigrations } from '../database/db';
import * as jobService from '../services/jobService';
import * as aiExtractionService from '../services/aiExtractionService';

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

  // Matching operations (placeholder - will implement AI service later)
  ipcMain.handle(IPC_CHANNELS.MATCH_RUN, async (_, jobId, profileId) => {
    try {
      log.info(`Running match for job ${jobId} and profile ${profileId}`);
      // TODO: Implement AI matching service
      return { jobId, profileId, message: 'Matching service not yet implemented' };
    } catch (error) {
      log.error('Error running match:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.MATCH_GET_RESULTS, async (_, jobId) => {
    try {
      const stmt = db.prepare(`
        SELECT mr.*, mp.name as prompt_name, mp.version as prompt_version
        FROM matching_results mr
        LEFT JOIN matching_prompts mp ON mr.prompt_id = mp.id
        WHERE mr.job_id = ?
        ORDER BY mr.created_at DESC
        LIMIT 1
      `);

      return stmt.get(jobId);
    } catch (error) {
      log.error('Error getting match results:', error);
      throw error;
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

        return { id: skill.id, ...skill };
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

        return { id: result.lastInsertRowid, ...skill };
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

  log.info('IPC handlers registered successfully');
}
