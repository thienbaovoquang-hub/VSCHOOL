import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import vm from 'node:vm';
import {
  buildSubjectAiContents,
  buildSubjectAiSystemInstruction,
  formatGeminiErrorMessage,
  getSubjectAiPresets,
  SUBJECT_AI_PROFILES,
  VALID_SUBJECT_IDS,
  validateSubjectAiRequest,
  validateSubjectStructuredRequest,
} from './subjectAi.ts';

test('formatGeminiErrorMessage unwraps JSON API errors cleanly', () => {
  const keyMsg = formatGeminiErrorMessage(
    403,
    '{"error":{"code":403,"message":"Your API key was reported as leaked.","status":"PERMISSION_DENIED"}}'
  );
  assert.ok(keyMsg.includes('Settings > Secrets'));
  assert.ok(!keyMsg.includes('{"error"'));

  const billingMsg = formatGeminiErrorMessage(
    403,
    '{"error":{"code":403,"message":"The Gemini API free tier is not available for this project. Please set up billing.","status":"PERMISSION_DENIED"}}'
  );
  assert.ok(billingMsg.includes('Settings > Secrets'));
  assert.ok(billingMsg.includes('Paid Tier'));

  const rateMsg = formatGeminiErrorMessage(
    429,
    'Generate content requests per day limit exceeded on Free Tier. Quota exceeded.'
  );
  assert.ok(rateMsg.includes('429'));
  assert.ok(!rateMsg.includes('403'));

  const highDemandMsg = formatGeminiErrorMessage(
    503,
    JSON.stringify({
      error: {
        code: 503,
        message: JSON.stringify({
          error: { code: 503, message: 'This model is currently experiencing high demand.', status: 'UNAVAILABLE' },
        }),
      },
    })
  );
  assert.ok(highDemandMsg.includes('quá tải'));
  assert.ok(!highDemandMsg.includes('"status"'));
});

test('SUBJECT_AI_PROFILES covers all 7 active subjects with presets', () => {
  assert.deepEqual(VALID_SUBJECT_IDS, ['english', 'math', 'physics', 'chemistry', 'literature', 'history', 'geography']);
  for (const subjectId of VALID_SUBJECT_IDS) {
    const profile = SUBJECT_AI_PROFILES[subjectId];
    assert.ok(profile, `Missing profile for ${subjectId}`);
    assert.ok(profile.tutorTitle.length > 0);
    assert.ok(profile.personaInstruction.length > 20);
    const presets = getSubjectAiPresets(subjectId);
    assert.ok(presets.length >= 3, `Expected >= 3 presets for ${subjectId}`);
  }
});

test('validateSubjectAiRequest rejects invalid subjectId and empty input', () => {
  const badSubject = validateSubjectAiRequest({ subjectId: 'biology', prompt: 'Hello' });
  assert.equal(badSubject.ok, false);

  const emptyReq = validateSubjectAiRequest({ subjectId: 'math', prompt: '   ' });
  assert.equal(emptyReq.ok, false);
});

test('validateSubjectAiRequest accepts valid text and strips data URL prefix on image', () => {
  const result = validateSubjectAiRequest({
    subjectId: 'physics',
    mode: 'solve_step_by_step',
    prompt: 'Tính quãng đường rơi tự do trong 3 giây',
    image: {
      mimeType: 'image/jpg',
      dataBase64: 'data:image/png;base64,iVBORw0KGgo=',
    },
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.subjectId, 'physics');
    assert.equal(result.value.mode, 'solve_step_by_step');
    assert.equal(result.value.image?.mimeType, 'image/png');
    assert.equal(result.value.image?.dataBase64, 'iVBORw0KGgo=');
  }
});

test('validateSubjectAiRequest preserves wrong_answer_coach mode', () => {
  const result = validateSubjectAiRequest({
    subjectId: 'math',
    mode: 'wrong_answer_coach',
    prompt: 'Giải thích vì sao đáp án B đúng',
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.mode, 'wrong_answer_coach');
  }
  const sys = buildSubjectAiSystemInstruction('math', 'wrong_answer_coach');
  assert.ok(sys.includes('Giải thích lỗi sai'));
});

test('validateSubjectAiRequest rejects unsupported image mimeType and oversized image', () => {
  const badMime = validateSubjectAiRequest({
    subjectId: 'chemistry',
    prompt: 'Cân bằng giúp em',
    image: {
      mimeType: 'application/pdf',
      dataBase64: 'JVBERi0xLjQ=',
    },
  });
  assert.equal(badMime.ok, false);

  const hugeImage = validateSubjectAiRequest({
    subjectId: 'math',
    prompt: 'Giải ảnh',
    image: {
      mimeType: 'image/png',
      dataBase64: 'A'.repeat(8_000_005),
    },
  });
  assert.equal(hugeImage.ok, false);
});

test('validateSubjectAiRequest normalizes multi-turn conversation so first turn is user', () => {
  const result = validateSubjectAiRequest({
    subjectId: 'literature',
    messages: [
      { role: 'assistant', content: 'Xin chào' },
      { role: 'user', content: 'Phân tích bài thơ Tây Tiến' },
      { role: 'assistant', content: 'Bạn muốn tập trung vào khổ nào?' },
      { role: 'user', content: 'Khổ 1 ạ' },
      { role: 'user', content: 'Thêm khổ 2 nữa nhé' },
    ],
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.messages.length, 3);
    assert.equal(result.value.messages[0].role, 'user');
    assert.ok(result.value.messages[2].content.includes('Khổ 1 ạ'));
    assert.ok(result.value.messages[2].content.includes('Thêm khổ 2 nữa nhé'));
  }
});

test('buildSubjectAiSystemInstruction includes subject persona, mode rules, and context', () => {
  const mathSys = buildSubjectAiSystemInstruction('math', 'solve_step_by_step');
  assert.ok(mathSys.includes('MathBuddy'));
  assert.ok(mathSys.includes('$...$'));
  assert.ok(mathSys.includes('Giải bài tập từng bước'));

  const litSys = buildSubjectAiSystemInstruction(
    'literature',
    'writing_outline',
    'Tác phẩm: Vợ nhặt - Kim Lân'
  );
  assert.ok(litSys.includes('Văn Hiến'));
  assert.ok(litSys.includes('Vợ nhặt - Kim Lân'));
  assert.ok(litSys.includes('Hướng dẫn lập dàn ý'));

  const hisSys = buildSubjectAiSystemInstruction(
    'history',
    'event_analysis',
    'Chiến thắng Bạch Đằng năm 938'
  );
  assert.ok(hisSys.includes('Sử Ký'));
  assert.ok(hisSys.includes('[Sự kiện]'));
  assert.ok(hisSys.includes('Chiến thắng Bạch Đằng năm 938'));
  assert.ok(hisSys.includes('Phân tích sự kiện lịch sử'));

  const geoSys = buildSubjectAiSystemInstruction(
    'geography',
    'chart_analysis',
    'Bảng số liệu dân số 2020-2023'
  );
  assert.ok(geoSys.includes('Địa Lý'));
  assert.ok(geoSys.includes('KHÔNG tự tạo'));
  assert.ok(geoSys.includes('Bảng số liệu dân số 2020-2023'));
  assert.ok(geoSys.includes('Phân tích bản đồ, Atlat, bảng số liệu và biểu đồ'));
});

test('buildSubjectAiContents attaches inlineData image to the last user turn', () => {
  const parsed = validateSubjectAiRequest({
    subjectId: 'chemistry',
    messages: [
      { role: 'user', content: 'Câu 1 là gì?' },
      { role: 'assistant', content: 'Bạn gửi ảnh đề bài nhé.' },
      { role: 'user', content: 'Đây là ảnh đề bài.' },
    ],
    image: {
      mimeType: 'image/jpeg',
      dataBase64: '/9j/4AAQSkZJRg==',
    },
  });

  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    const contents = buildSubjectAiContents(parsed.value);
    assert.equal(contents.length, 3);
    assert.equal(contents[1].role, 'model');
    assert.equal(contents[2].parts.length, 2);
    assert.deepEqual(contents[2].parts[1], {
      inlineData: {
        mimeType: 'image/jpeg',
        data: '/9j/4AAQSkZJRg==',
      },
    });
  }
});

test('validateSubjectStructuredRequest validates quiz, cards, and essay actions', () => {
  const badAction = validateSubjectStructuredRequest({ action: 'unknown', subjectId: 'math', topic: 'Hàm số' });
  assert.equal(badAction.ok, false);

  const missingTopic = validateSubjectStructuredRequest({ action: 'generate_quiz', subjectId: 'english' });
  assert.equal(missingTopic.ok, false);

  const validQuiz = validateSubjectStructuredRequest({
    action: 'generate_quiz',
    subjectId: 'english',
    topic: 'Present Perfect',
    count: 15,
  });
  assert.equal(validQuiz.ok, true);
  if (validQuiz.ok) {
    assert.equal(validQuiz.value.count, 8);
    assert.equal(validQuiz.value.topic, 'Present Perfect');
  }

  const validChat = validateSubjectAiRequest({
    subjectId: 'physics',
    prompt: 'Giải thích định luật Ôm',
  });
  assert.equal(validChat.ok, true);

  const emptyEssay = validateSubjectStructuredRequest({
    action: 'evaluate_writing',
    subjectId: 'literature',
    studentText: '   ',
  });
  assert.equal(emptyEssay.ok, false);
});

test('all 7 integrated subject HTML files and subject-ai-bridge.js have valid JavaScript syntax', () => {
  const rootDir = path.resolve(process.cwd(), 'public/assets/aistudio');
  const bridgeSrc = fs.readFileSync(path.join(rootDir, 'subject-ai-bridge.js'), 'utf8');
  new vm.Script(bridgeSrc, { filename: 'subject-ai-bridge.js' });
  assert.ok(bridgeSrc.includes('/api/ai/subject-assist'), 'subject-ai-bridge.js should support non-stream fallback');
  assert.ok(bridgeSrc.includes('askTopic: askTopic'), 'subject-ai-bridge.js should expose askTopic modal helper');
  assert.ok(bridgeSrc.includes('notify: notify'), 'subject-ai-bridge.js should expose notify toast helper');
  assert.ok(bridgeSrc.includes('decoder.decode()'), 'subject-ai-bridge.js should flush UTF-8 decoder on stream completion');
  const legacyPattern = new RegExp('claud' + 'e|anthropic|mountProviderControls|getStoredAiProvider', 'i');
  assert.equal(legacyPattern.test(bridgeSrc), false, 'subject-ai-bridge.js must not contain legacy secondary provider references');

  const htmlFiles = [
    'anh_40c06e4c.html',
    'MathBuddy___H_c_To_n_4da2fcc3.html',
    'V_t_L__Cute_54063342.html',
    'ChemiLab___H_c_H_a_vui_d8d22fe2.html',
    '3gemini-code-1795352432020_cdd2c619.html',
    'SuKy_LichSu.html',
    'DiaLy_Atlat.html',
  ];

  for (const file of htmlFiles) {
    const html = fs.readFileSync(path.join(rootDir, file), 'utf8');
    assert.ok(html.includes('subject-ai-bridge.js'), `${file} must load subject-ai-bridge.js`);
    assert.equal(legacyPattern.test(html), false, `${file} must not contain legacy secondary provider references`);
    assert.equal(html.includes('data-ai-provider-host'), false, `${file} must not include removed provider host`);
    const scriptMatches = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
    assert.ok(scriptMatches.length > 0, `${file} must contain inline script`);
    scriptMatches.forEach((m, idx) => {
      const code = m[1];
      new vm.Script(code, { filename: `${file}#script-${idx}` });
      assert.ok(!/\b(?:window\.)?(?:alert|prompt)\s*\(/.test(code), `${file} must not use native alert() or prompt() inside sandboxed iframes`);
    });
    if (file === 'anh_40c06e4c.html') {
      assert.ok(html.includes('const chosen=q.o[Q.a]??\'Chưa chọn\';const ans=q.o[q.a]??\'\';'), 'explainEnQ must use q.o[q.a] for the correct answer');
    }
  }
});

test('server AI configuration uses valid fallback models and removes secondary provider', () => {
  const serverSrc = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf8');
  assert.ok(!serverSrc.includes('gemini-3.5-flash-lite'), 'server.ts must not reference invalid gemini-3.5-flash-lite model');
  assert.ok(serverSrc.includes('gemini-4-hydrogen'));
  assert.ok(serverSrc.includes('gemini-3.1-flash-lite'));
  assert.ok(serverSrc.includes("'/api/ai/status'"));
  assert.ok(serverSrc.includes('generateContentWithAiFallback'));
  const legacyPattern = new RegExp('claud' + 'e|anthropic|dualAiEngine', 'i');
  assert.equal(legacyPattern.test(serverSrc), false, 'server.ts must not contain removed AI provider references');
});

test('formatGeminiErrorMessage surfaces accurate status codes for invalid and leaked API keys', () => {
  const msg400 = formatGeminiErrorMessage(
    400,
    JSON.stringify({ error: { code: 400, message: 'API key not valid. Please pass a valid API key.' } })
  );
  assert.ok(msg400.includes('(400)'));
  assert.ok(msg400.includes('Settings > Secrets'));

  const msg403 = formatGeminiErrorMessage(403, 'Your API key was reported as leaked.');
  assert.ok(msg403.includes('(403)'));
  assert.ok(msg403.includes('Settings > Secrets'));
});

test('all subject AI helpers and assistants integrate real AI backend instead of offline stubs', () => {
  const rootDir = path.resolve(process.cwd(), 'public/assets/aistudio');

  const phyHtml = fs.readFileSync(path.join(rootDir, 'V_t_L__Cute_54063342.html'), 'utf8');
  assert.equal(phyHtml.includes('offline rule-based SI helper'), false, 'Physics should not use offline SI helper');
  assert.equal(phyHtml.includes('const RL=['), false, 'Physics should not contain hardcoded RL lookup table');
  assert.ok(phyHtml.includes('Trợ lý AI Vật Lý'));

  const chemHtml = fs.readFileSync(path.join(rootDir, 'ChemiLab___H_c_H_a_vui_d8d22fe2.html'), 'utf8');
  assert.equal(chemHtml.includes('Chưa nhận ra dạng bài'), false, 'Chemistry calculator should not use offline regex matcher');
  assert.ok(chemHtml.includes('Trợ lý tính toán AI'));
  assert.ok(chemHtml.includes('Trợ lý AI Hóa Học'));

  const litHtml = fs.readFileSync(path.join(rootDir, '3gemini-code-1795352432020_cdd2c619.html'), 'utf8');
  assert.ok(litHtml.includes('SchoolHubAI.evaluateWriting'), 'Literature checkEssay must call evaluateWriting');
  assert.ok(litHtml.includes("mode: 'writing_outline'"), 'Literature makeOutline must stream from AI');
  assert.ok(litHtml.includes('Trợ lý AI Ngữ văn'));

  const enHtml = fs.readFileSync(path.join(rootDir, 'anh_40c06e4c.html'), 'utf8');
  assert.ok(enHtml.includes('SchoolHubAI.generateCards'), 'English flashcards must support card generation');
  assert.ok(enHtml.includes('Trợ lý AI Tiếng Anh'));

  const mathHtml = fs.readFileSync(path.join(rootDir, 'MathBuddy___H_c_To_n_4da2fcc3.html'), 'utf8');
  assert.ok(mathHtml.includes('Trợ lý AI Giải Toán'));
  assert.ok(mathHtml.includes('wrong_answer_coach'));

  const hisHtml = fs.readFileSync(path.join(rootDir, 'SuKy_LichSu.html'), 'utf8');
  assert.ok(hisHtml.includes('Trợ lý AI Lịch sử'));

  const geoHtml = fs.readFileSync(path.join(rootDir, 'DiaLy_Atlat.html'), 'utf8');
  assert.ok(geoHtml.includes('Trợ lý AI Địa Lý'));
});




