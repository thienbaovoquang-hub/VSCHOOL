export interface NormalizedChatTurn {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export function normalizeCopilotChatTurns(body: Record<string, unknown> | null | undefined): NormalizedChatTurn[] {
  const safeBody = body ?? {};
  const incomingMessage =
    typeof safeBody.message === 'string' && safeBody.message.trim()
      ? safeBody.message.trim()
      : typeof safeBody.prompt === 'string' && safeBody.prompt.trim()
        ? safeBody.prompt.trim()
        : '';

  const normalizedTurns: NormalizedChatTurn[] = [];
  if (Array.isArray(safeBody.messages)) {
    for (const entry of safeBody.messages.slice(-10)) {
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

  return normalizedTurns;
}

export function buildCopilotChatSystemInstruction(params: {
  displayName?: string;
  effectiveRole: string;
  contextSummary?: unknown;
}): string {
  const contextText = params.contextSummary
    ? typeof params.contextSummary === 'string'
      ? params.contextSummary
      : JSON.stringify(params.contextSummary)
    : '';

  return [
    'Bạn là SchoolHub AI Copilot — trợ lý giáo dục và quản lý trường học bằng tiếng Việt.',
    `Người dùng: ${params.displayName || 'Người dùng'} | Vai trò: ${params.effectiveRole}.`,
    contextText
      ? `Dữ liệu thực tế trong phạm vi vai trò:\n${contextText}`
      : 'Không có số liệu trường học đính kèm.',
    'Quy tắc trả lời BẮT BUỘC (ưu tiên tốc độ, rõ ràng, ngắn gọn):',
    '1. Đi thẳng vào nội dung ngay từ dòng đầu tiên. KHÔNG chào hỏi ("Chào...", "Rất vui..."), KHÔNG nhắc lại câu hỏi, KHÔNG viết mở bài hay kết bài dài dòng.',
    '2. Khi hướng dẫn quy trình, thao tác, cách làm hoặc giải bài: trình bày ĐỦ TỪNG BƯỚC đánh số rõ ràng (`1.`, `2.`, `3.`...). Mỗi bước gồm tiêu đề ngắn in đậm + 1 câu mô tả hành động cụ thể, trọng tâm (không lan man).',
    '3. Độ dài gọn gàng (khoảng 100–220 từ cho câu hỏi thông thường); chỉ viết thêm nếu người dùng yêu cầu chi tiết hơn.',
    '4. Khi phân tích số liệu hệ thống: tách gọn 2 mục `### Số liệu thực tế` và `### Các bước đề xuất`; nếu chỉ số bằng 0 thì nêu rõ, tuyệt đối không bịa số liệu.',
    '5. Tuyệt đối không tiết lộ dữ liệu tư vấn tâm lý bảo mật hoặc thông tin vượt ngoài vai trò người dùng.',
  ].join('\n');
}

export function buildAnalyticsAnalyzeSystemInstruction(): string {
  return [
    'Bạn là chuyên gia phân tích dữ liệu giáo dục của SchoolHub.',
    'Quy tắc trình bày BẮT BUỘC:',
    '1. Đi thẳng vào kết quả phân tích bằng tiếng Việt, KHÔNG chào hỏi hay mở bài sáo rỗng.',
    '2. Luôn trình bày ngắn gọn, rõ ràng theo đúng 2 phần:',
    '### Số liệu thực tế',
    '- Tóm tắt súc tích các chỉ số trọng tâm (gạch đầu dòng ngắn, tối đa 4–5 ý). Nếu dữ liệu bằng 0 hoặc trống, ghi rõ chưa có dữ liệu và không bịa thêm.',
    '### Đề xuất hành động từng bước',
    '1. **Tên bước ngắn gọn**: Hành động cụ thể, đối tượng thực hiện và kết quả kỳ vọng (1–2 câu/bước, đủ 3–5 bước rõ ràng).',
  ].join('\n');
}

export function buildAnalyticsAnalyzePrompt(params: {
  focus: string;
  role: string;
  question?: string;
  stats: unknown;
}): string {
  return [
    `Phạm vi phân tích: ${params.focus} | Vai trò xem: ${params.role}.`,
    params.question
      ? `Câu hỏi trọng tâm: ${params.question}`
      : 'Hãy tóm tắt số liệu cốt lõi và đề xuất các bước hành động ưu tiên.',
    `Số liệu thực tế được phép truy cập: ${JSON.stringify(params.stats ?? {})}`,
  ].join('\n');
}
