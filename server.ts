import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, Type } from '@google/genai';
import mammoth from 'mammoth';
import { parseRuleClausesLocally } from './src/utils/emulationRules.ts';
import { registerGoogleWorkspaceRoutes } from './src/server/googleRoutes.ts';
import {
  parseDevelopmentAdminMode,
  resolveBackendApiEffectiveRole,
} from './src/utils/devAdminMode.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const GEMINI_MODEL = 'gemini-4-hydrogen';
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

function buildFallbackChatReply(
  query: string,
  userContext?: { displayName?: string; role?: string },
  contextSummary?: unknown
): string {
  const q = query.toLowerCase();
  const role = resolveBackendApiEffectiveRole(userContext?.role, DEVELOPMENT_ADMIN_MODE);

  if (q.includes('tư vấn') && role !== 'counselor' && role !== 'student') {
    return [
      '[Quyền truy cập]',
      '- Hồ sơ tư vấn tâm lý học đường là dữ liệu bảo mật riêng tư. Vai trò hiện tại không có quyền tra cứu nội dung tư vấn của học sinh.',
    ].join('\n');
  }

  if (q.includes('rfid') || q.includes('mượn sách') || q.includes('thư viện')) {
    return [
      '[Hướng dẫn thực tế]',
      '1. Mở ứng dụng **Thư viện** -> tab **Mượn sách** hoặc **Danh mục sách**.',
      '2. Quét thẻ học sinh (RFID) hoặc chọn người mượn trong danh sách.',
      '3. Quét mã vạch bản sao sách (Copy Barcode) và xác nhận giao dịch mượn.',
    ].join('\n');
  }
  if (q.includes('phản ánh') || q.includes('ẩn danh') || q.includes('đơn')) {
    return [
      '[Hướng dẫn thực tế]',
      '- Mở ứng dụng **Dịch vụ học sinh** -> chọn tab **Phản ánh** hoặc **Đơn từ**.',
      '- Có thể bật chế độ ẩn danh khi gửi phản ánh; phản ánh thuộc danh mục Cơ sở vật chất sẽ tự động tạo phiếu bảo trì.',
    ].join('\n');
  }
  if (q.includes('điểm') || q.includes('thời khóa biểu') || q.includes('bài tập')) {
    return [
      '[Tra cứu học tập]',
      '- Mở ứng dụng **Học tập** trên Desktop.',
      '- Sử dụng các tab: **Thời khóa biểu**, **Điểm danh**, **Điểm số**, **Bài tập**, **Học liệu**.',
    ].join('\n');
  }

  const summaryText =
    typeof contextSummary === 'string' && contextSummary.trim()
      ? `\n[Dữ liệu trong phạm vi quyền của bạn]\n${contextSummary}`
      : '';

  return [
    `[Phản hồi cho ${userContext?.displayName || 'bạn'}]`,
    `- Câu hỏi: "${query}"`,
    summaryText,
    '[Gợi ý]',
    '- Mở trực tiếp các ứng dụng tương ứng trên Desktop để xem và thao tác dữ liệu thực.',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildFallbackAnalysisReply(
  stats: Record<string, unknown>,
  focus: string,
  role: string,
  question?: string
): string {
  const isRestrictedRole = role === 'student' || role === 'librarian' || role === 'staff';
  if (isRestrictedRole) {
    return [
      `[Số liệu thực tế theo vai trò (${focus})]`,
      question ? `- Câu hỏi: ${question}` : '',
      `- Dữ liệu tổng hợp toàn trường chỉ hiển thị cho Ban Giám hiệu và Quản trị viên.`,
      `- Đầu sách thư viện: **${Number(stats.booksCount ?? 0)}** · Đang mượn: **${Number(stats.activeLoans ?? 0)}**.`,
      '[Gợi ý hành động]',
      '- Sử dụng đúng phân hệ thuộc quyền hạn của bạn để kiểm tra chi tiết.',
    ]
      .filter(Boolean)
      .join('\n');
  }

  const studentCount = Number(stats.studentsCount ?? stats.studentCount ?? 0);
  const teacherCount = Number(stats.teachersCount ?? stats.teacherCount ?? 0);
  const classCount = Number(stats.classesCount ?? stats.classCount ?? 0);
  const bookCount = Number(stats.booksCount ?? stats.bookCount ?? 0);
  const activeBorrowCount = Number(stats.activeLoans ?? stats.activeBorrowCount ?? 0);
  const openFeedbackCount = Number(stats.feedbackCount ?? stats.openFeedbackCount ?? 0);
  const openMaintenanceCount = Number(stats.openMaintenance ?? stats.openMaintenanceCount ?? 0);

  const isAllEmpty =
    studentCount === 0 &&
    teacherCount === 0 &&
    classCount === 0 &&
    bookCount === 0 &&
    openFeedbackCount === 0 &&
    openMaintenanceCount === 0;

  return [
    `[Số liệu thực tế (${focus})]`,
    question ? `- Trọng tâm yêu cầu: ${question}` : '',
    `- Quy mô: **${studentCount}** học sinh · **${teacherCount}** giáo viên · **${classCount}** lớp học.`,
    `- Thư viện: **${bookCount}** đầu sách, **${activeBorrowCount}** lượt đang mượn.`,
    `- Vận hành: **${openFeedbackCount}** phản ánh ghi nhận, **${openMaintenanceCount}** yêu cầu bảo trì đang mở.`,
    '[Gợi ý hành động]',
    isAllEmpty
      ? '- Chưa có dữ liệu trong hệ thống. Hãy nhập Excel/CSV hoặc tạo lớp học, học sinh, đầu sách mới trước khi phân tích xu hướng.'
      : '- Ưu tiên xử lý các phiếu bảo trì và phản ánh chưa hoàn tất; theo dõi lịch sử quá hạn thư viện.',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildFallbackEmulationAssist(
  mode: string,
  scopeData: Record<string, unknown>,
  customPrompt?: string
): string {
  const totalRecords = Number(scopeData.totalRecords ?? 0);
  const totalViolations = Number(scopeData.totalViolations ?? 0);
  const totalAchievements = Number(scopeData.totalAchievements ?? 0);
  const pendingCount = Number(scopeData.pendingVerificationCount ?? 0);
  const openAppeals = Number(scopeData.openAppealsCount ?? 0);
  const topClass = scopeData.topClass ? String(scopeData.topClass) : 'Chưa có dữ liệu';

  if (mode === 'competition_draft') {
    return [
      '[Dự thảo Đề xuất Phong trào Thi đua (Tham khảo)]',
      customPrompt ? `- Chủ đề gợi ý: ${customPrompt}` : '- Chủ đề gợi ý: Tuần lễ Nề nếp – Học tốt – Thư viện Xanh',
      '1. **Mục tiêu**: Khuyến khích học sinh rèn luyện chuyên cần, đọc sách thư viện và giữ gìn vệ sinh lớp học.',
      '2. **Tiêu chí gợi ý**:',
      '   - Chuyên cần đúng giờ (Tối đa 30 điểm)',
      '   - Hoạt động học tập & đọc sách (Tối đa 40 điểm)',
      '   - Bảo vệ cơ sở vật chất & nề nếp (Tối đa 30 điểm)',
      '3. **Lưu ý quản trị**: Cần Ban Giám hiệu kiểm tra thông số, quy chế cộng điểm trước khi kích hoạt.',
    ].join('\n');
  }

  if (mode === 'monthly_report') {
    return [
      '[Dự thảo Báo cáo Thi đua Định kỳ (Chỉ dựa trên dữ liệu đã ghi nhận)]',
      `- Tổng lượt ghi nhận hợp lệ: **${totalRecords}** (Thành tích: **${totalAchievements}** | Vi phạm: **${totalViolations}**).`,
      `- Lớp dẫn đầu hiện tại: **${topClass}**.`,
      `- Hồ sơ chờ xác minh: **${pendingCount}** | Khiếu nại đang mở: **${openAppeals}**.`,
      '[Đề xuất hành động cho Ban Giám hiệu]',
      totalRecords === 0
        ? '- Hiện chưa có dữ liệu thi đua được ghi nhận trong kỳ. Khởi tạo bộ tiêu chí nội quy và ghi nhận nề nếp để bắt đầu tổng hợp.'
        : '- Xử lý dứt điểm các bản ghi chờ xác minh và khiếu nại trước khi chốt sổ kỳ thi đua.',
    ].join('\n');
  }

  if (mode === 'anomalies') {
    return [
      '[Phân tích Bất thường & Xu hướng Thi đua]',
      `- Dữ liệu phân tích: ${totalRecords} bản ghi hợp lệ, ${pendingCount} bản ghi chờ duyệt, ${openAppeals} khiếu nại.`,
      totalRecords === 0
        ? '- Chưa đủ bản ghi hợp lệ để phát hiện bất thường.'
        : `- Tỉ lệ thành tích/vi phạm hiện tại: ${totalAchievements} thành tích so với ${totalViolations} vi phạm.`,
      '- Lưu ý: Hệ thống AI chỉ đưa ra gợi ý tham khảo, mọi điều chỉnh điểm đều phải do cán bộ có thẩm quyền xác nhận.',
    ].join('\n');
  }

  return [
    '[Tóm tắt Tình hình Thi đua]',
    `- Bản ghi hợp lệ: **${totalRecords}** (Thành tích: ${totalAchievements}, Vi phạm: ${totalViolations}).`,
    `- Lớp đứng đầu: **${topClass}**.`,
    `- Hồ sơ chờ xác minh: **${pendingCount}**, khiếu nại đang xử lý: **${openAppeals}**.`,
  ].join('\n');
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
    const user = body.user;
    const effectiveRole = resolveBackendApiEffectiveRole(user?.role, DEVELOPMENT_ADMIN_MODE);
    const contextSummary = body.contextSummary;

    try {
      if (!incomingMessage) {
        res.status(400).json({ error: 'Thiếu nội dung câu hỏi.' });
        return;
      }

      const ai = getGeminiClient();
      if (!ai) {
        res.json({
          text: buildFallbackChatReply(incomingMessage, { ...user, role: effectiveRole }, contextSummary),
          source: 'local-assistant',
        });
        return;
      }

      const prompt = [
        'Bạn là SchoolHub AI Copilot — trợ lý hỗ trợ quản lý trường học và học tập.',
        `Người dùng: ${user?.displayName || 'Người dùng'} | Vai trò: ${effectiveRole}.`,
        contextSummary
          ? `Dữ liệu thực tế trong phạm vi vai trò này:\n${
              typeof contextSummary === 'string' ? contextSummary : JSON.stringify(contextSummary)
            }`
          : 'Chưa có dữ liệu đính kèm.',
        'Quy tắc bắt buộc:',
        '1. Tuyệt đối không tiết lộ dữ liệu tư vấn tâm lý bảo mật hoặc thông tin vượt ngoài vai trò người dùng.',
        '2. Tách rõ mục [Số liệu thực tế] và mục [Gợi ý].',
        '3. Nếu một chỉ số bằng 0 hoặc chưa có dữ liệu, nói rõ là chưa có dữ liệu — tuyệt đối không bịa đặt số liệu.',
        `Câu hỏi: ${incomingMessage}`,
      ]
        .filter(Boolean)
        .join('\n');

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
      });

      res.json({
        text: response.text || buildFallbackChatReply(incomingMessage, user, contextSummary),
        source: 'gemini',
      });
    } catch (error) {
      console.error('AI chat error:', error);
      res.json({
        text: buildFallbackChatReply(incomingMessage, user, contextSummary),
        source: 'fallback',
      });
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
        res.json({
          text: buildFallbackAnalysisReply(safeStats, focus, role, question || undefined),
          source: 'local-analytics',
        });
        return;
      }

      const prompt = [
        'Bạn là chuyên gia phân tích dữ liệu giáo dục của SchoolHub.',
        `Phạm vi phân tích: ${focus} | Vai trò xem: ${role}.`,
        question ? `Câu hỏi trọng tâm: ${question}` : '',
        `Số liệu thực tế được phép truy cập: ${JSON.stringify(safeStats)}`,
        'Quy tắc: Tách rõ [Số liệu thực tế] và [Gợi ý hành động]. Nếu dữ liệu bằng 0 hoặc trống, thông báo rõ chưa có dữ liệu và tuyệt đối không bịa thêm số liệu.',
      ]
        .filter(Boolean)
        .join('\n');

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
      });

      res.json({
        text: response.text || buildFallbackAnalysisReply(safeStats, focus, role, question || undefined),
        source: 'gemini',
      });
    } catch (error) {
      console.error('AI analyze error:', error);
      res.json({
        text: buildFallbackAnalysisReply(safeStats, focus, role, question || undefined),
        source: 'fallback',
      });
    }
  });

  app.post('/api/ai/parse-rules', async (req, res) => {
    const body = req.body ?? {};
    const fileName = String(body.fileName || 'noi-quy.txt');
    const mimeType = String(body.mimeType || 'text/plain');
    const fileBase64 = typeof body.fileBase64 === 'string' ? body.fileBase64 : '';
    let extractedText = typeof body.extractedText === 'string' ? body.extractedText.trim() : '';

    try {
      // Extract DOCX server-side if text wasn't already extracted client-side
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
        const localItems = extractedText ? parseRuleClausesLocally(extractedText) : [];
        res.json({
          summary:
            localItems.length > 0
              ? `Đã phân tích cục bộ ${localItems.length} điều khoản từ "${fileName}" (ở trạng thái Nháp chờ duyệt).`
              : 'Chưa trích xuất được điều khoản có cấu trúc từ tài liệu này.',
          extractedText,
          criteria: localItems,
          source: 'local-parser',
          note: 'GEMINI_API_KEY chưa được cấu hình — đã dùng bộ phân tích điều khoản cục bộ.',
        });
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

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
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
      });

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
      console.error('AI parse-rules error:', error);
      const localItems = extractedText ? parseRuleClausesLocally(extractedText) : [];
      res.json({
        summary:
          localItems.length > 0
            ? `Đã chuyển sang bộ phân tích dự phòng (${localItems.length} điều khoản nháp).`
            : 'Không thể trích xuất tự động lúc này, vui lòng nhập trực tiếp hoặc kiểm tra lại tệp.',
        extractedText,
        criteria: localItems,
        source: 'fallback',
      });
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
        res.json({
          text: buildFallbackEmulationAssist(mode, scopeData, customPrompt || undefined),
          source: 'local-assistant',
        });
        return;
      }

      const prompt = [
        'Bạn là Trợ lý Cố vấn Thi đua & Nề nếp của SchoolHub.',
        `Chế độ hỗ trợ: ${mode} | Vai trò người dùng: ${role}.`,
        customPrompt ? `Yêu cầu cụ thể: ${customPrompt}` : '',
        `Dữ liệu thi đua đã ẩn thông tin nhạy cảm: ${JSON.stringify(scopeData)}`,
        'QUY TẮC BẮT BUỘC:',
        '1. Vai trò chỉ là THAM KHẢO/HỖ TRỢ: tuyệt đối không tự ý chấm điểm, trừ điểm hay phạt học sinh.',
        '2. Chỉ phân tích trên dữ liệu thực được cung cấp; nếu bằng 0 hãy nói rõ chưa có dữ liệu.',
        '3. Trình bày mạch lạc bằng tiếng Việt với tiêu đề rõ ràng và gạch đầu dòng ngắn gọn.',
      ]
        .filter(Boolean)
        .join('\n');

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
      });

      res.json({
        text: response.text || buildFallbackEmulationAssist(mode, scopeData, customPrompt || undefined),
        source: 'gemini',
      });
    } catch (error) {
      console.error('AI emulation-assist error:', error);
      res.json({
        text: buildFallbackEmulationAssist(mode, scopeData, customPrompt || undefined),
        source: 'fallback',
      });
    }
  });

  registerGoogleWorkspaceRoutes(app, getGeminiClient, GEMINI_MODEL);

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
