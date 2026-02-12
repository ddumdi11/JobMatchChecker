/**
 * AI Extraction Service - AI integration for job field extraction
 *
 * Uses aiProviderService.sendPrompt() to support Anthropic and OpenRouter.
 */

import { sendPrompt } from './aiProviderService';
import type { AIExtractionResult } from '../../shared/types';

/**
 * Extract job fields from unstructured text using the configured AI provider
 */
export async function extractJobFields(text: string): Promise<AIExtractionResult> {
  // Handle empty text
  if (!text || text.trim() === '') {
    return {
      success: false,
      fields: {},
      confidence: 'low',
      missingRequired: ['title', 'company', 'postedDate'],
      error: 'No text provided for extraction'
    };
  }

  try {
    const prompt = `Extract structured job offer fields from the following job posting text.

IMPORTANT: This text may come from various sources including:
- Arbeitsagentur (German employment agency) - look for labeled fields like "Arbeitgeber:", "Angebotsart:", "Arbeitsort:"
- LinkedIn, StepStone, Indeed, or other job boards
- Company career pages
- Email or PDF job descriptions
- Messages or notifications that contain a job posting

IMPORTANT: If the text contains email headers, message metadata, sender information,
subject lines, or notification UI elements (e.g., "Ihre Nachricht", "Absender:", "Betreff:",
"Von:", "An:", "Gesendet:"), IGNORE all of that and extract ONLY the actual job posting content.

For Arbeitsagentur-style listings, note that:
- "Detailansicht des Stellenangebots" is just a header, NOT the job title
- The actual job title often appears after the employer name or in a prominent position
- "Arbeitgeber:" indicates the company name
- Salary may appear as a range like "60.000 € – 80.000 €/Jahr"
- "Heim-/Telearbeit", "Telearbeit", "Homeoffice", or "Remote" indicates remote work options
- Look for phrases like "überwiegend remote", "teilweise remote", "nach Absprache" for remote details
- "Vollzeit"/"Teilzeit" indicates contract type
- "unbefristet"/"befristet" indicates permanent/temporary

Return a JSON object with these fields (all optional except where noted):
- title (string, required): The actual job position title (e.g., "Java Architekt", "Software Developer")
- company (string, required): Company/employer name (look for "Arbeitgeber:" in German listings)
- location (string): Job location (look for "Arbeitsort:" or city names)
- remoteOption (string): Remote/home office work details - look for "Heim-/Telearbeit", "Telearbeit", "Homeoffice", "Remote", percentage mentions like "überwiegend" (mostly), "teilweise" (partly), or specific percentages. Extract the full remote work arrangement description. If NO remote/homeoffice option is mentioned at all, set this to "0% - Vor Ort" (pure on-site position).
- salaryRange (string): Salary information (preserve original format)
- contractType (string): Employment type (e.g., "Vollzeit", "Full-time", "unbefristet")
- postedDate (string, format: YYYY-MM-DD): Date job was posted
- deadline (string, format: YYYY-MM-DD): Application deadline
- url (string): Link to job posting
- requirements (array of strings): Key requirements, skills, or qualifications mentioned (e.g., technologies, years of experience, certifications)

Job text:
${text}

Return ONLY valid JSON, no explanation or markdown. If a field cannot be extracted, omit it from the JSON.`;

    const response = await sendPrompt(
      [{ role: 'user', content: prompt }],
      { maxTokens: 1024 }
    );

    // Try to extract JSON from markdown code blocks if present
    let jsonText = response.content.trim();
    const jsonBlockMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      jsonText = jsonBlockMatch[1].trim();
    } else {
      const codeBlockMatch = jsonText.match(/```\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        jsonText = codeBlockMatch[1].trim();
      }
    }

    // Parse JSON response
    let extractedData: any;
    try {
      extractedData = JSON.parse(jsonText);
    } catch (parseError) {
      if (process.env.NODE_ENV === 'test') {
        console.error('[AI Extraction Debug] JSON parse failed. Text:', jsonText.substring(0, 200));
      }
      return {
        success: false,
        fields: {
          fullText: text,
          rawImportData: text,
          importMethod: 'ai_paste'
        },
        confidence: 'low',
        missingRequired: ['title', 'company', 'postedDate'],
        error: 'Failed to parse AI response as JSON',
        warnings: ['AI returned non-JSON response. Please extract fields manually.']
      };
    }

    // Map to JobOffer field names (camelCase)
    const fields: any = {
      fullText: text,
      rawImportData: JSON.stringify({ originalText: text, aiResponse: extractedData }),
      importMethod: 'ai_paste'
    };

    if (extractedData.title) fields.title = extractedData.title;
    if (extractedData.company) fields.company = extractedData.company;
    if (extractedData.location) fields.location = extractedData.location;
    if (extractedData.remoteOption) fields.remoteOption = extractedData.remoteOption;
    if (extractedData.salaryRange) fields.salaryRange = extractedData.salaryRange;
    if (extractedData.contractType) fields.contractType = extractedData.contractType;
    if (extractedData.url) fields.url = extractedData.url;
    // Store extracted requirements in notes field (no separate DB column)
    if (extractedData.requirements && Array.isArray(extractedData.requirements) && extractedData.requirements.length > 0) {
      fields.notes = `Anforderungen:\n- ${extractedData.requirements.join('\n- ')}`;
    }

    // Parse dates
    if (extractedData.postedDate) {
      try {
        fields.postedDate = new Date(extractedData.postedDate);
      } catch {
        // Invalid date format - ignore
      }
    }

    if (extractedData.deadline) {
      try {
        fields.deadline = new Date(extractedData.deadline);
      } catch {
        // Invalid date format - ignore
      }
    }

    // Determine missing fields by importance
    const criticalFields = ['title', 'company'];
    const supplementaryFields = ['postedDate'];
    const missingCritical = criticalFields.filter(field => !fields[field]);
    const missingSupplementary = supplementaryFields.filter(field => !fields[field]);
    const missingRequired = [...missingCritical, ...missingSupplementary];

    // Determine confidence level
    let confidence: 'high' | 'medium' | 'low' = 'high';
    const extractedCount = Object.keys(extractedData).length;

    if (missingCritical.length > 0) {
      confidence = 'low';
    } else if (missingSupplementary.length > 0 || extractedCount < 3) {
      confidence = 'medium';
    }

    // Build warnings
    const warnings: string[] = [];
    if (missingRequired.length > 0) {
      warnings.push(`Missing required fields: ${missingRequired.join(', ')}`);
    }

    return {
      success: true,
      fields,
      confidence,
      missingRequired,
      warnings: warnings.length > 0 ? warnings : undefined
    };

  } catch (error: any) {
    // Handle timeout
    if (error.message?.includes('Timeout') || error.message?.includes('abgebrochen')) {
      return {
        success: false,
        fields: {
          fullText: text,
          rawImportData: text,
          importMethod: 'ai_paste'
        },
        confidence: 'low',
        missingRequired: ['title', 'company', 'postedDate'],
        error: error.message,
        warnings: ['Extraktion abgebrochen. Bitte versuchen Sie es erneut oder geben Sie die Felder manuell ein.']
      };
    }

    // Handle rate limit
    if (error.message?.includes('Rate-Limit') || error.message?.includes('rate limit')) {
      return {
        success: false,
        fields: {},
        confidence: 'low',
        missingRequired: ['title', 'company', 'postedDate'],
        error: error.message
      };
    }

    // Generic error
    return {
      success: false,
      fields: {
        fullText: text,
        rawImportData: text,
        importMethod: 'ai_paste'
      },
      confidence: 'low',
      missingRequired: ['title', 'company', 'postedDate'],
      error: `AI-Extraktion fehlgeschlagen: ${error.message}`
    };
  }
}
