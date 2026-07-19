import { describe, it, expect } from 'vitest';
import { cleanJobUrl, getJobUrlKey, extractUrls } from '../../src/shared/urlUtils';

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

    it('should canonicalize /jobs/search/?currentJobId= to /jobs/view/{ID}/', () => {
      expect(cleanJobUrl(
        'https://www.linkedin.com/jobs/search/?currentJobId=4377827138&keywords=java'
      )).toBe('https://www.linkedin.com/jobs/view/4377827138/');
    });

    it('should canonicalize /jobs/collections/…?currentJobId= to /jobs/view/{ID}/', () => {
      expect(cleanJobUrl(
        'https://www.linkedin.com/jobs/collections/recommended/?currentJobId=4377827138&discover=recommended'
      )).toBe('https://www.linkedin.com/jobs/view/4377827138/');
    });

    it('should prefer the path job ID even when a currentJobId query is also present', () => {
      expect(cleanJobUrl(
        'https://www.linkedin.com/jobs/view/1111111111/?currentJobId=2222222222'
      )).toBe('https://www.linkedin.com/jobs/view/1111111111/');
    });

    it('should not invent an ID for /jobs/search/ without currentJobId (degenerate fallback)', () => {
      // Ohne currentJobId bleibt nur der generische origin+pathname-Fallback
      // (Pfad inkl. Trailing-Slash) – KEINE erfundene Job-ID.
      expect(cleanJobUrl(
        'https://www.linkedin.com/jobs/search/?keywords=java'
      )).toBe('https://www.linkedin.com/jobs/search/');
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

describe('getJobUrlKey', () => {
  it('should return the canonical URL for a LinkedIn job-view link', () => {
    expect(getJobUrlKey(
      'https://www.linkedin.com/comm/jobs/view/4377827138/?trk=eml'
    )).toBe('https://www.linkedin.com/jobs/view/4377827138/');
  });

  it('should return the canonical URL for a currentJobId query link', () => {
    expect(getJobUrlKey(
      'https://www.linkedin.com/jobs/search/?currentJobId=4377827138'
    )).toBe('https://www.linkedin.com/jobs/view/4377827138/');
  });

  it('should return null for a degenerate LinkedIn search URL (no job ID)', () => {
    expect(getJobUrlKey(
      'https://www.linkedin.com/jobs/search/?keywords=java'
    )).toBeNull();
  });

  it('should return null for a degenerate LinkedIn collections URL (no job ID)', () => {
    expect(getJobUrlKey(
      'https://www.linkedin.com/jobs/collections/recommended/'
    )).toBeNull();
  });

  it('should give two degenerate LinkedIn URLs the same (null) key so they are NOT grouped as safe', () => {
    const a = getJobUrlKey('https://www.linkedin.com/jobs/search/?keywords=java');
    const b = getJobUrlKey('https://www.linkedin.com/jobs/search/?keywords=python');
    expect(a).toBeNull();
    expect(b).toBeNull();
  });

  it('should use the cleaned URL as key for specific non-LinkedIn portals', () => {
    expect(getJobUrlKey(
      'https://www.stepstone.de/job/123?ref=google'
    )).toBe('https://www.stepstone.de/job/123');
  });

  // --- XING (feat/duplicate-detection-hardening) ---
  it('should derive the XING key from the trailing numeric ID (strip tracking)', () => {
    expect(getJobUrlKey(
      'https://www.xing.com/jobs/muenchen-senior-qa-engineer-135791113?ijt=abc123def'
    )).toBe('https://www.xing.com/jobs/135791113');
  });

  it('should give the same XING key with and without tracking', () => {
    const withTracking = getJobUrlKey('https://www.xing.com/jobs/berlin-java-dev-99887766?ijt=xyz');
    const withoutTracking = getJobUrlKey('https://www.xing.com/jobs/berlin-java-dev-99887766');
    expect(withTracking).toBe('https://www.xing.com/jobs/99887766');
    expect(withoutTracking).toBe('https://www.xing.com/jobs/99887766');
    expect(withTracking).toBe(withoutTracking);
  });

  it('should give the same XING key when only the slug differs (same numeric ID)', () => {
    const a = getJobUrlKey('https://www.xing.com/jobs/senior-qa-engineer-135791113');
    const b = getJobUrlKey('https://www.xing.com/jobs/qa-lead-135791113?ijt=other');
    expect(a).toBe(b);
  });

  it('should give different XING keys for different numeric IDs', () => {
    const a = getJobUrlKey('https://www.xing.com/jobs/role-111');
    const b = getJobUrlKey('https://www.xing.com/jobs/role-222');
    expect(a).not.toBe(b);
    expect(a).toBe('https://www.xing.com/jobs/111');
    expect(b).toBe('https://www.xing.com/jobs/222');
  });

  it('should be query-invariant for generic non-LinkedIn portals', () => {
    const a = getJobUrlKey('https://www.jobware.de/stellenangebote/12345?src=newsletter&utm=x');
    const b = getJobUrlKey('https://www.jobware.de/stellenangebote/12345');
    expect(a).toBe('https://www.jobware.de/stellenangebote/12345');
    expect(a).toBe(b);
  });

  it('should return null for degenerate generic listing/search paths', () => {
    expect(getJobUrlKey('https://www.jobware.de/jobs')).toBeNull();
    expect(getJobUrlKey('https://example.com/search?q=java')).toBeNull();
    expect(getJobUrlKey('https://example.com/stellenangebote/')).toBeNull();
  });

  it('should return null for a bare domain without a specific path', () => {
    expect(getJobUrlKey('https://www.stepstone.de/')).toBeNull();
    expect(getJobUrlKey('https://www.stepstone.de')).toBeNull();
  });

  it('should return null for empty/invalid input', () => {
    expect(getJobUrlKey(null)).toBeNull();
    expect(getJobUrlKey(undefined)).toBeNull();
    expect(getJobUrlKey('')).toBeNull();
    expect(getJobUrlKey('not-a-url')).toBeNull();
  });
});

describe('extractUrls', () => {
  it('should extract all http(s) URLs from free text in order', () => {
    const text = `Schau dir die Firma an: https://acme.example.com/about
      und die Stelle hier: https://www.linkedin.com/jobs/view/123/ – viel Erfolg!`;
    expect(extractUrls(text)).toEqual([
      'https://acme.example.com/about',
      'https://www.linkedin.com/jobs/view/123/'
    ]);
  });

  it('should strip trailing punctuation', () => {
    expect(extractUrls('Link: https://example.com/job/9.')).toEqual([
      'https://example.com/job/9'
    ]);
  });

  it('should deduplicate repeated URLs', () => {
    const text = 'https://example.com/a und nochmal https://example.com/a';
    expect(extractUrls(text)).toEqual(['https://example.com/a']);
  });

  it('should return an empty array when there is no URL', () => {
    expect(extractUrls('kein link hier')).toEqual([]);
    expect(extractUrls('')).toEqual([]);
    expect(extractUrls(null)).toEqual([]);
    expect(extractUrls(undefined)).toEqual([]);
  });
});
