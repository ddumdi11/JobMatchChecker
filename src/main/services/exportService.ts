/**
 * Export Service - Generate Markdown and PDF exports for job details
 * Feature: Bulk Matching + Export
 */

import { getDatabase } from '../database/db';
import * as log from 'electron-log';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { dialog, shell } from 'electron';

/**
 * Job data for export (includes matching result)
 */
interface JobExportData {
  // Job basic info
  title: string;
  company: string;
  location?: string;
  remoteOption?: string;
  salaryRange?: string;
  contractType?: string;
  postedDate: Date;
  deadline?: Date;
  url?: string;
  sourceName?: string;
  fullText?: string;
  notes?: string;
  status: string;
  matchScore?: number;

  // Matching result
  matching?: {
    matchScore: number;
    matchCategory: string;
    strengths: string[];
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
    recommendations: string[];
    reasoning: string;
  };
}

/**
 * Get job data with latest matching result for export
 */
export function getJobExportData(jobId: number): JobExportData {
  const db = getDatabase();

  // Get job
  const job = db.prepare(`
    SELECT jo.*, js.name as source_name
    FROM job_offers jo
    LEFT JOIN job_sources js ON jo.source_id = js.id
    WHERE jo.id = ?
  `).get(jobId) as any;

  if (!job) {
    throw new Error(`Job with ID ${jobId} not found`);
  }

  // Get latest matching result
  const matchingResult = db.prepare(`
    SELECT * FROM matching_results
    WHERE job_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(jobId) as any;

  const exportData: JobExportData = {
    title: job.title,
    company: job.company,
    location: job.location,
    remoteOption: job.remote_option,
    salaryRange: job.salary_range,
    contractType: job.contract_type,
    postedDate: new Date(job.posted_date),
    deadline: job.deadline ? new Date(job.deadline) : undefined,
    url: job.url,
    sourceName: job.source_name,
    fullText: job.full_text,
    notes: job.notes,
    status: job.status,
    matchScore: job.match_score
  };

  if (matchingResult) {
    let strengths: string[] = [];
    let gaps: any = { missing_skills: [], experience_gaps: [] };

    try {
      strengths = JSON.parse(matchingResult.strengths || '[]');
    } catch {
      strengths = [];
    }

    try {
      gaps = JSON.parse(matchingResult.gap_analysis || '{}');
    } catch {
      gaps = { missing_skills: [], experience_gaps: [] };
    }

    exportData.matching = {
      matchScore: matchingResult.match_score,
      matchCategory: matchingResult.match_category,
      strengths,
      missingSkills: (gaps.missing_skills || gaps.missingSkills || []).map((s: any) => ({
        skill: s.skill,
        requiredLevel: s.required_level || s.requiredLevel || 0,
        currentLevel: s.current_level || s.currentLevel || 0,
        gap: s.gap || 0
      })),
      experienceGaps: (gaps.experience_gaps || gaps.experienceGaps || []).map((g: any) => ({
        area: g.area,
        requiredYears: g.required_years || g.requiredYears || 0,
        actualYears: g.actual_years || g.actualYears || 0
      })),
      recommendations: [], // Not stored in current schema, but might be added
      reasoning: matchingResult.ai_reasoning || ''
    };
  }

  return exportData;
}

/**
 * Format date for display
 */
function formatDate(date: Date | undefined): string {
  if (!date) return '-';
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Get match category label in German
 */
function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    perfect: 'Perfekter Match',
    good: 'Guter Fit',
    needs_work: 'Lücken schließbar',
    poor: 'Schwacher Match'
  };
  return labels[category] || category;
}

/**
 * Get status label in German
 */
function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    new: 'Neu',
    interesting: 'Interessant',
    applied: 'Beworben',
    rejected: 'Abgelehnt',
    archived: 'Archiviert'
  };
  return labels[status] || status;
}

/**
 * Escape HTML special characters to prevent XSS
 */
function escapeHtml(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Generate Markdown content from job export data
 */
export function generateMarkdown(data: JobExportData): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${data.title}`);
  lines.push('');
  lines.push(`**Firma:** ${data.company}`);
  lines.push(`**Status:** ${getStatusLabel(data.status)}`);
  lines.push('');

  // Match Score (prominent if available)
  if (data.matchScore !== undefined && data.matchScore !== null) {
    lines.push(`## Match-Score: ${Math.round(data.matchScore)}%`);
    if (data.matching) {
      lines.push(`**Kategorie:** ${getCategoryLabel(data.matching.matchCategory)}`);
    }
    lines.push('');
  }

  // Job Details
  lines.push('## Job-Details');
  lines.push('');
  lines.push(`| Feld | Wert |`);
  lines.push(`|------|------|`);
  if (data.location) lines.push(`| Standort | ${data.location} |`);
  if (data.remoteOption) lines.push(`| Remote | ${data.remoteOption} |`);
  if (data.salaryRange) lines.push(`| Gehalt | ${data.salaryRange} |`);
  if (data.contractType) lines.push(`| Vertragsart | ${data.contractType} |`);
  lines.push(`| Veröffentlicht | ${formatDate(data.postedDate)} |`);
  if (data.deadline) lines.push(`| Bewerbungsfrist | ${formatDate(data.deadline)} |`);
  if (data.sourceName) lines.push(`| Quelle | ${data.sourceName} |`);
  if (data.url) lines.push(`| URL | ${data.url} |`);
  lines.push('');

  // Matching Analysis
  if (data.matching) {
    // Strengths
    lines.push('## Stärken');
    lines.push('');
    if (data.matching.strengths.length > 0) {
      data.matching.strengths.forEach(strength => {
        lines.push(`- ✓ ${strength}`);
      });
    } else {
      lines.push('_Keine Stärken identifiziert_');
    }
    lines.push('');

    // Skill Gaps
    lines.push('## Skill-Lücken');
    lines.push('');
    if (data.matching.missingSkills.length > 0) {
      lines.push(`| Skill | Benötigt | Vorhanden | Lücke |`);
      lines.push(`|-------|----------|-----------|-------|`);
      data.matching.missingSkills.forEach(gap => {
        lines.push(`| ${gap.skill} | ${gap.requiredLevel}/10 | ${gap.currentLevel}/10 | ${gap.gap} Level |`);
      });
    } else {
      lines.push('_Keine Skill-Lücken identifiziert_');
    }
    lines.push('');

    // Experience Gaps
    if (data.matching.experienceGaps.length > 0) {
      lines.push('## Erfahrungs-Lücken');
      lines.push('');
      lines.push(`| Bereich | Benötigt | Vorhanden |`);
      lines.push(`|---------|----------|-----------|`);
      data.matching.experienceGaps.forEach(gap => {
        lines.push(`| ${gap.area} | ${gap.requiredYears} Jahre | ${gap.actualYears} Jahre |`);
      });
      lines.push('');
    }

    // AI Reasoning
    if (data.matching.reasoning) {
      lines.push('## KI-Analyse');
      lines.push('');
      lines.push(data.matching.reasoning);
      lines.push('');
    }
  }

  // Job Description
  if (data.fullText) {
    lines.push('## Stellenbeschreibung');
    lines.push('');
    lines.push(data.fullText);
    lines.push('');
  }

  // Notes
  if (data.notes) {
    lines.push('## Notizen');
    lines.push('');
    lines.push(data.notes);
    lines.push('');
  }

  // Footer
  lines.push('---');
  lines.push(`_Exportiert am ${formatDate(new Date())} mit JobMatchChecker_`);

  return lines.join('\n');
}

/**
 * Generate HTML content for PDF export
 */
export function generateHtml(data: JobExportData): string {
  const html: string[] = [];

  html.push(`<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(data.title)} - ${escapeHtml(data.company)}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
      color: #333;
    }
    h1 { color: #1976d2; margin-bottom: 5px; }
    h2 { color: #424242; border-bottom: 1px solid #e0e0e0; padding-bottom: 5px; margin-top: 30px; }
    .meta { color: #666; margin-bottom: 20px; }
    .score-badge {
      display: inline-block;
      background: #1976d2;
      color: white;
      padding: 10px 20px;
      border-radius: 25px;
      font-size: 24px;
      font-weight: bold;
      margin: 15px 0;
    }
    .score-badge.high { background: #4caf50; }
    .score-badge.medium { background: #ff9800; }
    .score-badge.low { background: #f44336; }
    .category {
      display: inline-block;
      background: #e3f2fd;
      color: #1976d2;
      padding: 4px 12px;
      border-radius: 15px;
      font-size: 14px;
      margin-left: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    th, td {
      padding: 10px;
      text-align: left;
      border-bottom: 1px solid #e0e0e0;
    }
    th {
      background: #f5f5f5;
      font-weight: 600;
    }
    .strength {
      color: #4caf50;
      padding: 5px 0;
    }
    .strength::before { content: '✓ '; }
    .gap-high { color: #f44336; }
    .gap-medium { color: #ff9800; }
    .description {
      background: #f5f5f5;
      padding: 15px;
      border-radius: 5px;
      white-space: pre-wrap;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      color: #999;
      font-size: 12px;
    }
  </style>
</head>
<body>`);

  // Header
  html.push(`<h1>${escapeHtml(data.title)}</h1>`);
  html.push(`<p class="meta"><strong>Firma:</strong> ${escapeHtml(data.company)} | <strong>Status:</strong> ${escapeHtml(getStatusLabel(data.status))}</p>`);

  // Match Score
  if (data.matchScore !== undefined && data.matchScore !== null) {
    const scoreClass = data.matchScore >= 70 ? 'high' : data.matchScore >= 40 ? 'medium' : 'low';
    html.push(`<div class="score-badge ${scoreClass}">${Math.round(data.matchScore)}%</div>`);
    if (data.matching) {
      html.push(`<span class="category">${escapeHtml(getCategoryLabel(data.matching.matchCategory))}</span>`);
    }
  }

  // Job Details Table
  html.push(`<h2>Job-Details</h2>`);
  html.push(`<table>`);
  html.push(`<tr><th style="width:150px;">Feld</th><th>Wert</th></tr>`);
  if (data.location) html.push(`<tr><td>Standort</td><td>${escapeHtml(data.location)}</td></tr>`);
  if (data.remoteOption) html.push(`<tr><td>Remote</td><td>${escapeHtml(data.remoteOption)}</td></tr>`);
  if (data.salaryRange) html.push(`<tr><td>Gehalt</td><td>${escapeHtml(data.salaryRange)}</td></tr>`);
  if (data.contractType) html.push(`<tr><td>Vertragsart</td><td>${escapeHtml(data.contractType)}</td></tr>`);
  html.push(`<tr><td>Veröffentlicht</td><td>${formatDate(data.postedDate)}</td></tr>`);
  if (data.deadline) html.push(`<tr><td>Bewerbungsfrist</td><td>${formatDate(data.deadline)}</td></tr>`);
  if (data.sourceName) html.push(`<tr><td>Quelle</td><td>${escapeHtml(data.sourceName)}</td></tr>`);
  if (data.url) html.push(`<tr><td>URL</td><td><a href="${escapeHtml(data.url)}">${escapeHtml(data.url)}</a></td></tr>`);
  html.push(`</table>`);

  // Matching Analysis
  if (data.matching) {
    // Strengths
    html.push(`<h2>Stärken</h2>`);
    if (data.matching.strengths.length > 0) {
      data.matching.strengths.forEach(strength => {
        html.push(`<p class="strength">${escapeHtml(strength)}</p>`);
      });
    } else {
      html.push(`<p><em>Keine Stärken identifiziert</em></p>`);
    }

    // Skill Gaps
    html.push(`<h2>Skill-Lücken</h2>`);
    if (data.matching.missingSkills.length > 0) {
      html.push(`<table>`);
      html.push(`<tr><th>Skill</th><th>Benötigt</th><th>Vorhanden</th><th>Lücke</th></tr>`);
      data.matching.missingSkills.forEach(gap => {
        const gapClass = gap.gap > 5 ? 'gap-high' : 'gap-medium';
        html.push(`<tr><td>${escapeHtml(gap.skill)}</td><td>${gap.requiredLevel}/10</td><td>${gap.currentLevel}/10</td><td class="${gapClass}">${gap.gap} Level</td></tr>`);
      });
      html.push(`</table>`);
    } else {
      html.push(`<p><em>Keine Skill-Lücken identifiziert</em></p>`);
    }

    // Experience Gaps
    if (data.matching.experienceGaps.length > 0) {
      html.push(`<h2>Erfahrungs-Lücken</h2>`);
      html.push(`<table>`);
      html.push(`<tr><th>Bereich</th><th>Benötigt</th><th>Vorhanden</th></tr>`);
      data.matching.experienceGaps.forEach(gap => {
        html.push(`<tr><td>${escapeHtml(gap.area)}</td><td>${gap.requiredYears} Jahre</td><td>${gap.actualYears} Jahre</td></tr>`);
      });
      html.push(`</table>`);
    }

    // AI Reasoning
    if (data.matching.reasoning) {
      html.push(`<h2>KI-Analyse</h2>`);
      html.push(`<p>${escapeHtml(data.matching.reasoning)}</p>`);
    }
  }

  // Job Description
  if (data.fullText) {
    html.push(`<h2>Stellenbeschreibung</h2>`);
    html.push(`<div class="description">${escapeHtml(data.fullText)}</div>`);
  }

  // Notes
  if (data.notes) {
    html.push(`<h2>Notizen</h2>`);
    html.push(`<p>${escapeHtml(data.notes)}</p>`);
  }

  // Footer
  html.push(`<p class="footer">Exportiert am ${formatDate(new Date())} mit JobMatchChecker</p>`);
  html.push(`</body></html>`);

  return html.join('\n');
}

/**
 * Export job to Markdown file
 */
export async function exportToMarkdown(jobId: number): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    const data = getJobExportData(jobId);
    const markdown = generateMarkdown(data);

    // Sanitize filename
    const sanitizedTitle = data.title.replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, '').replace(/\s+/g, '_');
    const sanitizedCompany = data.company.replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, '').replace(/\s+/g, '_');
    const defaultFilename = `${sanitizedTitle}_${sanitizedCompany}.md`;

    // Show save dialog
    const result = await dialog.showSaveDialog({
      title: 'Markdown exportieren',
      defaultPath: defaultFilename,
      filters: [
        { name: 'Markdown', extensions: ['md'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return { success: false, error: 'Export abgebrochen' };
    }

    // Write file
    fs.writeFileSync(result.filePath, markdown, 'utf-8');
    log.info(`Exported job ${jobId} to Markdown: ${result.filePath}`);

    // Open file location
    shell.showItemInFolder(result.filePath);

    return { success: true, filePath: result.filePath };

  } catch (error: any) {
    log.error('Error exporting to Markdown:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Export job to PDF file
 * Uses HTML-to-PDF via Electron's print-to-pdf functionality
 */
export async function exportToPdf(jobId: number): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    const data = getJobExportData(jobId);

    // Sanitize filename
    const sanitizedTitle = data.title.replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, '').replace(/\s+/g, '_');
    const sanitizedCompany = data.company.replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, '').replace(/\s+/g, '_');
    const defaultFilename = `${sanitizedTitle}_${sanitizedCompany}.pdf`;

    // Show save dialog
    const result = await dialog.showSaveDialog({
      title: 'PDF exportieren',
      defaultPath: defaultFilename,
      filters: [
        { name: 'PDF', extensions: ['pdf'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled || !result.filePath) {
      return { success: false, error: 'Export abgebrochen' };
    }

    // Generate HTML
    const html = generateHtml(data);

    // Create temporary HTML file (use os.tmpdir() for cross-platform compatibility)
    const tempDir = path.join(os.tmpdir(), 'jobmatchchecker-export');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const tempHtmlPath = path.join(tempDir, `export_${jobId}_${Date.now()}.html`);
    fs.writeFileSync(tempHtmlPath, html, 'utf-8');

    // Load HTML in hidden window and print to PDF
    const { BrowserWindow } = require('electron');
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    await printWindow.loadFile(tempHtmlPath);

    // Wait for content to render
    await new Promise(resolve => setTimeout(resolve, 500));

    // Generate PDF
    const pdfData = await printWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: {
        top: 0.5,
        bottom: 0.5,
        left: 0.5,
        right: 0.5
      }
    });

    // Write PDF file
    fs.writeFileSync(result.filePath, pdfData);

    // Cleanup
    printWindow.close();
    try {
      fs.unlinkSync(tempHtmlPath);
    } catch (cleanupError) {
      log.warn(`Failed to delete temp file ${tempHtmlPath}:`, cleanupError);
    }

    log.info(`Exported job ${jobId} to PDF: ${result.filePath}`);

    // Open file location
    shell.showItemInFolder(result.filePath);

    return { success: true, filePath: result.filePath };

  } catch (error: any) {
    log.error('Error exporting to PDF:', error);
    return { success: false, error: error.message };
  }
}
