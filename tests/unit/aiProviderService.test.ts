/**
 * Unit tests for aiProviderService.sendPrompt() retry logic.
 *
 * Focus: the timeout-retry behaviour introduced for the matching use-case.
 * Provider (Anthropic SDK), electron-store and the database are mocked, so these
 * tests need NO real API key, NO network and NO SQLite — pure logic verification.
 *
 * Covered cases:
 *   a) Timeout → Retry → Success   (and a log.info line is written)
 *   b) Timeout → Retry → Timeout   (AiTimeoutError is thrown after retries exhausted)
 *   c) 429 rate-limit              (immediate failure, NO retry)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Hoisted mock handles so the vi.mock factories below can reference them.
const { createMock, logMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  logMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock the Anthropic SDK — every `new Anthropic()` shares the same create() spy.
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: createMock };
    constructor(_opts: any) {}
  },
}));

// Mock electron-store so an API key is always "configured".
vi.mock('electron-store', () => ({
  default: class {
    get(key: string) {
      if (key === 'anthropic_api_key') return 'test-anthropic-key';
      return undefined;
    }
    set() {}
  },
}));

// Mock the database so getProviderConfig() resolves provider=anthropic without SQLite.
vi.mock('../../src/main/database/db', () => ({
  getDatabase: () => ({
    prepare: () => ({
      get: (key: string) => {
        if (key === 'ai_provider') return { value: 'anthropic' };
        if (key === 'ai_model') return { value: 'claude-test-model' };
        return undefined;
      },
    }),
  }),
}));

// Mock electron-log so we can assert on log.info / log.warn.
vi.mock('electron-log', () => logMock);

// Import AFTER the mocks are registered.
import { sendPrompt, AiTimeoutError } from '../../src/main/services/aiProviderService';

const successResponse = {
  content: [{ type: 'text', text: 'OK' }],
  model: 'claude-test-model',
  usage: { input_tokens: 10, output_tokens: 5 },
};

/** An error that sendToAnthropic recognises as a timeout/abort. */
function abortError() {
  return Object.assign(new Error('Request was aborted'), { name: 'AbortError' });
}

describe('Unit: aiProviderService.sendPrompt() retry logic', () => {
  beforeEach(() => {
    createMock.mockReset();
    logMock.info.mockClear();
    logMock.warn.mockClear();
    logMock.error.mockClear();
  });

  it('a) retries once after a timeout and returns the successful result', async () => {
    createMock
      .mockRejectedValueOnce(abortError())   // first attempt → timeout
      .mockResolvedValueOnce(successResponse); // retry → success

    const result = await sendPrompt([{ role: 'user', content: 'hi' }]);

    expect(result.content).toBe('OK');
    expect(result.provider).toBe('anthropic');
    expect(createMock).toHaveBeenCalledTimes(2); // initial + 1 retry
    // A log line documents the recovered retry so clustered timeouts stay visible.
    expect(logMock.warn).toHaveBeenCalledWith(expect.stringContaining('Retry'));
    expect(logMock.info).toHaveBeenCalledWith(expect.stringContaining('Retry erfolgreich'));
  });

  it('b) throws AiTimeoutError after the retry also times out', async () => {
    createMock.mockRejectedValue(abortError()); // both attempts time out

    await expect(sendPrompt([{ role: 'user', content: 'hi' }]))
      .rejects.toBeInstanceOf(AiTimeoutError);

    expect(createMock).toHaveBeenCalledTimes(2); // initial + 1 retry, then give up
    expect(logMock.info).not.toHaveBeenCalledWith(expect.stringContaining('Retry erfolgreich'));
  });

  it('c) does NOT retry on a 429 rate-limit error', async () => {
    createMock.mockRejectedValue(Object.assign(new Error('rate limited'), { status: 429 }));

    await expect(sendPrompt([{ role: 'user', content: 'hi' }]))
      .rejects.toThrow(/Rate-Limit/);

    expect(createMock).toHaveBeenCalledTimes(1); // no retry for non-timeout errors
  });
});
