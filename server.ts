import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import mammoth from 'mammoth';
import { extractText as extractPdfTextRaw, getDocumentProxy } from 'unpdf';
import * as XLSX from 'xlsx';
import {
  normalizeHistoryExcelRow,
  type HistoryExcelModule,
} from './src/utils/historyRules.ts';
import {
  normalizeGeoDataMatrixRows,
  normalizeGeoExcelRow,
  type GeoExcelModule,
} from './src/utils/geographyRules.ts';
import {
  generateSubjectExportBuffer,
  generateSubjectTemplateBuffer,
  parseSubjectExcelBuffer,
  type SubjectExcelSubjectId,
} from './src/utils/subjectExcel.ts';
import {
  parseDevelopmentAdminMode,
  resolveBackendApiEffectiveRole,
} from './src/utils/devAdminMode.ts';
import {
  buildSubjectAiContents,
  buildSubjectAiSystemInstruction,
  formatGeminiErrorMessage,
  SUBJECT_AI_PROFILES,
  validateSubjectAiRequest,
  validateSubjectStructuredRequest,
} from './src/utils/subjectAi.ts';
import {
  callGroqChatCompletions,
  convertContentsToGroqMessages,
  extractJsonText,
  formatGroqErrorMessage,
  getCandidateGroqApiKeys,
  GroqApiError,
  streamGroqChatCompletions,
} from './src/utils/groqClient.ts';
import {
  buildAnalyticsAnalyzePrompt,
  buildAnalyticsAnalyzeSystemInstruction,
  buildCopilotChatSystemInstruction,
  normalizeCopilotChatTurns,
} from './src/utils/aiPrompts.ts';
import {
  createExternalBookCache,
  enrichBookFromExternalApis,
  lookupExternalBookByIsbn,
  searchExternalBooks,
} from './src/utils/libraryExternalProxy.ts';
import type {
  ExternalIsbnLookupResponse,
  ExternalSearchResponse,
} from './src/utils/libraryExternalApis.ts';
import {
  createTtlCache,
  fetchGutendexExcerpt,
  fetchNasaApod,
  fetchNasaNeoFeed,
  fetchWorldBankIndicator,
  fetchWorldBankMultiCountry,
  lookupLexiconWord,
  lookupPubChemCompound,
  lookupWikipediaSummary,
  reverseNominatim,
  searchAcademicPapers,
  searchGutendexBooks,
  searchNasaMedia,
  searchNominatim,
  searchRestCountries,
} from './src/utils/externalIntegrationsProxy.ts';
import type {
  AcademicPaperResult,
  CountryProfile,
  GutendexBookResult,
  LexiconLookupResult,
  NasaApodResult,
  NasaMediaItem,
  NasaNeoItem,
  NominatimPlace,
  PubChemCompound,
  WikipediaSummaryResult,
  WorldBankSeries,
} from './src/utils/externalIntegrations.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const GEMINI_MODEL = 'gemini-4-hydrogen';
const GEMINI_FALLBACK_MODELS = ['gemini-3.1-flash-lite'] as const;
const DEVELOPMENT_ADMIN_MODE = parseDevelopmentAdminMode(process.env.DEVELOPMENT_ADMIN_MODE);

const PLACEHOLDER_API_KEYS = new Set([
  'MY_GEMINI_API_KEY',
  'YOUR_API_KEY',
  'YOUR_GEMINI_API_KEY',
  'GEMINI_API_KEY',
  'API_KEY',
  'UNDEFINED',
  'NULL',
  'NONE',
]);

function normalizeCandidateApiKey(raw?: string): string {
  if (!raw) return '';
  const cleaned = raw.trim().replace(/^["']+|["']+$/g, '').trim();
  if (!cleaned || PLACEHOLDER_API_KEYS.has(cleaned.toUpperCase())) {
    return '';
  }
  return cleaned;
}

function getCandidateApiKeys(): string[] {
  const rawCandidates = [
    process.env.CUSTOM_GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.GEMINI_API_KEY,
    process.env.API_KEY,
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of rawCandidates) {
    const key = normalizeCandidateApiKey(raw);
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

function createGeminiClientForKey(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getGeminiClient(): GoogleGenAI | null {
  const keys = getCandidateApiKeys();
  if (keys.length === 0) {
    return null;
  }
  return createGeminiClientForKey(keys[0]);
}

function getHttpStatusFromError(error: unknown): number {
  const errObj = error as { status?: unknown; code?: unknown; message?: unknown } | null;
  if (typeof errObj?.status === 'number' && errObj.status >= 400 && errObj.status < 600) {
    return errObj.status;
  }
  const msg = typeof errObj?.message === 'string' ? errObj.message : '';
  const codeMatch = /"code"\s*:\s*(\d{3})/.exec(msg);
  if (codeMatch) {
    const parsed = Number(codeMatch[1]);
    if (parsed >= 400 && parsed < 600) return parsed;
  }
  if (/PERMISSION_DENIED/i.test(msg)) return 403;
  if (/API_KEY_INVALID/i.test(msg)) return 400;
  if (/NOT_FOUND/i.test(msg)) return 404;
  if (/RESOURCE_EXHAUSTED/i.test(msg)) return 429;
  return 502;
}

function isRetryableGeminiStatus(status: number, error?: unknown, hasMoreCandidates = false): boolean {
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) return true;
  if (status === 404 && hasMoreCandidates) return true;
  const msg = error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
    ? String((error as { message: string }).message)
    : '';
  return /high demand|unavailable|overloaded|try again later|temporarily/i.test(msg);
}

function buildGeminiConfig(
  model: string,
  abortSignal: AbortSignal,
  baseConfig?: Record<string, unknown>
): Record<string, unknown> {
  const config: Record<string, unknown> = {
    ...(baseConfig ?? {}),
    abortSignal,
  };
  if (model.startsWith('gemini-4-') && !config.thinkingConfig) {
    config.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
  }
  return config;
}

const modelCooldownUntil = new Map<string, { until: number; status: number }>();

function getOrderedCandidateModels(deprioritizeModel?: string): string[] {
  const all = [GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS];
  const now = Date.now();
  const ready = all.filter((m) => (modelCooldownUntil.get(m)?.until ?? 0) <= now);
  const transientCooled = all
    .filter((m) => {
      const entry = modelCooldownUntil.get(m);
      return Boolean(entry && entry.until > now && entry.status !== 429);
    })
    .sort((a, b) => modelCooldownUntil.get(a)!.until - modelCooldownUntil.get(b)!.until);
  const rateLimited = all
    .filter((m) => {
      const entry = modelCooldownUntil.get(m);
      return Boolean(entry && entry.until > now && entry.status === 429);
    })
    .sort((a, b) => modelCooldownUntil.get(a)!.until - modelCooldownUntil.get(b)!.until);

  const ordered =
    ready.length > 0 || transientCooled.length > 0
      ? [...ready, ...transientCooled, ...rateLimited]
      : [...all];

  if (deprioritizeModel && ordered.includes(deprioritizeModel)) {
    return [...ordered.filter((m) => m !== deprioritizeModel), deprioritizeModel];
  }
  return ordered;
}

function markModelCooldown(model: string, status: number): void {
  const durationMs = status === 429 ? 15_000 : 12_000;
  modelCooldownUntil.set(model, { until: Date.now() + durationMs, status });
}

function raceFailoverTimeout<T>(
  promise: Promise<T>,
  ms: number,
  model: string,
  controller?: AbortController
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      try {
        controller?.abort();
      } catch {
        // ignore abort error
      }
      const err = new Error(`Model ${model} timed out after ${ms}ms (unavailable).`);
      (err as { status?: number }).status = 503;
      reject(err);
    }, ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function callGeminiWithFallbackOnClient<T>(
  fn: (model: string, abortSignal: AbortSignal) => Promise<T>,
  options?: { deprioritizeModel?: string; deadlineMs?: number }
): Promise<T> {
  const firstPass = getOrderedCandidateModels(options?.deprioritizeModel);
  const overallDeadline = options?.deadlineMs ?? Date.now() + 48_000;
  let lastError: unknown;
  const non429Models: string[] = [];

  for (let m = 0; m < firstPass.length; m++) {
    const model = firstPass[m];
    const hasMore = m < firstPass.length - 1;
    const remainingMs = overallDeadline - Date.now();
    if (remainingMs < 3000 && lastError) {
      throw lastError;
    }
    const startedAt = Date.now();
    const controller = new AbortController();
    const perAttemptCap = 28_000;
    const timeoutMs = Math.min(perAttemptCap, Math.max(3000, remainingMs));
    try {
      const result = await raceFailoverTimeout(
        fn(model, controller.signal),
        timeoutMs,
        model,
        controller
      );
      modelCooldownUntil.delete(model);
      return result;
    } catch (error) {
      lastError = error;
      const elapsedMs = Date.now() - startedAt;
      const status = getHttpStatusFromError(error);
      console.warn(`[Gemini fallback] model=${model} status=${status} elapsed=${elapsedMs}ms`);
      if (!isRetryableGeminiStatus(status, error, hasMore)) {
        throw error;
      }
      markModelCooldown(model, status);
      if (status !== 429 && status !== 404) {
        non429Models.push(model);
      }
    }
  }

  // Exponential backoff retry passes across transient/503 models within the overall deadline
  const backoffDelaysMs = [1200, 2600, 4200];
  for (let pass = 0; pass < backoffDelaysMs.length; pass++) {
    if (non429Models.length === 0) break;
    const delayMs = backoffDelaysMs[pass];
    if (overallDeadline - Date.now() <= delayMs + 3000) break;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    const nextPassModels: string[] = [];
    for (let i = 0; i < non429Models.length; i++) {
      const model = non429Models[i];
      const remainingMs = overallDeadline - Date.now();
      if (remainingMs < 3000) break;
      const startedAt = Date.now();
      const controller = new AbortController();
      const timeoutMs = Math.min(24_000, remainingMs);
      try {
        const result = await raceFailoverTimeout(
          fn(model, controller.signal),
          timeoutMs,
          model,
          controller
        );
        modelCooldownUntil.delete(model);
        return result;
      } catch (error) {
        lastError = error;
        const elapsedMs = Date.now() - startedAt;
        const status = getHttpStatusFromError(error);
        console.warn(`[Gemini retry-pass-${pass + 1}] model=${model} status=${status} elapsed=${elapsedMs}ms`);
        if (!isRetryableGeminiStatus(status, error, i < non429Models.length - 1 || pass < backoffDelaysMs.length - 1)) {
          throw error;
        }
        markModelCooldown(model, status);
        if (status !== 429 && status !== 404) {
          nextPassModels.push(model);
        }
      }
    }
    non429Models.length = 0;
    non429Models.push(...nextPassModels);
  }

  throw lastError;
}

async function callGeminiWithFallback<T>(
  fn: (model: string, abortSignal: AbortSignal, client: GoogleGenAI) => Promise<T>,
  options?: { deprioritizeModel?: string; deadlineMs?: number; client?: GoogleGenAI }
): Promise<T> {
  if (options?.client) {
    const fixedClient = options.client;
    return callGeminiWithFallbackOnClient(
      (model, abortSignal) => fn(model, abortSignal, fixedClient),
      options
    );
  }
  const keys = getActiveGeminiApiKeys();
  if (keys.length === 0) {
    throw new Error('Missing GEMINI_API_KEY');
  }
  let lastError: unknown;
  for (let i = 0; i < keys.length; i++) {
    const client = createGeminiClientForKey(keys[i]);
    try {
      return await callGeminiWithFallbackOnClient(
        (model, abortSignal) => fn(model, abortSignal, client),
        options
      );
    } catch (error) {
      lastError = error;
      if (isUnusableGeminiFallbackError(error)) {
        invalidGeminiKeys.add(keys[i]);
      }
      const status = getHttpStatusFromError(error);
      const isKeyFailure = status === 400 || status === 401 || status === 403;
      if (!isKeyFailure || i === keys.length - 1) {
        throw error;
      }
      console.warn(`[Gemini key fallback] keyIndex=${i} status=${status}, trying next configured key`);
    }
  }
  throw lastError;
}

function sendMissingKeyError(res: express.Response) {
  res.status(503).json({
    error:
      'Máy chủ chưa cấu hình GROQ_API_KEY (tạo khóa tại console.groq.com) hoặc GEMINI_API_KEY. Vui lòng thiết lập trong phần Settings > Secrets.',
    code: 'missing_api_key',
  });
}

const invalidGroqKeys = new Set<string>();
const invalidGeminiKeys = new Set<string>();

function getActiveGroqApiKeys(): string[] {
  return getCandidateGroqApiKeys().filter((k) => !invalidGroqKeys.has(k));
}

function getActiveGeminiApiKeys(): string[] {
  return getCandidateApiKeys().filter((k) => !invalidGeminiKeys.has(k));
}

function hasAnyConfiguredAiKey(): boolean {
  return getActiveGroqApiKeys().length > 0 || getActiveGeminiApiKeys().length > 0;
}

function isUnusableGroqError(error: unknown): boolean {
  return error instanceof GroqApiError && (error.status === 401 || error.status === 403);
}

function isUnusableGeminiFallbackError(error: unknown): boolean {
  const status = getHttpStatusFromError(error);
  if (status === 401 || status === 403) return true;
  if (status === 400) {
    const msg = error instanceof Error ? error.message : String(error || '');
    return /API_KEY_INVALID|API key not valid|invalid.*key|permission|billing|paid tier/i.test(msg);
  }
  return false;
}

async function extractPdfTextLocally(buffer: Buffer): Promise<string> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const res = await extractPdfTextRaw(pdf, { mergePages: true });
    return String(res?.text || '').replace(/\u0000/g, '').trim();
  } catch (err) {
    console.warn('[unpdf] Local PDF extraction skipped:', err instanceof Error ? err.message : err);
    return '';
  }
}

function sendGeminiError(res: express.Response, error: unknown, logPrefix: string) {
  const status = getHttpStatusFromError(error);
  const errObj = error as { message?: string };
  const detail = formatGeminiErrorMessage(status, errObj?.message || '');
  console.warn(`${logPrefix} status=${status} detail=${detail}`);
  res.status(status).json({
    error: detail,
    code: status === 429 ? 'rate_limited' : 'gemini_error',
  });
}

function sendAiError(res: express.Response, error: unknown, logPrefix: string) {
  if (error instanceof GroqApiError) {
    const detail = formatGroqErrorMessage(error);
    console.warn(`${logPrefix} groqStatus=${error.status} detail=${detail}`);
    res.status(error.status).json({
      error: detail,
      code: error.status === 429 ? 'rate_limited' : 'groq_error',
    });
    return;
  }
  if (
    error instanceof Error &&
    (error.message === 'Missing GEMINI_API_KEY' ||
      error.message === 'Missing AI API key' ||
      error.message === 'Missing GROQ_API_KEY')
  ) {
    sendMissingKeyError(res);
    return;
  }
  sendGeminiError(res, error, logPrefix);
}

type AiEngineSource = 'groq' | 'gemini';

interface AiGenerationResult {
  text: string;
  source: AiEngineSource;
  model?: string;
}

function formatEngineFailureShort(err: unknown): string {
  if (err instanceof GroqApiError) return formatGroqErrorMessage(err);
  if (err instanceof Error && err.message) return err.message;
  return 'Lỗi kết nối';
}

async function generateContentWithAiFallback(params: {
  contents: unknown;
  systemInstruction?: string;
  geminiConfig?: Record<string, unknown>;
  jsonSchemaHint?: string;
  maxTokens?: number;
}): Promise<AiGenerationResult> {
  const groqKeys = getActiveGroqApiKeys();
  const geminiKeys = getActiveGeminiApiKeys();

  const jsonMode = Boolean(
    params.jsonSchemaHint || params.geminiConfig?.responseMimeType === 'application/json'
  );
  const structuredSystemParts = [params.systemInstruction?.trim() || ''];
  if (params.jsonSchemaHint) {
    structuredSystemParts.push(
      `BẮT BUỘC chỉ trả về một JSON object hợp lệ duy nhất (không bọc \`\`\`json, không thêm lời dẫn bên ngoài JSON) đúng theo cấu trúc:\n${params.jsonSchemaHint}`
    );
  }
  const structuredSystem = structuredSystemParts.filter(Boolean).join('\n\n') || undefined;
  const { hasPdfParts } = convertContentsToGroqMessages(params.contents, params.systemInstruction);

  let groqError: unknown = null;
  if (groqKeys.length > 0 && !hasPdfParts) {
    const groqController = new AbortController();
    const groqTimeout = setTimeout(() => groqController.abort(), 32_000);
    try {
      const groqRes = await callGroqChatCompletions({
        apiKeys: groqKeys,
        systemInstruction: structuredSystem,
        contents: params.contents,
        jsonMode,
        maxTokens: params.maxTokens ?? 4096,
        signal: groqController.signal,
      });
      const text = params.jsonSchemaHint ? extractJsonText(groqRes.text) : groqRes.text.trim();
      if (text) {
        return { text, source: 'groq', model: groqRes.model };
      }
      groqError = new Error('Groq API chưa trả về nội dung.');
    } catch (err) {
      groqError = err;
      if (isUnusableGroqError(err)) {
        for (const k of groqKeys) invalidGroqKeys.add(k);
        console.warn(`[AI Groq] Disabling invalid GROQ_API_KEY (status=${(err as GroqApiError).status}).`);
      } else {
        console.warn(`[AI Groq] Failed: ${err instanceof Error ? err.message : 'error'}`);
      }
    } finally {
      clearTimeout(groqTimeout);
    }
  }

  if (geminiKeys.length > 0) {
    try {
      const geminiDeadlineMs = Date.now() + 20_000;
      const response = await callGeminiWithFallback(
        (model, abortSignal, client) =>
          client.models.generateContent({
            model,
            contents: params.contents as never,
            config: buildGeminiConfig(model, abortSignal, {
              ...(params.geminiConfig ?? {}),
              ...(params.systemInstruction ? { systemInstruction: params.systemInstruction } : {}),
            }),
          }),
        { deadlineMs: geminiDeadlineMs }
      );
      const rawGemText = typeof response.text === 'string' ? response.text.trim() : '';
      const text = params.jsonSchemaHint ? extractJsonText(rawGemText) : rawGemText;
      if (text) {
        return { text, source: 'gemini', model: 'gemini' };
      }
    } catch (gemErr) {
      if (groqError && isUnusableGeminiFallbackError(gemErr)) {
        throw groqError;
      }
      throw gemErr;
    }
  }

  if (groqError) throw groqError;
  throw new Error('Missing AI API key');
}

async function streamAiWithFallback(params: {
  res: express.Response;
  contents: unknown;
  systemInstruction?: string;
  logPrefix: string;
  emptyErrorMessage: string;
  streamEmptyErrorMessage?: string;
}): Promise<void> {
  const {
    res,
    contents,
    systemInstruction,
    logPrefix,
    emptyErrorMessage,
    streamEmptyErrorMessage,
  } = params;
  const groqKeys = getActiveGroqApiKeys();
  const candidateKeys = getActiveGeminiApiKeys();

  if (groqKeys.length === 0 && candidateKeys.length === 0) {
    sendMissingKeyError(res);
    return;
  }

  const modelsToTry = getOrderedCandidateModels();
  const overallDeadline = Date.now() + 48_000;
  const HEDGE_DELAY_MS = 3_000;
  let headersSent = false;
  let clientClosed = false;
  const activeControllers = new Set<AbortController>();
  const abortAllActive = () => {
    for (const ctrl of activeControllers) {
      try {
        ctrl.abort();
      } catch {
        // ignore abort error
      }
    }
    activeControllers.clear();
  };

  const ensureSseHeaders = () => {
    if (!headersSent) {
      headersSent = true;
      res.status(200);
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders?.();
    }
  };

  res.on('close', () => {
    if (!res.writableEnded) {
      clientClosed = true;
      abortAllActive();
    }
  });

  try {
    let fullText = '';
    let groqPrimaryError: unknown = null;
    let lastError: unknown;
    let failedStreamModel: string | undefined;
    let streamCompletedCleanly = false;
    let aiSource: AiEngineSource = 'groq';

    const { hasPdfParts } = convertContentsToGroqMessages(contents, systemInstruction);

    if (groqKeys.length > 0 && !hasPdfParts && !clientClosed) {
      const groqController = new AbortController();
      activeControllers.add(groqController);
      const groqTimer = setTimeout(() => groqController.abort(), 32_000);
      try {
        let groqStreamed = '';
        const groqRes = await streamGroqChatCompletions({
          apiKeys: groqKeys,
          systemInstruction,
          contents,
          signal: groqController.signal,
          onDelta: (delta) => {
            if (clientClosed) return;
            groqStreamed += delta;
            ensureSseHeaders();
            res.write(`data: ${JSON.stringify({ delta })}\n\n`);
          },
        });
        const text = (groqStreamed || groqRes.text).trim();
        if (text && !clientClosed) {
          fullText = text;
          aiSource = 'groq';
          streamCompletedCleanly = true;
        } else if (headersSent) {
          throw new Error(emptyErrorMessage);
        }
      } catch (groqErr) {
        groqPrimaryError = groqErr;
        lastError = groqErr;
        if (isUnusableGroqError(groqErr)) {
          for (const k of groqKeys) invalidGroqKeys.add(k);
          console.warn(
            `[AI stream Groq] Disabling invalid GROQ_API_KEY (status=${(groqErr as GroqApiError).status}).`
          );
        } else {
          console.warn(
            `[AI stream Groq] Failed (${formatEngineFailureShort(groqErr)}).`
          );
        }
        if (headersSent) {
          throw groqErr;
        }
      } finally {
        clearTimeout(groqTimer);
        activeControllers.delete(groqController);
      }
    }

    const runKeyStreamingRace = async (
      aiClient: GoogleGenAI,
      keyIndex: number
    ): Promise<{
      completed: boolean;
      hadKeyFailure: boolean;
      fatalError?: unknown;
    }> => {
      if (modelsToTry.length === 0 || clientClosed) {
        return { completed: false, hadKeyFailure: false };
      }

      return new Promise((resolveRace) => {
        let settled = false;
        let winnerClaimed = false;
        let hadKeyFailure = false;
        let fatalError: unknown = undefined;
        let launchedCount = 0;
        let finishedCount = 0;
        let hedgeTimer: ReturnType<typeof setTimeout> | null = null;

        const candidates: Array<{
          model: string;
          controller: AbortController;
          abortedAsLoser: boolean;
        }> = [];

        const clearHedgeTimer = () => {
          if (hedgeTimer) {
            clearTimeout(hedgeTimer);
            hedgeTimer = null;
          }
        };

        const finishRace = (result: {
          completed: boolean;
          hadKeyFailure: boolean;
          fatalError?: unknown;
        }) => {
          if (settled) return;
          settled = true;
          clearHedgeTimer();
          resolveRace(result);
        };

        const abortOtherCandidates = (winnerController: AbortController) => {
          for (const entry of candidates) {
            if (entry.controller !== winnerController) {
              entry.abortedAsLoser = true;
              try {
                entry.controller.abort();
              } catch {
                // ignore abort error
              }
              activeControllers.delete(entry.controller);
            }
          }
        };

        const scheduleNextHedgeIfNeeded = () => {
          clearHedgeTimer();
          if (
            settled ||
            winnerClaimed ||
            clientClosed ||
            hadKeyFailure ||
            fatalError !== undefined ||
            launchedCount >= modelsToTry.length
          ) {
            return;
          }
          const remaining = overallDeadline - Date.now();
          if (remaining <= HEDGE_DELAY_MS + 3_000) {
            return;
          }
          hedgeTimer = setTimeout(() => {
            hedgeTimer = null;
            if (!settled && !winnerClaimed && !clientClosed && launchedCount < modelsToTry.length) {
              launchCandidate(launchedCount++);
              scheduleNextHedgeIfNeeded();
            }
          }, HEDGE_DELAY_MS);
        };

        const launchCandidate = (index: number) => {
          if (settled || winnerClaimed || clientClosed || index >= modelsToTry.length) {
            return;
          }
          const model = modelsToTry[index];
          const remainingMs = overallDeadline - Date.now();
          if (remainingMs < 3_000 && lastError) {
            finishedCount++;
            if (finishedCount >= launchedCount && launchedCount >= modelsToTry.length) {
              finishRace({ completed: false, hadKeyFailure: false });
            }
            return;
          }

          const startedAt = Date.now();
          const controller = new AbortController();
          activeControllers.add(controller);
          const entry = { model, controller, abortedAsLoser: false };
          candidates.push(entry);

          const perModelCap = 22_000;
          const preHeaderTimeoutMs = Math.min(perModelCap, Math.max(3_000, remainingMs));

          void (async () => {
            let iterator: AsyncIterator<{ text?: string }> | null = null;
            let isWinner = false;
            try {
              const stream = await raceFailoverTimeout(
                aiClient.models.generateContentStream({
                  model,
                  contents: contents as never,
                  config: buildGeminiConfig(model, controller.signal, { systemInstruction }),
                }),
                preHeaderTimeoutMs,
                model,
                controller
              );
              iterator = stream[Symbol.asyncIterator]();

              while (true) {
                if (clientClosed || entry.abortedAsLoser) {
                  iterator.return?.().catch(() => {});
                  return;
                }

                const stepTimeoutMs = isWinner
                  ? 26_000
                  : Math.max(3_000, Math.min(preHeaderTimeoutMs, overallDeadline - Date.now()));
                const step = await raceFailoverTimeout(
                  iterator.next(),
                  stepTimeoutMs,
                  model,
                  controller
                );
                if (step.done) break;

                if (clientClosed || entry.abortedAsLoser) {
                  iterator.return?.().catch(() => {});
                  return;
                }

                const delta = typeof step.value?.text === 'string' ? step.value.text : '';
                if (!delta) continue;

                if (!isWinner) {
                  if (winnerClaimed) {
                    entry.abortedAsLoser = true;
                    iterator.return?.().catch(() => {});
                    return;
                  }
                  winnerClaimed = true;
                  isWinner = true;
                  clearHedgeTimer();
                  abortOtherCandidates(controller);
                  modelCooldownUntil.delete(model);
                  if (!headersSent) {
                    headersSent = true;
                    res.status(200);
                    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
                    res.setHeader('Cache-Control', 'no-cache, no-transform');
                    res.setHeader('Connection', 'keep-alive');
                    res.setHeader('X-Accel-Buffering', 'no');
                    res.flushHeaders?.();
                  }
                }

                fullText += delta;
                res.write(`data: ${JSON.stringify({ delta })}\n\n`);
              }

              if (isWinner && fullText.trim()) {
                modelCooldownUntil.delete(model);
                streamCompletedCleanly = true;
                finishRace({ completed: true, hadKeyFailure: false });
                return;
              }

              if (!winnerClaimed && !entry.abortedAsLoser) {
                const emptyErr = new Error(emptyErrorMessage);
                (emptyErr as { status?: number }).status = 502;
                lastError = emptyErr;
              }
            } catch (err) {
              iterator?.return?.().catch(() => {});
              if (clientClosed || entry.abortedAsLoser) {
                return;
              }

              lastError = err;
              const elapsedMs = Date.now() - startedAt;
              const status = getHttpStatusFromError(err);
              console.warn(
                `[Gemini stream fallback] keyIndex=${keyIndex} model=${model} status=${status} elapsed=${elapsedMs}ms headersSent=${headersSent}`
              );

              if (isWinner || headersSent) {
                failedStreamModel = model;
                finishRace({ completed: false, hadKeyFailure: false });
                return;
              }

              const hasMorePotential =
                launchedCount < modelsToTry.length ||
                candidates.some((c) => c !== entry && !c.abortedAsLoser);

              if (isRetryableGeminiStatus(status, err, hasMorePotential)) {
                markModelCooldown(model, status);
              }

              const isKeyFailure = status === 400 || status === 401 || status === 403;
              if (isKeyFailure) {
                hadKeyFailure = true;
                abortOtherCandidates(controller);
                finishRace({ completed: false, hadKeyFailure: true, fatalError: err });
                return;
              }

              if (!isRetryableGeminiStatus(status, err, hasMorePotential)) {
                fatalError = err;
                abortOtherCandidates(controller);
                finishRace({ completed: false, hadKeyFailure: false, fatalError: err });
                return;
              }
            } finally {
              activeControllers.delete(controller);
              finishedCount++;
              if (!settled && !winnerClaimed) {
                if (launchedCount < modelsToTry.length) {
                  clearHedgeTimer();
                  launchCandidate(launchedCount++);
                  scheduleNextHedgeIfNeeded();
                } else if (finishedCount >= launchedCount) {
                  finishRace({ completed: false, hadKeyFailure });
                }
              } else if (!settled && isWinner && !streamCompletedCleanly) {
                finishRace({ completed: false, hadKeyFailure: false });
              }
            }
          })();
        };

        launchCandidate(launchedCount++);
        scheduleNextHedgeIfNeeded();
      });
    };

    if (!streamCompletedCleanly && candidateKeys.length > 0 && !clientClosed) {
      keyLoop: for (let k = 0; k < candidateKeys.length; k++) {
        const aiClient = createGeminiClientForKey(candidateKeys[k]);
        const hasMoreKeys = k < candidateKeys.length - 1;
        const raceResult = await runKeyStreamingRace(aiClient, k);

        if (raceResult.completed) {
          aiSource = 'gemini';
          break keyLoop;
        }
        if (clientClosed || headersSent) {
          break keyLoop;
        }
        if (raceResult.fatalError !== undefined) {
          lastError = raceResult.fatalError;
        }
        if (raceResult.hadKeyFailure) {
          if (isUnusableGeminiFallbackError(raceResult.fatalError ?? lastError)) {
            invalidGeminiKeys.add(candidateKeys[k]);
          }
          if (hasMoreKeys) {
            continue keyLoop;
          }
          break keyLoop;
        }
        break keyLoop;
      }
    }

    if (clientClosed) return;

    const remainingGeminiKeys = getActiveGeminiApiKeys();
    if (
      remainingGeminiKeys.length > 0 &&
      (!streamCompletedCleanly || !fullText.trim()) &&
      modelsToTry.length > 0 &&
      overallDeadline - Date.now() >= 4_000
    ) {
      try {
        const nonStreamResp = await callGeminiWithFallback(
          (model, abortSignal, client) =>
            client.models.generateContent({
              model,
              contents: contents as never,
              config: buildGeminiConfig(model, abortSignal, { systemInstruction }),
            }),
          { deprioritizeModel: failedStreamModel, deadlineMs: overallDeadline }
        );
        const nonStreamText =
          typeof nonStreamResp.text === 'string' ? nonStreamResp.text.trim() : '';
        if (nonStreamText && !clientClosed) {
          fullText = nonStreamText;
          aiSource = 'gemini';
          streamCompletedCleanly = true;
          if (!headersSent) {
            headersSent = true;
            res.status(200);
            res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-transform');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');
            res.flushHeaders?.();
            res.write(`data: ${JSON.stringify({ delta: nonStreamText })}\n\n`);
          } else {
            res.write(`data: ${JSON.stringify({ replace: nonStreamText })}\n\n`);
          }
        }
      } catch (fallbackErr) {
        lastError = fallbackErr;
      }
    }

    if (clientClosed) return;

    const finalText = fullText.trim();
    if (!finalText) {
      if (!headersSent) {
        if (groqPrimaryError && (!lastError || isUnusableGeminiFallbackError(lastError))) {
          throw groqPrimaryError;
        }
        if (
          groqKeys.length === 0 &&
          (!lastError ||
            isUnusableGeminiFallbackError(lastError) ||
            (lastError instanceof Error && lastError.message === 'Missing GEMINI_API_KEY'))
        ) {
          sendMissingKeyError(res);
          return;
        }
        if (lastError) {
          throw lastError;
        }
        res.status(502).json({
          error: emptyErrorMessage,
          code: 'empty_response',
          exhaustedFallback: true,
        });
        return;
      }
      res.write(
        `data: ${JSON.stringify({ error: streamEmptyErrorMessage || emptyErrorMessage })}\n\n`
      );
      res.end();
      return;
    }

    res.write(
      `data: ${JSON.stringify({
        done: true,
        text: finalText,
        source: aiSource,
      })}\n\n`
    );
    res.end();
  } catch (error) {
    let status: number;
    let detail: string;
    let code: string;
    if (error instanceof GroqApiError) {
      status = error.status;
      detail = formatGroqErrorMessage(error);
      code = status === 429 ? 'rate_limited' : 'groq_error';
    } else if (
      error instanceof Error &&
      (error.message === 'Missing GEMINI_API_KEY' ||
        error.message === 'Missing AI API key' ||
        error.message === 'Missing GROQ_API_KEY')
    ) {
      if (!headersSent) {
        sendMissingKeyError(res);
        return;
      }
      status = 503;
      detail = 'Chưa cấu hình khóa API AI hợp lệ (GROQ_API_KEY hoặc GEMINI_API_KEY).';
      code = 'missing_api_key';
    } else {
      status = getHttpStatusFromError(error);
      const errObj = error as { message?: string };
      detail = formatGeminiErrorMessage(status, errObj?.message || '');
      code = status === 429 ? 'rate_limited' : 'gemini_error';
    }
    console.warn(`${logPrefix} status=${status} code=${code} detail=${detail}`);
    if (!headersSent) {
      res.status(status).json({ error: detail, code, exhaustedFallback: true });
    } else if (!clientClosed) {
      res.write(`data: ${JSON.stringify({ error: detail })}\n\n`);
      res.end();
    }
  } finally {
    abortAllActive();
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use('/assets/aistudio', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'schoolhub',
      developmentAdminMode: DEVELOPMENT_ADMIN_MODE,
    });
  });

  app.get('/api/ai/status', (_req, res) => {
    const groqConfigured = getActiveGroqApiKeys().length > 0;
    const geminiConfigured = getActiveGeminiApiKeys().length > 0;
    res.json({
      groqConfigured,
      geminiConfigured,
    });
  });

  const nominatimCache = createTtlCache<NominatimPlace[]>(20 * 60 * 1000);
  const nominatimReverseCache = createTtlCache<NominatimPlace | null>(20 * 60 * 1000);
  const pubchemCache = createTtlCache<PubChemCompound>(30 * 60 * 1000);
  const countriesCache = createTtlCache<CountryProfile[]>(60 * 60 * 1000);
  const worldBankCache = createTtlCache<WorldBankSeries>(60 * 60 * 1000);
  const wikipediaCache = createTtlCache<WikipediaSummaryResult>(30 * 60 * 1000);
  const gutendexSearchCache = createTtlCache<GutendexBookResult[]>(20 * 60 * 1000);
  const gutendexTextCache = createTtlCache<{ id: number; title: string; text: string; truncated: boolean }>(60 * 60 * 1000, 40);
  const academicSearchCache = createTtlCache<{ results: AcademicPaperResult[]; warnings: string[] }>(20 * 60 * 1000);
  const nasaApodCache = createTtlCache<NasaApodResult>(60 * 60 * 1000);
  const nasaNeoCache = createTtlCache<{ date: string; count: number; items: NasaNeoItem[] }>(30 * 60 * 1000);
  const nasaMediaCache = createTtlCache<NasaMediaItem[]>(30 * 60 * 1000);
  const lexiconCache = createTtlCache<LexiconLookupResult>(30 * 60 * 1000);

  const getNasaApiKey = () =>
    normalizeCandidateApiKey(process.env.NASA_API_KEY) || 'DEMO_KEY';

  // 1. OpenStreetMap Nominatim
  app.get('/api/external/nominatim', async (req, res) => {
    const q = String(req.query.q || '').trim();
    const limit = Number(req.query.limit || 8);
    if (!q) {
      res.status(400).json({ error: 'Thiếu từ khóa địa danh cần tìm kiếm.' });
      return;
    }
    try {
      const results = await searchNominatim(q, limit, { cache: nominatimCache });
      res.setHeader('Cache-Control', 'public, max-age=1200');
      res.json({ query: q, results });
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : 'Không thể kết nối OpenStreetMap Nominatim.',
      });
    }
  });

  app.get('/api/external/nominatim/reverse', async (req, res) => {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      res.status(400).json({ error: 'Tọa độ lat/lon không hợp lệ.' });
      return;
    }
    try {
      const place = await reverseNominatim(lat, lon, { cache: nominatimReverseCache });
      res.setHeader('Cache-Control', 'public, max-age=1200');
      res.json({ place });
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : 'Không thể giải mã tọa độ Nominatim.',
      });
    }
  });

  // 2. PubChem API
  app.get('/api/external/pubchem', async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) {
      res.status(400).json({ error: 'Vui lòng nhập tên hợp chất, công thức hoặc CID.' });
      return;
    }
    try {
      const compound = await lookupPubChemCompound(q, { cache: pubchemCache });
      if (!compound) {
        res.status(404).json({ error: `Không tìm thấy hợp chất "${q}" trên PubChem.` });
        return;
      }
      res.setHeader('Cache-Control', 'public, max-age=1800');
      res.json({ compound });
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : 'Không thể kết nối PubChem API.',
      });
    }
  });

  app.get('/api/external/pubchem/image/:cid', async (req, res) => {
    const cid = Number(req.params.cid);
    if (!Number.isFinite(cid) || cid <= 0) {
      res.status(400).send('Invalid CID');
      return;
    }
    try {
      const upstream = await fetch(
        `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${Math.trunc(cid)}/PNG?image_size=large`
      );
      if (!upstream.ok) {
        res.status(upstream.status).send('Image unavailable');
        return;
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(buf);
    } catch {
      res.status(502).send('Failed to fetch structure PNG');
    }
  });

  // 3. REST Countries API
  app.get('/api/external/countries', async (req, res) => {
    const q = String(req.query.q || '').trim();
    const region = String(req.query.region || '').trim();
    try {
      const results = await searchRestCountries(q, region, { cache: countriesCache });
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.json({ query: q, region, results });
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : 'Không thể kết nối REST Countries API.',
      });
    }
  });

  // 4. World Bank API
  app.get('/api/external/worldbank', async (req, res) => {
    const country = String(req.query.country || 'VNM').trim();
    const indicator = String(req.query.indicator || 'NY.GDP.PCAP.CD').trim();
    try {
      const series = await fetchWorldBankIndicator(country, indicator, { cache: worldBankCache });
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.json({ series });
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : 'Không thể kết nối World Bank API.',
      });
    }
  });

  app.get('/api/external/worldbank/compare', async (req, res) => {
    const rawCountries = String(req.query.countries || 'VNM,JPN,SGP').trim();
    const indicator = String(req.query.indicator || 'NY.GDP.PCAP.CD').trim();
    const countryCodes = rawCountries
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      const comparison = await fetchWorldBankMultiCountry(countryCodes, indicator, {
        cache: worldBankCache,
      });
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.json({ comparison });
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : 'Không thể so sánh dữ liệu World Bank.',
      });
    }
  });

  // 5. Wikipedia REST API
  app.get('/api/external/wikipedia', async (req, res) => {
    const q = String(req.query.q || '').trim();
    const lang = String(req.query.lang || 'vi').trim() === 'en' ? 'en' : 'vi';
    const rawContext = String(req.query.context || '').trim().toLowerCase();
    const context =
      rawContext === 'literature' ||
      rawContext === 'history' ||
      rawContext === 'geography' ||
      rawContext === 'math'
        ? rawContext
        : undefined;
    if (!q) {
      res.status(400).json({ error: 'Vui lòng nhập chủ đề cần tra cứu trên Wikipedia.' });
      return;
    }
    try {
      const summary = await lookupWikipediaSummary(q, lang, { cache: wikipediaCache, context });
      if (!summary) {
        res.status(404).json({ error: `Không tìm thấy bài viết Wikipedia cho "${q}".` });
        return;
      }
      res.setHeader('Cache-Control', 'public, max-age=1800');
      res.json({ summary });
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : 'Không thể kết nối Wikipedia REST API.',
      });
    }
  });

  // 6. NASA Open APIs
  app.get('/api/external/nasa/apod', async (req, res) => {
    const date = String(req.query.date || '').trim();
    try {
      const apod = await fetchNasaApod(date, {
        cache: nasaApodCache,
        nasaApiKey: getNasaApiKey(),
      });
      if (!apod) {
        res.status(404).json({ error: 'Không có dữ liệu NASA APOD cho ngày đã chọn.' });
        return;
      }
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.json({ apod });
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : 'Không thể kết nối NASA APOD API.',
      });
    }
  });

  app.get('/api/external/nasa/neo', async (req, res) => {
    const date = String(req.query.date || '').trim();
    try {
      const feed = await fetchNasaNeoFeed(date, {
        cache: nasaNeoCache,
        nasaApiKey: getNasaApiKey(),
      });
      res.setHeader('Cache-Control', 'public, max-age=1800');
      res.json(feed);
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : 'Không thể kết nối NASA NeoWs API.',
      });
    }
  });

  app.get('/api/external/nasa/media', async (req, res) => {
    const q = String(req.query.q || 'james webb').trim();
    try {
      const items = await searchNasaMedia(q, { cache: nasaMediaCache });
      res.setHeader('Cache-Control', 'public, max-age=1800');
      res.json({ query: q, items });
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : 'Không thể kết nối NASA Images API.',
      });
    }
  });

  // 7. Datamuse + Wiktionary Lexicon (replaces Free Dictionary API)
  app.get('/api/external/lexicon', async (req, res) => {
    const word = String(req.query.word || req.query.q || '').trim();
    const lang = String(req.query.lang || 'en').trim() === 'vi' ? 'vi' : 'en';
    const mode = String(req.query.mode || 'word').trim() === 'meaning' ? 'meaning' : 'word';
    if (!word) {
      res.status(400).json({ error: 'Vui lòng nhập từ vựng hoặc mô tả nghĩa cần tra cứu.' });
      return;
    }
    try {
      const entry = await lookupLexiconWord(word, { lang, mode, cache: lexiconCache });
      res.setHeader('Cache-Control', 'public, max-age=1800');
      res.json({ entry });
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : 'Không thể kết nối Datamuse / Wiktionary API.',
      });
    }
  });

  // 8. Gutendex / Project Gutenberg + Crossref / arXiv Library Extensions
  app.get('/api/library/gutendex-search', async (req, res) => {
    const q = String(req.query.q || '').trim();
    const lang = String(req.query.lang || '').trim();
    try {
      const results = await searchGutendexBooks(q, lang, { cache: gutendexSearchCache });
      res.setHeader('Cache-Control', 'public, max-age=1200');
      res.json({ query: q, lang, results });
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : 'Không thể kết nối Gutendex (Project Gutenberg).',
      });
    }
  });

  app.get('/api/library/gutendex-text', async (req, res) => {
    const id = Number(req.query.id);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: 'Mã sách Project Gutenberg không hợp lệ.' });
      return;
    }
    try {
      const excerpt = await fetchGutendexExcerpt(id, { cache: gutendexTextCache });
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.json(excerpt);
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : 'Không thể tải nội dung sách Project Gutenberg.',
      });
    }
  });

  app.get('/api/library/academic-search', async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) {
      res.status(400).json({ error: 'Vui lòng nhập từ khóa nghiên cứu, DOI hoặc chủ đề STEM.' });
      return;
    }
    const rawSrc = String(req.query.source || 'all');
    const source = rawSrc === 'crossref' || rawSrc === 'arxiv' ? rawSrc : 'all';
    try {
      const payload = await searchAcademicPapers(q, source, { cache: academicSearchCache });
      res.setHeader('Cache-Control', 'public, max-age=1200');
      res.json({ query: q, source, ...payload });
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : 'Không thể kết nối Crossref / arXiv API.',
      });
    }
  });

  const librarySearchCache = createExternalBookCache<ExternalSearchResponse>();
  const libraryIsbnCache = createExternalBookCache<ExternalIsbnLookupResponse>();

  const getGoogleBooksApiKey = () =>
    normalizeCandidateApiKey(process.env.GOOGLE_BOOKS_API_KEY) || undefined;

  app.get('/api/library/external-search', async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (!q) {
      res.status(400).json({ error: 'Vui lòng nhập từ khóa, nhan đề, tác giả hoặc ISBN để tra cứu.' });
      return;
    }
    const sourceRaw = String(req.query.source || 'all');
    const source =
      sourceRaw === 'google_books' || sourceRaw === 'open_library' ? sourceRaw : 'all';
    const modeRaw = String(req.query.mode || 'all');
    const mode =
      modeRaw === 'title' || modeRaw === 'author' || modeRaw === 'isbn' ? modeRaw : 'all';
    const lang = String(req.query.lang || '').trim();
    const maxResults = Number(req.query.maxResults || 15);

    try {
      const payload = await searchExternalBooks(
        { q, source, mode, lang, maxResults },
        { cache: librarySearchCache, googleApiKey: getGoogleBooksApiKey() }
      );
      res.setHeader('Cache-Control', 'public, max-age=600');
      res.json(payload);
    } catch (error) {
      res.status(502).json({
        error: error instanceof Error ? error.message : 'Không thể kết nối Google Books / Open Library.',
      });
    }
  });

  app.get('/api/library/isbn/:isbn', async (req, res) => {
    const rawIsbn = String(req.params.isbn || '').trim();
    try {
      const payload = await lookupExternalBookByIsbn(rawIsbn, {
        cache: libraryIsbnCache,
        googleApiKey: getGoogleBooksApiKey(),
      });
      if (!payload.found && payload.warnings?.[0]?.includes('không hợp lệ')) {
        res.status(400).json(payload);
        return;
      }
      res.setHeader('Cache-Control', 'public, max-age=900');
      res.json(payload);
    } catch (error) {
      res.status(502).json({
        found: false,
        isbn: rawIsbn,
        result: null,
        sources: [],
        warnings: [error instanceof Error ? error.message : 'Lỗi tra cứu ISBN.'],
      });
    }
  });

  app.post('/api/library/enrich-book', async (req, res) => {
    const body = req.body ?? {};
    const isbn = typeof body.isbn === 'string' ? body.isbn : undefined;
    const title = typeof body.title === 'string' ? body.title : undefined;
    const author = typeof body.author === 'string' ? body.author : undefined;

    if (!isbn && !title) {
      res.status(400).json({ error: 'Cần cung cấp tối thiểu ISBN hoặc tên sách để làm giàu dữ liệu.' });
      return;
    }

    try {
      const payload = await enrichBookFromExternalApis(
        { isbn, title, author },
        { googleApiKey: getGoogleBooksApiKey() }
      );
      res.json(payload);
    } catch (error) {
      res.status(502).json({
        found: false,
        match: null,
        sources: [],
        warnings: [error instanceof Error ? error.message : 'Lỗi kết nối dịch vụ dữ liệu sách.'],
      });
    }
  });



  // Read-only system auth-mode configuration (only configurable via server environment)
  app.get('/api/system/auth-mode', (_req, res) => {
    res.json({
      developmentAdminMode: DEVELOPMENT_ADMIN_MODE,
      defaultAuthenticatedRole: DEVELOPMENT_ADMIN_MODE ? 'admin' : 'student',
      configSource: 'server_env',
      editableFromBrowser: false,
    });
  });

  app.all('/api/system/auth-mode', (_req, res) => {
    res.status(403).json({
      error: 'Không được phép thay đổi DEVELOPMENT_ADMIN_MODE từ trình duyệt. Vui lòng cấu hình ở biến môi trường máy chủ.',
    });
  });

  app.post('/api/ai/chat', async (req, res) => {
    const body = req.body ?? {};
    const normalizedTurns = normalizeCopilotChatTurns(body);
    const user = body.user;
    const effectiveRole = resolveBackendApiEffectiveRole(user?.role, DEVELOPMENT_ADMIN_MODE);
    const contextSummary = body.contextSummary;

    try {
      if (normalizedTurns.length === 0) {
        res.status(400).json({ error: 'Thiếu nội dung câu hỏi.' });
        return;
      }

      if (!hasAnyConfiguredAiKey()) {
        sendMissingKeyError(res);
        return;
      }

      const systemInstruction = buildCopilotChatSystemInstruction({
        displayName: user?.displayName,
        effectiveRole,
        contextSummary,
      });

      const result = await generateContentWithAiFallback({
        contents: normalizedTurns,
        systemInstruction,
      });

      const text = result.text.trim();
      if (!text) {
        res.status(502).json({
          error: 'Trợ lý AI chưa trả về nội dung phù hợp. Vui lòng thử lại.',
          code: 'empty_response',
        });
        return;
      }

      res.json({
        text,
        source: result.source,
      });
    } catch (error) {
      sendAiError(res, error, 'AI chat error:');
    }
  });

  app.post('/api/ai/chat-stream', async (req, res) => {
    const body = req.body ?? {};
    const normalizedTurns = normalizeCopilotChatTurns(body);
    if (normalizedTurns.length === 0) {
      res.status(400).json({ error: 'Thiếu nội dung câu hỏi.' });
      return;
    }

    const user = body.user;
    const effectiveRole = resolveBackendApiEffectiveRole(user?.role, DEVELOPMENT_ADMIN_MODE);
    const systemInstruction = buildCopilotChatSystemInstruction({
      displayName: user?.displayName,
      effectiveRole,
      contextSummary: body.contextSummary,
    });

    await streamAiWithFallback({
      res,
      contents: normalizedTurns,
      systemInstruction,
      logPrefix: 'AI chat-stream error:',
      emptyErrorMessage: 'Trợ lý AI chưa trả về nội dung phù hợp. Vui lòng thử lại.',
    });
  });

  app.post('/api/ai/analyze', async (req, res) => {
    const body = req.body ?? {};
    const safeStats =
      typeof (body.stats ?? body.metrics) === 'object' && (body.stats ?? body.metrics) !== null
        ? body.stats ?? body.metrics
        : {};
    const focus = String(body.focus ?? body.scope ?? 'Toàn trường');
    const role = resolveBackendApiEffectiveRole(body.role, DEVELOPMENT_ADMIN_MODE);
    const question =
      typeof (body.question ?? body.prompt) === 'string'
        ? String(body.question ?? body.prompt).trim()
        : '';

    try {
      if (!hasAnyConfiguredAiKey()) {
        sendMissingKeyError(res);
        return;
      }

      const systemInstruction = buildAnalyticsAnalyzeSystemInstruction();
      const prompt = buildAnalyticsAnalyzePrompt({
        focus,
        role,
        question,
        stats: safeStats,
      });

      const result = await generateContentWithAiFallback({
        contents: prompt,
        systemInstruction,
      });

      const text = result.text.trim();
      if (!text) {
        res.status(502).json({
          error: 'Trợ lý AI chưa trả về báo cáo phân tích. Vui lòng thử lại.',
          code: 'empty_response',
        });
        return;
      }

      res.json({
        text,
        source: result.source,
      });
    } catch (error) {
      sendAiError(res, error, 'AI analyze error:');
    }
  });

  app.post('/api/ai/analyze-stream', async (req, res) => {
    const body = req.body ?? {};
    const safeStats =
      typeof (body.stats ?? body.metrics) === 'object' && (body.stats ?? body.metrics) !== null
        ? body.stats ?? body.metrics
        : {};
    const focus = String(body.focus ?? body.scope ?? 'Toàn trường');
    const role = resolveBackendApiEffectiveRole(body.role, DEVELOPMENT_ADMIN_MODE);
    const question =
      typeof (body.question ?? body.prompt) === 'string'
        ? String(body.question ?? body.prompt).trim()
        : '';

    const systemInstruction = buildAnalyticsAnalyzeSystemInstruction();
    const prompt = buildAnalyticsAnalyzePrompt({
      focus,
      role,
      question,
      stats: safeStats,
    });

    await streamAiWithFallback({
      res,
      contents: prompt,
      systemInstruction,
      logPrefix: 'AI analyze-stream error:',
      emptyErrorMessage: 'Trợ lý AI chưa trả về báo cáo phân tích. Vui lòng thử lại.',
    });
  });

  function decodeHtmlEntitiesSimple(input: string): string {
    return input
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(Number(dec) || 32))
      .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCharCode(parseInt(hex, 16) || 32));
  }

  function stripHtmlTagsSimple(html: string): string {
    return decodeHtmlEntitiesSimple(
      html
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<\/?(strong|b|em|i|u|span|a|sup|sub)[^>]*>/gi, '')
        .replace(/<[^>]+>/g, ' ')
    )
      .replace(/\s+/g, ' ')
      .trim();
  }

  async function extractStructuredDocxText(buffer: Buffer): Promise<string> {
    try {
      const htmlRes = await mammoth.convertToHtml({ buffer });
      const html = htmlRes.value || '';
      if (!html.trim()) {
        const raw = await mammoth.extractRawText({ buffer });
        return raw.value.trim();
      }

      const blocks: string[] = [];
      // Replace each <table>...</table> with structured pipe-delimited rows in document order
      const tablePlaceholders: string[] = [];
      const htmlWithPlaceholders = html.replace(/<table[\s\S]*?<\/table>/gi, (tableHtml) => {
        const rows: string[] = [];
        const trMatches = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];
        for (const tr of trMatches) {
          const cells = tr.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || [];
          const cellTexts = cells.map((c) => stripHtmlTagsSimple(c));
          if (cellTexts.some((t) => t.length > 0)) {
            rows.push(`| ${cellTexts.join(' | ')} |`);
          }
        }
        const idx = tablePlaceholders.length;
        tablePlaceholders.push(rows.join('\n'));
        return `<p>__TABLE_PLACEHOLDER_${idx}__</p>`;
      });

      const blockRegex = /<(h[1-6]|p|li)[^>]*>([\s\S]*?)<\/\1>/gi;
      let match: RegExpExecArray | null;
      while ((match = blockRegex.exec(htmlWithPlaceholders)) !== null) {
        const tag = match[1].toLowerCase();
        const rawInner = match[2];
        const placeholderMatch = rawInner.match(/^__TABLE_PLACEHOLDER_(\d+)__$/);
        if (placeholderMatch) {
          const tableText = tablePlaceholders[Number(placeholderMatch[1])];
          if (tableText) blocks.push(tableText);
          continue;
        }
        const cleaned = stripHtmlTagsSimple(rawInner);
        if (!cleaned) continue;
        if (tag === 'li') {
          blocks.push(`- ${cleaned}`);
        } else {
          blocks.push(cleaned);
        }
      }

      const structured = blocks.join('\n').trim();
      if (structured.length > 0) return structured;
    } catch (err) {
      console.warn('mammoth.convertToHtml fallback to extractRawText:', err);
    }

    const fallback = await mammoth.extractRawText({ buffer });
    return fallback.value.trim();
  }

  app.post('/api/ai/parse-rules', async (req, res) => {
    const body = req.body ?? {};
    const fileName = String(body.fileName || 'noi-quy.txt');
    const mimeType = String(body.mimeType || 'text/plain');
    const fileBase64 = typeof body.fileBase64 === 'string' ? body.fileBase64 : '';
    let extractedText = typeof body.extractedText === 'string' ? body.extractedText.trim() : '';

    try {
      if (
        !extractedText &&
        fileBase64 &&
        (fileName.toLowerCase().endsWith('.docx') ||
          mimeType.includes('wordprocessingml'))
      ) {
        const buffer = Buffer.from(fileBase64, 'base64');
        extractedText = await extractStructuredDocxText(buffer);
      } else if (
        !extractedText &&
        fileBase64 &&
        (fileName.toLowerCase().endsWith('.pdf') || mimeType === 'application/pdf')
      ) {
        const buffer = Buffer.from(fileBase64.replace(/^data:[^;]+;base64,/, ''), 'base64');
        extractedText = await extractPdfTextLocally(buffer);
      }

      if (!extractedText && !fileBase64) {
        res.status(400).json({ error: 'Vui lòng cung cấp nội dung văn bản hoặc tệp .docx/.pdf để trích xuất.' });
        return;
      }

      if (!hasAnyConfiguredAiKey()) {
        sendMissingKeyError(res);
        return;
      }

      if (
        mimeType === 'application/pdf' &&
        !extractedText &&
        getActiveGeminiApiKeys().length === 0
      ) {
        res.status(422).json({
          error: 'Tệp PDF này là bản scan ảnh chưa có lớp chữ để trích xuất văn bản trực tiếp. Vui lòng dùng file PDF có lớp chữ, .docx/.txt hoặc copy nội dung dán vào.',
        });
        return;
      }

      const instructions = [
        'Bạn là chuyên gia phân tích văn bản Nội quy & Quy định Thi đua Trường học Việt Nam.',
        'Hãy đọc toàn bộ văn bản (kể cả văn bản dạng đoạn văn, điều khoản, danh sách gạch đầu dòng hoặc bảng `| cột |`) và trích xuất đầy đủ các tiêu chí thành JSON theo schema.',
        'QUY TẮC BẮT BUỘC:',
        '1. ĐIỂM CỘNG / ĐIỂM TRỪ: CHỈ điền `points` nếu tài liệu CÓ GHI RÕ SỐ ĐIỂM (cộng/trừ hoặc bảng điểm). Nếu tài liệu KHÔNG ghi điểm cụ thể, BẮT BUỘC đặt `pointsSpecified: false` và `points: null`. TUYỆT ĐỐI KHÔNG tự bịa hay suy đoán số điểm.',
        '2. LOẠI (`type`): chỉ nhận "violation" (vi phạm / hành vi bị trừ điểm / điều cấm / nhắc nhở nề nếp) hoặc "achievement" (thành tích / việc làm tốt / điểm cộng / thi đua / khen thưởng). Nếu có điểm: "violation" dùng số ÂM (VD: -5), "achievement" dùng số DƯƠNG (VD: 10).',
        '3. PHÂN LOẠI VINH DANH (`isHonor`):',
        '   - Đặt `isHonor: true` (Vinh danh) khi tiêu chí mang tính khen thưởng, tuyên dương, biểu dương trước cờ, nêu gương, trao danh hiệu, giấy khen, cờ thi đua, bảng vàng, hoặc hành động đẹp tiêu biểu (VD: nhặt được của rơi, đạt giải học sinh giỏi, giúp đỡ bạn vượt khó, lớp cờ đỏ xuất sắc...).',
        '   - Đặt `isHonor: false` (Không vinh danh) đối với tất cả tiêu chí vi phạm/trừ điểm HOẶC các tiêu chí nề nếp thường kỳ bình thường không gắn danh hiệu/vinh danh (VD: đi học đúng giờ, trực nhật đầy đủ hàng ngày).',
        '   - Nếu có ghi hình thức khen thưởng/vinh danh cụ thể (VD: "Tuyên dương dưới cờ", "Giấy khen Hiệu trưởng", "Cờ thi đua tuần"), ghi ngắn gọn vào `honorNote`; nếu không, để chuỗi rỗng "".',
        '4. PHẠM VI (`target`): "individual" (cá nhân học sinh), "class" (tập thể lớp), hoặc "group" (tổ/nhóm).',
        '5. MỨC ĐỘ (`severity`): nếu phân định được mức độ thì dùng "Nhẹ", "Trung bình" hoặc "Nghiêm trọng"; nếu không rõ bỏ trống "".',
        '6. Tên tiêu chí (`name`) ngắn gọn, rõ nghĩa (tối đa ~120 ký tự), phần mô tả hành vi chi tiết giữ trong `behavior` và `description`.',
      ].join('\n');

      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
        { text: instructions },
      ];

      if (extractedText) {
        parts.push({ text: `Nội dung văn bản nội quy (${fileName}):\n${extractedText}` });
      } else if (mimeType === 'application/pdf' && fileBase64) {
        parts.push({
          inlineData: {
            mimeType: 'application/pdf',
            data: fileBase64,
          },
        });
      }

      const result = await generateContentWithAiFallback({
        contents: [{ role: 'user', parts }],
        jsonSchemaHint:
          '{"summary": string, "criteria": [{"group": string, "name": string, "description": string, "behavior": string, "type": "violation" | "achievement", "pointsSpecified": boolean, "points": number | null, "isHonor": boolean, "honorNote"?: string, "severity"?: "Nhẹ" | "Trung bình" | "Nghiêm trọng" | "", "target": "individual" | "class" | "group", "condition"?: string, "sourceClause"?: string}]}',
        geminiConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              criteria: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    group: { type: Type.STRING },
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                    behavior: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ['violation', 'achievement'] },
                    pointsSpecified: { type: Type.BOOLEAN },
                    points: { type: Type.NUMBER, nullable: true },
                    isHonor: { type: Type.BOOLEAN },
                    honorNote: { type: Type.STRING },
                    severity: { type: Type.STRING, enum: ['Nhẹ', 'Trung bình', 'Nghiêm trọng'], nullable: true },
                    target: { type: Type.STRING, enum: ['individual', 'class', 'group'] },
                    condition: { type: Type.STRING },
                    sourceClause: { type: Type.STRING },
                  },
                  required: [
                    'group',
                    'name',
                    'description',
                    'behavior',
                    'type',
                    'pointsSpecified',
                    'isHonor',
                    'target',
                  ],
                },
              },
            },
            required: ['summary', 'criteria'],
          },
        },
      });

      const mergedCriteria: Array<Record<string, unknown>> = [];
      const seenCriteriaKeys = new Set<string>();
      let summaryText = '';

      try {
        const parsed = JSON.parse(extractJsonText(result.text) || '{}') as {
          summary?: string;
          criteria?: Array<Record<string, unknown>>;
        };
        if (parsed.summary && String(parsed.summary).trim()) {
          summaryText = String(parsed.summary).trim();
        }
        const items = Array.isArray(parsed.criteria) ? parsed.criteria : [];
        for (const item of items) {
          if (!item || typeof item !== 'object') continue;
          const type: 'violation' | 'achievement' =
            item.type === 'achievement' ? 'achievement' : 'violation';
          const name = String(item.name || '').trim();
          const behavior = String(item.behavior || item.description || '').trim();
          const dedupeKey = `${type}:${name.toLowerCase().replace(/\s+/g, ' ')}`;
          if (!name || seenCriteriaKeys.has(dedupeKey)) continue;
          seenCriteriaKeys.add(dedupeKey);

          const severityRaw = String(item.severity || '').trim();
          const severity =
            severityRaw === 'Nhẹ' || severityRaw === 'Trung bình' || severityRaw === 'Nghiêm trọng'
              ? severityRaw
              : undefined;
          const honorNote = item.honorNote ? String(item.honorNote).trim() : '';
          const isHonor = type === 'violation' ? false : Boolean(item.isHonor);
          const idx = mergedCriteria.length;
          mergedCriteria.push({
            tempId: `AI-${Date.now().toString().slice(-4)}-${idx + 1}`,
            group: String(item.group || 'Quy định chung').trim() || 'Quy định chung',
            name: name || `Tiêu chí ${idx + 1}`,
            description: String(item.description || behavior).trim(),
            behavior: behavior || name,
            type,
            pointsSpecified: Boolean(item.pointsSpecified && typeof item.points === 'number'),
            points:
              item.pointsSpecified && typeof item.points === 'number' && Number.isFinite(item.points)
                ? type === 'violation'
                  ? -Math.abs(item.points)
                  : Math.abs(item.points)
                : null,
            isHonor,
            ...(honorNote ? { honorNote } : {}),
            ...(severity ? { severity } : {}),
            target:
              item.target === 'class' || item.target === 'group' ? item.target : 'individual',
            condition: item.condition ? String(item.condition).trim() : undefined,
            sourceClause: item.sourceClause ? String(item.sourceClause).trim() : undefined,
            confidence: 0.92,
            selected: true,
          });
        }
      } catch {
        // return empty list if response was not valid JSON
      }

      res.json({
        summary:
          summaryText ||
          `Đã trích xuất ${mergedCriteria.length} tiêu chí nháp từ tài liệu.`,
        extractedText,
        criteria: mergedCriteria,
        source: result.source,
      });
    } catch (error) {
      const isPdfUpload = fileName.toLowerCase().endsWith('.pdf') || mimeType === 'application/pdf';
      if (isPdfUpload && !extractedText) {
        res.status(422).json({
          error: 'Tệp PDF này là bản scan ảnh chưa có lớp chữ để trích xuất trực tiếp. Vui lòng dùng file PDF có lớp chữ, .docx/.txt hoặc copy nội dung dán vào.',
        });
        return;
      }
      sendAiError(res, error, 'AI parse-rules error:');
    }
  });

  app.post('/api/ai/emulation-assist', async (req, res) => {
    const body = req.body ?? {};
    const mode = String(body.mode || 'summary');
    const role = resolveBackendApiEffectiveRole(body.role || 'principal', DEVELOPMENT_ADMIN_MODE);
    const customPrompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    const scopeData =
      typeof body.scopeData === 'object' && body.scopeData !== null
        ? (body.scopeData as Record<string, unknown>)
        : {};

    try {
      if (!hasAnyConfiguredAiKey()) {
        sendMissingKeyError(res);
        return;
      }

      const systemInstruction = [
        'Bạn là Trợ lý Cố vấn Thi đua & Nề nếp của SchoolHub.',
        '1. Vai trò chỉ là THAM KHẢO/HỖ TRỢ: tuyệt đối không tự ý chấm điểm, trừ điểm hay phạt học sinh.',
        '2. Chỉ phân tích trên dữ liệu thực được cung cấp; nếu bằng 0 hãy nói rõ chưa có dữ liệu.',
        '3. Trình bày mạch lạc bằng tiếng Việt với tiêu đề rõ ràng và gạch đầu dòng ngắn gọn.',
      ].join('\n');

      const prompt = [
        `Chế độ hỗ trợ: ${mode} | Vai trò người dùng: ${role}.`,
        customPrompt ? `Yêu cầu cụ thể: ${customPrompt}` : '',
        `Dữ liệu thi đua đã ẩn thông tin nhạy cảm: ${JSON.stringify(scopeData)}`,
      ]
        .filter(Boolean)
        .join('\n');

      const result = await generateContentWithAiFallback({
        contents: prompt,
        systemInstruction,
      });

      const text = result.text.trim();
      if (!text) {
        res.status(502).json({
          error: 'Trợ lý AI chưa trả về nội dung phù hợp. Vui lòng thử lại.',
          code: 'empty_response',
        });
        return;
      }

      res.json({
        text,
        source: result.source,
      });
    } catch (error) {
      sendAiError(res, error, 'AI emulation-assist error:');
    }
  });

  app.post('/api/ai/subject-assist', async (req, res) => {
    const validation = validateSubjectAiRequest(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error, code: 'invalid_request' });
      return;
    }

    const requestData = validation.value;
    if (!hasAnyConfiguredAiKey()) {
      sendMissingKeyError(res);
      return;
    }

    const systemInstruction = buildSubjectAiSystemInstruction(
      requestData.subjectId,
      requestData.mode,
      requestData.contextText
    );
    const contents = buildSubjectAiContents(requestData);

    try {
      const result = await generateContentWithAiFallback({
        contents,
        systemInstruction,
      });

      const text = result.text.trim();
      if (!text) {
        res.status(502).json({
          error: 'Trợ lý AI chưa trả về nội dung phù hợp. Vui lòng thử diễn đạt rõ hơn.',
          code: 'empty_response',
        });
        return;
      }

      res.json({
        text,
        subjectId: requestData.subjectId,
        mode: requestData.mode,
        source: result.source,
      });
    } catch (error) {
      sendAiError(res, error, 'AI subject-assist error:');
    }
  });

  app.post('/api/ai/subject-assist-stream', async (req, res) => {
    const validation = validateSubjectAiRequest(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error, code: 'invalid_request' });
      return;
    }

    const requestData = validation.value;
    const systemInstruction = buildSubjectAiSystemInstruction(
      requestData.subjectId,
      requestData.mode,
      requestData.contextText
    );
    const contents = buildSubjectAiContents(requestData);

    await streamAiWithFallback({
      res,
      contents,
      systemInstruction,
      logPrefix: 'AI subject-assist-stream error:',
      emptyErrorMessage: 'Trợ lý AI chưa trả về nội dung phù hợp. Vui lòng thử diễn đạt rõ hơn.',
      streamEmptyErrorMessage: 'Trợ lý AI chưa trả về nội dung phù hợp.',
    });
  });

  app.post('/api/ai/subject-structured', async (req, res) => {
    const validation = validateSubjectStructuredRequest(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error, code: 'invalid_request' });
      return;
    }

    const reqData = validation.value;
    if (!hasAnyConfiguredAiKey()) {
      sendMissingKeyError(res);
      return;
    }

    const profile = SUBJECT_AI_PROFILES[reqData.subjectId];
    const systemInstruction = [
      `[Vai trò & Môn học: ${profile.subjectName} — ${profile.appTitle}]`,
      profile.personaInstruction,
      'Trả về JSON chuẩn xác theo đúng schema đã khai báo, bằng tiếng Việt rõ ràng (trừ thuật ngữ/tiếng Anh khi ở môn Tiếng Anh). Không tự bịa số liệu hay trích dẫn.',
    ].join('\n\n');

    try {
      if (reqData.action === 'generate_quiz') {
        const prompt = [
          `Hãy tạo đúng ${reqData.count} câu hỏi trắc nghiệm khách quan (4 phương án A, B, C, D) cho môn ${profile.subjectName}.`,
          `Chủ đề trọng tâm: ${reqData.topic || 'Kiến thức cốt lõi trong ngữ cảnh'}.`,
          reqData.contextText ? `[Ngữ cảnh học tập]\n${reqData.contextText}` : '',
          'Yêu cầu: Mỗi câu hỏi rõ ràng, chỉ có 1 đáp án đúng duy nhất (correctIndex từ 0 đến 3) và kèm giải thích ngắn gọn vì sao đúng.',
        ]
          .filter(Boolean)
          .join('\n\n');

        const result = await generateContentWithAiFallback({
          contents: prompt,
          systemInstruction,
          jsonSchemaHint:
            '{"questions": [{"question": string, "options": [string, string, string, string], "correctIndex": number, "explanation": string, "topic": string}]}',
          geminiConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                questions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      question: { type: Type.STRING },
                      options: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                      },
                      correctIndex: { type: Type.INTEGER },
                      explanation: { type: Type.STRING },
                      topic: { type: Type.STRING },
                    },
                    required: ['question', 'options', 'correctIndex', 'explanation'],
                  },
                },
              },
              required: ['questions'],
            },
          },
        });

        let questions: Array<{
          question: string;
          options: string[];
          correctIndex: number;
          explanation: string;
          topic: string;
        }> = [];
        try {
          const parsed = JSON.parse(extractJsonText(result.text) || '{}') as { questions?: unknown[] };
          const rawList = Array.isArray(parsed.questions) ? parsed.questions : [];
          questions = rawList
            .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
            .map((q) => {
              const opts = Array.isArray(q.options)
                ? q.options.map((o) => String(o || '').trim()).filter(Boolean).slice(0, 4)
                : [];
              const idxNum = Number(q.correctIndex);
              const safeIdx =
                opts.length > 0 && Number.isFinite(idxNum)
                  ? Math.min(opts.length - 1, Math.max(0, Math.round(idxNum)))
                  : 0;
              return {
                question: String(q.question || '').trim(),
                options: opts,
                correctIndex: safeIdx,
                explanation: String(q.explanation || '').trim(),
                topic: String(q.topic || reqData.topic || profile.subjectName).trim(),
              };
            })
            .filter((q) => q.question && q.options.length >= 2)
            .slice(0, reqData.count);
        } catch {
          questions = [];
        }

        res.json({
          questions,
          subjectId: reqData.subjectId,
          topic: reqData.topic,
          source: result.source,
        });
        return;
      }

      if (reqData.action === 'generate_study_cards') {
        const prompt = [
          `Hãy tạo đúng ${reqData.count} thẻ ghi nhớ / công thức trọng tâm cho môn ${profile.subjectName}.`,
          `Chủ đề: ${reqData.topic || 'Kiến thức cốt lõi'}.`,
          reqData.contextText ? `[Ngữ cảnh học tập]\n${reqData.contextText}` : '',
          'Yêu cầu: front là khái niệm/công thức/từ vựng ngắn gọn, back là giải thích/nghĩa rõ ràng, example là ví dụ minh họa, tip là mẹo nhớ nhanh.',
        ]
          .filter(Boolean)
          .join('\n\n');

        const result = await generateContentWithAiFallback({
          contents: prompt,
          systemInstruction,
          jsonSchemaHint:
            '{"cards": [{"front": string, "back": string, "example": string, "tip": string}]}',
          geminiConfig: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                cards: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      front: { type: Type.STRING },
                      back: { type: Type.STRING },
                      example: { type: Type.STRING },
                      tip: { type: Type.STRING },
                    },
                    required: ['front', 'back'],
                  },
                },
              },
              required: ['cards'],
            },
          },
        });

        let cards: Array<{
          front: string;
          back: string;
          example: string;
          tip: string;
        }> = [];
        try {
          const parsed = JSON.parse(extractJsonText(result.text) || '{}') as { cards?: unknown[] };
          const rawCards = Array.isArray(parsed.cards) ? parsed.cards : [];
          cards = rawCards
            .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
            .map((c) => ({
              front: String(c.front || '').trim(),
              back: String(c.back || '').trim(),
              example: String(c.example || '').trim(),
              tip: String(c.tip || '').trim(),
            }))
            .filter((c) => c.front && c.back)
            .slice(0, reqData.count);
        } catch {
          cards = [];
        }

        res.json({
          cards,
          subjectId: reqData.subjectId,
          topic: reqData.topic,
          source: result.source,
        });
        return;
      }

      // evaluate_writing
      const evalPrompt = [
        `Hãy đánh giá bài viết môn ${profile.subjectName} theo rubric chi tiết nhưng mang tính khích lệ học sinh.`,
        reqData.promptTitle ? `Đề bài: ${reqData.promptTitle}` : '',
        reqData.referenceText ? `Tài liệu / Dẫn chứng tham chiếu:\n${reqData.referenceText}` : '',
        `Bài viết của học sinh:\n${reqData.studentText}`,
      ]
        .filter(Boolean)
        .join('\n\n');

      const result = await generateContentWithAiFallback({
        contents: evalPrompt,
        systemInstruction,
        jsonSchemaHint:
          '{"score10": number, "summary": string, "strengths": [string], "improvements": [string], "rewriteSuggestion": string}',
        geminiConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score10: { type: Type.NUMBER },
              summary: { type: Type.STRING },
              strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
              rewriteSuggestion: { type: Type.STRING },
            },
            required: ['score10', 'summary', 'strengths', 'improvements'],
          },
        },
      });

      const parsed = JSON.parse(extractJsonText(result.text) || '{}') as Record<string, unknown>;
      res.json({
        score10: Number(parsed.score10 ?? 0),
        summary: String(parsed.summary || '').trim(),
        strengths: Array.isArray(parsed.strengths)
          ? parsed.strengths.map((s) => String(s || '').trim()).filter(Boolean)
          : [],
        improvements: Array.isArray(parsed.improvements)
          ? parsed.improvements.map((s) => String(s || '').trim()).filter(Boolean)
          : [],
        ...(parsed.rewriteSuggestion
          ? { rewriteSuggestion: String(parsed.rewriteSuggestion).trim() }
          : {}),
        subjectId: reqData.subjectId,
        source: result.source,
      });
    } catch (error) {
      sendAiError(res, error, 'AI subject-structured error:');
    }
  });

  const HISTORY_TEMPLATE_HEADERS: Record<HistoryExcelModule, {
    fileName: string;
    headers: string[];
    guide: Array<{ Cot: string; MoTa: string; ViDu: string }>;
  }> = {
    history: {
      fileName: 'Mau_KhoKienThuc_LichSu.xlsx',
      headers: [
        'Tiêu đề',
        'Lớp',
        'Chương',
        'Thời kỳ',
        'Chủ đề',
        'Mốc thời gian',
        'Bối cảnh',
        'Nguyên nhân',
        'Diễn biến',
        'Kết quả',
        'Ý nghĩa',
        'Bài học lịch sử',
        'Nhân vật',
        'Nguồn',
        'Đồng bộ Timeline',
      ],
      guide: [
        { Cot: 'Mốc thời gian', MoTa: 'Hỗ trợ TCN/SCN hoặc dd/mm/yyyy để tự sắp xếp dòng thời gian', ViDu: '2879 TCN hoặc 02/09/1945' },
        { Cot: 'Nhân vật', MoTa: 'Phân tách nhiều nhân vật bằng dấu chấm phẩy ;', ViDu: 'Ngô Quyền; Dương Đình Nghệ' },
        { Cot: 'Đồng bộ Timeline', MoTa: 'Ghi Có hoặc Không (mặc định Có nếu có mốc thời gian)', ViDu: 'Có' },
      ],
    },
    timeline: {
      fileName: 'Mau_DongThoiGian_SuKien.xlsx',
      headers: [
        'Tên sự kiện',
        'Mốc thời gian',
        'Thời kỳ',
        'Quốc gia',
        'Khu vực',
        'Chủ đề',
        'Bối cảnh',
        'Diễn biến',
        'Kết quả',
        'Ý nghĩa',
        'Nhân vật',
        'Nguồn',
      ],
      guide: [
        { Cot: 'Mốc thời gian', MoTa: 'Năm TCN, SCN hoặc ngày/tháng/năm', ViDu: '938 hoặc 490 TCN' },
        { Cot: 'Khu vực', MoTa: 'Ví dụ: Đông Nam Á, Châu Âu, Thế giới', ViDu: 'Đông Nam Á' },
      ],
    },
    archive: {
      fileName: 'Mau_ThuVien_TuLieu_LichSu.xlsx',
      headers: [
        'Tên tư liệu',
        'Loại',
        'Thời kỳ',
        'Chủ đề',
        'Quốc gia',
        'Nhân vật',
        'Niên đại',
        'Nguồn',
        'Xuất xứ',
        'Tóm tắt',
        'Nội dung',
        'Đường dẫn ảnh',
      ],
      guide: [
        { Cot: 'Loại', MoTa: 'Ghi: Ảnh tư liệu, Văn kiện hoặc Hiện vật', ViDu: 'Văn kiện' },
        { Cot: 'Nguồn / Xuất xứ', MoTa: 'Ghi rõ kho lưu trữ, sách hoặc tài liệu gốc', ViDu: 'Đại Việt sử ký toàn thư' },
      ],
    },
    practice: {
      fileName: 'Mau_CauHoi_LuyenTap_LichSu.xlsx',
      headers: [
        'Loại',
        'Lớp',
        'Chương',
        'Chủ đề',
        'Câu hỏi',
        'Tư liệu',
        'Nguồn',
        'Phương án A',
        'Phương án B',
        'Phương án C',
        'Phương án D',
        'Đáp án đúng',
        'Giải thích',
      ],
      guide: [
        { Cot: 'Loại', MoTa: 'mcq (Trắc nghiệm), tf (Đúng/Sai), source (Đọc hiểu tư liệu)', ViDu: 'mcq' },
        { Cot: 'Đáp án đúng', MoTa: 'Với mcq/source ghi A/B/C/D; với tf ghi Đúng hoặc Sai', ViDu: 'B' },
      ],
    },
  };

  const ALLOWED_SUBJECT_EXCEL_IDS = new Set<SubjectExcelSubjectId>([
    'english',
    'math',
    'physics',
    'chemistry',
    'literature',
    'history',
    'geography',
  ]);

  app.get('/api/subjects/excel-template', async (req, res) => {
    try {
      const rawSubj = String(req.query.subject || 'english').toLowerCase() as SubjectExcelSubjectId;
      const subjectId: SubjectExcelSubjectId = ALLOWED_SUBJECT_EXCEL_IDS.has(rawSubj)
        ? rawSubj
        : 'english';
      const moduleKey = String(req.query.module || '');
      const rawClasses = String(req.query.classes || '');
      const presetClasses = rawClasses
        .split(/[;,]/)
        .map((s) => s.trim())
        .filter(Boolean);

      const { fileName, buffer } = await generateSubjectTemplateBuffer({
        subjectId,
        moduleKey,
        presetClasses,
      });
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(Buffer.from(buffer));
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Không thể tạo tệp mẫu Excel.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/subjects/parse-excel', (req, res) => {
    try {
      const body = req.body ?? {};
      const rawSubj = String(body.subjectId || 'english').toLowerCase() as SubjectExcelSubjectId;
      const subjectId: SubjectExcelSubjectId = ALLOWED_SUBJECT_EXCEL_IDS.has(rawSubj)
        ? rawSubj
        : 'english';
      const moduleKey = String(body.moduleKey || '');
      const rawBase64 = typeof body.fileBase64 === 'string' ? body.fileBase64 : '';
      const cleanBase64 = rawBase64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
      if (!cleanBase64) {
        res.status(400).json({ error: 'Thiếu dữ liệu tệp Excel (.xlsx, .xls).' });
        return;
      }
      const buffer = Buffer.from(cleanBase64, 'base64');
      const result = parseSubjectExcelBuffer({
        subjectId,
        moduleKey,
        buffer,
        title: typeof body.title === 'string' ? body.title : undefined,
        presetClasses: Array.isArray(body.presetClasses)
          ? body.presetClasses.map((s: unknown) => String(s || ''))
          : undefined,
      });
      res.json({
        ...result,
        sheetName: result.sheetNames[0] || 'DuLieu',
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Không thể đọc tệp Excel.';
      res.status(400).json({ error: `Lỗi đọc Excel: ${msg}` });
    }
  });

  app.post('/api/subjects/export-excel', async (req, res) => {
    try {
      const body = req.body ?? {};
      const rawSubj = String(body.subjectId || 'english').toLowerCase() as SubjectExcelSubjectId;
      const subjectId: SubjectExcelSubjectId = ALLOWED_SUBJECT_EXCEL_IDS.has(rawSubj)
        ? rawSubj
        : 'english';
      const moduleKey = String(body.moduleKey || '');
      const records = Array.isArray(body.records) ? body.records : [];
      const presetClasses = Array.isArray(body.presetClasses)
        ? body.presetClasses.map((s: unknown) => String(s || '').trim()).filter(Boolean)
        : [];
      const customFileName =
        typeof body.fileName === 'string' && body.fileName.trim()
          ? body.fileName.trim().replace(/[^a-zA-Z0-9._-]/g, '_')
          : undefined;

      const { fileName, buffer } = await generateSubjectExportBuffer({
        subjectId,
        moduleKey,
        records,
        presetClasses,
        fileName: customFileName,
      });
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(Buffer.from(buffer));
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Không thể xuất tệp Excel.';
      res.status(500).json({ error: msg });
    }
  });

  app.get('/api/history/excel-template', async (req, res) => {
    try {
      const rawMod = String(req.query.module || 'history').toLowerCase();
      const mod: HistoryExcelModule =
        rawMod === 'timeline' || rawMod === 'archive' || rawMod === 'practice' ? rawMod : 'history';
      const rawClasses = String(req.query.classes || '');
      const presetClasses = rawClasses
        .split(/[;,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const { fileName, buffer } = await generateSubjectTemplateBuffer({
        subjectId: 'history',
        moduleKey: mod,
        presetClasses,
      });
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(Buffer.from(buffer));
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Không thể tạo tệp mẫu Lịch sử.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/history/parse-excel', (req, res) => {
    try {
      const body = req.body ?? {};
      const rawMod = String(body.moduleKey || 'history').toLowerCase();
      const mod: HistoryExcelModule =
        rawMod === 'timeline' || rawMod === 'archive' || rawMod === 'practice' ? rawMod : 'history';
      const rawBase64 = typeof body.fileBase64 === 'string' ? body.fileBase64 : '';
      const cleanBase64 = rawBase64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');

      if (!cleanBase64) {
        res.status(400).json({ error: 'Thiếu dữ liệu tệp Excel (.xlsx, .xls).' });
        return;
      }

      const buffer = Buffer.from(cleanBase64, 'base64');
      const parsed = parseSubjectExcelBuffer({
        subjectId: 'history',
        moduleKey: mod,
        buffer,
        presetClasses: Array.isArray(body.presetClasses)
          ? body.presetClasses.map((s: unknown) => String(s || ''))
          : undefined,
      });
      if (parsed.sheetNames.length === 0) {
        res.status(400).json({ error: 'Tệp Excel không chứa trang tính nào.' });
        return;
      }

      res.json({
        moduleKey: mod,
        sheetName: parsed.sheetNames[0],
        sheetNames: parsed.sheetNames,
        totalRawRows: parsed.totalRawRows,
        rows: parsed.rows,
        discoveredClasses: parsed.discoveredClasses,
        discoveredTopics: parsed.discoveredTopics,
        discoveredGrades: parsed.discoveredGrades,
        discoveredCategories: parsed.discoveredCategories,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Không thể đọc tệp Excel.';
      res.status(400).json({ error: `Lỗi đọc Excel: ${msg}` });
    }
  });

  app.post('/api/history/parse-document', async (req, res) => {
    try {
      const body = req.body ?? {};
      const fileName = String(body.fileName || 'tai-lieu.txt');
      const mimeType = String(body.mimeType || '').toLowerCase();
      const rawBase64 = typeof body.fileBase64 === 'string' ? body.fileBase64 : '';
      const cleanBase64 = rawBase64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');

      if (!cleanBase64) {
        res.status(400).json({ error: 'Thiếu nội dung tệp tài liệu.' });
        return;
      }

      const buffer = Buffer.from(cleanBase64, 'base64');
      const lowerName = fileName.toLowerCase();

      if (lowerName.endsWith('.docx') || mimeType.includes('wordprocessingml')) {
        const result = await mammoth.extractRawText({ buffer });
        res.json({ fileName, kind: 'docx', text: result.value.trim() });
        return;
      }

      if (
        lowerName.endsWith('.txt') ||
        lowerName.endsWith('.md') ||
        lowerName.endsWith('.csv') ||
        mimeType.startsWith('text/')
      ) {
        res.json({ fileName, kind: 'text', text: buffer.toString('utf8').trim() });
        return;
      }

      if (lowerName.endsWith('.pdf') || mimeType === 'application/pdf') {
        const localText = await extractPdfTextLocally(buffer);
        if (localText.length >= 20) {
          res.json({ fileName, kind: 'pdf', text: localText });
          return;
        }
        if (getActiveGeminiApiKeys().length === 0) {
          res.status(422).json({
            error: 'Tệp PDF này là bản scan ảnh chưa có lớp chữ để trích xuất trực tiếp. Vui lòng dùng tệp PDF có lớp chữ, .docx hoặc .txt.',
          });
          return;
        }
        try {
          const result = await generateContentWithAiFallback({
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: 'Hãy trích xuất nguyên văn nội dung văn bản lịch sử trong tệp PDF này bằng tiếng Việt có dấu chính xác. Không thêm bình luận hay suy diễn.',
                  },
                  {
                    inlineData: {
                      mimeType: 'application/pdf',
                      data: cleanBase64,
                    },
                  },
                ],
              },
            ],
          });
          res.json({
            fileName,
            kind: 'pdf',
            text: result.text.trim(),
          });
          return;
        } catch {
          res.status(422).json({
            error: 'Tệp PDF này là bản scan ảnh chưa có lớp chữ để trích xuất trực tiếp. Vui lòng dùng tệp PDF có lớp chữ, .docx hoặc .txt.',
          });
          return;
        }
      }

      res.status(400).json({
        error: 'Chỉ hỗ trợ trích xuất văn bản từ .docx, .pdf, .txt hoặc .md.',
      });
    } catch (error) {
      sendAiError(res, error, 'History parse-document error:');
    }
  });

  const GEO_TEMPLATE_HEADERS: Record<GeoExcelModule, {
    fileName: string;
    headers: string[];
    guide: Array<{ Cot: string; MoTa: string; ViDu: string }>;
  }> = {
    knowledge: {
      fileName: 'Mau_KienThuc_DiaLy.xlsx',
      headers: [
        'Tiêu đề',
        'Lớp',
        'Chương',
        'Chủ đề',
        'Mảng',
        'Kiến thức trọng tâm',
        'Ý chính',
        'Ví dụ',
        'Số liệu',
        'Năm',
        'Nguồn',
      ],
      guide: [
        { Cot: 'Mảng', MoTa: 'Tự nhiên, Dân cư, Kinh tế, Xã hội hoặc Môi trường', ViDu: 'Tự nhiên' },
        { Cot: 'Năm / Nguồn', MoTa: 'Ghi rõ năm thống kê và nguồn tài liệu để đối chiếu', ViDu: '2024 · SGK Địa lý 12' },
      ],
    },
    atlas: {
      fileName: 'Mau_Atlat_DiaDanh_ToaDo.xlsx',
      headers: [
        'Địa danh',
        'Phạm vi',
        'Lớp bản đồ',
        'Vĩ độ',
        'Kinh độ',
        'Vùng',
        'Quốc gia',
        'Thông tin',
        'Chỉ số',
        'Năm',
        'Nguồn',
      ],
      guide: [
        { Cot: 'Phạm vi', MoTa: 'Ghi vietnam hoặc world', ViDu: 'vietnam' },
        { Cot: 'Lớp bản đồ', MoTa: 'Địa hình, Hành chính, Khí hậu, Sông ngòi, Dân cư, Kinh tế, Giao thông, Tài nguyên', ViDu: 'Hành chính' },
        { Cot: 'Vĩ độ / Kinh độ', MoTa: 'Tọa độ thập phân để hiển thị trên lưới tọa độ Atlat', ViDu: '21.0285 / 105.8542' },
      ],
    },
    data: {
      fileName: 'Mau_BangSoLieu_DiaLy.xlsx',
      headers: [
        'Đối tượng',
        'Đơn vị',
        '2020',
        '2021',
        '2022',
        '2023',
        'Nguồn',
      ],
      guide: [
        { Cot: 'Đối tượng', MoTa: 'Tên vùng, tỉnh, quốc gia hoặc ngành kinh tế', ViDu: 'Nông - lâm - thủy sản' },
        { Cot: 'Cột năm / chỉ tiêu', MoTa: 'Có thể thêm bất kỳ cột năm hoặc chỉ tiêu số (ví dụ: Diện tích, Dân số)', ViDu: '14.8' },
        { Cot: 'Nguồn', MoTa: 'Ghi rõ cơ quan thống kê phát hành số liệu', ViDu: 'Tổng cục Thống kê' },
      ],
    },
    practice: {
      fileName: 'Mau_CauHoi_LuyenTap_DiaLy.xlsx',
      headers: [
        'Loại',
        'Lớp',
        'Chương',
        'Chủ đề',
        'Câu hỏi',
        'Phương án A',
        'Phương án B',
        'Phương án C',
        'Phương án D',
        'Đáp án đúng',
        'Phương pháp',
        'Giải thích',
        'Nguồn',
      ],
      guide: [
        { Cot: 'Loại', MoTa: 'mcq (Trắc nghiệm), tf (Đúng/Sai), short (Trả lời ngắn), atlas (Đọc Atlat), data (Số liệu)', ViDu: 'mcq' },
        { Cot: 'Đáp án đúng', MoTa: 'Với mcq/atlas/data ghi A/B/C/D; với tf ghi Đúng/Sai; với short ghi đáp án ngắn', ViDu: 'B' },
      ],
    },
    test: {
      fileName: 'Mau_DeKiemTra_DiaLy.xlsx',
      headers: [
        'Loại',
        'Lớp',
        'Chương',
        'Chủ đề',
        'Câu hỏi',
        'Phương án A',
        'Phương án B',
        'Phương án C',
        'Phương án D',
        'Đáp án đúng',
        'Phương pháp',
        'Giải thích',
        'Nguồn',
      ],
      guide: [
        { Cot: 'Loại', MoTa: 'mcq, tf, short, atlas hoặc data', ViDu: 'mcq' },
        { Cot: 'Đáp án đúng', MoTa: 'A/B/C/D, Đúng/Sai hoặc văn bản đáp án ngắn', ViDu: 'A' },
      ],
    },
  };

  app.get('/api/geography/excel-template', async (req, res) => {
    try {
      const rawMod = String(req.query.module || 'knowledge').toLowerCase();
      const mod: GeoExcelModule =
        rawMod === 'atlas' || rawMod === 'data' || rawMod === 'practice' || rawMod === 'test'
          ? rawMod
          : 'knowledge';
      const rawClasses = String(req.query.classes || '');
      const presetClasses = rawClasses
        .split(/[;,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const { fileName, buffer } = await generateSubjectTemplateBuffer({
        subjectId: 'geography',
        moduleKey: mod,
        presetClasses,
      });
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(Buffer.from(buffer));
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Không thể tạo tệp mẫu Địa lý.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/geography/parse-excel', (req, res) => {
    try {
      const body = req.body ?? {};
      const rawMod = String(body.moduleKey || 'knowledge').toLowerCase();
      const mod: GeoExcelModule =
        rawMod === 'atlas' || rawMod === 'data' || rawMod === 'practice' || rawMod === 'test'
          ? rawMod
          : 'knowledge';
      const rawBase64 = typeof body.fileBase64 === 'string' ? body.fileBase64 : '';
      const cleanBase64 = rawBase64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');

      if (!cleanBase64) {
        res.status(400).json({ error: 'Thiếu dữ liệu tệp Excel (.xlsx, .xls).' });
        return;
      }

      const buffer = Buffer.from(cleanBase64, 'base64');
      const parsed = parseSubjectExcelBuffer({
        subjectId: 'geography',
        moduleKey: mod,
        buffer,
        title: typeof body.title === 'string' ? body.title : undefined,
        presetClasses: Array.isArray(body.presetClasses)
          ? body.presetClasses.map((s: unknown) => String(s || ''))
          : undefined,
      });
      if (parsed.sheetNames.length === 0) {
        res.status(400).json({ error: 'Tệp Excel không chứa trang tính nào.' });
        return;
      }

      res.json({
        moduleKey: mod,
        sheetName: parsed.sheetNames[0],
        sheetNames: parsed.sheetNames,
        totalRawRows: parsed.totalRawRows,
        dataset: parsed.dataset ?? null,
        datasets: parsed.datasets ?? [],
        rows: parsed.rows,
        discoveredClasses: parsed.discoveredClasses,
        discoveredTopics: parsed.discoveredTopics,
        discoveredGrades: parsed.discoveredGrades,
        discoveredCategories: parsed.discoveredCategories,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Không thể đọc tệp Excel.';
      res.status(400).json({ error: `Lỗi đọc Excel: ${msg}` });
    }
  });

  app.post('/api/geography/parse-document', async (req, res) => {
    try {
      const body = req.body ?? {};
      const fileName = String(body.fileName || 'tai-lieu.txt');
      const mimeType = String(body.mimeType || '').toLowerCase();
      const rawBase64 = typeof body.fileBase64 === 'string' ? body.fileBase64 : '';
      const cleanBase64 = rawBase64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');

      if (!cleanBase64) {
        res.status(400).json({ error: 'Thiếu nội dung tệp tài liệu.' });
        return;
      }

      const buffer = Buffer.from(cleanBase64, 'base64');
      const lowerName = fileName.toLowerCase();

      if (lowerName.endsWith('.docx') || mimeType.includes('wordprocessingml')) {
        const result = await mammoth.extractRawText({ buffer });
        res.json({ fileName, kind: 'docx', text: result.value.trim() });
        return;
      }

      if (
        lowerName.endsWith('.txt') ||
        lowerName.endsWith('.md') ||
        lowerName.endsWith('.csv') ||
        mimeType.startsWith('text/')
      ) {
        res.json({ fileName, kind: 'text', text: buffer.toString('utf8').trim() });
        return;
      }

      if (lowerName.endsWith('.pdf') || mimeType === 'application/pdf') {
        const localText = await extractPdfTextLocally(buffer);
        if (localText.length >= 20) {
          res.json({ fileName, kind: 'pdf', text: localText });
          return;
        }
        if (getActiveGeminiApiKeys().length === 0) {
          res.status(422).json({
            error: 'Tệp PDF này là bản scan ảnh chưa có lớp chữ để trích xuất trực tiếp. Vui lòng dùng tệp PDF có lớp chữ, .docx hoặc .txt.',
          });
          return;
        }
        try {
          const result = await generateContentWithAiFallback({
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: 'Hãy trích xuất nguyên văn nội dung kiến thức và số liệu Địa lý trong tệp PDF này bằng tiếng Việt có dấu chính xác. Giữ nguyên mốc năm và đơn vị số liệu, không thêm bình luận hay suy diễn.',
                  },
                  {
                    inlineData: {
                      mimeType: 'application/pdf',
                      data: cleanBase64,
                    },
                  },
                ],
              },
            ],
          });
          res.json({
            fileName,
            kind: 'pdf',
            text: result.text.trim(),
          });
          return;
        } catch {
          res.status(422).json({
            error: 'Tệp PDF này là bản scan ảnh chưa có lớp chữ để trích xuất trực tiếp. Vui lòng dùng tệp PDF có lớp chữ, .docx hoặc .txt.',
          });
          return;
        }
      }

      res.status(400).json({
        error: 'Chỉ hỗ trợ trích xuất văn bản từ .docx, .pdf, .txt hoặc .csv.',
      });
    } catch (error) {
      sendAiError(res, error, 'Geography parse-document error:');
    }
  });

  app.post('/api/literature/parse-document', async (req, res) => {
    try {
      const body = req.body ?? {};
      const fileName = String(body.fileName || 'van-ban.txt');
      const mimeType = String(body.mimeType || '').toLowerCase();
      const rawBase64 = typeof body.fileBase64 === 'string' ? body.fileBase64 : '';
      const cleanBase64 = rawBase64.replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');

      if (!cleanBase64) {
        res.status(400).json({ error: 'Thiếu nội dung tệp tài liệu.' });
        return;
      }

      const buffer = Buffer.from(cleanBase64, 'base64');
      const lowerName = fileName.toLowerCase();

      if (lowerName.endsWith('.docx') || mimeType.includes('wordprocessingml')) {
        const result = await mammoth.extractRawText({ buffer });
        res.json({ fileName, kind: 'docx', text: result.value.trim() });
        return;
      }

      if (
        lowerName.endsWith('.txt') ||
        lowerName.endsWith('.md') ||
        lowerName.endsWith('.csv') ||
        mimeType.startsWith('text/')
      ) {
        res.json({ fileName, kind: 'text', text: buffer.toString('utf8').trim() });
        return;
      }

      if (lowerName.endsWith('.pdf') || mimeType === 'application/pdf') {
        const localText = await extractPdfTextLocally(buffer);
        if (localText.length >= 20) {
          res.json({ fileName, kind: 'pdf', text: localText });
          return;
        }
        if (getActiveGeminiApiKeys().length === 0) {
          res.status(422).json({
            error: 'Tệp PDF này là bản scan ảnh chưa có lớp chữ để trích xuất trực tiếp. Vui lòng dùng tệp PDF có lớp chữ, .docx hoặc .txt.',
          });
          return;
        }
        try {
          const result = await generateContentWithAiFallback({
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: 'Hãy trích xuất nguyên văn nội dung văn bản Ngữ văn / tác phẩm / đề thi trong tệp PDF này bằng tiếng Việt có dấu chính xác. Không thêm bình luận hay suy diễn.',
                  },
                  {
                    inlineData: {
                      mimeType: 'application/pdf',
                      data: cleanBase64,
                    },
                  },
                ],
              },
            ],
          });
          res.json({
            fileName,
            kind: 'pdf',
            text: result.text.trim(),
          });
          return;
        } catch {
          res.status(422).json({
            error: 'Tệp PDF này là bản scan ảnh chưa có lớp chữ để trích xuất trực tiếp. Vui lòng dùng tệp PDF có lớp chữ, .docx hoặc .txt.',
          });
          return;
        }
      }

      res.status(400).json({
        error: 'Chỉ hỗ trợ trích xuất văn bản từ .docx, .pdf, .txt hoặc .md.',
      });
    } catch (error) {
      sendAiError(res, error, 'Literature parse-document error:');
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SchoolHub server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
