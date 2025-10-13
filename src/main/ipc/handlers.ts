import { ipcMain } from 'electron';
import * as log from 'electron-log';
import { IPC_CHANNELS } from '../../shared/constants';
import { getDatabase } from '../database/db';
import { backupDatabase, restoreDatabase, runMigrations } from '../database/db';

/**
 * Register all IPC handlers
 */
export function registerIpcHandlers() {
  log.info('Registering IPC handlers...');

  const db = getDatabase();

  // Job operations
  ipcMain.handle(IPC_CHANNELS.JOB_CREATE, async (_, data) => {
    try {
      const stmt = db.prepare(`
        INSERT INTO job_offers (
          source_id, title, company, url, posted_date, location,
          remote_option, full_text, import_method, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        data.sourceId,
        data.title,
        data.company,
        data.url,
        data.postedDate,
        data.location || null,
        data.remoteOption || null,
        data.fullText || null,
        data.importMethod || 'copy_paste',
        data.status || 'new'
      );

      return { id: result.lastInsertRowid, ...data };
    } catch (error) {
      log.error('Error creating job:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.JOB_UPDATE, async (_, id, data) => {
    try {
      const stmt = db.prepare(`
        UPDATE job_offers
        SET title = ?, company = ?, location = ?, status = ?, notes = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(
        data.title,
        data.company,
        data.location,
        data.status,
        data.notes || null,
        id
      );

      return { id, ...data };
    } catch (error) {
      log.error('Error updating job:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.JOB_DELETE, async (_, id) => {
    try {
      const stmt = db.prepare('DELETE FROM job_offers WHERE id = ?');
      stmt.run(id);
      return { success: true };
    } catch (error) {
      log.error('Error deleting job:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.JOB_GET_ALL, async () => {
    try {
      const stmt = db.prepare(`
        SELECT
          jo.*,
          js.name as source_name,
          mr.match_score,
          mr.match_category
        FROM job_offers jo
        LEFT JOIN job_sources js ON jo.source_id = js.id
        LEFT JOIN matching_results mr ON jo.id = mr.job_id
        ORDER BY jo.posted_date DESC
      `);

      return stmt.all();
    } catch (error) {
      log.error('Error getting jobs:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.JOB_GET_BY_ID, async (_, id) => {
    try {
      const stmt = db.prepare(`
        SELECT
          jo.*,
          js.name as source_name,
          js.url as source_url
        FROM job_offers jo
        LEFT JOIN job_sources js ON jo.source_id = js.id
        WHERE jo.id = ?
      `);

      return stmt.get(id);
    } catch (error) {
      log.error('Error getting job by id:', error);
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
      // Use INSERT ... ON CONFLICT to handle both create and update
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
      const preferences = prefsStmt.get();

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
          skill.categoryId || null,
          skill.yearsOfExperience || null,
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
          skill.categoryId || null,
          skill.yearsOfExperience || null
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

      return {
        ...prefs,
        min_salary: prefs.desired_salary_min,
        max_salary: prefs.desired_salary_max,
        preferred_locations: prefs.desired_locations
          ? JSON.parse(prefs.desired_locations)
          : [],
        remote_work_preference: prefs.remote_preference || prefs.remote_work_preference,
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
          id, desired_salary_min, desired_salary_max, desired_locations, remote_preference
        )
        VALUES (1, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          desired_salary_min = excluded.desired_salary_min,
          desired_salary_max = excluded.desired_salary_max,
          desired_locations = excluded.desired_locations,
          remote_preference = excluded.remote_preference,
          updated_at = CURRENT_TIMESTAMP
      `);

      stmt.run(
        data.minSalary || null,
        data.maxSalary || null,
        data.preferredLocations ? JSON.stringify(data.preferredLocations) : null,
        data.remoteWorkPreference || 'flexible'
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
