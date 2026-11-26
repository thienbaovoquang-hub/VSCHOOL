export interface GeminiLikePart {
  text?: string;
  inlineData?: {
    mimeType?: string;
    data?: string;
  };
}

export interface GeminiLikeTurn {
  role?: string;
  parts?: GeminiLikePart[];
}

export function extractJsonText(rawText: string): string {
  const trimmed = (rawText || '').trim();
  if (!trimmed) return '';

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;

  try {
    JSON.parse(candidate);
    return candidate;
  } catch {
    const objStart = candidate.indexOf('{');
    const objEnd = candidate.lastIndexOf('}');
    if (objStart >= 0 && objEnd > objStart) {
      const sliced = candidate.slice(objStart, objEnd + 1);
      try {
        JSON.parse(sliced);
        return sliced;
      } catch {
        // ignore
      }
    }
    const arrStart = candidate.indexOf('[');
    const arrEnd = candidate.lastIndexOf(']');
    if (arrStart >= 0 && arrEnd > arrStart) {
      const sliced = candidate.slice(arrStart, arrEnd + 1);
      try {
        JSON.parse(sliced);
        return sliced;
      } catch {
        // ignore
      }
    }
    return candidate;
  }
}

export type GroqContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | GroqContentPart[];
}

export const DEFAULT_GROQ_TEXT_MODELS = [
  'llama-3.3-70b-versatile',
  'openai/gpt-oss-120b',
  'llama-3.1-8b-instant',
] as const;

export const DEFAULT_GROQ_VISION_MODELS = [
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
] as const;

const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';

const PLACEHOLDER_GROQ_KEYS = new Set([
  'MY_GROQ_API_KEY',
  'YOUR_GROQ_API_KEY',
  'YOUR_API_KEY',
  'GROQ_API_KEY',
  'API_KEY',
  'UNDEFINED',
  'NULL',
  'NONE',
]);

export function normalizeGroqApiKey(raw?: string): string {
  if (!raw) return '';
  const cleaned = raw.trim().replace(/^["']+|["']+$/g, '').trim();
  if (!cleaned || PLACEHOLDER_GROQ_KEYS.has(cleaned.toUpperCase())) {
    return '';
  }
  if (!cleaned.startsWith('gsk_')) {
    return '';
  }
  return cleaned;
}

export function getCandidateGroqApiKeys(
  env: Record<string, string | undefined> = process.env
): string[] {
  const candidates = [env.GROQ_API_KEY, env.CUSTOM_GROQ_API_KEY, env.MY_GROQ_API_KEY];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of candidates) {
    const key = normalizeGroqApiKey(raw);
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

export function getGroqCandidateModels(
  hasImages: boolean,
  env: Record<string, string | undefined> = process.env
): string[] {
  if (hasImages) {
    const customVision =
      typeof env.GROQ_VISION_MODEL === 'string' ? env.GROQ_VISION_MODEL.trim() : '';
    const list = customVision
      ? [customVision, ...DEFAULT_GROQ_VISION_MODELS]
      : [...DEFAULT_GROQ_VISION_MODELS];
    return Array.from(new Set(list));
  }

  const customText = typeof env.GROQ_MODEL === 'string' ? env.GROQ_MODEL.trim() : '';
  const list = customText
    ? [customText, ...DEFAULT_GROQ_TEXT_MODELS]
    : [...DEFAULT_GROQ_TEXT_MODELS];
  return Array.from(new Set(list));
}

function toGroqParts(parts: GeminiLikePart[]): {
  contentParts: GroqContentPart[];
  hasImages: boolean;
  hasPdfParts: boolean;
} {
  const contentParts: GroqContentPart[] = [];
  let hasImages = false;
  let hasPdfParts = false;

  for (const part of parts) {
    if (!part || typeof part !== 'object') continue;
    if (typeof part.text === 'string' && part.text.trim()) {
      contentParts.push({ type: 'text', text: part.text });
      continue;
    }
    if (part.inlineData && typeof part.inlineData.data === 'string' && part.inlineData.data) {
      const mimeType = String(part.inlineData.mimeType || '').toLowerCase();
      if (mimeType === 'application/pdf') {
        hasPdfParts = true;
      } else if (mimeType.startsWith('image/')) {
        hasImages = true;
        const normalizedMime = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;
        contentParts.push({
          type: 'image_url',
          image_url: {
            url: `data:${normalizedMime};base64,${part.inlineData.data}`,
          },
        });
      }
    }
  }

  return { contentParts, hasImages, hasPdfParts };
}

function asGroqPartArray(content: string | GroqContentPart[]): GroqContentPart[] {
  return typeof content === 'string' ? [{ type: 'text', text: content }] : [...content];
}

export function convertContentsToGroqMessages(
  contents: unknown,
  systemInstruction?: string
): { messages: GroqMessage[]; hasImages: boolean; hasPdfParts: boolean } {
  const out: GroqMessage[] = [];
  if (systemInstruction && systemInstruction.trim()) {
    out.push({ role: 'system', content: systemInstruction.trim() });
  }

  let hasImages = false;
  let hasPdfParts = false;

  if (typeof contents === 'string') {
    const trimmed = contents.trim();
    if (trimmed) {
      out.push({ role: 'user', content: trimmed });
    }
    return { messages: out, hasImages, hasPdfParts };
  }

  const rawList: GeminiLikeTurn[] = Array.isArray(contents)
    ? (contents as GeminiLikeTurn[])
    : contents && typeof contents === 'object'
      ? [contents as GeminiLikeTurn]
      : [];

  const turns: GroqMessage[] = [];
  for (const turn of rawList) {
    if (!turn || typeof turn !== 'object') continue;
    const role: 'user' | 'assistant' =
      turn.role === 'model' || turn.role === 'assistant' ? 'assistant' : 'user';
    const converted = Array.isArray(turn.parts)
      ? toGroqParts(turn.parts)
      : { contentParts: [], hasImages: false, hasPdfParts: false };
    if (converted.hasImages) hasImages = true;
    if (converted.hasPdfParts) hasPdfParts = true;
    if (converted.contentParts.length === 0) continue;

    const normalizedContent: string | GroqContentPart[] =
      converted.contentParts.length === 1 && converted.contentParts[0].type === 'text'
        ? converted.contentParts[0].text
        : converted.contentParts;

    const prev = turns[turns.length - 1];
    if (prev && prev.role === role) {
      prev.content = [...asGroqPartArray(prev.content), ...asGroqPartArray(normalizedContent)];
    } else {
      turns.push({ role, content: normalizedContent });
    }
  }

  while (turns.length > 0 && turns[0].role !== 'user') {
    turns.shift();
  }

  return {
    messages: [...out, ...turns],
    hasImages,
    hasPdfParts,
  };
}

export class GroqApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'GroqApiError';
    this.status = status;
  }
}

async function parseGroqHttpError(response: Response): Promise<GroqApiError> {
  let detail = `HTTP ${response.status}`;
  try {
    const raw = await response.text();
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { error?: { message?: string } };
        detail = parsed?.error?.message || raw;
      } catch {
        detail = raw;
      }
    }
  } catch {
    // ignore read error
  }
  return new GroqApiError(response.status, detail);
}

function isRetryableGroqStatus(status: number): boolean {
  return status === 404 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function isGroqKeyFailure(status: number): boolean {
  return status === 401 || status === 403;
}

export function parseGroqSseLine(line: string): { delta?: string; error?: string } | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return null;
  const payload = trimmed.slice(5).trim();
  if (!payload || payload === '[DONE]') return null;

  try {
    const parsed = JSON.parse(payload) as {
      choices?: Array<{ delta?: { content?: string | null } }>;
      error?: { message?: string };
    };
    if (parsed.error?.message) {
      return { error: parsed.error.message };
    }
    const delta = parsed.choices?.[0]?.delta?.content;
    if (typeof delta === 'string' && delta.length > 0) {
      return { delta };
    }
  } catch {
    return null;
  }
  return null;
}

export interface CallGroqOptions {
  apiKeys: string[];
  models?: string[];
  systemInstruction?: string;
  contents: unknown;
  jsonMode?: boolean;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

export async function callGroqChatCompletions(
  options: CallGroqOptions
): Promise<{ text: string; model: string }> {
  const {
    apiKeys,
    systemInstruction,
    contents,
    jsonMode = false,
    maxTokens = 4096,
    temperature = 0.35,
    signal,
    fetchImpl = fetch,
  } = options;

  if (apiKeys.length === 0) {
    throw new GroqApiError(503, 'Missing GROQ_API_KEY');
  }

  const { messages, hasImages } = convertContentsToGroqMessages(contents, systemInstruction);
  const nonSystemCount = messages.filter((m) => m.role !== 'system').length;
  if (nonSystemCount === 0) {
    throw new GroqApiError(400, 'Thiếu nội dung câu hỏi để gửi Groq API.');
  }

  const models = options.models && options.models.length > 0
    ? options.models
    : getGroqCandidateModels(hasImages);

  let lastError: unknown;

  keyLoop: for (let k = 0; k < apiKeys.length; k++) {
    const apiKey = apiKeys[k];
    const hasMoreKeys = k < apiKeys.length - 1;

    for (let m = 0; m < models.length; m++) {
      const model = models[m];
      const hasMoreModels = m < models.length - 1;
      try {
        const runRequest = async (useJsonFormat: boolean): Promise<string> => {
          const payload: Record<string, unknown> = {
            model,
            messages,
            max_tokens: maxTokens,
            temperature,
          };
          if (useJsonFormat && !hasImages) {
            payload.response_format = { type: 'json_object' };
          }
          const resp = await fetchImpl(GROQ_CHAT_COMPLETIONS_URL, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
            signal,
          });
          if (!resp.ok) {
            throw await parseGroqHttpError(resp);
          }
          const data = (await resp.json()) as {
            choices?: Array<{ message?: { content?: string | null } }>;
          };
          const raw = String(data.choices?.[0]?.message?.content || '').trim();
          return raw;
        };

        let rawText: string;
        try {
          rawText = await runRequest(jsonMode);
        } catch (innerErr) {
          // Some Groq models or edge prompts reject response_format: json_object with 400; retry plain and parse JSON.
          if (
            jsonMode &&
            innerErr instanceof GroqApiError &&
            innerErr.status === 400 &&
            /json|response_format/i.test(innerErr.message)
          ) {
            rawText = await runRequest(false);
          } else {
            throw innerErr;
          }
        }

        const text = jsonMode ? extractJsonText(rawText) : rawText;
        if (!text) {
          throw new GroqApiError(502, 'Groq API không trả về nội dung văn bản.');
        }
        return { text, model };
      } catch (error) {
        lastError = error;
        const status = error instanceof GroqApiError ? error.status : 502;
        if (isGroqKeyFailure(status) && hasMoreKeys) {
          continue keyLoop;
        }
        if (isRetryableGroqStatus(status) && hasMoreModels) {
          continue;
        }
        throw error;
      }
    }
  }

  throw lastError;
}

export interface StreamGroqOptions extends CallGroqOptions {
  onDelta: (delta: string) => void;
}

export async function streamGroqChatCompletions(
  options: StreamGroqOptions
): Promise<{ text: string; model: string }> {
  const {
    apiKeys,
    systemInstruction,
    contents,
    maxTokens = 4096,
    temperature = 0.35,
    onDelta,
    signal,
    fetchImpl = fetch,
  } = options;

  if (apiKeys.length === 0) {
    throw new GroqApiError(503, 'Missing GROQ_API_KEY');
  }

  const { messages, hasImages } = convertContentsToGroqMessages(contents, systemInstruction);
  const nonSystemCount = messages.filter((m) => m.role !== 'system').length;
  if (nonSystemCount === 0) {
    throw new GroqApiError(400, 'Thiếu nội dung câu hỏi để gửi Groq API.');
  }

  const models = options.models && options.models.length > 0
    ? options.models
    : getGroqCandidateModels(hasImages);

  let lastError: unknown;

  keyLoop: for (let k = 0; k < apiKeys.length; k++) {
    const apiKey = apiKeys[k];
    const hasMoreKeys = k < apiKeys.length - 1;

    for (let m = 0; m < models.length; m++) {
      const model = models[m];
      const hasMoreModels = m < models.length - 1;
      let emittedAny = false;
      try {
        const resp = await fetchImpl(GROQ_CHAT_COMPLETIONS_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: maxTokens,
            temperature,
            stream: true,
          }),
          signal,
        });

        if (!resp.ok) {
          throw await parseGroqHttpError(resp);
        }

        if (!resp.body) {
          throw new GroqApiError(502, 'Groq streaming response body is empty.');
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let fullText = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const event = parseGroqSseLine(line);
            if (event?.error) {
              throw new GroqApiError(502, event.error);
            }
            if (event?.delta) {
              emittedAny = true;
              fullText += event.delta;
              onDelta(event.delta);
            }
          }
        }

        buffer += decoder.decode();
        if (buffer.trim()) {
          for (const line of buffer.split(/\r?\n/)) {
            const event = parseGroqSseLine(line);
            if (event?.error) {
              throw new GroqApiError(502, event.error);
            }
            if (event?.delta) {
              emittedAny = true;
              fullText += event.delta;
              onDelta(event.delta);
            }
          }
        }

        if (!fullText.trim()) {
          throw new GroqApiError(502, 'Groq API không trả về nội dung streaming.');
        }

        return { text: fullText.trim(), model };
      } catch (error) {
        lastError = error;
        if (emittedAny) {
          throw error;
        }
        const status = error instanceof GroqApiError ? error.status : 502;
        if (isGroqKeyFailure(status) && hasMoreKeys) {
          continue keyLoop;
        }
        if (isRetryableGroqStatus(status) && hasMoreModels) {
          continue;
        }
        throw error;
      }
    }
  }

  throw lastError;
}

export function formatGroqErrorMessage(error: unknown): string {
  const status = error instanceof GroqApiError ? error.status : 502;
  const raw = error instanceof Error ? error.message : String(error || 'Unknown Groq error');
  const lower = raw.toLowerCase();

  if (status === 401 || status === 403 || lower.includes('invalid api key') || lower.includes('authentication')) {
    return `Lỗi API Key Groq (${status}): Khóa GROQ_API_KEY không hợp lệ hoặc đã bị thu hồi. Vui lòng kiểm tra lại trong Settings > Secrets.`;
  }
  if (status === 429 || lower.includes('rate limit') || lower.includes('quota')) {
    return `Groq API đang tạm chạm giới hạn tốc độ miễn phí (429 Rate Limit). Vui lòng chờ vài giây rồi thử lại.`;
  }
  if (status === 413 || lower.includes('too large') || lower.includes('context length')) {
    return `Nội dung hoặc ảnh gửi lên vượt quá giới hạn kích thước của Groq API (${status}). Vui lòng rút gọn hoặc chọn ảnh dung lượng nhỏ hơn.`;
  }
  return `Lỗi kết nối Groq API (${status}): ${raw.length > 160 ? `${raw.slice(0, 157)}...` : raw}`;
}
