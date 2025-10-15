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

  // Create AbortController for 5-second timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const prompt = `Extract structured job offer fields from the following job posting text.

Return a JSON object with these fields (all optional except where noted):
- title (string, required): Job title
- company (string, required): Company name
- location (string): Job location
- remoteOption (string): Remote work details (e.g., "100% remote", "hybrid")
- salaryRange (string): Salary information
- contractType (string): Employment type (e.g., "Full-time", "Contract")
- postedDate (string, format: YYYY-MM-DD): Date job was posted
- deadline (string, format: YYYY-MM-DD): Application deadline
- url (string): Link to job posting

Job text:
${text}

Return ONLY valid JSON, no explanation or markdown. If a field cannot be extracted, omit it from the JSON.`;

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
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

    // Parse JSON response
    let extractedData: any;
    try {
      extractedData = JSON.parse(responseText);
    } catch (parseError) {
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
        error: 'Extraction timed out after 5 seconds',
        warnings: ['Extraction timed out after 5 seconds. Please try again or enter fields manually.']
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
