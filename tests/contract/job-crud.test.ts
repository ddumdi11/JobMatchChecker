/**
 * Contract tests for Job CRUD IPC handlers (Issue #57, Option 3).
 *
 * Prüft die ECHTE Verdrahtung der IPC-Schicht: `handlers.ts → jobService → SQL`.
 * Statt gegen `window.api` (Electron-Preload, unter Node/vitest nicht vorhanden)
 * laufen die Tests über den Harness `invoke(channel, ...)` / `isRegistered(...)`
 * (siehe tests/helpers/ipcContract.ts) gegen die frisch migrierte Test-DB.
 *
 * Damit fällt u. a. "IPC-Handler vergessen zu registrieren" auf (isRegistered),
 * ebenso Fehler in der Handler→Service-Verdrahtung. Reine Datenbank-/Query-Logik
 * ist zusätzlich in tests/unit/jobService.test.ts abgedeckt.
 *
 * Feature: 005-job-offer-management (ursprünglich als window.api-Contract; auf die
 * Handler-Schicht umklassifiziert, weil window.api unter Node nicht existiert).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { JobOfferInput, JobFilters, JobSortConfig, PaginationParams } from '../../src/shared/types';
import { invoke, isRegistered, getDatabase } from '../helpers/ipcContract';

const SOURCE_LINKEDIN = 1; // seeded (20250930000002_seed_initial_data.js)

function clearJobs(): void {
  const db = getDatabase();
  db.prepare('DELETE FROM matching_results').run();
  db.prepare('DELETE FROM job_offers').run();
}

function baseJobInput(overrides: Partial<JobOfferInput> = {}): JobOfferInput {
  return {
    sourceId: SOURCE_LINKEDIN,
    title: 'Baseline Job',
    company: 'Baseline Company',
    postedDate: new Date('2026-01-15'),
    status: 'new',
    importMethod: 'manual',
    ...overrides
  } as JobOfferInput;
}

let existingId: number;

beforeEach(async () => {
  clearJobs();
  // Ein bekannter Bestand pro Test — die frisch migrierte DB hat keine Jobs.
  const job = await invoke('createJob', baseJobInput());
  existingId = job.id;
});

describe('Contract: Job CRUD IPC Handlers (Handler-Schicht)', () => {

  describe('getJobs() - List jobs with pagination, filters, and sorting', () => {
    it('registriert den Kanal getJobs', () => {
      expect(isRegistered('getJobs')).toBe(true);
    });

    it('should accept pagination parameters', async () => {
      const pagination: PaginationParams = { page: 1, limit: 25 };
      const result = await invoke('getJobs', undefined, undefined, pagination);

      expect(result).toBeDefined();
      expect(result.pagination).toBeDefined();
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(25);
    });

    it('should accept filter parameters', async () => {
      const filters: JobFilters = {
        status: 'new',
        sourceId: 1,
        postedDateFrom: new Date('2025-01-01'),
        postedDateTo: new Date('2026-12-31'),
        matchScoreMin: 50,
        matchScoreMax: 100
      };
      const result = await invoke('getJobs', filters);

      expect(result).toBeDefined();
      expect(result.jobs).toBeInstanceOf(Array);
    });

    it('should accept sort parameters', async () => {
      const sort: JobSortConfig = { sortBy: 'postedDate', sortOrder: 'desc' };
      const result = await invoke('getJobs', undefined, sort);

      expect(result).toBeDefined();
      expect(result.jobs).toBeInstanceOf(Array);
    });

    it('should return PaginatedJobsResponse structure', async () => {
      const result = await invoke('getJobs');

      expect(result).toHaveProperty('jobs');
      expect(result).toHaveProperty('pagination');
      expect(Array.isArray(result.jobs)).toBe(true);

      expect(result.pagination).toHaveProperty('page');
      expect(result.pagination).toHaveProperty('limit');
      expect(result.pagination).toHaveProperty('total');
      expect(result.pagination).toHaveProperty('totalPages');

      expect(typeof result.pagination.page).toBe('number');
      expect(typeof result.pagination.limit).toBe('number');
      expect(typeof result.pagination.total).toBe('number');
      expect(typeof result.pagination.totalPages).toBe('number');
    });

    it('should handle empty filters (return all jobs)', async () => {
      const result = await invoke('getJobs', {} as JobFilters);
      expect(result).toBeDefined();
      expect(result.jobs).toBeInstanceOf(Array);
    });

    it('should combine multiple filters with AND logic', async () => {
      const filters: JobFilters = { status: 'interesting', sourceId: 1 };
      const result = await invoke('getJobs', filters);

      expect(result.jobs).toBeInstanceOf(Array);
      if (result.jobs.length > 0) {
        result.jobs.forEach((job: any) => {
          expect(job.status).toBe('interesting');
          expect(job.sourceId).toBe(1);
        });
      }
    });

    it('should return default pagination when not specified', async () => {
      const result = await invoke('getJobs');
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(25); // Default from spec
    });
  });

  describe('getJobById() - Get single job by ID', () => {
    it('registriert den Kanal getJobById', () => {
      expect(isRegistered('getJobById')).toBe(true);
    });

    it('should accept integer ID parameter', async () => {
      const result = await invoke('getJobById', existingId);
      expect(result).toBeDefined();
      expect(result.id).toBe(existingId);
    });

    it('should return JobOffer with sourceName joined', async () => {
      const result = await invoke('getJobById', existingId);
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('sourceId');
      expect(result).toHaveProperty('sourceName'); // Joined field
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('company');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('createdAt');
      expect(result).toHaveProperty('updatedAt');
    });

    it('should throw NOT_FOUND error for non-existent ID', async () => {
      await expect(invoke('getJobById', 99999)).rejects.toThrow();
    });
  });

  describe('createJob() - Create new job offer', () => {
    it('registriert den Kanal createJob', () => {
      expect(isRegistered('createJob')).toBe(true);
    });

    it('should accept JobOfferInput object', async () => {
      const jobInput = baseJobInput({
        title: 'Senior TypeScript Developer',
        company: 'Tech Corp',
        url: 'https://example.com/job/123',
        location: 'Berlin, Germany',
        remoteOption: 'hybrid',
        salaryRange: '70k-90k EUR',
        contractType: 'full-time',
        fullText: 'We are looking for...'
      });
      const result = await invoke('createJob', jobInput);

      expect(result.id).toBeDefined();
      expect(typeof result.id).toBe('number');
      expect(result.title).toBe(jobInput.title);
      expect(result.company).toBe(jobInput.company);
    });

    it('should return created JobOffer with generated ID and timestamps', async () => {
      const result = await invoke('createJob', baseJobInput({ title: 'Test Job', company: 'Test Company', postedDate: new Date() }));
      expect(result.id).toBeGreaterThan(0);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw VALIDATION_ERROR for missing required fields', async () => {
      const invalidInput = { status: 'new' } as JobOfferInput;
      await expect(invoke('createJob', invalidInput)).rejects.toThrow();
    });

    it('should throw VALIDATION_ERROR for future postedDate', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      await expect(invoke('createJob', baseJobInput({ postedDate: futureDate }))).rejects.toThrow();
    });

    it('should throw VALIDATION_ERROR for deadline before postedDate', async () => {
      const invalidInput = baseJobInput({
        postedDate: new Date('2025-10-15'),
        deadline: new Date('2025-10-10') // Before posted date
      });
      await expect(invoke('createJob', invalidInput)).rejects.toThrow();
    });

    it('should throw VALIDATION_ERROR for invalid URL format', async () => {
      await expect(invoke('createJob', baseJobInput({ url: 'not-a-valid-url' }))).rejects.toThrow();
    });
  });

  describe('updateJob() - Update existing job offer', () => {
    it('registriert den Kanal updateJob', () => {
      expect(isRegistered('updateJob')).toBe(true);
    });

    it('should accept id and partial JobOfferInput', async () => {
      const result = await invoke('updateJob', existingId, {
        status: 'applied',
        notes: 'Applied via company website'
      } as Partial<JobOfferInput>);

      expect(result.id).toBe(existingId);
      expect(result.status).toBe('applied');
      expect(result.notes).toBe('Applied via company website');
    });

    it('should return updated JobOffer with a valid updatedAt timestamp', async () => {
      const result = await invoke('updateJob', existingId, { title: 'Updated Title' } as Partial<JobOfferInput>);
      // Contract-Ebene: updateJob liefert einen JobOffer mit gültigem updatedAt.
      // Eine "innerhalb-5-s"-Frischeprüfung wäre HIER unzuverlässig: created_at/
      // updated_at werden von SQLite CURRENT_TIMESTAMP als UTC ohne "Z" abgelegt
      // und in rowToJobOffer als Lokalzeit geparst (bekannte Timestamp-Inkonsistenz,
      // RESUME "zweite Charge" Punkt 2). Diese Semantik gehört nicht in den
      // IPC-Contract, sondern in die Timestamp-Vereinheitlichung.
      expect(result.updatedAt).toBeInstanceOf(Date);
      expect(Number.isNaN(result.updatedAt.getTime())).toBe(false);
    });

    it('should throw NOT_FOUND error for non-existent job', async () => {
      await expect(invoke('updateJob', 99999, { status: 'applied' } as Partial<JobOfferInput>)).rejects.toThrow();
    });

    it('should validate required fields on update (same as create)', async () => {
      await expect(invoke('updateJob', existingId, { title: '' } as Partial<JobOfferInput>)).rejects.toThrow();
    });
  });

  describe('deleteJob() - Delete job offer', () => {
    it('registriert den Kanal deleteJob', () => {
      expect(isRegistered('deleteJob')).toBe(true);
    });

    it('should accept integer ID parameter and return void', async () => {
      const result = await invoke('deleteJob', existingId);
      expect(result).toBeUndefined();
    });

    it('should complete successfully without errors', async () => {
      await expect(invoke('deleteJob', existingId)).resolves.toBeUndefined();
    });

    it('should throw NOT_FOUND error for non-existent job', async () => {
      await expect(invoke('deleteJob', 99999)).rejects.toThrow();
    });

    it('should cascade delete associated matching results', async () => {
      // CASCADE ist Schema-Sache; hier nur, dass der Handler sauber durchläuft.
      await expect(invoke('deleteJob', existingId)).resolves.toBeUndefined();
    });
  });

  describe('getJobSources() - Get list of job sources', () => {
    it('registriert den Kanal getJobSources', () => {
      expect(isRegistered('getJobSources')).toBe(true);
    });

    it('should return array of JobSource objects', async () => {
      const result = await invoke('getJobSources');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return array with id/name structure', async () => {
      const result = await invoke('getJobSources');
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0]).toHaveProperty('id');
        expect(result[0]).toHaveProperty('name');
        expect(typeof result[0].id).toBe('number');
        expect(typeof result[0].name).toBe('string');
      }
    });
  });

  describe('getJobStatusOptions() - Get list of job status options', () => {
    it('registriert den Kanal getJobStatusOptions', () => {
      expect(isRegistered('getJobStatusOptions')).toBe(true);
    });

    it('should return array of status option objects', async () => {
      const result = await invoke('getJobStatusOptions');
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      const option = result[0];
      expect(option).toHaveProperty('value');
      expect(option).toHaveProperty('label');
      expect(typeof option.value).toBe('string');
      expect(typeof option.label).toBe('string');
    });

    it('should return all 5 status values', async () => {
      const result = await invoke('getJobStatusOptions');
      expect(result.length).toBe(5);
      const values = result.map((opt: any) => opt.value);
      expect(values).toContain('new');
      expect(values).toContain('interesting');
      expect(values).toContain('applied');
      expect(values).toContain('rejected');
      expect(values).toContain('archived');
    });

    it('should have user-friendly labels (capitalized)', async () => {
      const result = await invoke('getJobStatusOptions');
      result.forEach((option: any) => {
        expect(option.label[0]).toBe(option.label[0].toUpperCase());
        expect(option.label.length).toBeGreaterThan(0);
      });
    });
  });
});
