import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import mammoth from 'mammoth';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const GEMINI_MODEL = 'gemini-4-hydrogen';
const GEMINI_FALLBACK_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'] as const;
const DEVELOPMENT_ADMIN_MODE = parseDevelopmentAdminMode(process.env.DEVELOPMENT_ADMIN_MODE);

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
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
  if (/RESOURCE_EXHAUSTED/i.test(msg)) return 429;
  return 502;
}

function isRetryableGeminiStatus(status: number, error?: unknown): boolean {
  if (status === 429 || status === 500 || status === 503 || status === 504) return true;
  const msg = error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
    ? String((error as { message: string }).message)
    : '';
  return /high demand|unavailable|overloaded|try again later|temporarily/i.test(msg);
}

const modelCooldownUntil = new Map<string, { until: number; status: number }>();

function getOrderedCandidateModels(): string[] {
  const all = [GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS];
  const now = Date.now();
  const ready = all.filter((m) => (modelCooldownUntil.get(m)?.until ?? 0) <= now);
  const transientCooled = all
    .filter((m) => {
      const entry = modelCooldownUntil.get(m);
      return Boolean(entry && entry.until > now && entry.status !== 429);
    })
    .sort((a, b) => modelCooldownUntil.get(a)!.until - modelCooldownUntil.get(b)!.until);
  if (ready.length > 0 || transientCooled.length > 0) {
    return [...ready, ...transientCooled];
  }
  return [...all];
}

function markModelCooldown(model: string, status: number): void {
  const durationMs = status === 429 ? 5 * 60_000 : 45_000;
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

async function callGeminiWithFallback<T>(
  fn: (model: string, abortSignal: AbortSignal) => Promise<T>
): Promise<T> {
  const modelsToTry = getOrderedCandidateModels();
  const overallDeadline = Date.now() + 12_000;
  let lastError: unknown;
  for (let m = 0; m < modelsToTry.length; m++) {
    const model = modelsToTry[m];
    const isLastModel = m === modelsToTry.length - 1;
    const maxRetries = isLastModel ? 1 : 0;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const remainingMs = overallDeadline - Date.now();
      if (remainingMs < 1500 && lastError) {
        throw lastError;
      }
      const startedAt = Date.now();
      const controller = new AbortController();
      try {
        const timeoutMs = Math.min(isLastModel ? 6000 : 4000, Math.max(1500, remainingMs));
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
        if (!isRetryableGeminiStatus(status, error)) {
          throw error;
        }
        markModelCooldown(model, status);
        if (
          attempt < maxRetries &&
          status !== 429 &&
          elapsedMs < 3000 &&
          overallDeadline - Date.now() > 3000
        ) {
          await new Promise((resolve) => setTimeout(resolve, 350));
          continue;
        }
        break;
      }
    }
  }
  throw lastError;
}

function sendMissingKeyError(res: express.Response) {
  res.status(503).json({
    error: 'Máy chủ chưa cấu hình GEMINI_API_KEY. Vui lòng thiết lập trong phần Settings > Secrets để dùng Trợ lý AI.',
    code: 'missing_api_key',
  });
}

function sendGeminiError(res: express.Response, error: unknown, logPrefix: string) {
  console.error(logPrefix, error);
  const status = getHttpStatusFromError(error);
  const errObj = error as { message?: string };
  const detail = formatGeminiErrorMessage(status, errObj?.message || '');
  res.status(status).json({
    error: detail,
    code: status === 429 ? 'rate_limited' : 'gemini_error',
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'schoolhub',
      developmentAdminMode: DEVELOPMENT_ADMIN_MODE,
    });
  });

  app.get('/api/ai/debug-probe', async (_req, res) => {
    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({ hasKey: false });
      return;
    }
    const availableModels: string[] = [];
    try {
      const pager = await ai.models.list();
      for await (const m of pager) {
        if (m.name) availableModels.push(m.name.replace(/^models\//, ''));
      }
    } catch (e) {
      availableModels.push('list-err:' + (e instanceof Error ? e.message : String(e)));
    }

    const candidates = [
      'gemini-4-hydrogen',
      'gemini-3.1-flash-lite',
      'gemini-3.5-flash-lite',
      'gemini-3.5-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash',
    ].filter((name) => availableModels.includes(name) || name === 'gemini-3.5-flash-lite' || name === 'gemini-4-hydrogen' || name === 'gemini-3.1-flash-lite');

    const results: Array<Record<string, unknown>> = [];
    for (const model of candidates) {
      const started = Date.now();
      try {
        const r = await ai.models.generateContent({
          model,
          contents: 'Tóm tắt 2 gạch đầu dòng về phương pháp học tốt môn Toán.',
          config: model.startsWith('gemini-4-') ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : undefined,
        });
        results.push({
          model,
          kind: 'text',
          ok: true,
          ms: Date.now() - started,
          len: (r.text || '').length,
          preview: (r.text || '').slice(0, 70),
        });
      } catch (err) {
        results.push({
          model,
          kind: 'text',
          ok: false,
          ms: Date.now() - started,
          status: getHttpStatusFromError(err),
          error: (err instanceof Error ? err.message : String(err)).slice(0, 180),
        });
      }
    }

    // Also test JSON schema on whichever succeeded
    for (const item of results.filter((x) => x.ok)) {
      const model = String(item.model);
      const started = Date.now();
      try {
        const r = await ai.models.generateContent({
          model,
          contents: 'Tạo 2 câu hỏi trắc nghiệm Toán lớp 10 bằng tiếng Việt.',
          config: {
            ...(model.startsWith('gemini-4-') ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
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
                      options: { type: Type.ARRAY, items: { type: Type.STRING } },
                      correctIndex: { type: Type.INTEGER },
                      explanation: { type: Type.STRING },
                    },
                    required: ['question', 'options', 'correctIndex', 'explanation'],
                  },
                },
              },
              required: ['questions'],
            },
          },
        });
        results.push({
          model,
          kind: 'json',
          ok: true,
          ms: Date.now() - started,
          len: (r.text || '').length,
        });
      } catch (err) {
        results.push({
          model,
          kind: 'json',
          ok: false,
          ms: Date.now() - started,
          status: getHttpStatusFromError(err),
          error: (err instanceof Error ? err.message : String(err)).slice(0, 180),
        });
      }
    }

    res.json({ hasKey: true, availableModelsCount: availableModels.length, availableGemini: availableModels.filter((n) => /gemini/i.test(n)).slice(0, 40), results });
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
    const incomingMessage =
      typeof body.message === 'string' && body.message.trim()
        ? body.message.trim()
        : typeof body.prompt === 'string' && body.prompt.trim()
        ? body.prompt.trim()
        : '';

    const normalizedTurns: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
    if (Array.isArray(body.messages)) {
      for (const entry of body.messages.slice(-12)) {
        if (!entry || typeof entry !== 'object') continue;
        const raw = entry as Record<string, unknown>;
        const text =
          typeof raw.content === 'string'
            ? raw.content.trim()
            : typeof raw.text === 'string'
              ? raw.text.trim()
              : '';
        if (!text) continue;
        const role: 'user' | 'model' =
          raw.role === 'assistant' || raw.role === 'model' ? 'model' : 'user';
        const prev = normalizedTurns[normalizedTurns.length - 1];
        if (prev && prev.role === role) {
          prev.parts[0].text = `${prev.parts[0].text}\n\n${text}`.slice(0, 8000);
        } else {
          normalizedTurns.push({ role, parts: [{ text: text.slice(0, 8000) }] });
        }
      }
      while (normalizedTurns.length > 0 && normalizedTurns[0].role !== 'user') {
        normalizedTurns.shift();
      }
    }

    if (incomingMessage && normalizedTurns.length === 0) {
      normalizedTurns.push({ role: 'user', parts: [{ text: incomingMessage.slice(0, 8000) }] });
    } else if (incomingMessage) {
      const last = normalizedTurns[normalizedTurns.length - 1];
      if (!last || last.role !== 'user' || last.parts[0].text !== incomingMessage) {
        if (last && last.role === 'user') {
          last.parts[0].text = `${last.parts[0].text}\n\n${incomingMessage}`.slice(0, 8000);
        } else {
          normalizedTurns.push({ role: 'user', parts: [{ text: incomingMessage.slice(0, 8000) }] });
        }
      }
    }

    const user = body.user;
    const effectiveRole = resolveBackendApiEffectiveRole(user?.role, DEVELOPMENT_ADMIN_MODE);
    const contextSummary = body.contextSummary;

    try {
      if (normalizedTurns.length === 0) {
        res.status(400).json({ error: 'Thiếu nội dung câu hỏi.' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        sendMissingKeyError(res);
        return;
      }

      const systemInstruction = [
        'Bạn là SchoolHub AI Copilot — trợ lý AI hỗ trợ học tập, hướng nghiệp và quản lý trường học bằng tiếng Việt rõ ràng, thân thiện.',
        `Người dùng hiện tại: ${user?.displayName || 'Người dùng'} | Vai trò: ${effectiveRole}.`,
        contextSummary
          ? `Dữ liệu thực tế trong phạm vi vai trò này:\n${
              typeof contextSummary === 'string' ? contextSummary : JSON.stringify(contextSummary)
            }`
          : 'Không có số liệu trường học đính kèm cho lượt này.',
        'Quy tắc bắt buộc:',
        '1. Tuyệt đối không tiết lộ dữ liệu tư vấn tâm lý bảo mật hoặc thông tin vượt ngoài vai trò người dùng.',
        '2. Khi phân tích số liệu hệ thống, tách rõ [Số liệu thực tế] và [Gợi ý]; nếu chỉ số bằng 0 hoặc chưa có dữ liệu thì nêu rõ, không bịa đặt số liệu.',
        '3. Khi giải đáp kiến thức học tập hoặc phương pháp ôn thi, trả lời chi tiết, mạch lạc, có ví dụ minh họa dễ hiểu.',
      ].join('\n');

      const response = await callGeminiWithFallback((model, abortSignal) =>
        ai.models.generateContent({
          model,
          contents: normalizedTurns,
          config: { systemInstruction, abortSignal },
        })
      );

      const text = typeof response.text === 'string' ? response.text.trim() : '';
      if (!text) {
        res.status(502).json({
          error: 'Trợ lý AI chưa trả về nội dung phù hợp. Vui lòng thử lại.',
          code: 'empty_response',
        });
        return;
      }

      res.json({
        text,
        source: 'gemini',
      });
    } catch (error) {
      sendGeminiError(res, error, 'AI chat error:');
    }
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
      const ai = getGeminiClient();
      if (!ai) {
        sendMissingKeyError(res);
        return;
      }

      const systemInstruction = [
        'Bạn là chuyên gia phân tích dữ liệu giáo dục của SchoolHub.',
        'Trình bày bằng tiếng Việt có cấu trúc rõ ràng, tách riêng [Số liệu thực tế] và [Gợi ý hành động].',
        'Nếu dữ liệu bằng 0 hoặc trống, thông báo rõ chưa có dữ liệu và tuyệt đối không bịa thêm số liệu.',
      ].join('\n');

      const prompt = [
        `Phạm vi phân tích: ${focus} | Vai trò xem: ${role}.`,
        question ? `Câu hỏi trọng tâm: ${question}` : 'Hãy tổng hợp và đề xuất hành động ưu tiên dựa trên số liệu sau.',
        `Số liệu thực tế được phép truy cập: ${JSON.stringify(safeStats)}`,
      ].join('\n');

      const response = await callGeminiWithFallback((model) =>
        ai.models.generateContent({
          model,
          contents: prompt,
          config: { systemInstruction },
        })
      );

      const text = typeof response.text === 'string' ? response.text.trim() : '';
      if (!text) {
        res.status(502).json({
          error: 'Trợ lý AI chưa trả về báo cáo phân tích. Vui lòng thử lại.',
          code: 'empty_response',
        });
        return;
      }

      res.json({
        text,
        source: 'gemini',
      });
    } catch (error) {
      sendGeminiError(res, error, 'AI analyze error:');
    }
  });

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
        const result = await mammoth.extractRawText({ buffer });
        extractedText = result.value.trim();
      }

      if (!extractedText && !fileBase64) {
        res.status(400).json({ error: 'Vui lòng cung cấp nội dung văn bản hoặc tệp .docx/.pdf để trích xuất.' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        sendMissingKeyError(res);
        return;
      }

      const instructions = [
        'Bạn là chuyên gia phân tích văn bản Nội quy & Quy định Thi đua Trường học.',
        'Hãy trích xuất danh sách tiêu chí rõ ràng, đầy đủ thành JSON theo schema.',
        'QUY TẮC TUYỆT ĐỐI:',
        '1. CHỈ điền `points` nếu tài liệu CÓ GHI RÕ SỐ ĐIỂM cộng/trừ. Nếu tài liệu KHÔNG ghi điểm cụ thể, BẮT BUỘC đặt `pointsSpecified: false` và `points: null`. TUYỆT ĐỐI KHÔNG tự bịa hay suy đoán mức điểm.',
        '2. `type` chỉ là "violation" (vi phạm/hành vi cần tránh) hoặc "achievement" (thành tích/khen thưởng). Nếu có điểm trừ, dùng số âm (ví dụ -5); nếu điểm cộng dùng số dương (ví dụ 10).',
        '3. `target` là "individual" (cá nhân học sinh), "class" (tập thể lớp), hoặc "group" (tổ/nhóm).',
        '4. Mọi tiêu chí trích xuất chỉ là dự thảo (draft) để Ban Giám hiệu rà soát trước khi ban hành.',
      ].join('\n');

      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
        { text: instructions },
      ];

      if (mimeType === 'application/pdf' && fileBase64) {
        parts.push({
          inlineData: {
            mimeType: 'application/pdf',
            data: fileBase64,
          },
        });
        if (extractedText) {
          parts.push({ text: `Văn bản bổ sung:\n${extractedText}` });
        }
      } else {
        parts.push({ text: `Nội dung văn bản nội quy (${fileName}):\n${extractedText}` });
      }

      const response = await callGeminiWithFallback((model) =>
        ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts }],
          config: {
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
                      'target',
                    ],
                  },
                },
              },
              required: ['summary', 'criteria'],
            },
          },
        })
      );

      const parsed = JSON.parse(response.text || '{}');
      const criteria = Array.isArray(parsed.criteria)
        ? parsed.criteria.map((item: Record<string, unknown>, idx: number) => ({
            tempId: `AI-${Date.now().toString().slice(-4)}-${idx + 1}`,
            group: String(item.group || 'Quy định chung'),
            name: String(item.name || `Tiêu chí ${idx + 1}`),
            description: String(item.description || item.behavior || ''),
            behavior: String(item.behavior || item.description || ''),
            type: item.type === 'achievement' ? 'achievement' : 'violation',
            pointsSpecified: Boolean(item.pointsSpecified && typeof item.points === 'number'),
            points:
              item.pointsSpecified && typeof item.points === 'number' && Number.isFinite(item.points)
                ? item.type === 'violation'
                  ? -Math.abs(item.points)
                  : Math.abs(item.points)
                : null,
            target:
              item.target === 'class' || item.target === 'group' ? item.target : 'individual',
            condition: item.condition ? String(item.condition) : undefined,
            sourceClause: item.sourceClause ? String(item.sourceClause) : undefined,
            confidence: 0.92,
            selected: true,
          }))
        : [];

      res.json({
        summary: String(parsed.summary || `Đã trích xuất ${criteria.length} tiêu chí nháp từ tài liệu.`),
        extractedText,
        criteria,
        source: 'gemini',
      });
    } catch (error) {
      sendGeminiError(res, error, 'AI parse-rules error:');
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
      const ai = getGeminiClient();
      if (!ai) {
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

      const response = await callGeminiWithFallback((model) =>
        ai.models.generateContent({
          model,
          contents: prompt,
          config: { systemInstruction },
        })
      );

      const text = typeof response.text === 'string' ? response.text.trim() : '';
      if (!text) {
        res.status(502).json({
          error: 'Trợ lý AI chưa trả về nội dung phù hợp. Vui lòng thử lại.',
          code: 'empty_response',
        });
        return;
      }

      res.json({
        text,
        source: 'gemini',
      });
    } catch (error) {
      sendGeminiError(res, error, 'AI emulation-assist error:');
    }
  });

  app.post('/api/ai/subject-assist', async (req, res) => {
    const validation = validateSubjectAiRequest(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error, code: 'invalid_request' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      sendMissingKeyError(res);
      return;
    }

    const requestData = validation.value;
    const systemInstruction = buildSubjectAiSystemInstruction(
      requestData.subjectId,
      requestData.mode,
      requestData.contextText
    );
    const contents = buildSubjectAiContents(requestData);

    try {
      const response = await callGeminiWithFallback((model, abortSignal) =>
        ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
            abortSignal,
          },
        })
      );

      const text = typeof response.text === 'string' ? response.text.trim() : '';
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
        source: 'gemini',
      });
    } catch (error) {
      sendGeminiError(res, error, 'AI subject-assist error:');
    }
  });

  app.post('/api/ai/subject-assist-stream', async (req, res) => {
    const validation = validateSubjectAiRequest(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error, code: 'invalid_request' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      sendMissingKeyError(res);
      return;
    }

    const requestData = validation.value;
    const systemInstruction = buildSubjectAiSystemInstruction(
      requestData.subjectId,
      requestData.mode,
      requestData.contextText
    );
    const contents = buildSubjectAiContents(requestData);

    const modelsToTry = getOrderedCandidateModels();
    const overallDeadline = Date.now() + 11_000;
    let headersSent = false;
    let clientClosed = false;
    let activeController: AbortController | null = null;
    res.on('close', () => {
      if (!res.writableEnded) {
        clientClosed = true;
        try {
          activeController?.abort();
        } catch {
          // ignore abort error
        }
      }
    });

    try {
      let fullText = '';
      let lastError: unknown;

      for (let m = 0; m < modelsToTry.length; m++) {
        const model = modelsToTry[m];
        const isLastModel = m === modelsToTry.length - 1;
        const maxAttempts = isLastModel ? 2 : 1;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          const remainingMs = overallDeadline - Date.now();
          if (!headersSent && remainingMs < 1500 && lastError) {
            break;
          }
          const startedAt = Date.now();
          const controller = new AbortController();
          activeController = controller;
          let iterator: AsyncIterator<{ text?: string }> | null = null;
          try {
            const preHeaderTimeoutMs = Math.min(
              isLastModel ? 5500 : 4000,
              Math.max(1500, remainingMs)
            );
            const stream = await raceFailoverTimeout(
              ai.models.generateContentStream({
                model,
                contents,
                config: { systemInstruction, abortSignal: controller.signal },
              }),
              preHeaderTimeoutMs,
              model,
              controller
            );
            iterator = stream[Symbol.asyncIterator]();

            while (true) {
              if (clientClosed) {
                iterator.return?.().catch(() => {});
                return;
              }
              const stepTimeoutMs = headersSent
                ? 12_000
                : Math.max(1200, Math.min(preHeaderTimeoutMs, overallDeadline - Date.now()));
              const step = await raceFailoverTimeout(
                iterator.next(),
                stepTimeoutMs,
                model,
                controller
              );
              if (step.done) break;
              const chunk = step.value;
              const delta = typeof chunk?.text === 'string' ? chunk.text : '';
              if (delta) {
                if (!headersSent) {
                  headersSent = true;
                  modelCooldownUntil.delete(model);
                  res.status(200);
                  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
                  res.setHeader('Cache-Control', 'no-cache, no-transform');
                  res.setHeader('Connection', 'keep-alive');
                  res.flushHeaders?.();
                }
                fullText += delta;
                res.write(`data: ${JSON.stringify({ delta })}\n\n`);
              }
            }

            if (fullText.trim()) {
              modelCooldownUntil.delete(model);
              break;
            }
          } catch (err) {
            lastError = err;
            iterator?.return?.().catch(() => {});
            if (clientClosed) return;
            const elapsedMs = Date.now() - startedAt;
            const status = getHttpStatusFromError(err);
            console.warn(
              `[Gemini stream fallback] model=${model} status=${status} elapsed=${elapsedMs}ms`
            );
            if (!headersSent && isRetryableGeminiStatus(status, err)) {
              markModelCooldown(model, status);
              if (
                attempt + 1 < maxAttempts &&
                status !== 429 &&
                elapsedMs < 3000 &&
                overallDeadline - Date.now() > 3000
              ) {
                await new Promise((resolve) => setTimeout(resolve, 350));
                continue;
              }
              if (m < modelsToTry.length - 1) {
                break;
              }
            }
            if (headersSent) {
              throw err;
            }
          } finally {
            if (activeController === controller) {
              activeController = null;
            }
          }
        }
        if (fullText.trim()) break;
        if (!headersSent && overallDeadline - Date.now() < 1500 && lastError) break;
      }

      if (clientClosed) return;

      // If streaming attempts stalled/timed out or hit 503 before emitting headers, try one fast non-stream generateContent call
      if (!fullText.trim() && !headersSent && modelsToTry.length > 0) {
        const non429Models = modelsToTry.filter((m) => {
          const entry = modelCooldownUntil.get(m);
          return !entry || entry.until <= Date.now() || entry.status !== 429;
        });
        const fallbackModel = non429Models[0] || 'gemini-3.5-flash-lite';
        const fallbackController = new AbortController();
        activeController = fallbackController;
        try {
          const nonStreamResp = await raceFailoverTimeout(
            ai.models.generateContent({
              model: fallbackModel,
              contents,
              config: { systemInstruction, abortSignal: fallbackController.signal },
            }),
            5500,
            fallbackModel,
            fallbackController
          );
          const nonStreamText =
            typeof nonStreamResp.text === 'string' ? nonStreamResp.text.trim() : '';
          if (nonStreamText && !clientClosed) {
            headersSent = true;
            modelCooldownUntil.delete(fallbackModel);
            fullText = nonStreamText;
            res.status(200);
            res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-transform');
            res.setHeader('Connection', 'keep-alive');
            res.flushHeaders?.();
            res.write(`data: ${JSON.stringify({ delta: nonStreamText })}\n\n`);
          }
        } catch (fallbackErr) {
          if (!lastError) {
            lastError = fallbackErr;
          }
        } finally {
          if (activeController === fallbackController) {
            activeController = null;
          }
        }
      }

      if (clientClosed) return;

      const finalText = fullText.trim();
      if (!finalText) {
        if (!headersSent) {
          if (lastError) {
            throw lastError;
          }
          res.status(502).json({
            error: 'Trợ lý AI chưa trả về nội dung phù hợp. Vui lòng thử diễn đạt rõ hơn.',
            code: 'empty_response',
          });
          return;
        }
        res.write(`data: ${JSON.stringify({ error: 'Trợ lý AI chưa trả về nội dung phù hợp.' })}\n\n`);
        res.end();
        return;
      }

      res.write(`data: ${JSON.stringify({ done: true, text: finalText })}\n\n`);
      res.end();
    } catch (error) {
      console.error('AI subject-assist-stream error:', error);
      const status = getHttpStatusFromError(error);
      const errObj = error as { message?: string };
      const detail = formatGeminiErrorMessage(status, errObj?.message || '');
      if (!headersSent) {
        res.status(status).json({
          error: detail,
          code: status === 429 ? 'rate_limited' : 'gemini_error',
        });
      } else if (!clientClosed) {
        res.write(`data: ${JSON.stringify({ error: detail })}\n\n`);
        res.end();
      }
    }
  });

  app.post('/api/ai/subject-structured', async (req, res) => {
    const validation = validateSubjectStructuredRequest(req.body);
    if (!validation.ok) {
      res.status(400).json({ error: validation.error, code: 'invalid_request' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      sendMissingKeyError(res);
      return;
    }

    const reqData = validation.value;
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

        const response = await callGeminiWithFallback((model, abortSignal) =>
          ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              systemInstruction,
              abortSignal,
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
          })
        );

        const parsed = JSON.parse(response.text || '{}') as { questions?: unknown[] };
        const rawList = Array.isArray(parsed.questions) ? parsed.questions : [];
        const questions = rawList
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
          .filter((q) => q.question && q.options.length >= 2);

        res.json({
          questions,
          subjectId: reqData.subjectId,
          topic: reqData.topic,
          source: 'gemini',
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

        const response = await callGeminiWithFallback((model, abortSignal) =>
          ai.models.generateContent({
            model,
            contents: prompt,
            config: {
              systemInstruction,
              abortSignal,
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
          })
        );

        const parsed = JSON.parse(response.text || '{}') as { cards?: unknown[] };
        const rawCards = Array.isArray(parsed.cards) ? parsed.cards : [];
        const cards = rawCards
          .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
          .map((c) => ({
            front: String(c.front || '').trim(),
            back: String(c.back || '').trim(),
            example: String(c.example || '').trim(),
            tip: String(c.tip || '').trim(),
          }))
          .filter((c) => c.front && c.back);

        res.json({
          cards,
          subjectId: reqData.subjectId,
          topic: reqData.topic,
          source: 'gemini',
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

      const response = await callGeminiWithFallback((model, abortSignal) =>
        ai.models.generateContent({
          model,
          contents: evalPrompt,
          config: {
            systemInstruction,
            abortSignal,
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
        })
      );

      const parsed = JSON.parse(response.text || '{}') as Record<string, unknown>;
      res.json({
        ...parsed,
        subjectId: reqData.subjectId,
        source: 'gemini',
      });
    } catch (error) {
      sendGeminiError(res, error, 'AI subject-structured error:');
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

  app.get('/api/history/excel-template', (req, res) => {
    const rawMod = String(req.query.module || 'history').toLowerCase();
    const mod: HistoryExcelModule =
      rawMod === 'timeline' || rawMod === 'archive' || rawMod === 'practice' ? rawMod : 'history';
    const spec = HISTORY_TEMPLATE_HEADERS[mod];

    const wb = XLSX.utils.book_new();
    const dataWs = XLSX.utils.aoa_to_sheet([spec.headers]);
    dataWs['!cols'] = spec.headers.map((h) => ({ wch: Math.max(16, h.length + 6) }));
    XLSX.utils.book_append_sheet(wb, dataWs, 'DuLieu');

    const guideWs = XLSX.utils.json_to_sheet(spec.guide);
    guideWs['!cols'] = [{ wch: 22 }, { wch: 52 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, guideWs, 'HuongDan');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${spec.fileName}"`);
    res.send(buf);
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
      const wb = XLSX.read(buffer, { type: 'buffer' });
      const firstSheetName =
        wb.SheetNames.find((n) => n !== 'HuongDan') || wb.SheetNames[0];
      if (!firstSheetName) {
        res.status(400).json({ error: 'Tệp Excel không chứa trang tính nào.' });
        return;
      }

      const ws = wb.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
      const normalizedRows = rawRows
        .map((row, idx) => normalizeHistoryExcelRow(mod, row, idx))
        .filter((item): item is Record<string, unknown> => item !== null);

      res.json({
        moduleKey: mod,
        sheetName: firstSheetName,
        totalRawRows: rawRows.length,
        rows: normalizedRows,
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
        const ai = getGeminiClient();
        if (!ai) {
          sendMissingKeyError(res);
          return;
        }
        const response = await callGeminiWithFallback((model) =>
          ai.models.generateContent({
            model,
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
          })
        );
        res.json({
          fileName,
          kind: 'pdf',
          text: String(response.text || '').trim(),
        });
        return;
      }

      res.status(400).json({
        error: 'Chỉ hỗ trợ trích xuất văn bản từ .docx, .pdf, .txt hoặc .md.',
      });
    } catch (error) {
      sendGeminiError(res, error, 'History parse-document error:');
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

  app.get('/api/geography/excel-template', (req, res) => {
    const rawMod = String(req.query.module || 'knowledge').toLowerCase();
    const mod: GeoExcelModule =
      rawMod === 'atlas' || rawMod === 'data' || rawMod === 'practice' || rawMod === 'test'
        ? rawMod
        : 'knowledge';
    const spec = GEO_TEMPLATE_HEADERS[mod];

    const wb = XLSX.utils.book_new();
    const dataWs = XLSX.utils.aoa_to_sheet([spec.headers]);
    dataWs['!cols'] = spec.headers.map((h) => ({ wch: Math.max(16, h.length + 6) }));
    XLSX.utils.book_append_sheet(wb, dataWs, 'DuLieu');

    const guideWs = XLSX.utils.json_to_sheet(spec.guide);
    guideWs['!cols'] = [{ wch: 22 }, { wch: 56 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(wb, guideWs, 'HuongDan');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${spec.fileName}"`);
    res.send(buf);
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
      const wb = XLSX.read(buffer, { type: 'buffer' });
      const firstSheetName =
        wb.SheetNames.find((n) => n !== 'HuongDan') || wb.SheetNames[0];
      if (!firstSheetName) {
        res.status(400).json({ error: 'Tệp Excel không chứa trang tính nào.' });
        return;
      }

      const ws = wb.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

      if (mod === 'data') {
        const dataset = normalizeGeoDataMatrixRows(rawRows, {
          title: typeof body.title === 'string' && body.title.trim() ? body.title.trim() : firstSheetName,
        });
        res.json({
          moduleKey: mod,
          sheetName: firstSheetName,
          totalRawRows: rawRows.length,
          dataset,
          rows: dataset ? [dataset] : [],
        });
        return;
      }

      const normalizedRows = rawRows
        .map((row, idx) => normalizeGeoExcelRow(mod, row, idx))
        .filter((item): item is Record<string, unknown> => item !== null);

      res.json({
        moduleKey: mod,
        sheetName: firstSheetName,
        totalRawRows: rawRows.length,
        rows: normalizedRows,
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
        const ai = getGeminiClient();
        if (!ai) {
          sendMissingKeyError(res);
          return;
        }
        const response = await callGeminiWithFallback((model) =>
          ai.models.generateContent({
            model,
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
          })
        );
        res.json({
          fileName,
          kind: 'pdf',
          text: String(response.text || '').trim(),
        });
        return;
      }

      res.status(400).json({
        error: 'Chỉ hỗ trợ trích xuất văn bản từ .docx, .pdf, .txt hoặc .csv.',
      });
    } catch (error) {
      sendGeminiError(res, error, 'Geography parse-document error:');
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
        const ai = getGeminiClient();
        if (!ai) {
          sendMissingKeyError(res);
          return;
        }
        const response = await callGeminiWithFallback((model) =>
          ai.models.generateContent({
            model,
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
          })
        );
        res.json({
          fileName,
          kind: 'pdf',
          text: String(response.text || '').trim(),
        });
        return;
      }

      res.status(400).json({
        error: 'Chỉ hỗ trợ trích xuất văn bản từ .docx, .pdf, .txt hoặc .md.',
      });
    } catch (error) {
      sendGeminiError(res, error, 'Literature parse-document error:');
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
