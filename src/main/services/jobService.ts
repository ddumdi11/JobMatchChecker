/**
 * Job Service - CRUD operations and business rule validation
 *
 * Feature: 005-job-offer-management
 * Phase: 3.3 Implementation (GREEN)
 * Task: T012
 */

import { getDatabase } from '../database/db';
import type {
  JobOffer,
  JobOfferInput,
  JobFilters,
  JobSortConfig,
  PaginationParams,
  PaginatedJobsResponse,
  JobStatus
} from '../../shared/types';

/**
 * Custom error class for validation errors
 */
class ValidationError extends Error {
  code = 'VALIDATION_ERROR';
  field: string;

  constructor(field: string, message: string) {
    super(message);
    this.field = field;
    this.name = 'ValidationError';
  }
}

/**
 * Custom error class for not found errors
 */
class NotFoundError extends Error {
  code = 'NOT_FOUND';
  entity: string;
  id: number;

  constructor(entity: string, id: number) {
    super(`${entity} with id ${id} not found`);
    this.entity = entity;
    this.id = id;
    this.name = 'NotFoundError';
  }
}

/**
 * Validate business rules before insert/update
 *
 * Business Rules:
 * BR-1: Required fields (title, company, postedDate, sourceId)
 * BR-2: postedDate not in future
 * BR-3: deadline after postedDate
 * BR-4: URL validation (HTTP/HTTPS)
 * BR-5: Status enum values
 * BR-6: Match score range (0-100)
 * BR-7: Foreign key integrity (sourceId exists)
 */
function validateJobData(data: Partial<JobOfferInput>, isUpdate = false): void {
  const db = getDatabase();

  // BR-1: Required fields (only for create, or if provided in update)
  if (!isUpdate || data.title !== undefined) {
    if (!data.title || data.title.trim() === '') {
      throw new ValidationError('title', 'Title is required');
    }
  }

  if (!isUpdate || data.company !== undefined) {
    if (!data.company || data.company.trim() === '') {
      throw new ValidationError('company', 'Company is required');
    }
  }

  if (!isUpdate || data.postedDate !== undefined) {
    if (!data.postedDate) {
      throw new ValidationError('postedDate', 'postedDate is required');
    }
  }

  if (!isUpdate || data.sourceId !== undefined) {
    if (!data.sourceId) {
      throw new ValidationError('sourceId', 'Job source is required');
    }
  }

  // BR-2: postedDate not in future
  if (data.postedDate) {
    const postedDate = new Date(String(data.postedDate));
    if (isNaN(postedDate.getTime())) {
      throw new ValidationError('postedDate', 'Invalid posted date format');
    }

    const now = new Date();
    now.setHours(23, 59, 59, 999); // End of today

    if (postedDate > now) {
      throw new ValidationError('postedDate', 'Posted date cannot be in the future');
    }
  }

  // BR-3: deadline after postedDate
  if (data.deadline && data.postedDate) {
    const deadline = new Date(String(data.deadline));
    if (isNaN(deadline.getTime())) {
      throw new ValidationError('deadline', 'Invalid deadline format');
    }

    const postedDate = new Date(String(data.postedDate));
    if (isNaN(postedDate.getTime())) {
      throw new ValidationError('postedDate', 'Invalid posted date format');
    }

    if (deadline <= postedDate) {
      throw new ValidationError('deadline', 'Deadline must be after posted date');
    }
  }

  // BR-4: URL validation
  if (data.url) {
    try {
      const url = new URL(data.url);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('Invalid protocol');
      }
    } catch (error) {
      throw new ValidationError('url', 'Invalid URL format');
    }
  }

  // BR-5: Status enum validation
  if (data.status) {
    const validStatuses: JobStatus[] = ['new', 'interesting', 'applied', 'rejected', 'archived'];
    if (!validStatuses.includes(data.status as JobStatus)) {
      throw new ValidationError('status', 'Invalid status value');
    }
  }

  // BR-6: Match score range (0-100)
  if (data.matchScore !== undefined && data.matchScore !== null) {
    if (typeof data.matchScore !== 'number' || data.matchScore < 0 || data.matchScore > 100) {
      throw new ValidationError('matchScore', 'Match score must be between 0 and 100');
    }
  }

  // BR-7: Foreign key integrity (sourceId exists)
  if (data.sourceId) {
    const source = db.prepare('SELECT id FROM job_sources WHERE id = ?').get(data.sourceId);
    if (!source) {
      throw new ValidationError('sourceId', 'Selected job source does not exist');
    }
  }
}

/**
 * Convert database row to JobOffer object
 */
function rowToJobOffer(row: any): JobOffer {
  return {
    id: row.id,
    sourceId: row.source_id,
    sourceName: row.source_name || undefined,
    title: row.title,
    company: row.company,
    url: row.url || undefined,
    postedDate: new Date(row.posted_date),
    deadline: row.deadline ? new Date(row.deadline) : undefined,
    location: row.location || undefined,
    remoteOption: row.remote_option || undefined,
    salaryRange: row.salary_range || undefined,
    contractType: row.contract_type || undefined,
    fullText: row.full_text || undefined,
    rawImportData: row.raw_import_data || undefined,
    importMethod: row.import_method as any || undefined,
    notes: row.notes || undefined,
    status: row.status as JobStatus,
    matchScore: row.match_score !== null ? row.match_score : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  };
}

/**
 * Create a new job offer
 */
export async function createJob(data: JobOfferInput): Promise<JobOffer> {
  // Validate business rules
  validateJobData(data, false);

  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO job_offers (
      source_id, title, company, url, posted_date, deadline,
      location, remote_option, salary_range, contract_type,
      full_text, raw_import_data, import_method, notes, status, match_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Normalize dates to ISO strings
  const postedDate = new Date(String(data.postedDate));
  const postedIso = isNaN(postedDate.getTime()) ? null : postedDate.toISOString();

  let deadlineIso: string | null = null;
  if (data.deadline) {
    const deadline = new Date(String(data.deadline));
    deadlineIso = isNaN(deadline.getTime()) ? null : deadline.toISOString();
  }

  const info = stmt.run(
    data.sourceId,
    data.title,
    data.company,
    data.url || null,
    postedIso,
    deadlineIso,
    data.location || null,
    data.remoteOption || null,
    data.salaryRange || null,
    data.contractType || null,
    data.fullText || null,
    data.rawImportData || null,
    data.importMethod || null,
    data.notes || null,
    data.status || 'new',
    data.matchScore !== undefined ? data.matchScore : null
  );

  const jobId = info.lastInsertRowid as number;

  // Fetch and return the created job
  return await getJobById(jobId);
}

/**
 * Get a job offer by ID
 */
export async function getJobById(id: number): Promise<JobOffer> {
  const db = getDatabase();

  const row = db.prepare(`
    SELECT
      jo.*,
      js.name as source_name
    FROM job_offers jo
    LEFT JOIN job_sources js ON jo.source_id = js.id
    WHERE jo.id = ?
  `).get(id);

  if (!row) {
    throw new NotFoundError('job_offer', id);
  }

  return rowToJobOffer(row);
}

/**
 * Get jobs with filters, sorting, and pagination
 */
export async function getJobs(
  filters?: JobFilters,
  sort?: JobSortConfig,
  pagination?: PaginationParams
): Promise<PaginatedJobsResponse> {
  const db = getDatabase();

  // Build WHERE clause
  const whereClauses: string[] = [];
  const params: any[] = [];

  if (filters) {
    if (filters.status) {
      whereClauses.push('jo.status = ?');
      params.push(filters.status);
    }

    if (filters.sourceId) {
      whereClauses.push('jo.source_id = ?');
      params.push(filters.sourceId);
    }

    if (filters.postedDateFrom) {
      whereClauses.push('jo.posted_date >= ?');
      params.push(filters.postedDateFrom.toISOString());
    }

    if (filters.postedDateTo) {
      whereClauses.push('jo.posted_date <= ?');
      params.push(filters.postedDateTo.toISOString());
    }

    if (filters.matchScoreMin !== undefined && filters.matchScoreMin !== null) {
      whereClauses.push('jo.match_score >= ?');
      params.push(filters.matchScoreMin);
    }

    if (filters.matchScoreMax !== undefined && filters.matchScoreMax !== null) {
      whereClauses.push('jo.match_score <= ?');
      params.push(filters.matchScoreMax);
    }
  }

  const whereClause = whereClauses.length > 0
    ? `WHERE ${whereClauses.join(' AND ')}`
    : '';

  // Build ORDER BY clause
  const sortBy = sort?.sortBy || 'postedDate';

  // Normalize and whitelist sortOrder
  const rawSortOrder = (sort?.sortOrder || 'desc').toString().trim().toLowerCase();
  const sortOrder = rawSortOrder === 'asc' ? 'ASC' : 'DESC';

  const columnMap: Record<string, string> = {
    postedDate: 'jo.posted_date',
    company: 'jo.company',
    status: 'jo.status',
    matchScore: 'jo.match_score'
  };

  const orderByColumn = columnMap[sortBy] || 'jo.posted_date';
  const orderByClause = `ORDER BY ${orderByColumn} ${sortOrder}`;

  // Pagination
  const page = pagination?.page || 1;
  const limit = pagination?.limit || 25;
  const offset = (page - 1) * limit;

  // Count total
  const countSql = `
    SELECT COUNT(*) as total
    FROM job_offers jo
    ${whereClause}
  `;

  const totalRow = db.prepare(countSql).get(...params) as { total: number };
  const total = totalRow.total;

  // Fetch jobs
  const sql = `
    SELECT
      jo.*,
      js.name as source_name
    FROM job_offers jo
    LEFT JOIN job_sources js ON jo.source_id = js.id
    ${whereClause}
    ${orderByClause}
    LIMIT ? OFFSET ?
  `;

  const rows = db.prepare(sql).all(...params, limit, offset);
  const jobs = rows.map(rowToJobOffer);

  return {
    jobs,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Update a job offer
 */
export async function updateJob(id: number, data: Partial<JobOfferInput>): Promise<JobOffer> {
  // Validate business rules
  validateJobData(data, true);

  const db = getDatabase();

  // Check if job exists
  const existing = db.prepare('SELECT id FROM job_offers WHERE id = ?').get(id);
  if (!existing) {
    throw new NotFoundError('job_offer', id);
  }

  // Build UPDATE query dynamically (only update provided fields)
  const updates: string[] = [];
  const params: any[] = [];

  if (data.sourceId !== undefined) {
    updates.push('source_id = ?');
    params.push(data.sourceId);
  }

  if (data.title !== undefined) {
    updates.push('title = ?');
    params.push(data.title);
  }

  if (data.company !== undefined) {
    updates.push('company = ?');
    params.push(data.company);
  }

  if (data.url !== undefined) {
    updates.push('url = ?');
    params.push(data.url || null);
  }

  if (data.postedDate !== undefined) {
    updates.push('posted_date = ?');
    if (data.postedDate === null) {
      params.push(null);
    } else if (data.postedDate instanceof Date) {
      params.push(data.postedDate.toISOString());
    } else {
      const date = new Date(String(data.postedDate));
      params.push(isNaN(date.getTime()) ? null : date.toISOString());
    }
  }

  if (data.deadline !== undefined) {
    updates.push('deadline = ?');
    if (data.deadline === null) {
      params.push(null);
    } else if (data.deadline instanceof Date) {
      params.push(data.deadline.toISOString());
    } else {
      const date = new Date(String(data.deadline));
      params.push(isNaN(date.getTime()) ? null : date.toISOString());
    }
  }

  if (data.location !== undefined) {
    updates.push('location = ?');
    params.push(data.location || null);
  }

  if (data.remoteOption !== undefined) {
    updates.push('remote_option = ?');
    params.push(data.remoteOption || null);
  }

  if (data.salaryRange !== undefined) {
    updates.push('salary_range = ?');
    params.push(data.salaryRange || null);
  }

  if (data.contractType !== undefined) {
    updates.push('contract_type = ?');
    params.push(data.contractType || null);
  }

  if (data.fullText !== undefined) {
    updates.push('full_text = ?');
    params.push(data.fullText || null);
  }

  if (data.rawImportData !== undefined) {
    updates.push('raw_import_data = ?');
    params.push(data.rawImportData || null);
  }

  if (data.importMethod !== undefined) {
    updates.push('import_method = ?');
    params.push(data.importMethod || null);
  }

  if (data.notes !== undefined) {
    updates.push('notes = ?');
    params.push(data.notes || null);
  }

  if (data.status !== undefined) {
    updates.push('status = ?');
    params.push(data.status);
  }

  if (data.matchScore !== undefined) {
    updates.push('match_score = ?');
    params.push(data.matchScore !== null ? data.matchScore : null);
  }

  // Always update updated_at
  updates.push('updated_at = CURRENT_TIMESTAMP');

  const sql = `
    UPDATE job_offers
    SET ${updates.join(', ')}
    WHERE id = ?
  `;

  params.push(id);

  db.prepare(sql).run(...params);

  // Fetch and return updated job
  return await getJobById(id);
}

/**
 * Delete a job offer
 */
export async function deleteJob(id: number): Promise<void> {
  const db = getDatabase();

  // Check if job exists
  const existing = db.prepare('SELECT id FROM job_offers WHERE id = ?').get(id);
  if (!existing) {
    throw new NotFoundError('job_offer', id);
  }

  // Delete (cascade to matching_results via FK constraint)
  db.prepare('DELETE FROM job_offers WHERE id = ?').run(id);
}

/**
 * Get all job sources
 */
export function getJobSources(): Array<{ id: number; name: string }> {
  const db = getDatabase();

  const rows = db.prepare('SELECT id, name FROM job_sources ORDER BY name').all();

  return rows as Array<{ id: number; name: string }>;
}

/**
 * Get job status options with user-friendly labels
 */
export function getJobStatusOptions(): Array<{ value: JobStatus; label: string }> {
  return [
    { value: 'new', label: 'New' },
    { value: 'interesting', label: 'Interesting' },
    { value: 'applied', label: 'Applied' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'archived', label: 'Archived' }
  ];
}
