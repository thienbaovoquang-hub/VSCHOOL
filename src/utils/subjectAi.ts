import type { SubjectId } from './subjectRegistry.ts';

export type SubjectAiMode =
  | 'tutor_chat'
  | 'solve_step_by_step'
  | 'wrong_answer_coach'
  | 'similar_problems'
  | 'writing_outline'
  | 'writing_feedback'
  | 'grammar_check'
  | 'quiz_generate'
  | 'event_analysis'
  | 'figure_role'
  | 'period_compare'
  | 'mindmap_timeline'
  | 'chart_analysis'
  | 'geo_calc'
  | 'phenomenon_analysis'
  | 'exam_guide';

export interface SubjectAiChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface SubjectAiImageInput {
  mimeType: string;
  dataBase64: string;
}

export interface ValidatedSubjectAiRequest {
  subjectId: SubjectId;
  mode: SubjectAiMode;
  prompt: string;
  messages: SubjectAiChatTurn[];
  contextText: string;
  previousSolution: string;
  image: SubjectAiImageInput | null;
}

export interface SubjectAiPreset {
  id: string;
  label: string;
  mode: SubjectAiMode;
  prompt: string;
}

export interface SubjectAiProfile {
  subjectId: SubjectId;
  subjectName: string;
  appTitle: string;
  tutorTitle: string;
  description: string;
  personaInstruction: string;
  presets: SubjectAiPreset[];
}

export const VALID_SUBJECT_IDS: readonly SubjectId[] = [
  'english',
  'math',
  'physics',
  'chemistry',
  'literature',
  'history',
  'geography',
] as const;

export const VALID_SUBJECT_AI_MODES: readonly SubjectAiMode[] = [
  'tutor_chat',
  'solve_step_by_step',
  'wrong_answer_coach',
  'similar_problems',
  'writing_outline',
  'writing_feedback',
  'grammar_check',
  'quiz_generate',
  'event_analysis',
  'figure_role',
  'period_compare',
  'mindmap_timeline',
  'chart_analysis',
  'geo_calc',
  'phenomenon_analysis',
  'exam_guide',
] as const;

export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

export const MAX_PROMPT_CHARS = 8000;
export const MAX_CONTEXT_CHARS = 16000;
export const MAX_PREVIOUS_SOLUTION_CHARS = 8000;
export const MAX_MESSAGES_COUNT = 12;
export const MAX_IMAGE_BASE64_CHARS = 8_000_000;

export const SUBJECT_AI_PROFILES: Record<SubjectId, SubjectAiProfile> = {
  english: {
    subjectId: 'english',
    subjectName: 'Tiếng Anh',
    appTitle: 'Lingo – Học tiếng Anh',
    tutorTitle: 'Trợ lý AI Tiếng Anh (Lingo)',
    description: 'Giải thích từ vựng – ngữ pháp, sửa bài viết tiếng Anh và tạo bài tập trắc nghiệm.',
    personaInstruction: [
      'Bạn là gia sư Tiếng Anh thân thiện, giải thích bằng tiếng Việt rõ ràng kèm ví dụ tiếng Anh tự nhiên (có thể kèm phiên âm IPA nếu hữu ích).',
      'Khi sửa câu/bài viết: chỉ ra lỗi sai cụ thể (thì, giới từ, cấu trúc, từ vựng), đưa phiên bản tự nhiên hơn và giải thích ngắn gọn.',
      'Khi được cung cấp danh sách từ vựng hoặc ngữ pháp hiện có của học sinh, hãy ưu tiên liên kết và ôn lại các nội dung đó.',
    ].join('\n'),
    presets: [
      {
        id: 'en-grammar',
        label: 'Giải thích ngữ pháp',
        mode: 'tutor_chat',
        prompt: 'Phân biệt nhanh cấu trúc và cách dùng thì Hiện tại hoàn thành với Quá khứ đơn kèm 3 ví dụ.',
      },
      {
        id: 'en-check',
        label: 'Sửa câu tiếng Anh',
        mode: 'grammar_check',
        prompt: 'Kiểm tra và sửa lỗi ngữ pháp, diễn đạt cho đoạn/câu sau: "Yesterday I go to school and meet my friends, we very happy."',
      },
      {
        id: 'en-quiz',
        label: 'Tạo câu hỏi ôn tập',
        mode: 'quiz_generate',
        prompt: 'Tạo 3 câu hỏi trắc nghiệm tiếng Anh (A, B, C, D) kèm đáp án và giải thích ngắn về câu điều kiện loại 1 & 2.',
      },
    ],
  },
  math: {
    subjectId: 'math',
    subjectName: 'Toán',
    appTitle: 'MathBuddy – Học Toán',
    tutorTitle: 'Trợ lý AI Toán học (MathBuddy)',
    description: 'Giải Toán từng bước với công thức LaTeX, nhận diện ảnh đề và sinh bài tập tương tự.',
    personaInstruction: [
      'Bạn là gia sư Toán thân thiện, trả lời bằng tiếng Việt chính xác, rõ ràng, dễ hiểu.',
      'BẮT BUỘC viết mọi công thức toán học bằng LaTeX nằm trong dấu $...$ (ví dụ $\\Delta = b^2 - 4ac$, $x = \\frac{-b}{2a}$); không dùng \\( \\) hay $$.',
      'Khi giải toán: nêu điều kiện xác định (nếu có), phân tích hướng đi, trình bày từng bước có giải thích và kết luận rõ ràng.',
      'Nếu bài toán liên quan đến đồ thị hàm số, hãy ghi thêm biểu thức hàm số dạng y = ... để học sinh nhập vào mục Graph.',
    ].join('\n'),
    presets: [
      {
        id: 'math-step',
        label: 'Giải phương trình từng bước',
        mode: 'solve_step_by_step',
        prompt: 'Giải từng bước phương trình: $x^2 - 5x + 6 = 0$ và nêu cách kiểm tra lại nghiệm.',
      },
      {
        id: 'math-graph',
        label: 'Khảo sát hàm số vẽ Graph',
        mode: 'tutor_chat',
        prompt: 'Hướng dẫn tìm tọa độ đỉnh, trục đối xứng và giao điểm với các trục của parabol $y = x^2 - 2x - 3$.',
      },
      {
        id: 'math-similar',
        label: 'Tạo 3 bài tương tự',
        mode: 'similar_problems',
        prompt: 'Dựa trên dạng phương trình bậc hai một ẩn, hãy tạo 3 bài tập tương tự từ dễ đến nâng cao kèm đáp số.',
      },
    ],
  },
  physics: {
    subjectId: 'physics',
    subjectName: 'Vật Lý',
    appTitle: 'Vật Lý Cute',
    tutorTitle: 'Trợ lý AI Vật Lý',
    description: 'Tóm tắt dữ kiện chuẩn SI, giải bài Vật Lý bằng công thức KaTeX và đọc ảnh đề.',
    personaInstruction: [
      'Bạn là gia sư Vật Lý trực quan, trả lời bằng tiếng Việt mạch lạc, chuẩn kiến thức phổ thông.',
      'Luôn tóm tắt dữ kiện đã cho, quy đổi đơn vị sang hệ SI (m, kg, s, N, J, V, A, Ω) trước khi thế số.',
      'Viết công thức Vật Lý bằng LaTeX trong $...$ (ví dụ $s = v_0 t + \\frac{1}{2}at^2$, $F = ma$) để hiển thị chuẩn.',
      'Kiểm tra tính hợp lý vật lý và ghi rõ đơn vị ở kết quả cuối cùng.',
    ].join('\n'),
    presets: [
      {
        id: 'phy-kinematics',
        label: 'Giải bài chuyển động',
        mode: 'solve_step_by_step',
        prompt: 'Một xe khởi hành từ nghỉ với gia tốc $a = 2\\ \\mathrm{m/s^2}$ trong $t = 5\\ \\mathrm{s}$. Tính vận tốc cuối và quãng đường đi được.',
      },
      {
        id: 'phy-spring',
        label: 'Giải thích con lắc lò xo',
        mode: 'tutor_chat',
        prompt: 'Giải thích ý nghĩa công thức chu kỳ $T = 2\\pi\\sqrt{\\frac{m}{k}}$ và cơ năng của con lắc lò xo trong phần Mô phỏng.',
      },
      {
        id: 'phy-similar',
        label: 'Tạo bài Vật Lý tương tự',
        mode: 'similar_problems',
        prompt: 'Đề xuất 3 bài tập tương tự về định luật II Newton và rơi tự do (có đáp số chuẩn SI).',
      },
    ],
  },
  chemistry: {
    subjectId: 'chemistry',
    subjectName: 'Hóa Học',
    appTitle: 'ChemiLab – Học Hóa vui',
    tutorTitle: 'Trợ lý AI Hóa Học (ChemiLab)',
    description: 'Cân bằng phương trình, giải toán mol/nồng độ/pH, giải thích hiện tượng và đọc ảnh đề.',
    personaInstruction: [
      'Bạn là gia sư Hóa Học rõ ràng, chính xác cho học sinh phổ thông Việt Nam.',
      'Viết công thức hóa học chuẩn (ví dụ H2O, Fe2O3, CuSO4, NaOH, H2SO4) và phương trình hóa học đã cân bằng kèm điều kiện phản ứng / hiện tượng (kết tủa, màu dung dịch, sủi bọt khí) nếu có.',
      'Với bài toán tính toán: trình bày rõ các bước tính số mol, tỉ lệ phương trình, bảo toàn khối lượng/nguyên tố/electron (nếu dùng) và kết luận kèm đơn vị.',
    ].join('\n'),
    presets: [
      {
        id: 'chem-mol',
        label: 'Giải bài toán mol & phản ứng',
        mode: 'solve_step_by_step',
        prompt: 'Cho 5,6 g Fe tác dụng hoàn toàn với dung dịch HCl dư. Viết PTHH và tính thể tích khí H2 thu được (đktc) cùng khối lượng muối FeCl2.',
      },
      {
        id: 'chem-eq',
        label: 'Cân bằng & hiện tượng',
        mode: 'tutor_chat',
        prompt: 'Cân bằng phản ứng Cu + HNO3(loãng) → Cu(NO3)2 + NO + H2O theo thăng bằng electron và nêu hiện tượng quan sát được.',
      },
      {
        id: 'chem-similar',
        label: 'Tạo bài Hóa tương tự',
        mode: 'similar_problems',
        prompt: 'Tạo 3 bài tập tương tự về nồng độ mol và phản ứng trung hòa axit – bazơ kèm đáp số ngắn.',
      },
    ],
  },
  literature: {
    subjectId: 'literature',
    subjectName: 'Ngữ Văn',
    appTitle: 'Văn Hiến',
    tutorTitle: 'Trợ lý AI Ngữ Văn (Văn Hiến)',
    description: 'Hướng dẫn phân tích đề, lập dàn ý, nhận xét bài viết và giải đáp kiến thức Ngữ Văn.',
    personaInstruction: [
      'Bạn là trợ lý học Ngữ Văn cho học sinh Việt Nam.',
      'Ưu tiên hướng dẫn cách tư duy và cách làm bài (câu hỏi gợi mở, các bước, tiêu chí đánh giá) trước khi đưa ví dụ; không viết sẵn bài văn mẫu hoàn chỉnh trừ khi được yêu cầu rõ, và khi đó vẫn giải thích cách làm.',
      'TUYỆT ĐỐI không bịa câu thơ, câu văn, dẫn chứng, năm tháng hay thông tin về tác giả, tác phẩm: chỉ trích dẫn từ tài liệu được cung cấp; nếu không chắc, nói rõ là chưa chắc chắn và đề nghị đối chiếu sách giáo khoa.',
      'Trả lời bằng tiếng Việt, ngắn gọn, có cấu trúc.',
    ].join('\n'),
    presets: [
      {
        id: 'lit-outline',
        label: 'Hướng dẫn lập dàn ý',
        mode: 'writing_outline',
        prompt: 'Hướng dẫn các bước phân tích đề và lập dàn ý cho bài nghị luận văn học về vẻ đẹp tình đồng chí hoặc tình cảm gia đình.',
      },
      {
        id: 'lit-rhetoric',
        label: 'Phân tích biện pháp tu từ',
        mode: 'tutor_chat',
        prompt: 'Hướng dẫn cách nhận biết và phân tích tác dụng của ẩn dụ, hoán dụ và điệp ngữ trong đoạn văn/thơ.',
      },
      {
        id: 'lit-feedback',
        label: 'Góp ý cách viết đoạn văn',
        mode: 'writing_feedback',
        prompt: 'Nhận xét giúp mình cách triển khai câu chủ đề, lập luận và chuyển ý cho đoạn văn nghị luận xã hội ngắn.',
      },
    ],
  },
  history: {
    subjectId: 'history',
    subjectName: 'Lịch Sử',
    appTitle: 'Sử Ký – Kho lưu trữ Lịch sử',
    tutorTitle: 'Trợ lý Lịch sử (Sử Ký)',
    description: 'Giải đáp câu hỏi lịch sử, phân tích sự kiện 4 chiều, vai trò nhân vật, so sánh thời kỳ, lập sơ đồ tư duy & đọc tư liệu.',
    personaInstruction: [
      'Bạn là sử gia và trợ lý học tập Lịch sử chuẩn xác, khách quan cho học sinh Việt Nam.',
      'QUY TẮC SỬ HỌC BẮT BUỘC:',
      '1. Phân biệt rõ ràng 3 lớp thông tin bằng nhãn đầu dòng khi cần: [Sự kiện] (mốc đã xác thực), [Tư liệu] (trích dẫn/nguồn tham khảo cụ thể), và [Nhận định] (đánh giá/ý nghĩa lịch sử).',
      '2. TUYỆT ĐỐI KHÔNG tự bịa mốc thời gian, tên nhân vật, số liệu, văn kiện hay sự kiện lịch sử. Nếu tư liệu/đề bài chưa rõ hoặc bạn không chắc chắn chi tiết nào, phải nói rõ là chưa đủ căn cứ và khuyến nghị đối chiếu chính sử / sách giáo khoa.',
      '3. Khi người dùng gửi kèm nội dung bài học, sự kiện hoặc tư liệu đã lưu, ưu tiên bám sát và đối chiếu với ngữ cảnh đó.',
      '4. Trình bày cô đọng, phân cấp rõ ràng bằng tiếng Việt chuẩn mực.',
    ].join('\n'),
    presets: [
      {
        id: 'his-event',
        label: 'Phân tích sự kiện 4 chiều',
        mode: 'event_analysis',
        prompt: 'Phân tích sự kiện lịch sử theo cấu trúc: Bối cảnh – Nguyên nhân – Diễn biến chính – Kết quả & Ý nghĩa lịch sử.',
      },
      {
        id: 'his-figure',
        label: 'Vai trò nhân vật lịch sử',
        mode: 'figure_role',
        prompt: 'Phân tích bối cảnh hoạt động, đóng góp cốt lõi và ý nghĩa lịch sử của nhân vật được nêu (tách rõ sự kiện và nhận định).',
      },
      {
        id: 'his-compare',
        label: 'So sánh thời kỳ / phong trào',
        mode: 'period_compare',
        prompt: 'Lập bảng so sánh điểm giống nhau, khác nhau (mục tiêu, lực lượng, phương pháp, kết quả) giữa hai thời kỳ hoặc phong trào lịch sử.',
      },
      {
        id: 'his-mindmap',
        label: 'Bảng tổng hợp & Sơ đồ tư duy',
        mode: 'mindmap_timeline',
        prompt: 'Hệ thống hóa nội dung thành bảng tổng hợp, sơ đồ tư duy phân nhánh và dòng thời gian cô đọng để dễ ôn tập.',
      },
    ],
  },
  geography: {
    subjectId: 'geography',
    subjectName: 'Địa Lý',
    appTitle: 'Địa Lý – Atlat & Khám phá',
    tutorTitle: 'Trợ lý Địa lý AI',
    description: 'Giải bài tập, đọc bản đồ/Atlat/biểu đồ từ ảnh, tính chỉ số địa lý, phân tích hiện tượng và hướng dẫn phương pháp thi.',
    personaInstruction: [
      'Bạn là gia sư và chuyên gia Địa lý chuẩn xác, khoa học, giàu tính trực quan cho học sinh Việt Nam.',
      'QUY TẮC ĐỊA LÝ BẮT BUỘC:',
      '1. Phân biệt rõ số liệu theo từng năm, từng giai đoạn và đơn vị đo; ghi rõ nguồn tham khảo nếu có trong tài liệu hoặc kiến thức chuẩn.',
      '2. TUYỆT ĐỐI KHÔNG tự tạo hoặc bịa đặt số liệu thống kê, tọa độ hay trích dẫn; nếu đề bài/ảnh thiếu số liệu hoặc mờ, hãy nêu rõ dữ kiện còn thiếu để học sinh bổ sung.',
      '3. Khi tính các chỉ số địa lý (cơ cấu %, mật độ dân số, tốc độ tăng trưởng, bình quân): luôn nêu công thức tổng quát, thay số theo từng năm và ghi đúng đơn vị.',
      '4. Khi phân tích biểu đồ/bảng số liệu/Atlat: tách rõ phần Nhận xét (xu hướng, biến động, so sánh có dẫn chứng số liệu) và Giải thích (nguyên nhân tự nhiên, kinh tế – xã hội).',
    ].join('\n'),
    presets: [
      {
        id: 'geo-chart',
        label: 'Nhận xét & so sánh biểu đồ',
        mode: 'chart_analysis',
        prompt: 'Hướng dẫn cách nhận xét, so sánh và giải thích bảng số liệu / biểu đồ Địa lý theo đúng từng mốc năm.',
      },
      {
        id: 'geo-calc',
        label: 'Tính chỉ số địa lý',
        mode: 'geo_calc',
        prompt: 'Trình bày công thức và các bước tính cơ cấu (%), mật độ dân số (người/km²), tốc độ tăng trưởng (%) và thu nhập bình quân.',
      },
      {
        id: 'geo-phenom',
        label: 'Phân tích hiện tượng địa lý',
        mode: 'phenomenon_analysis',
        prompt: 'Phân tích nguyên nhân, đặc điểm và hệ quả của hiện tượng gió mùa hoặc biến đổi khí hậu đối với sản xuất và đời sống.',
      },
      {
        id: 'geo-exam',
        label: 'Phương pháp làm bài thi',
        mode: 'exam_guide',
        prompt: 'Hướng dẫn từng bước phương pháp làm bài thi Địa lý (đọc Atlat, xử lý bảng số liệu, chọn biểu đồ thích hợp và trả lời câu hỏi ngắn).',
      },
    ],
  },
};

export function isValidSubjectId(value: unknown): value is SubjectId {
  return typeof value === 'string' && (VALID_SUBJECT_IDS as readonly string[]).includes(value);
}

export function isValidSubjectAiMode(value: unknown): value is SubjectAiMode {
  return typeof value === 'string' && (VALID_SUBJECT_AI_MODES as readonly string[]).includes(value);
}

function stripBase64DataUrlPrefix(rawData: string, fallbackMime: string): {
  mimeType: string;
  dataBase64: string;
} {
  const trimmed = rawData.trim();
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(trimmed);
  if (match) {
    return {
      mimeType: match[1].toLowerCase(),
      dataBase64: match[2].replace(/\s+/g, ''),
    };
  }
  return {
    mimeType: fallbackMime.toLowerCase(),
    dataBase64: trimmed.replace(/\s+/g, ''),
  };
}

export function validateSubjectAiRequest(
  raw: unknown
): { ok: true; value: ValidatedSubjectAiRequest } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Dữ liệu yêu cầu không hợp lệ.' };
  }
  const body = raw as Record<string, unknown>;

  if (!isValidSubjectId(body.subjectId)) {
    return { ok: false, error: 'Thiếu hoặc sai mã môn học (subjectId).' };
  }

  const mode: SubjectAiMode =
    body.mode === undefined
      ? 'tutor_chat'
      : isValidSubjectAiMode(body.mode)
        ? body.mode
        : 'tutor_chat';

  const prompt =
    typeof body.prompt === 'string' ? body.prompt.trim().slice(0, MAX_PROMPT_CHARS) : '';
  const contextText =
    typeof body.contextText === 'string'
      ? body.contextText.trim().slice(0, MAX_CONTEXT_CHARS)
      : '';
  const previousSolution =
    typeof body.previousSolution === 'string'
      ? body.previousSolution.trim().slice(0, MAX_PREVIOUS_SOLUTION_CHARS)
      : '';

  const messages: SubjectAiChatTurn[] = [];
  if (Array.isArray(body.messages)) {
    for (const entry of body.messages.slice(-MAX_MESSAGES_COUNT)) {
      if (!entry || typeof entry !== 'object') continue;
      const item = entry as Record<string, unknown>;
      const content =
        typeof item.content === 'string' ? item.content.trim().slice(0, MAX_PROMPT_CHARS) : '';
      if (!content) continue;
      const role: 'user' | 'assistant' = item.role === 'assistant' ? 'assistant' : 'user';
      messages.push({ role, content });
    }
    while (messages.length > 0 && messages[0].role !== 'user') {
      messages.shift();
    }
    const merged: SubjectAiChatTurn[] = [];
    for (const turn of messages) {
      const prev = merged[merged.length - 1];
      if (prev && prev.role === turn.role) {
        prev.content = `${prev.content}\n\n${turn.content}`.slice(0, MAX_PROMPT_CHARS);
      } else {
        merged.push({ ...turn });
      }
    }
    messages.length = 0;
    messages.push(...merged);
  }

  let image: SubjectAiImageInput | null = null;
  if (body.image !== undefined && body.image !== null) {
    if (typeof body.image !== 'object') {
      return { ok: false, error: 'Dữ liệu ảnh đính kèm không hợp lệ.' };
    }
    const imgObj = body.image as Record<string, unknown>;
    const rawMime = typeof imgObj.mimeType === 'string' ? imgObj.mimeType.trim().toLowerCase() : '';
    const rawData = typeof imgObj.dataBase64 === 'string' ? imgObj.dataBase64 : '';
    const stripped = stripBase64DataUrlPrefix(rawData, rawMime);
    const normalizedMime = stripped.mimeType === 'image/jpg' ? 'image/jpeg' : stripped.mimeType;

    if (!ALLOWED_IMAGE_MIME_TYPES.has(normalizedMime)) {
      return {
        ok: false,
        error: 'Định dạng ảnh chưa được hỗ trợ. Chỉ chấp nhận PNG, JPEG, WebP hoặc GIF.',
      };
    }
    if (!stripped.dataBase64 || stripped.dataBase64.length > MAX_IMAGE_BASE64_CHARS) {
      return {
        ok: false,
        error: 'Ảnh đính kèm trống hoặc vượt quá kích thước cho phép (tối đa ~6MB).',
      };
    }
    image = {
      mimeType: normalizedMime,
      dataBase64: stripped.dataBase64,
    };
  }

  const hasUserTurn = messages.some((turn) => turn.role === 'user');
  if (!prompt && !hasUserTurn && !image && !previousSolution) {
    return { ok: false, error: 'Vui lòng nhập câu hỏi, đề bài hoặc đính kèm ảnh.' };
  }

  return {
    ok: true,
    value: {
      subjectId: body.subjectId,
      mode,
      prompt,
      messages,
      contextText,
      previousSolution,
      image,
    },
  };
}

function describeModeInstruction(mode: SubjectAiMode): string {
  switch (mode) {
    case 'solve_step_by_step':
      return [
        'Chế độ: Giải bài tập từng bước.',
        'Hãy: 1) Tóm tắt dữ kiện & nhận diện dạng bài / kiến thức liên quan. 2) Giải từng bước chi tiết và nêu lý do/công thức áp dụng ở mỗi bước. 3) Kết luận đáp số cuối cùng.',
      ].join('\n');
    case 'wrong_answer_coach':
      return [
        'Chế độ: Giải thích lỗi sai & củng cố trọng tâm.',
        'Hãy chỉ ra vì sao đáp án đúng là chính xác, phân tích lỗi hiểu nhầm phổ biến ở đáp án sai, nêu quy tắc/công thức cần nhớ và gợi ý 1 mẹo kiểm tra nhanh.',
      ].join('\n');
    case 'similar_problems':
      return [
        'Chế độ: Đề xuất 3 bài tập tương tự.',
        'Dựa trên đề bài / nội dung hoặc lời giải trước đó, hãy tạo 3 bài tập tương tự tăng dần độ khó (Cơ bản, Vận dụng, Nâng cao) kèm đáp số / gợi ý ngắn ở cuối.',
      ].join('\n');
    case 'writing_outline':
      return [
        'Chế độ: Hướng dẫn lập dàn ý.',
        'Phân tích đề (yêu cầu, phạm vi, từ khóa), gợi ý hệ thống luận điểm – luận cứ – loại dẫn chứng cần tìm (không tự bịa dẫn chứng), gợi ý mở bài – kết bài và 2–3 câu hỏi gợi mở.',
      ].join('\n');
    case 'writing_feedback':
      return [
        'Chế độ: Nhận xét bài viết.',
        'Nhận xét cụ thể theo 5 tiêu chí: Bố cục, Lập luận, Dẫn chứng, Diễn đạt, Chính tả. Chỉ rõ điểm mạnh, điểm cần sửa kèm ví dụ sửa 1–2 câu tiêu biểu; không viết lại toàn bộ bài.',
      ].join('\n');
    case 'grammar_check':
      return [
        'Chế độ: Kiểm tra & sửa lỗi tiếng Anh.',
        'Chỉ ra các lỗi ngữ pháp, chính tả, dùng từ; đưa ra phiên bản đã sửa tự nhiên và giải thích ngắn gọn từng lỗi bằng tiếng Việt.',
      ].join('\n');
    case 'quiz_generate':
      return [
        'Chế độ: Tạo câu hỏi trắc nghiệm ôn tập.',
        'Tạo câu hỏi trắc nghiệm rõ ràng (A, B, C, D) phù hợp trình độ học sinh, kèm đáp án đúng và giải thích ngắn gọn cho từng câu (không bịa dữ kiện).',
      ].join('\n');
    case 'event_analysis':
      return [
        'Chế độ: Phân tích sự kiện lịch sử.',
        'Trình bày có cấu trúc rõ 5 phần: 1) Mốc thời gian & [Sự kiện] cốt lõi; 2) Bối cảnh & Nguyên nhân; 3) Diễn biến chính; 4) Kết quả; 5) [Nhận định] Ý nghĩa & Bài học lịch sử, kèm [Tư liệu] đối chiếu nếu có.',
      ].join('\n');
    case 'figure_role':
      return [
        'Chế độ: Giải thích vai trò nhân vật lịch sử.',
        'Phân tách rõ [Sự kiện] (tiểu sử ngắn, hành động/quyết sách chính gắn với mốc thời gian xác thực), [Tư liệu] liên quan, và [Nhận định] đánh giá vai trò – hạn chế lịch sử (nếu có).',
      ].join('\n');
    case 'period_compare':
      return [
        'Chế độ: So sánh thời kỳ, sự kiện hoặc phong trào lịch sử.',
        'Trình bày bằng bảng Markdown gồm các tiêu chí (Thời gian, Bối cảnh, Lực lượng/Lãnh đạo, Diễn biến/Hình thức, Kết quả, Ý nghĩa), sau đó nêu ngắn gọn Điểm tương đồng và Điểm khác biệt cốt lõi.',
      ].join('\n');
    case 'mindmap_timeline':
      return [
        'Chế độ: Tạo bảng tổng hợp, sơ đồ tư duy và dòng thời gian.',
        'Cung cấp: 1) Bảng tổng hợp từ khóa & số liệu trọng tâm; 2) Sơ đồ tư duy dạng phân cấp nhánh rõ ràng; 3) Tiến trình/dòng thời gian nếu có.',
      ].join('\n');
    case 'chart_analysis':
      return [
        'Chế độ: Phân tích bản đồ, Atlat, bảng số liệu và biểu đồ.',
        'Trình bày rõ: 1) Dạng biểu đồ / đối tượng bản đồ & đơn vị, mốc năm; 2) Nhận xét xu hướng tổng quát và chi tiết từng giai đoạn (có dẫn chứng số liệu từng năm); 3) Giải thích nguyên nhân và so sánh.',
      ].join('\n');
    case 'geo_calc':
      return [
        'Chế độ: Tính toán các chỉ số địa lý.',
        'Trình bày: 1) Công thức tính chuẩn; 2) Tóm tắt số liệu đầu vào theo năm và đơn vị; 3) Các bước tính toán chi tiết; 4) Kết quả cuối cùng kèm đơn vị và ý nghĩa.',
      ].join('\n');
    case 'phenomenon_analysis':
      return [
        'Chế độ: Phân tích nguyên nhân, đặc điểm và hệ quả của hiện tượng địa lý.',
        'Trình bày có cấu trúc: 1) Bản chất & Đặc điểm nhận diện; 2) Nguyên nhân hình thành (tự nhiên / kinh tế – xã hội); 3) Hệ quả & tác động thực tiễn.',
      ].join('\n');
    case 'exam_guide':
      return [
        'Chế độ: Hướng dẫn từng bước phương pháp làm bài thi Địa lý.',
        'Hướng dẫn rõ quy trình từng bước (đọc đề, khai thác Atlat, chọn dạng biểu đồ, tránh bẫy thường gặp) và tiêu chí chấm điểm.',
      ].join('\n');
    case 'tutor_chat':
    default:
      return 'Chế độ: Hỏi đáp gia sư học tập. Trả lời cô đọng, dễ hiểu, có cấu trúc rõ ràng.';
  }
}

export function buildSubjectAiSystemInstruction(
  subjectId: SubjectId,
  mode: SubjectAiMode,
  contextText?: string
): string {
  const profile = SUBJECT_AI_PROFILES[subjectId];
  const sections = [
    `[Vai trò & Môn học: ${profile.subjectName} — ${profile.appTitle}]`,
    profile.personaInstruction,
    describeModeInstruction(mode),
    'Lưu ý trung thực: Không tự bịa dữ kiện, số liệu hay trích dẫn; nếu đề bài/ảnh mờ hoặc thiếu dữ kiện, hãy nêu rõ dữ kiện còn thiếu để học sinh bổ sung.',
  ];

  if (contextText && contextText.trim()) {
    sections.push(`[Ngữ cảnh học tập do ứng dụng môn học cung cấp]\n${contextText.trim()}`);
  }

  return sections.join('\n\n');
}

export interface GeminiContentTurn {
  role: 'user' | 'model';
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
}

export function buildSubjectAiContents(req: ValidatedSubjectAiRequest): GeminiContentTurn[] {
  const turns: GeminiContentTurn[] = [];

  if (req.messages.length > 0) {
    for (const msg of req.messages) {
      turns.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }
  } else {
    const promptPieces: string[] = [];
    if (req.prompt) {
      promptPieces.push(req.prompt);
    } else if (req.image) {
      promptPieces.push('Hãy đọc nội dung trong ảnh đính kèm và hỗ trợ giải quyết theo đúng yêu cầu.');
    }
    if (req.previousSolution) {
      promptPieces.push(`[Lời giải / nội dung trước đó]\n${req.previousSolution}`);
    }
    turns.push({
      role: 'user',
      parts: [{ text: promptPieces.join('\n\n') }],
    });
  }

  if (req.image) {
    let lastUserIndex = -1;
    for (let i = turns.length - 1; i >= 0; i--) {
      if (turns[i].role === 'user') {
        lastUserIndex = i;
        break;
      }
    }
    if (lastUserIndex >= 0) {
      turns[lastUserIndex].parts.push({
        inlineData: {
          mimeType: req.image.mimeType,
          data: req.image.dataBase64,
        },
      });
    } else {
      turns.push({
        role: 'user',
        parts: [
          { text: 'Hãy đọc và phân tích ảnh đính kèm.' },
          {
            inlineData: {
              mimeType: req.image.mimeType,
              data: req.image.dataBase64,
            },
          },
        ],
      });
    }
  }

  return turns;
}

export function getSubjectAiPresets(subjectId: SubjectId): SubjectAiPreset[] {
  return SUBJECT_AI_PROFILES[subjectId].presets;
}

export interface SubjectBridgeContextPayload {
  subjectId: SubjectId;
  summary: string;
  topic?: string;
  activeTopic?: string;
  scoreSummary?: string;
  wrongCount?: number;
  view?: string;
}

export type SubjectBridgeMessage =
  | {
      type: 'subject:context';
      payload: SubjectBridgeContextPayload;
    }
  | {
      type: 'subject:open-ai';
      payload: {
        subjectId: SubjectId;
        mode?: SubjectAiMode;
        prompt?: string;
        contextText?: string;
        autoSend?: boolean;
      };
    }
  | {
      type: 'subject:sync-classes';
      payload: {
        subjectId: SubjectId;
        classNames: string[];
        source?: string;
      };
    };

export function parseSubjectBridgeMessage(data: unknown): SubjectBridgeMessage | null {
  if (!data || typeof data !== 'object') return null;
  const raw = data as Record<string, unknown>;
  if (raw.type === 'subject:context' && raw.payload && typeof raw.payload === 'object') {
    const p = raw.payload as Record<string, unknown>;
    if (isValidSubjectId(p.subjectId)) {
      return {
        type: 'subject:context',
        payload: {
          subjectId: p.subjectId,
          summary: String(p.summary || ''),
          topic: typeof p.topic === 'string' ? p.topic : undefined,
          activeTopic: typeof p.activeTopic === 'string' ? p.activeTopic : undefined,
          scoreSummary: typeof p.scoreSummary === 'string' ? p.scoreSummary : undefined,
          wrongCount: typeof p.wrongCount === 'number' ? p.wrongCount : undefined,
          view: typeof p.view === 'string' ? p.view : undefined,
        },
      };
    }
  }
  if (raw.type === 'subject:open-ai' && raw.payload && typeof raw.payload === 'object') {
    const p = raw.payload as Record<string, unknown>;
    if (isValidSubjectId(p.subjectId)) {
      return {
        type: 'subject:open-ai',
        payload: {
          subjectId: p.subjectId,
          mode: isValidSubjectAiMode(p.mode) ? p.mode : undefined,
          prompt: typeof p.prompt === 'string' ? p.prompt : undefined,
          contextText: typeof p.contextText === 'string' ? p.contextText : undefined,
          autoSend: Boolean(p.autoSend),
        },
      };
    }
  }
  if (raw.type === 'subject:sync-classes' && raw.payload && typeof raw.payload === 'object') {
    const p = raw.payload as Record<string, unknown>;
    if (isValidSubjectId(p.subjectId) && Array.isArray(p.classNames)) {
      const classNames = Array.from(
        new Set(p.classNames.map((c) => String(c || '').trim()).filter(Boolean))
      );
      if (classNames.length > 0) {
        return {
          type: 'subject:sync-classes',
          payload: {
            subjectId: p.subjectId,
            classNames,
            source: typeof p.source === 'string' ? p.source : undefined,
          },
        };
      }
    }
  }
  return null;
}

export function formatGeminiErrorMessage(status: number, rawMessage: string): string {
  let cleaned = rawMessage;
  for (let depth = 0; depth < 3; depth++) {
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed === 'object') {
        const errObj = parsed as { error?: { message?: string; code?: number } };
        if (typeof errObj.error?.message === 'string' && errObj.error.message !== cleaned) {
          cleaned = errObj.error.message;
          continue;
        }
      }
    } catch {
      // ignore parse error
    }
    break;
  }

  const lower = cleaned.toLowerCase();
  const shortDetail = cleaned.length > 140 ? `${cleaned.slice(0, 137)}...` : cleaned;
  if (status === 429 || lower.includes('quota') || lower.includes('rate limit') || lower.includes('resource_exhausted')) {
    return `Hệ thống AI đang tạm vượt hạn mức miễn phí (429 Quota Exceeded). Bạn có thể chờ ít phút rồi thử lại hoặc gắn khóa API trả phí trong Settings > Secrets.`;
  }
  if (status === 400 || status === 403 || lower.includes('leaked') || lower.includes('api key') || lower.includes('api_key_invalid') || lower.includes('permission_denied') || lower.includes('free tier')) {
    const codeLabel = status === 400 || status === 403 ? status : 403;
    if (lower.includes('free tier') || lower.includes('billing')) {
      return `Trợ lý AI cần khóa Gemini có bật thanh toán (Billing / Paid Tier) — mã lỗi ${codeLabel}. Vui lòng cấu hình GEMINI_API_KEY trả phí trong Settings > Secrets để mở khóa tính năng AI.`;
    }
    return `Lỗi API Key (${codeLabel}): Khóa API Gemini không hợp lệ hoặc đã bị vô hiệu hóa. Vui lòng kiểm tra lại GEMINI_API_KEY trong Settings > Secrets.${shortDetail ? ` (${shortDetail})` : ''}`;
  }
  if (status === 503 || status === 504 || lower.includes('high demand') || lower.includes('unavailable') || lower.includes('overloaded')) {
    return `Máy chủ Gemini đang quá tải lưu lượng tạm thời (${status}). Vui lòng chờ vài giây rồi nhấn gửi lại.`;
  }
  return `Lỗi gọi Trợ lý AI (${status}): ${shortDetail}`;
}

export type SubjectStructuredAction = 'generate_quiz' | 'generate_study_cards' | 'evaluate_writing';

export interface ValidatedSubjectStructuredRequest {
  action: SubjectStructuredAction;
  subjectId: SubjectId;
  topic: string;
  count: number;
  contextText: string;
  promptTitle: string;
  studentText: string;
  referenceText: string;
}

export function validateSubjectStructuredRequest(
  raw: unknown
): { ok: true; value: ValidatedSubjectStructuredRequest } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Dữ liệu yêu cầu có cấu trúc không hợp lệ.' };
  }
  const body = raw as Record<string, unknown>;
  const action = body.action;
  if (
    action !== 'generate_quiz' &&
    action !== 'generate_study_cards' &&
    action !== 'evaluate_writing'
  ) {
    return { ok: false, error: 'Hành động AI không hợp lệ (action).' };
  }
  if (!isValidSubjectId(body.subjectId)) {
    return { ok: false, error: 'Thiếu hoặc sai mã môn học (subjectId).' };
  }

  const topic = typeof body.topic === 'string' ? body.topic.trim().slice(0, 500) : '';
  const contextText =
    typeof body.contextText === 'string' ? body.contextText.trim().slice(0, MAX_CONTEXT_CHARS) : '';
  const promptTitle =
    typeof body.promptTitle === 'string' ? body.promptTitle.trim().slice(0, 500) : '';
  const studentText =
    typeof body.studentText === 'string' ? body.studentText.trim().slice(0, MAX_PROMPT_CHARS) : '';
  const referenceText =
    typeof body.referenceText === 'string' ? body.referenceText.trim().slice(0, MAX_PROMPT_CHARS) : '';

  const rawCount = Number(body.count);
  const count = Number.isFinite(rawCount) ? Math.min(8, Math.max(1, Math.round(rawCount))) : 4;

  if ((action === 'generate_quiz' || action === 'generate_study_cards') && !topic && !contextText) {
    return { ok: false, error: 'Vui lòng nhập chủ đề hoặc cung cấp ngữ cảnh để tạo nội dung.' };
  }
  if (action === 'evaluate_writing' && !studentText) {
    return { ok: false, error: 'Vui lòng nhập bài viết của học sinh để AI nhận xét.' };
  }

  return {
    ok: true,
    value: {
      action,
      subjectId: body.subjectId,
      topic,
      count,
      contextText,
      promptTitle,
      studentText,
      referenceText,
    },
  };
}


