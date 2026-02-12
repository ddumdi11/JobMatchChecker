/**
 * AI Provider Service - Abstraction layer for Anthropic and OpenRouter
 *
 * Routes AI prompts to the configured provider (Anthropic SDK or OpenRouter fetch).
 * Stores provider/model in app_settings (SQLite), API keys in electron-store.
 */

import Anthropic from '@anthropic-ai/sdk';
import Store from 'electron-store';
import * as log from 'electron-log';
import { getDatabase } from '../database/db';
import { AI_PROVIDER_DEFAULTS } from '../../shared/constants';
import type { AIProvider, AIProviderConfig, AIMessage, AIResponse, OpenRouterModel } from '../../shared/types';

const store = new Store();

// In-memory cache for OpenRouter models
let cachedModels: OpenRouterModel[] | null = null;
let modelsCacheTimestamp = 0;

/**
 * Get the current AI provider configuration
 */
export function getProviderConfig(): AIProviderConfig {
  const db = getDatabase();

  const providerRow = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('ai_provider') as { value: string } | undefined;
  const modelRow = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('ai_model') as { value: string } | undefined;

  const provider = (providerRow?.value as AIProvider) || AI_PROVIDER_DEFAULTS.defaultProvider;
  const model = modelRow?.value || (
    provider === 'anthropic'
      ? AI_PROVIDER_DEFAULTS.defaultAnthropicModel
      : AI_PROVIDER_DEFAULTS.defaultOpenRouterModel
  );

  return {
    provider,
    model,
    hasAnthropicKey: !!(store.get('anthropic_api_key') as string),
    hasOpenRouterKey: !!(store.get('openrouter_api_key') as string),
  };
}

/**
 * Save AI provider configuration
 */
export function saveProviderConfig(config: { provider?: AIProvider; model?: string }): void {
  const db = getDatabase();

  const upsert = db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);

  if (config.provider) {
    upsert.run('ai_provider', config.provider);
  }
  if (config.model) {
    upsert.run('ai_model', config.model);
  }

  log.info(`AI provider config saved: provider=${config.provider}, model=${config.model}`);
}

/**
 * Save an API key to electron-store
 */
export function saveApiKey(provider: 'anthropic' | 'openrouter', apiKey: string): void {
  const storeKey = provider === 'anthropic' ? 'anthropic_api_key' : 'openrouter_api_key';
  store.set(storeKey, apiKey);
  log.info(`${provider} API key saved`);
}

/**
 * Get an API key from electron-store
 */
export function getApiKey(provider: 'anthropic' | 'openrouter'): string | null {
  const storeKey = provider === 'anthropic' ? 'anthropic_api_key' : 'openrouter_api_key';
  return (store.get(storeKey) as string) || null;
}

/**
 * Send a prompt to the configured AI provider
 */
export async function sendPrompt(
  messages: AIMessage[],
  options?: { maxTokens?: number; temperature?: number }
): Promise<AIResponse> {
  const config = getProviderConfig();
  const maxTokens = options?.maxTokens ?? 2000;
  const temperature = options?.temperature;

  if (config.provider === 'anthropic') {
    return sendToAnthropic(messages, config.model, maxTokens, temperature);
  } else {
    return sendToOpenRouter(messages, config.model, maxTokens, temperature);
  }
}

/**
 * Send prompt via Anthropic SDK
 */
async function sendToAnthropic(
  messages: AIMessage[],
  model: string,
  maxTokens: number,
  temperature?: number
): Promise<AIResponse> {
  const apiKey = store.get('anthropic_api_key') as string;
  if (!apiKey) {
    throw new Error('Anthropic API-Key nicht konfiguriert. Bitte in Einstellungen hinterlegen.');
  }

  const client = new Anthropic({ apiKey });

  // Anthropic SDK: system message goes in the `system` parameter, rest in `messages`
  let systemPrompt: string | undefined;
  const apiMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      systemPrompt = msg.content;
    } else {
      apiMessages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_PROVIDER_DEFAULTS.anthropicTimeout);

  try {
    const params: any = {
      model,
      max_tokens: maxTokens,
      messages: apiMessages,
    };
    if (systemPrompt) {
      params.system = systemPrompt;
    }
    if (temperature !== undefined) {
      params.temperature = temperature;
    }

    const response = await client.messages.create(params, {
      signal: controller.signal as any,
    });

    clearTimeout(timeoutId);

    const content = response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('');

    return {
      content,
      model: response.model,
      provider: 'anthropic',
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError' || error.message?.includes('aborted')) {
      throw new Error('Anthropic-Anfrage nach 30 Sekunden abgebrochen (Timeout).');
    }
    if (error.status === 429) {
      throw new Error('Rate-Limit erreicht. Bitte warte einen Moment und versuche es erneut.');
    }
    throw error;
  }
}

/**
 * Send prompt via OpenRouter (OpenAI-compatible API)
 */
async function sendToOpenRouter(
  messages: AIMessage[],
  model: string,
  maxTokens: number,
  temperature?: number
): Promise<AIResponse> {
  const apiKey = store.get('openrouter_api_key') as string;
  if (!apiKey) {
    throw new Error('OpenRouter API-Key nicht konfiguriert. Bitte in Einstellungen hinterlegen.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_PROVIDER_DEFAULTS.openRouterTimeout);

  try {
    const body: any = {
      model,
      max_tokens: maxTokens,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    };
    if (temperature !== undefined) {
      body.temperature = temperature;
    }

    const response = await fetch(`${AI_PROVIDER_DEFAULTS.openRouterBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/JobMatchChecker',
        'X-Title': 'Job Match Checker',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      log.error(`OpenRouter API error ${response.status}:`, errorBody);

      if (response.status === 401) {
        throw new Error('OpenRouter API-Key ungültig. Bitte prüfe den Key in den Einstellungen.');
      }
      if (response.status === 429) {
        throw new Error('Rate-Limit erreicht. Bitte warte einen Moment und versuche es erneut.');
      }
      if (response.status === 402) {
        throw new Error('Nicht genügend Guthaben auf dem OpenRouter-Konto.');
      }
      throw new Error(`OpenRouter-Fehler (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return {
      content,
      model: data.model || model,
      provider: 'openrouter',
      usage: data.usage ? {
        inputTokens: data.usage.prompt_tokens || 0,
        outputTokens: data.usage.completion_tokens || 0,
      } : undefined,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new Error('OpenRouter-Anfrage nach 60 Sekunden abgebrochen (Timeout). Kostenlose Modelle können langsamer sein.');
    }
    throw error;
  }
}

/**
 * Get available models from OpenRouter (cached for 1 hour)
 */
export async function getAvailableModels(forceRefresh = false): Promise<OpenRouterModel[]> {
  const now = Date.now();

  if (!forceRefresh && cachedModels && (now - modelsCacheTimestamp) < AI_PROVIDER_DEFAULTS.modelCacheTtl) {
    return cachedModels;
  }

  try {
    const response = await fetch(AI_PROVIDER_DEFAULTS.openRouterModelsUrl);

    if (!response.ok) {
      throw new Error(`Modell-Liste konnte nicht geladen werden (${response.status})`);
    }

    const data = await response.json();
    const models: OpenRouterModel[] = (data.data || []).map((m: any) => ({
      id: m.id,
      name: m.name || m.id,
      contextLength: m.context_length || 0,
      pricing: {
        prompt: m.pricing?.prompt || '0',
        completion: m.pricing?.completion || '0',
      },
      isFree: m.pricing?.prompt === '0' && m.pricing?.completion === '0',
    }));

    // Sort: free models first, then by name
    models.sort((a, b) => {
      if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    cachedModels = models;
    modelsCacheTimestamp = now;

    log.info(`Loaded ${models.length} OpenRouter models (${models.filter(m => m.isFree).length} free)`);
    return models;
  } catch (error: any) {
    log.error('Error fetching OpenRouter models:', error);

    // Return cached models if available, even if stale
    if (cachedModels) {
      log.warn('Returning stale cached models');
      return cachedModels;
    }

    throw new Error(`Modell-Liste konnte nicht geladen werden: ${error.message}`);
  }
}

/**
 * Test the connection to a provider with the given API key
 */
export async function testConnection(
  provider: AIProvider,
  apiKey: string,
  model?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (provider === 'anthropic') {
      const testModel = model || AI_PROVIDER_DEFAULTS.defaultAnthropicModel;
      const client = new Anthropic({ apiKey });
      await client.messages.create({
        model: testModel,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      });
      return { success: true };
    } else {
      // OpenRouter: use the selected model (or fall back to config/default)
      const testModel = model || getProviderConfig().model || AI_PROVIDER_DEFAULTS.defaultOpenRouterModel;
      const response = await fetch(`${AI_PROVIDER_DEFAULTS.openRouterBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/JobMatchChecker',
          'X-Title': 'Job Match Checker',
        },
        body: JSON.stringify({
          model: testModel,
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        if (response.status === 401) {
          return { success: false, error: 'API-Key ungültig' };
        }
        return { success: false, error: `Fehler ${response.status}: ${errorBody}` };
      }

      return { success: true };
    }
  } catch (error: any) {
    log.error(`Connection test failed for ${provider}:`, error);
    return { success: false, error: error.message };
  }
}
