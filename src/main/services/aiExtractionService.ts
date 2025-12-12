/**
 * AI Extraction Service - Claude API integration for job field extraction
 *
 * Feature: 005-job-offer-management
 * Phase: 3.3 Implementation (GREEN)
 * Task: T013
 */

import Anthropic from '@anthropic-ai/sdk';
import type { AIExtractionResult } from '../../shared/types';

/**
 * Extract job fields from unstructured text using Claude API
 *
 * @param text - Raw job description text (pasted by user)
 * @returns AIExtractionResult with extracted fields, confidence level, and missing fields
 *
 * @throws Error if API key is missing
 * @throws Error if rate limit exceeded
 * @throws Error if network error occurs
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

  // Check for API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      fields: {},
      confidence: 'low',
      missingRequired: ['title', 'company', 'postedDate'],
      error: 'Anthropic API key not configured. Please set ANTHROPIC_API_KEY environment variable.'
    };
  }

  // Initialize Anthropic client
  const anthropic = new Anthropic({
    apiKey: apiKey
  });

  // Create AbortController for 30-second timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const prompt = `Extract structured job offer fields from the following job posting text.

IMPORTANT: This text may come from various sources including:
- Arbeitsagentur (German employment agency) - look for labeled fields like "Arbeitgeber:", "Angebotsart:", "Arbeitsort:"
- LinkedIn, StepStone, Indeed, or other job boards
- Company career pages
- Email or PDF job descriptions

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
- remoteOption (string): Remote/home office work details - look for "Heim-/Telearbeit", "Telearbeit", "Homeoffice", "Remote", percentage mentions like "überwiegend" (mostly), "teilweise" (partly), or specific percentages. Extract the full remote work arrangement description.
- salaryRange (string): Salary information (preserve original format)
- contractType (string): Employment type (e.g., "Vollzeit", "Full-time", "unbefristet")
- postedDate (string, format: YYYY-MM-DD): Date job was posted
- deadline (string, format: YYYY-MM-DD): Application deadline
- url (string): Link to job posting
- requirements (array of strings): Key requirements, skills, or qualifications mentioned (e.g., technologies, years of experience, certifications)

Job text:
${text}

Return ONLY valid JSON, no explanation or markdown. If a field cannot be extracted, omit it from the JSON.`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    }, {
      signal: controller.signal as any
    });

    clearTimeout(timeoutId);

    // Extract text content from response
    const responseText = message.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('');

    // Debug logging (can be removed later)
    if (process.env.NODE_ENV === 'test') {
      console.log('[AI Extraction Debug] Raw response:', responseText.substring(0, 200));
    }

    // Try to extract JSON from markdown code blocks if present
    let jsonText = responseText.trim();
    const jsonBlockMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      jsonText = jsonBlockMatch[1].trim();
    } else {
      // Also try without "json" tag
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
        console.error('[AI Extraction Debug] Parse error:', parseError);
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

    // Determine missing required fields
    const requiredFields = ['title', 'company', 'postedDate'];
    const missingRequired = requiredFields.filter(field => !fields[field]);

    // Determine confidence level
    let confidence: 'high' | 'medium' | 'low' = 'high';
    const extractedCount = Object.keys(extractedData).length;

    if (missingRequired.length > 0) {
      confidence = 'low';
    } else if (extractedCount < 3) {
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
    clearTimeout(timeoutId);

    // Debug logging
    if (process.env.NODE_ENV === 'test') {
      console.error('[AI Extraction Debug] Caught error:', error.name, error.message);
      console.error('[AI Extraction Debug] Error status:', error.status);
    }

    // Handle timeout
    if (error.name === 'AbortError' || error.message?.includes('aborted')) {
      return {
        success: false,
        fields: {
          fullText: text,
          rawImportData: text,
          importMethod: 'ai_paste'
        },
        confidence: 'low',
        missingRequired: ['title', 'company', 'postedDate'],
        error: 'Extraction timed out after 30 seconds',
        warnings: ['Extraction timed out after 30 seconds. Please try again or enter fields manually.']
      };
    }

    // Handle rate limit
    if (error.status === 429 || error.message?.includes('rate limit')) {
      return {
        success: false,
        fields: {},
        confidence: 'low',
        missingRequired: ['title', 'company', 'postedDate'],
        error: 'Rate limit exceeded. Please try again in a few moments.'
      };
    }

    // Handle network errors
    if (error.message?.includes('network') || error.message?.includes('ECONNREFUSED')) {
      return {
        success: false,
        fields: {},
        confidence: 'low',
        missingRequired: ['title', 'company', 'postedDate'],
        error: 'Network error. Please check your internet connection and try again.'
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
      error: `AI extraction failed: ${error.message}`
    };
  }
}
