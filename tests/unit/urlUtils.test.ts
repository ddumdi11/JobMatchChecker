import { describe, it, expect } from 'vitest';
import { cleanJobUrl } from '../../src/shared/urlUtils';

describe('cleanJobUrl', () => {

  describe('LinkedIn URLs', () => {
    it('should strip tracking parameters from LinkedIn job URLs', () => {
      expect(cleanJobUrl(
        'https://www.linkedin.com/comm/jobs/view/4377827138/?trackingId=a%2F%2Fxp37gyKcd3If2ZWAnWQ%3D%3D&refId=abc&midToken=xyz&trk=eml'
      )).toBe('https://www.linkedin.com/jobs/view/4377827138/');
    });

    it('should normalize /comm/jobs/view/ to /jobs/view/', () => {
      expect(cleanJobUrl(
        'https://www.linkedin.com/comm/jobs/view/4377827138/?midToken=AQF123'
      )).toBe('https://www.linkedin.com/jobs/view/4377827138/');
    });

    it('should keep already clean LinkedIn URLs unchanged', () => {
      expect(cleanJobUrl(
        'https://www.linkedin.com/jobs/view/4377827138/'
      )).toBe('https://www.linkedin.com/jobs/view/4377827138/');
    });

    it('should add trailing slash to LinkedIn URLs without one', () => {
      expect(cleanJobUrl(
        'https://www.linkedin.com/jobs/view/4377827138'
      )).toBe('https://www.linkedin.com/jobs/view/4377827138/');
    });

    it('should handle LinkedIn URLs with only some tracking params', () => {
      expect(cleanJobUrl(
        'https://www.linkedin.com/jobs/view/4377827138?trk=email'
      )).toBe('https://www.linkedin.com/jobs/view/4377827138/');
    });

    it('should preserve the job ID as string (no precision loss)', () => {
      const result = cleanJobUrl('https://www.linkedin.com/jobs/view/9007199254740993/');
      expect(result).toBe('https://www.linkedin.com/jobs/view/9007199254740993/');
    });
  });

  describe('XING URLs', () => {
    it('should not modify XING URLs (tracking links may trigger server actions)', () => {
      const xingUrl = 'https://www.xing.com/m/qSY20mp_EKUJGUIR9---gK';
      expect(cleanJobUrl(xingUrl)).toBe(xingUrl);
    });

    it('should not modify XING URLs with query parameters', () => {
      const xingUrl = 'https://www.xing.com/jobs/something?ref=email';
      expect(cleanJobUrl(xingUrl)).toBe(xingUrl);
    });
  });

  describe('Hostname spoofing (negative tests)', () => {
    it('should not treat linkedin.com in path as LinkedIn URL', () => {
      const url = 'https://example.com/redirect/linkedin.com/jobs/view/123';
      expect(cleanJobUrl(url)).toBe('https://example.com/redirect/linkedin.com/jobs/view/123');
    });

    it('should not treat linkedin.com in query as LinkedIn URL', () => {
      const url = 'https://tracking.example.com/click?url=linkedin.com/jobs/view/123';
      expect(cleanJobUrl(url)).toBe('https://tracking.example.com/click');
    });

    it('should not match notlinkedin.com as LinkedIn', () => {
      const url = 'https://notlinkedin.com/jobs/view/123';
      expect(cleanJobUrl(url)).toBe('https://notlinkedin.com/jobs/view/123');
    });

    it('should not match linkedin.com.evil.com as LinkedIn', () => {
      const url = 'https://linkedin.com.evil.com/jobs/view/123';
      expect(cleanJobUrl(url)).toBe('https://linkedin.com.evil.com/jobs/view/123');
    });

    it('should not treat xing.com in path as XING URL', () => {
      const url = 'https://example.com/redirect/xing.com/jobs?ref=email';
      expect(cleanJobUrl(url)).toBe('https://example.com/redirect/xing.com/jobs');
    });

    it('should not match myxingpartner.com as XING', () => {
      const url = 'https://myxingpartner.com/jobs?ref=email';
      expect(cleanJobUrl(url)).toBe('https://myxingpartner.com/jobs');
    });
  });

  describe('Other URLs', () => {
    it('should strip query parameters from other job portals', () => {
      expect(cleanJobUrl(
        'https://www.stepstone.de/job/123?ref=google'
      )).toBe('https://www.stepstone.de/job/123');
    });

    it('should strip query parameters from Indeed URLs', () => {
      expect(cleanJobUrl(
        'https://de.indeed.com/viewjob?jk=abc123&from=serp'
      )).toBe('https://de.indeed.com/viewjob');
    });

    it('should keep clean URLs unchanged', () => {
      expect(cleanJobUrl(
        'https://www.stepstone.de/job/123'
      )).toBe('https://www.stepstone.de/job/123');
    });
  });

  describe('Edge cases', () => {
    it('should return null for null input', () => {
      expect(cleanJobUrl(null)).toBeNull();
    });

    it('should return undefined for undefined input', () => {
      expect(cleanJobUrl(undefined)).toBeUndefined();
    });

    it('should return empty string for empty string input', () => {
      expect(cleanJobUrl('')).toBe('');
    });

    it('should handle whitespace-only strings', () => {
      expect(cleanJobUrl('   ')).toBe('   ');
    });

    it('should trim whitespace from valid URLs', () => {
      expect(cleanJobUrl('  https://www.linkedin.com/jobs/view/123  ')).toBe(
        'https://www.linkedin.com/jobs/view/123/'
      );
    });

    it('should return invalid URLs unchanged', () => {
      expect(cleanJobUrl('not-a-url')).toBe('not-a-url');
    });
  });
});
