import assert from 'node:assert/strict';
import { test } from 'node:test';
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

  const emptyEssay = validateSubjectStructuredRequest({
    action: 'evaluate_writing',
    subjectId: 'literature',
    studentText: '   ',
  });
  assert.equal(emptyEssay.ok, false);
});

