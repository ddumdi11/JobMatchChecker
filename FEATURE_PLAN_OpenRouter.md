# Feature Plan: OpenRouter Integration

> **Issue-Titel:** Multi-Provider AI: OpenRouter Integration für kostenloses Matching
> **Stand:** 2026-02-12
> **Aufwand:** Mittel (2-3 Sessions)
> **Impact:** Hoch (Kostenreduktion, Modellvergleiche, Zukunftssicherheit)

---

## Motivation

Aktuell ist Claude Sonnet 4.5 fest verdrahtet für:
- **AI-Extraktion** (`aiExtractionService.ts`) → Felder aus Stellenanzeigen extrahieren
- **Matching** (`matchingService.ts`) → Profil gegen Job matchen

OpenRouter bietet Zugang zu 200+ Modellen über eine einheitliche API, darunter regelmäßig **kostenlose Preview-Modelle** (z.B. DeepSeek, Qwen, Llama). Damit könnten Matchings kostenlos durchgeführt werden.

**Referenz:** SOMAS Prompt Generator (Python/Streamlit) hat diese Integration bereits erfolgreich umgesetzt – siehe Screenshots im Projekt.

---

## Architektur

### Ist-Zustand
```
aiExtractionService.ts ─── Anthropic SDK ─── Claude API
matchingService.ts     ─── Anthropic SDK ─── Claude API
```

### Soll-Zustand
```
aiExtractionService.ts ─── aiProviderService.ts ─── Anthropic SDK ─── Claude API
matchingService.ts     ─── aiProviderService.ts ─── OpenRouter    ─── Beliebiges Modell
                                                 ─── Anthropic SDK ─── Claude API (Fallback)
```

### Kern: `aiProviderService.ts` (NEU)

Abstraktionsschicht die beide APIs bedient:

```typescript
// Typen
type AIProvider = 'anthropic' | 'openrouter';

interface AIProviderConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
  // OpenRouter-spezifisch
  openRouterBaseUrl?: string; // https://openrouter.ai/api/v1
}

interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AIResponse {
  content: string;
  model: string;
  provider: AIProvider;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalCost?: number; // In USD, falls OpenRouter
  };
}

// Hauptfunktion
async function sendPrompt(
  messages: AIMessage[],
  config: AIProviderConfig
): Promise<AIResponse>
```

**Anthropic-Pfad:** Nutzt weiterhin das Anthropic SDK (bewährt, typsicher).

**OpenRouter-Pfad:** Nutzt `fetch()` gegen `https://openrouter.ai/api/v1/chat/completions` (OpenAI-kompatibles Format).

---

## Implementierung (4 Blöcke)

### Block 1: AI Provider Service (Kern)

**Neue Datei:** `src/main/services/aiProviderService.ts`

```typescript
// Pseudo-Code Struktur
export class AIProviderService {
  // Hauptmethode: Prompt an gewählten Provider senden
  async sendPrompt(messages: AIMessage[], config?: Partial<AIProviderConfig>): Promise<AIResponse>

  // Anthropic-Pfad (bestehende Logik aus aiExtractionService)
  private async sendToAnthropic(messages: AIMessage[], config: AIProviderConfig): Promise<AIResponse>

  // OpenRouter-Pfad (OpenAI-kompatibles Format)
  private async sendToOpenRouter(messages: AIMessage[], config: AIProviderConfig): Promise<AIResponse>

  // Modelle von OpenRouter laden (cached, 1h TTL)
  async getAvailableModels(): Promise<OpenRouterModel[]>

  // Nur kostenlose Modelle filtern
  async getFreeModels(): Promise<OpenRouterModel[]>

  // API Key testen
  async testConnection(provider: AIProvider, apiKey: string): Promise<boolean>
}
```

**OpenRouter API Format:**
```typescript
// Request (OpenAI-kompatibel)
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://github.com/ddumdi11/JobMatchChecker',
    'X-Title': 'JobMatchChecker'
  },
  body: JSON.stringify({
    model: 'deepseek/deepseek-chat:free', // Beispiel
    messages: [
      { role: 'system', content: 'Du bist ein Job-Matching-Experte...' },
      { role: 'user', content: promptText }
    ],
    max_tokens: 2048,
    temperature: 0.1
  })
});

// Response
const data = await response.json();
const content = data.choices[0].message.content;
const usage = data.usage; // { prompt_tokens, completion_tokens, total_tokens }
```

**Modell-Liste laden:**
```typescript
// GET https://openrouter.ai/api/v1/models
// Returns: { data: [{ id, name, pricing: { prompt, completion }, context_length, ... }] }
// Free-Filter: pricing.prompt === "0" && pricing.completion === "0"
```

### Block 2: Settings-Erweiterung (UI)

**Datei:** `src/renderer/pages/PreferencesPanel.tsx` (erweitern)

Neuer Abschnitt "AI-Provider Einstellungen":

| Element | Beschreibung |
|---------|-------------|
| **Provider-Auswahl** | Dropdown: "Anthropic (Claude)" / "OpenRouter" |
| **Anthropic API Key** | Textfeld (bereits vorhanden, verschieben) |
| **OpenRouter API Key** | Textfeld + Test-Button |
| **Modell-Auswahl** | Dropdown mit Modell-Liste (nur bei OpenRouter) |
| **Free-Filter** | Checkbox: "Nur kostenlose Modelle" |
| **Modell-Info** | Anzeige: Kontextfenster, Kosten/1M Tokens |

**Modell-Dropdown Format (wie SOMAS):**
```
DeepSeek: DeepSeek V3 (free)        671K  FREE
Google: Gemma 3 27B (free)          96K   FREE
Qwen: QwQ 32B (free)               131K  FREE
---
Anthropic: Claude Sonnet 4.5        200K  $3.00/$15.00
OpenAI: GPT-4o                      128K  $2.50/$10.00
```

### Block 3: Migration der bestehenden Services

**Datei:** `src/main/services/aiExtractionService.ts`
- `extractJobFields()` → nutzt `aiProviderService.sendPrompt()` statt direkt Anthropic SDK
- Prompt bleibt gleich, nur der Transport ändert sich
- Fallback: Wenn OpenRouter-Modell den JSON nicht korrekt zurückgibt → Retry mit Anthropic

**Datei:** `src/main/services/matchingService.ts`
- Matching-Prompt → nutzt `aiProviderService.sendPrompt()`
- Besonders hier lohnt sich OpenRouter: Matching wird am häufigsten aufgerufen
- `validateAndAdjustScore()` bleibt als Safety-Net (unabhängig vom Modell)

### Block 4: IPC & Einstellungen

**Datei:** `src/main/ipc/handlers.ts`
- `ai:getModels` → Modell-Liste von OpenRouter laden
- `ai:testConnection` → API Key testen
- `ai:getProviderConfig` → Aktuelle Provider-Einstellungen laden
- `ai:setProviderConfig` → Provider-Einstellungen speichern

**Datei:** `src/main/preload.ts` + `global.d.ts`
- API-Methoden exponieren

**Datei:** Neue Migration für Settings-Tabelle
- `ai_provider` (string): 'anthropic' | 'openrouter'
- `ai_model` (string): Modell-ID
- `openrouter_api_key` (string): Verschlüsselt via keytar

---

## Wichtige Designentscheidungen

### 1. Pro Funktion verschiedene Provider erlauben?
**Empfehlung: Nein (erstmal nicht).** Ein globaler Provider + Modell reicht. Später könnte man pro Funktion (Extraktion vs. Matching) verschiedene Modelle erlauben, aber das verkompliziert die UX unnötig.

### 2. API Key Speicherung
- **Anthropic Key:** Bereits via `electron-store` oder `keytar` gespeichert
- **OpenRouter Key:** Gleicher Mechanismus (keytar für sichere Speicherung)

### 3. Modell-Cache
- Modell-Liste von OpenRouter cachen (1h TTL)
- Beim Start einmal laden, danach aus Cache
- "Modelle aktualisieren" Button für manuelles Refresh

### 4. Fehlerbehandlung
- OpenRouter hat eigene Rate Limits und Error Codes
- Manche Free-Modelle haben Wartezeiten (Queue)
- Timeout erhöhen: Free-Modelle können langsamer sein (60s statt 30s)
- Bei Fehler: Klare Meldung "Modell X nicht verfügbar, versuche ein anderes"

### 5. JSON-Robustheit
- Nicht alle Modelle halten sich strikt an "Return ONLY valid JSON"
- JSON-Extraktion aus Markdown-Blöcken bereits implementiert (aiExtractionService)
- Zusätzlich: `validateAndAdjustScore()` im matchingService als Safety-Net

---

## Reihenfolge der Umsetzung

| Schritt | Was | Dateien |
|---------|-----|---------|
| 1 | `aiProviderService.ts` erstellen | Neue Datei |
| 2 | OpenRouter fetch + Modell-Endpunkt | aiProviderService.ts |
| 3 | IPC Handler für Provider-Config | handlers.ts, preload.ts, global.d.ts |
| 4 | PreferencesPanel erweitern | PreferencesPanel.tsx |
| 5 | aiExtractionService migrieren | aiExtractionService.ts |
| 6 | matchingService migrieren | matchingService.ts |
| 7 | Testen mit Free-Modell | Manueller Test |

---

## Testplan

| Test | Erwartung |
|------|-----------|
| Anthropic-Matching (wie bisher) | Score wie gehabt (48% digatus) |
| OpenRouter + Claude Sonnet | Gleiches Ergebnis wie direkt Anthropic |
| OpenRouter + Free-Modell (z.B. DeepSeek) | Ähnlicher Score (±10%), JSON valide |
| OpenRouter + schwaches Free-Modell | validateAndAdjustScore greift, Score wird korrigiert |
| Kein API Key | Klare Fehlermeldung |
| Ungültiger API Key | "API Key ungültig" nach Test-Button |
| Modell nicht verfügbar | "Modell nicht verfügbar, bitte anderes wählen" |

---

## Nicht in Scope (bewusst ausgeklammert)

- Streaming-Responses (nice-to-have, aber unnötig komplex)
- Kosten-Tracking pro Matching (wäre cool, aber eigenes Feature)
- Automatischer Modell-Wechsel bei Fehler (Fallback-Chain)
- Perplexity AI als dritter Provider (erst wenn Bedarf bestätigt)

---

## Zusammenfassung

**Was ändert sich für den User?**
1. Neuer Abschnitt in Einstellungen: "AI-Provider"
2. Wahl zwischen Anthropic (direkt) und OpenRouter (200+ Modelle)
3. Bei OpenRouter: Modell-Dropdown mit Kosten-Anzeige und Free-Filter
4. Matchings mit Free-Modellen = 0€ Kosten

**Was ändert sich im Code?**
1. Neue Abstraktionsschicht `aiProviderService.ts`
2. Bestehende Services nutzen diese statt direkt Anthropic SDK
3. Settings-Erweiterung für Provider-Konfiguration
4. Neue IPC Handler für Modell-Liste und Provider-Config
